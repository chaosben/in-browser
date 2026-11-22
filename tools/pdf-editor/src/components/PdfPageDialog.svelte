<script lang="ts">
	// Which page of a PDF with several pages becomes the stamp or picture: its pages as small pictures (drawn when
	// they come into view), a click takes one.
	import Modal from '@in-browser/brand/Modal.svelte';
	import { read } from '@in-browser/files/fs.js';
	import { basename } from '@in-browser/files/path.js';
	import { openPdf } from '@in-browser/pdf/pdfjs.js';
	import { m } from '#lib/i18n/index.js';

	let { path, pages, ondone }: { path: string; pages: number; ondone: (page: number | null) => void } = $props();

	/** Longer side of a page's picture (CSS pixels) */
	const SIDE = 160;
	let failed = $state(false);

	// svelte-ignore state_referenced_locally
	const opened = read(path)
		.then(async (file) => openPdf(new Uint8Array(await file.arrayBuffer())))
		.catch((e) => {
			console.warn('[pdf-editor] pages', e);
			failed = true;
			return null;
		});
	$effect(() => () => void opened.then((doc) => doc?.loadingTask.destroy()));

	/** Draws page `index` once its tile is in view */
	const picture = (index: number) => (canvas: HTMLCanvasElement) => {
		let gone = false;
		const observer = new IntersectionObserver((entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			observer.disconnect();
			void (async () => {
				const doc = await opened;
				if (!doc || gone) return;
				const page = await doc.getPage(index + 1);
				const base = page.getViewport({ scale: 1 });
				const viewport = page.getViewport({ scale: (SIDE * (window.devicePixelRatio || 1)) / Math.max(base.width, base.height) });
				canvas.width = Math.max(1, Math.round(viewport.width));
				canvas.height = Math.max(1, Math.round(viewport.height));
				const canvasContext = canvas.getContext('2d');
				if (canvasContext && !gone) await page.render({ canvas: null, canvasContext, viewport }).promise;
			})().catch((e) => console.warn('[pdf-editor] page', e));
		});
		observer.observe(canvas);
		return () => {
			gone = true;
			observer.disconnect();
		};
	};
</script>

<Modal onclose={() => ondone(null)} labelledby="pdf-page-title">
	<div class="modal-box flex max-h-[85dvh] max-w-2xl flex-col gap-3">
		<h3 id="pdf-page-title" class="flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--picture-as-pdf-outline] size-6" aria-hidden="true"></span>
			{m.stamps.pageTitle}
		</h3>
		<p class="text-sm opacity-70">{m.stamps.pageHint(basename(path), pages)}</p>
		{#if failed}
			<p role="alert" class="text-error text-sm">{m.stamps.loadFailed}</p>
		{/if}
		<ul class="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2 overflow-y-auto p-1">
			{#each { length: pages }, index (index)}
				<li>
					<button class="hover:bg-selection/20 border-base-300 flex w-full flex-col items-center gap-1 rounded border p-2" onclick={() => ondone(index)} title={m.stamps.usePage(index + 1)}>
						<!-- Paper is a document color: white, whatever the theme -->
						<canvas class="h-40 max-w-full rounded-sm bg-white object-contain shadow-sm" {@attach picture(index)}></canvas>
						<span class="text-xs tabular-nums">{m.attach.onPage(index + 1)}</span>
					</button>
				</li>
			{/each}
		</ul>
		<div class="modal-action mt-0">
			<button class="btn btn-ghost" onclick={() => ondone(null)}>{m.common.cancel}</button>
		</div>
	</div>
</Modal>
