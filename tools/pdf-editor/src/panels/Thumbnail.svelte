<script lang="ts">
	// A small picture of a page: the page's preview (rendered once for the surface too) with what lies on it (drawn
	// items, comments), drawn when it comes into view and again after changes.
	import { sourceOf, type PdfDocument, type PdfPage } from '#lib/model/document.svelte.js';

	let { doc, page, width }: { doc: PdfDocument; page: PdfPage; width: number } = $props();

	let canvas = $state<HTMLCanvasElement>();
	let visible = $state(false);
	let drawn = $state(false);

	$effect(() => {
		if (!canvas) return;
		const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { rootMargin: '200px' });
		observer.observe(canvas);
		return () => observer.disconnect();
	});

	// The page looks different (layers, rotation, items): draw again
	$effect(() => {
		void page.rev;
		void doc.changes;
		drawn = false;
	});

	$effect(() => {
		if (!visible || drawn || !canvas) return;
		void doc.rendered;
		// A blank page: paper in its color
		const bitmap = page.number ? doc.renders.preview(sourceOf(page), page.number, page.background) : null;
		if (page.number && !bitmap) return;
		const dpr = devicePixelRatio || 1;
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round((width * page.h) / page.w) * dpr;
		const ctx = canvas.getContext('2d');
		if (ctx) {
			if (bitmap) ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
			else {
				ctx.fillStyle = page.background ?? '#ffffff';
				ctx.fillRect(0, 0, canvas.width, canvas.height);
			}
			const scene = doc.scene(page.id);
			if (scene?.items.length) {
				ctx.setTransform(canvas.width / page.w, 0, 0, canvas.height / page.h, 0, 0);
				scene.draw(ctx, scene.items);
				ctx.setTransform(1, 0, 0, 1, 0, 0);
			}
		}
		// A picture kept from before a change (a filled-in field, edited content): drawn again when the new one arrives
		drawn = !page.number || doc.renders.previewFresh(sourceOf(page), page.number, page.background);
	});
</script>

<canvas bind:this={canvas} class="block bg-white shadow-sm" style="width: {width}px; height: {(width * page.h) / page.w}px" aria-hidden="true"></canvas>
