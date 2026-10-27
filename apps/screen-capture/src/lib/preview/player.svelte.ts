import { untrack } from 'svelte';
import type { Clip, Project, Rect } from '#lib/project/types.js';
import { renderFrame, type Frame } from '#lib/render/compositor.js';
import { frameArea } from '#lib/media/content.js';
import { onPictureLoaded } from '#lib/render/images.svelte.js';
import { mediaFile } from '#lib/storage/opfs.js';
import { clipsAt, clipsOf, duration, sourceTime, trackState } from '#lib/timeline/ops.js';
import { m } from '#lib/i18n/index.js';
import { toast } from '#lib/ui/toast.svelte.js';
import { errorMessage } from '#lib/util/format.js';

/** How long before a clip starts its video is already seeked to its start point. */
const PRELOAD = 1;
/** A playing video is resynced once it drifts this far (seconds) from the master clock. */
const MAX_DRIFT = 0.25;

/**
 * Preview playback: a master clock (`performance.now()`) drives the time, gaps simply play through.
 * Every currently visible clip gets a (detached) `<video>` from a per-source pool that supplies picture
 * and sound and follows the clock; drawing happens in a rAF loop via the compositor. The browser mixes the
 * audio of simultaneous clips.
 */
export class Player {
	time = $state(0);
	playing = $state(false);
	/** Forced view, e.g. full frame while editing a zoom segment. */
	forcedView = $state<Rect | null>(null);

	#urls = new Map<string, string>();
	/** Free video elements per source */
	#pool = new Map<string, HTMLVideoElement[]>();
	/** Video element per clip (visible clips and clips about to start) */
	#assigned = new Map<string, { sourceId: string; video: HTMLVideoElement }>();
	/** Last picture of each video, drawn while it seeks (instead of flashing the background) */
	#stills = new WeakMap<HTMLVideoElement, HTMLCanvasElement>();
	/** Seek target that waits for the running seek of a video, so fast scrubbing does not starve it */
	#pendingSeek = new WeakMap<HTMLVideoElement, number>();
	#canvas: HTMLCanvasElement | null = null;
	/** `performance.now()` at timeline time 0 (during playback) */
	#clockOrigin = 0;
	#raf = 0;

	constructor(private project: () => Project) {}

	get duration() {
		return duration(this.project().timeline);
	}

