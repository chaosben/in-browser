<script lang="ts">
	// The slides window (`/pdf-editor/show?path=…&session=…`): the PDF shown to the audience, opened only for reading
	// (no lock, never saved). Its presenter view finds it by the presentation's name; it holds where the presentation
	// stands and keeps it for a reload. Without a presenter it still goes on with keys and clicks. A version of the
	// file saved meanwhile (in the editor, or arriving through a share's sync) is read anew, the place stays.
	import { page as route } from '$app/state';
	import { watch } from '@in-browser/files/fs.js';
	import { normalize } from '@in-browser/files/path.js';
	import { m } from '#lib/i18n/index.js';
	import { PdfDocument } from '#lib/model/document.svelte.js';
	import { DisplayController } from '#lib/show/display.svelte.js';
	import { displayLink } from '#lib/show/local.js';
	import { offerRemote } from '#lib/show/remote-link.js';
	import Display from '#lib/show/Display.svelte';

	let doc = $state<PdfDocument | null>(null);
	let display = $state<DisplayController | null>(null);
	let error = $state<string | null>(null);
	let ended = $state(false);

	/** Where a reload of this window starts (kept for the window only) */
	const placeKey = (session: string) => `pdf-editor:show:${session}`;

	function savedPlace(session: string | null): { page: number; step: number } | null {
		if (!session) return null;
		try {
			const saved = JSON.parse(sessionStorage.getItem(placeKey(session)) ?? 'null') as { page?: unknown; step?: unknown } | null;
			return saved && typeof saved.page === 'number' && typeof saved.step === 'number' ? { page: saved.page, step: saved.step } : null;
		} catch {
			return null;
		}
	}

	/** The comments become the editor's items once the file has been read for writing – until then the slides would
	 * show all of them at once */
	const checked = (d: PdfDocument) =>
		new Promise<void>((done) => {
			const look = () => (d.editable !== 'checking' ? done() : setTimeout(look, 40));
			look();
		});

	$effect(() => {
		const params = route.url.searchParams;
		const param = params.get('path');
		const session = params.get('session');
		if (!param) return;
		const path = normalize(param);
		const start = savedPlace(session) ?? { page: Number(params.get('page')) || 0, step: Number(params.get('step')) || 0 };
		let disposed = false;
		let opened: PdfDocument | null = null;
		let shown: DisplayController | null = null;
		let link: ReturnType<typeof displayLink> | null = null;
		let stopOffer: (() => void) | null = null;
		let stopWatch: (() => void) | null = null;

		(async () => {
			try {
				const next = await PdfDocument.open(path);
				if (disposed) return next.destroy();
				opened = next;
				await checked(next);
				if (disposed) return;
				const controller = new DisplayController(
					() => {
						const now = opened ?? next;
						return { pages: now.pages.length, steps: (i) => now.stepsOf(now.pages[i]?.id ?? '') };
					},
					start,
					() => (opened ?? next).fingerprint
				);
				controller.onplace = (state) => {
					if (!session) return;
					try {
						sessionStorage.setItem(placeKey(session), JSON.stringify({ page: state.page, step: state.step }));
					} catch {
						// A reload starts where the presenter view is
					}
				};
				controller.onend = finish;
				if (session) {
					link = displayLink(session);
					controller.attach(link);
				}
				// Remote controls on the phone sharing it, or on this user's other devices
				stopOffer = offerRemote(controller, path, next.name);
				shown = controller;
				doc = next;
				display = controller;
				// Another version of the file: shown as soon as it is read (what is on the screen stays until then)
				let reading = false;
				const reopen = async () => {
					if (reading || disposed) return;
					reading = true;
					try {
						const newer = await PdfDocument.open(path);
						await checked(newer);
						if (disposed) return newer.destroy();
						const old = opened;
						opened = newer;
						doc = newer;
						controller.reloaded();
						old?.destroy();
					} catch (e) {
						// Half written or gone: the slides stay as they are, the next change tries again
						console.warn('[pdf-editor] show: reload', e);
					} finally {
						reading = false;
					}
				};
				stopWatch = watch((paths) => void opened?.filesChanged(paths, () => void reopen()));
			} catch (e) {
				console.error('[pdf-editor] show', e);
				error = m.show.failed;
			}
		})();

		// Closed or reloaded: the presenter view hears it at once
		const leave = () => shown?.leave();
		addEventListener('pagehide', leave);
		return () => {
			disposed = true;
			removeEventListener('pagehide', leave);
			stopOffer?.();
			stopWatch?.();
			shown?.leave();
			link?.close();
			display = null;
			doc = null;
			opened?.destroy();
		};
	});

	/** The presentation ends here: the window closes (a window the browser won't close says so) */
	function finish() {
		display?.leave();
		ended = true;
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		window.close();
	}
</script>

{#if doc && display && !ended}
	<Display {doc} {display} onexit={finish} hint={route.url.searchParams.get('session') ? m.show.moveHint : undefined} />
{:else}
	<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black p-6 text-center text-white">
		{#if ended}
			<p>{m.show.ended}</p>
		{:else if error}
			<p role="alert">{error}</p>
		{:else}
			<p class="flex items-center gap-2"><span class="loading loading-spinner" aria-hidden="true"></span>{m.show.loading}</p>
		{/if}
	</div>
{/if}
