<script lang="ts">
	// The drawing surface of a notebook: canvases of the stage plus the input pipeline. Svelte only sets it up; while
	// drawing, nothing here is reactive (see `render/stage.ts`, `input/controller.ts`).
	import { untrack } from 'svelte';
	import { InputController, type EraserMode } from '#lib/input/controller.js';
	import { Selection } from '#lib/input/selection.svelte.js';
	import { ShapeSuggestion } from '#lib/input/suggestion.svelte.js';
	import type { NotebookDoc } from '#lib/model/notebook.svelte.js';
	import { tools } from '#lib/model/tools.svelte.js';
	import { Stage } from '#lib/render/stage.js';

	interface Props {
		doc: NotebookDoc;
		/** The stage is ready (zoom, current page …), with the selection and the shape suggestion */
		onready: (stage: Stage, selection: Selection, suggestion: ShapeSuggestion) => void;
		/** View moved or zoomed (at most once per frame) */
		onview: () => void;
		/** Any press on the surface (closes open panels) */
		onpress: () => void;
	}

	let { doc, onready, onview, onpress }: Props = $props();

	let root = $state<HTMLDivElement>();
	let base = $state<HTMLCanvasElement>();
	let live = $state<HTMLCanvasElement>();
	let marker = $state<HTMLCanvasElement>();
	let overlay = $state<HTMLCanvasElement>();
	let ghost = $state<HTMLCanvasElement>();
	let cursor = $state<HTMLDivElement>();

	$effect(() => {
		if (!root || !base || !live || !marker || !ghost || !overlay || !cursor) return;
		const notebook = doc;
		const elements = { root, base, live, marker, ghost, overlay, cursor };
		return untrack(() => {
			const stage = new Stage(elements, (id) => notebook.scene(id), (id) => void notebook.load(id), notebook.backgrounds);
			const selection = new Selection(stage, notebook);
			const suggestion = new ShapeSuggestion(stage, notebook);
			notebook.listener = {
				pages: (pages) => {
					stage.setPages(pages);
					selection.clear();
				},
				content: (id) => {
					stage.contentChanged(id);
					selection.refresh();
					suggestion.updateRect();
				},
				stroke: (id, scene, stroke) => stage.committed(id, scene, stroke),
				region: (id, box) => stage.regionChanged(id, box),
				background: () => stage.backgroundReady()
			};
			stage.setPages(notebook.pages);
			let viewFrame = 0;
			stage.onview = () => {
				if (!viewFrame)
					viewFrame = requestAnimationFrame(() => {
						viewFrame = 0;
						selection.updateRect();
						suggestion.updateRect();
						onview();
					});
			};

			const input = new InputController(elements.root, stage, {
				tool: () => tools.state(),
				commit: (s) => notebook.addStroke(s.page, s),
				commitShape: (page, fit, color, size, style) => notebook.addShape(page, fit, color, size, style),
				suggest: (s) => suggestion.show(s),
				erase: (sx, sy, radius, mode) => erase(sx, sy, radius, mode),
				eraseEnd: () => {
					lastErase = null;
					notebook.eraseEnd();
				},
				selection,
				hover: () => (tools.penHover = true)
			});
			// The eraser follows its path in steps of half its radius (events can be far apart or very dense)
			let lastErase: { x: number; y: number } | null = null;
			function erase(sx: number, sy: number, radius: number, mode: EraserMode) {
				const from = lastErase ?? { x: sx, y: sy };
				const dist = Math.hypot(sx - from.x, sy - from.y);
				const step = Math.max(1, radius / 2);
				if (lastErase && dist < step) return;
				const n = Math.max(1, Math.ceil(dist / step));
				for (let i = lastErase ? 1 : 0; i <= n; i++) {
					const x = from.x + ((sx - from.x) * i) / n;
					const y = from.y + ((sy - from.y) * i) / n;
					const hit = stage.strokesAt(x, y, radius);
					if (!hit || !hit.strokes.length) continue;
					if (mode === 'stroke') notebook.erase(hit.page, hit.strokes);
					else {
						const [px, py] = stage.toPage(hit.page, x, y);
						notebook.erasePixels(hit.page, hit.strokes, px, py, radius / stage.view.zoom);
					}
				}
				lastErase = { x: sx, y: sy };
			}

			const detach = input.attach();
			const press = () => onpress();
			elements.root.addEventListener('pointerdown', press);

			const resize = () => {
				const rect = elements.root.getBoundingClientRect();
				stage.resize(rect.width, rect.height, window.devicePixelRatio || 1);
			};
			const observer = new ResizeObserver(resize);
			observer.observe(elements.root);
			// Moving the window to a screen with another pixel density
			window.addEventListener('resize', resize);
			const scroll = () => stage.updateOrigin();
			window.addEventListener('scroll', scroll, { passive: true, capture: true });
			// Theme switch (system or the switch in the header): the desk color around the pages follows
			const dark = matchMedia('(prefers-color-scheme: dark)');
			const theme = () => requestAnimationFrame(() => stage.themeChanged());
			dark.addEventListener('change', theme);
			const themeObserver = new MutationObserver(theme);
			themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

			resize();
			onready(stage, selection, suggestion);
			return () => {
				detach();
				elements.root.removeEventListener('pointerdown', press);
				observer.disconnect();
				window.removeEventListener('resize', resize);
				window.removeEventListener('scroll', scroll, { capture: true });
				dark.removeEventListener('change', theme);
				themeObserver.disconnect();
				cancelAnimationFrame(viewFrame);
				selection.clear();
				suggestion.clear();
				notebook.listener = null;
				stage.destroy();
			};
		});
	});
</script>

<!-- No browser gestures, selection, magnifier or callout on the surface (iOS needs the prefixed properties) -->
<div
	bind:this={root}
	class="bg-base-200 relative size-full touch-none overflow-hidden select-none"
	style="-webkit-user-select: none; -webkit-touch-callout: none"
	data-testid="surface"
>
	<canvas bind:this={base} class="absolute inset-0 size-full"></canvas>
	<!-- Opaque low-latency layer: only visible while a pen stroke is drawn -->
	<canvas bind:this={live} class="pointer-events-none invisible absolute inset-0 size-full"></canvas>
	<!-- Highlighter strokes: painted opaque, see-through as a whole (overlaps don't darken) -->
	<canvas bind:this={marker} class="pointer-events-none absolute inset-0 size-full opacity-35 mix-blend-multiply"></canvas>
	<canvas bind:this={ghost} class="pointer-events-none absolute inset-0 size-full"></canvas>
	<!-- Lasso, selection frame and dragged strokes, laser pointer -->
	<canvas bind:this={overlay} class="pointer-events-none absolute inset-0 size-full"></canvas>
	<!-- Brush/eraser preview over the paper (a document color, so fixed contrast colors instead of theme colors) -->
	<div
		bind:this={cursor}
		class="pointer-events-none absolute top-0 left-0 hidden rounded-full"
		style="border: 1px solid rgb(0 0 0 / 0.55); box-shadow: 0 0 0 1px rgb(255 255 255 / 0.8)"
		aria-hidden="true"
	></div>
</div>