	/** Creates a video element for new sources (and disposes of removed ones), waits until ready to play. */
	async syncSources() {
		const { id, sources } = this.project();
		for (const sourceId of this.#urls.keys()) {
			if (sources.some((s) => s.id === sourceId)) continue;
			for (const [clipId, a] of this.#assigned) if (a.sourceId === sourceId) this.#release(clipId);
			this.#pool.get(sourceId)?.forEach(unload);
			this.#pool.delete(sourceId);
			URL.revokeObjectURL(this.#urls.get(sourceId)!);
			this.#urls.delete(sourceId);
		}
		await Promise.all(
			sources
				.filter((s) => !this.#urls.has(s.id))
				.map(async (s) => {
					const url = URL.createObjectURL(await mediaFile(id, s.file));
					this.#urls.set(s.id, url);
					const video = this.#createVideo(url);
					this.#pool.set(s.id, [video]);
					await new Promise<void>((resolve, reject) => {
						video.addEventListener('loadeddata', () => resolve(), { once: true });
						video.addEventListener('error', () => reject(new Error(m.errors.cannotPlay(s.name))), {
							once: true
						});
					});
				})
		);
	}

	attach(canvas: HTMLCanvasElement) {
		this.#canvas = canvas;
		// Fonts of text annotations load on first use – draw again once they are there
		document.fonts.removeEventListener('loadingdone', this.#redrawLater);
		document.fonts.addEventListener('loadingdone', this.#redrawLater);
		// Likewise own images and icons
		this.#unsubscribePictures?.();
		this.#unsubscribePictures = onPictureLoaded(this.#redrawLater);
		// Called from a Svelte attachment: without untrack the attachment would subscribe to the values read
		// here (playing, time, …), rerun on every change and stop playback immediately.
		untrack(() => this.refresh());
	}

	/** Call after changes to the clips: stops playback and redraws. */
	refresh() {
		if (this.playing) this.pause();
		this.seek(this.time);
	}

	seek(t: number) {
		const wasPlaying = this.playing;
		if (wasPlaying) this.pause();
		this.time = Math.min(Math.max(t, 0), this.duration);
		this.#sync(this.time, false);
		this.redraw();
		if (wasPlaying) this.play();
	}

	play() {
		if (this.playing) return;
		const total = this.duration;
		if (!(total > 0) || !Number.isFinite(total)) {
			return this.#fail(new Error(m.editor.nothingToPlay(String(total))));
		}
		if (this.time >= total - 0.01) this.time = 0;
		this.playing = true;
		this.#clockOrigin = performance.now() - this.time * 1000;
		this.#sync(this.time, true);
		this.#raf = requestAnimationFrame(this.#tick);
	}

	/** Aborts playback and shows the reason (instead of silently stalling). */
	#fail(e: unknown) {
		this.pause();
		console.error('[Player]', e);
		// For DOMExceptions show name and original text – errorMessage's short form hides the reason here
		const reason = e instanceof DOMException ? `${e.name}: ${e.message}` : errorMessage(e);
		toast(m.editor.playbackFailed(reason), 'error', 10000);
	}

	pause() {
		this.playing = false;
		cancelAnimationFrame(this.#raf);
		for (const { video } of this.#assigned.values()) video.pause();
		// Annotations are drawn without fading again
		this.redraw();
	}

	toggle() {
		if (this.playing) this.pause();
		else this.play();
	}

	#tick = () => {
		if (!this.playing) return;
		const total = this.duration;
		const t = (performance.now() - this.#clockOrigin) / 1000;
		if (t >= total) {
			this.pause();
			this.time = total;
		} else {
			this.time = t;
			this.#sync(t, true);
		}
		this.redraw();
		if (this.playing) this.#raf = requestAnimationFrame(this.#tick);
	};

	/** Seeks the videos of all visible (and about-to-start) clips to time `t`. */
	#sync(t: number, playing: boolean) {
		const { timeline } = this.project();
		const active = clipsAt(timeline, t);
		const upcoming = playing
			? clipsOf(timeline).filter((c) => c.type === 'video' && c.start > t && c.start <= t + PRELOAD)
			: [];
		const keep = new Set([...active, ...upcoming].map((c) => c.id));
		for (const clipId of this.#assigned.keys()) if (!keep.has(clipId)) this.#release(clipId);

		for (const clip of active) {
			const video = this.#video(clip);
			if (!video) continue;
			const target = sourceTime(clip, t);
			const track = trackState(timeline, clip.track);
			video.volume = clip.type === 'video' && !track.muted && !track.hidden ? (clip.volume ?? 1) : 0;
			if (!playing || clip.type === 'freeze') {
				video.pause();
				this.#seekVideo(video, target, 0.001);
			} else if (video.paused) {
				this.#seekVideo(video, target, 0.05);
				video.play().catch((e) => {
					// Abort via pause() (e.g. clip end) is not an error
					if (!(e instanceof DOMException && e.name === 'AbortError')) this.#fail(e);
				});
			} else if (!video.seeking && Math.abs(video.currentTime - target) > MAX_DRIFT) {
				this.#seekVideo(video, target, 0);
			}
		}
		// Seek clips about to start to their start point in advance
		for (const clip of upcoming) {
			const video = this.#video(clip);
			const target = sourceTime(clip, clip.start);
			if (video && video.paused) this.#seekVideo(video, target, 0.05);
		}
	}

	/**
	 * Seeks a video unless it is within `tolerance` of `target`. While a seek is running, only the newest target is
	 * remembered and applied on `seeked`; the current picture is kept for drawing until the new one is there.
	 */
	#seekVideo(video: HTMLVideoElement, target: number, tolerance: number) {
		// While seeking, currentTime already reports the target of the running seek
		const off = Math.abs(video.currentTime - target) > tolerance;
		if (video.seeking) {
			if (off) this.#pendingSeek.set(video, target);
			else this.#pendingSeek.delete(video);
			return;
		}
		if (!off) return;
		this.#keepStill(video);
		video.currentTime = target;
	}

	#keepStill(video: HTMLVideoElement) {
		if (video.readyState < 2 || !video.videoWidth) return;
		let still = this.#stills.get(video);
		if (!still) {
			still = document.createElement('canvas');
			this.#stills.set(video, still);
		}
		if (still.width !== video.videoWidth || still.height !== video.videoHeight) {
			still.width = video.videoWidth;
			still.height = video.videoHeight;
		}
		still.getContext('2d')?.drawImage(video, 0, 0);
	}

	#createVideo(url: string) {
		const video = createVideo(url);
		video.addEventListener('seeked', () => {
			this.redraw();
			const next = this.#pendingSeek.get(video);
			this.#pendingSeek.delete(video);
			if (next !== undefined) this.#seekVideo(video, next, 0.001);
		});
		return video;
	}

	/** Video element for a clip (from the source's pool, created if needed) */
	#video(clip: Clip): HTMLVideoElement | null {
		const assigned = this.#assigned.get(clip.id);
		if (assigned) return assigned.video;
		const url = this.#urls.get(clip.sourceId);
		if (!url) return null;
		let video = this.#pool.get(clip.sourceId)?.pop();
		if (!video) {
			// Second simultaneous clip of the same source: own element, draw once loaded
			video = this.#createVideo(url);
			video.addEventListener('loadeddata', () => this.redraw(), { once: true });
		}
		this.#assigned.set(clip.id, { sourceId: clip.sourceId, video });
		return video;
	}

	#release(clipId: string) {
		const assigned = this.#assigned.get(clipId);
		if (!assigned) return;
		assigned.video.pause();
		this.#pendingSeek.delete(assigned.video);
		this.#assigned.delete(clipId);
		const free = this.#pool.get(assigned.sourceId);
		if (free) free.push(assigned.video);
		else unload(assigned.video);
	}

	/** Redraws the current state (e.g. after changes to annotations or zoom). */
	redraw() {
		const canvas = this.#canvas;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) return;
		const project = this.project();
		const frames = new Map<string, Frame>();
		for (const clip of clipsAt(project.timeline, this.time)) {
			const video = this.#assigned.get(clip.id)?.video;
			if (!video) continue;
			const source = project.sources.find((s) => s.id === clip.sourceId);
			const t = sourceTime(clip, this.time);
			const still = video.seeking ? this.#stills.get(video) : undefined;
			const anchor = clip.anchor;
			if (still) frames.set(clip.id, { image: still, anchor, ...frameArea(source, t, still.width, still.height) });
			else if (video.readyState >= 2) {
				frames.set(clip.id, { image: video, anchor, ...frameArea(source, t, video.videoWidth, video.videoHeight) });
			}
		}
		renderFrame(ctx, canvas.width, canvas.height, {
			t: this.time,
			timeline: project.timeline,
			background: project.background,
			frames,
			view: this.forcedView ?? undefined,
			// Paused: everything under the playhead is visible, also at the very start of a fade-in
			fades: this.playing
		});
	}

	#redrawLater = () => this.redraw();
	#unsubscribePictures: (() => void) | undefined;

	destroy() {
		document.fonts.removeEventListener('loadingdone', this.#redrawLater);
		this.#unsubscribePictures?.();
		this.pause();
		for (const { video } of this.#assigned.values()) unload(video);
		for (const videos of this.#pool.values()) videos.forEach(unload);
		this.#assigned.clear();
		this.#pool.clear();
		this.#urls.forEach((u) => URL.revokeObjectURL(u));
		this.#urls.clear();
	}
}

function createVideo(url: string) {
	const video = document.createElement('video');
	video.preload = 'auto';
	video.playsInline = true;
	video.src = url;
	return video;
}

function unload(video: HTMLVideoElement) {
	video.pause();
	video.removeAttribute('src');
	video.load();
}
