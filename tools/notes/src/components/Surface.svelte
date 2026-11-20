<script lang="ts">
	// The drawing surface of a notebook: canvases of the stage plus the input pipeline. Svelte only sets it up; while
	// drawing, nothing here is reactive (see `@in-browser/ink/render/stage.ts`, `input/controller.ts`).
	import { untrack } from 'svelte';
	import { InputController, type EraserMode } from '@in-browser/ink/input/controller.js';
	import { Selection } from '@in-browser/ink/input/selection.svelte.js';
	import { ShapeSuggestion } from '@in-browser/ink/input/suggestion.svelte.js';
	import type { NotebookDoc } from '#lib/model/notebook.svelte.js';
	import { tools } from '#lib/model/tools.svelte.js';
	import { inkKit } from '@in-browser/ink/render/ink-kit.js';
	import { Stage, type StageElements } from '@in-browser/ink/render/stage.js';
	import { attachSurface } from '@in-browser/ink/ui/surface.js';
	import SurfaceLayers from '@in-browser/ink/ui/SurfaceLayers.svelte';
	import { isInk } from '#lib/model/types.js';
	import { notesBackdrop, type NotesSelection, type NotesStage, type NotesSuggestion } from '#lib/render/surface.js';

	interface Props {
		doc: NotebookDoc;
		/** The stage is ready (zoom, current page …), with the selection and the shape suggestion */
		onready: (stage: NotesStage, selection: NotesSelection, suggestion: NotesSuggestion) => void;
		/** View moved or zoomed (at most once per frame) */
		onview: () => void;
	}

	let { doc, onready, onview }: Props = $props();

	let elements = $state.raw<StageElements | null>(null);
	/** The stage, for the layers (guides) */
	let surface = $state.raw<NotesStage | null>(null);

	$effect(() => {
		if (!elements) return;
		const notebook = doc;
		const el = elements;
		return untrack(() => {
			const stage: NotesStage = new Stage(el, {
				sceneOf: (id) => notebook.scene(id),
				load: (id) => void notebook.load(id),
				backdrop: notesBackdrop(notebook.backgrounds),
				kit: inkKit,
				label: '[notes]'
			});
			const selection = new Selection(stage, notebook.items);
			const suggestion = new ShapeSuggestion(stage, notebook.items);
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

			const input = new InputController(el.root, stage, {
				tool: () => tools.state(),
				commit: (s) => notebook.items.addStroke(s.page, s),
				commitShape: (page, fit, color, size, style) => notebook.items.addShape(page, fit, color, size, style),
				suggest: (s) => suggestion.show(s),
				erase: (sx, sy, radius, mode) => erase(sx, sy, radius, mode),
				eraseEnd: () => {
					lastErase = null;
					notebook.items.eraseEnd();
				},
				selection,
				hover: () => (tools.penHover = true)
			}, '[notes]');
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
					const hit = stage.erasableAt(x, y, radius);
					if (!hit || !hit.items.length) continue;
					// The ink kit only lets erasers touch ink
					const strokes = hit.items.filter(isInk);
					if (mode === 'stroke') notebook.items.erase(hit.page, strokes);
					else {
						const [px, py] = stage.toPage(hit.page, x, y);
						notebook.items.erasePixels(hit.page, strokes, px, py, radius / stage.view.zoom);
					}
				}
				lastErase = { x: sx, y: sy };
			}

			const detach = input.attach();
			const detachSurface = attachSurface(el.root, stage);
			onready(stage, selection, suggestion);
			surface = stage;
			return () => {
				surface = null;
				detach();
				detachSurface();
				cancelAnimationFrame(viewFrame);
				selection.clear();
				suggestion.clear();
				notebook.listener = null;
				stage.destroy();
			};
		});
	});
</script>

<SurfaceLayers bind:elements stage={surface} />
