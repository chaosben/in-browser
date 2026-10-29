<script lang="ts">
	import { peaks, thumbnails, type Peaks, type Thumbnails } from '#lib/media/visuals.js';
	import type { Clip, Source } from '#lib/project/types.js';
	import { clipDuration } from '#lib/timeline/ops.js';

	interface Props {
		projectId: string;
		source: Source;
		clip: Clip;
		/** Width in CSS pixels */
		width: number;
		height: number;
	}

	let { projectId, source, clip, width, height }: Props = $props();

	// Very wide clips (strong zoom) are drawn squashed to save memory.
	const MAX_WIDTH = 8192;

	function draw(canvas: HTMLCanvasElement, clip: Clip, width: number, height: number) {
		const dpr = window.devicePixelRatio || 1;
		const w = Math.max(1, Math.min(Math.round(width * dpr), MAX_WIDTH));
		const h = Math.max(1, Math.round(height * dpr));
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		let cancelled = false;
		const length = clipDuration(clip);
		const timeAt = (x: number) => (clip.type === 'freeze' ? clip.at : clip.in + (x / w) * length);

		// Thumbnails and waveform arrive independently; redraw everything on each arrival
		// so the waveform is never covered by thumbnails loaded later.
		let thumbs: Thumbnails | null = null;
		let wave: Peaks | null = null;

		function paint() {
			if (cancelled) return;
			ctx!.clearRect(0, 0, w, h);
			if (thumbs) {
				const tileW = h * thumbs.aspect;
				for (let x = 0; x < w; x += tileW) {
					const index = Math.min(Math.round(timeAt(x + tileW / 2) / thumbs.interval), thumbs.images.length - 1);
					ctx!.drawImage(thumbs.images[Math.max(index, 0)], x, 0, tileW, h);
				}
			}
			if (wave) {
				// Dark band at the bottom with light bars on it – readable on light and dark images alike.
				// Audio-only clips use the full height. The height follows the clip's volume.
				const band = source.hasVideo ? Math.round(h * 0.35) : h;
				const volume = clip.type === 'video' ? (clip.volume ?? 1) : 1;
				ctx!.fillStyle = source.hasVideo ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.3)';
				ctx!.fillRect(0, h - band, w, band);
				ctx!.fillStyle = 'rgba(255, 255, 255, 0.9)';
				const base = h - 1;
				const maxBar = band - 2;
				for (let x = 0; x < w; x++) {
					const from = Math.floor(timeAt(x) * wave.rate);
					const to = Math.max(from + 1, Math.floor(timeAt(x + 1) * wave.rate));
					let peak = 0;
					for (let i = from; i < to && i < wave.data.length; i++) peak = Math.max(peak, wave.data[i]);
					const bar = Math.max(peak * volume * maxBar, 0.5);
					ctx!.fillRect(x, base - bar, 1, bar);
				}
			}
		}

		thumbnails(projectId, source).then((t) => {
			thumbs = t;
			paint();
		});
		// Stills are silent – no waveform
		if (clip.type === 'video') {
			peaks(projectId, source).then((p) => {
				wave = p;
				paint();
			});
		}
		return () => (cancelled = true);
	}
</script>

<canvas
	class="pointer-events-none absolute inset-0 h-full w-full"
	{@attach (canvas) => draw(canvas, clip, width, height)}
></canvas>
