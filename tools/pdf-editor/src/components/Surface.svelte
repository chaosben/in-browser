<script lang="ts">
	// The pages of the open PDF on the shared ink core (stage, tiles, input). Svelte only sets it up; nothing here
	// is reactive while the pages move or ink is drawn. Tools: "Hand" pans with the mouse or pen (fingers always pan and
	// pinch), "Select text" leaves presses on the text of a page to the browser, the highlighter marks the text it is
	// dragged over (character by character, previewed on the text layer); pen, shapes, eraser and select are the
	// core's, exactly as in Notes. What they make becomes annotations when saved.
	import { untrack, type Snippet } from 'svelte';
	import { InputController, type EraserMode, type Gesture } from '@in-browser/ink/input/controller.js';
	import { Selection } from '@in-browser/ink/input/selection.svelte.js';
	import { ShapeSuggestion } from '@in-browser/ink/input/suggestion.svelte.js';
	import { isInk } from '@in-browser/ink/items.js';
	import { highlightBoxes } from '#lib/render/highlight.js';
	import { isMarkup, pdfKit, type MarkKind } from '#lib/render/markup.js';
	import { isNote, NOTE_SIZE } from '#lib/render/note.js';
	import { fontOf, isText, loadTextFont, minTextSize, roomOf, withText, type TextItem } from '#lib/render/textbox.js';
	import { Stage, type StageElements } from '@in-browser/ink/render/stage.js';
	import { attachSurface } from '@in-browser/ink/ui/surface.js';
	import SurfaceLayers from '@in-browser/ink/ui/SurfaceLayers.svelte';
	import type { SearchHit } from '@in-browser/pdf/text.js';
	import { TextLayers, type PagePlace } from '@in-browser/pdf/text-layer.js';
	import '@in-browser/pdf/text-layer.css';
	import '#lib/render/form-layer.css';
	import { FormLayers } from '#lib/render/form-layers.js';
	import { FILLABLE } from '#lib/model/document.svelte.js';
	import { shownBox } from '#lib/model/fields.js';
	import { formView } from '#lib/model/forms.svelte.js';
	import type { PdfDocument } from '#lib/model/document.svelte.js';
	import { isMarkTool, markColors, noteColor, noteIcon, textStyle, tools } from '#lib/model/tools.svelte.js';
	import { boxesOf, positionAt, type PageText } from '@in-browser/pdf/text.js';
	import { pdfBackdrop, type PdfSelection, type PdfStage, type PdfSuggestion } from '#lib/render/surface.js';

	interface Props {
		doc: PdfDocument;
		/** The stage is ready (zoom, current page …), with the selection, the shape suggestion and what shows a form
		 * field (its widget scrolled into view and focused) */
		onready: (stage: PdfStage, selection: PdfSelection, suggestion: PdfSuggestion, showField: (widget: string) => void) => void;
		/** View moved or zoomed (at most once per frame) */
		onview: () => void;
		/** Search hits to mark, and the current one */
		hits?: readonly SearchHit[];
		current?: SearchHit | null;
		/** Layers on top of the canvases */
		children?: Snippet<[PdfStage]>;
		/** A text box is to be typed into or a note's comment written (new, pressed with its tool, double-clicked with
		 * "Select") – it is selected */
		onedit?: (id: string) => void;
	}

	let { doc, onready, onview, hits = [], current = null, children, onedit }: Props = $props();

	let elements = $state.raw<StageElements | null>(null);
	let stage = $state.raw<PdfStage | null>(null);
	let textHost = $state<HTMLDivElement>();
	let texts = $state.raw<TextLayers | null>(null);
	let formHost = $state<HTMLDivElement>();
	let forms = $state.raw<FormLayers | null>(null);

	/** The text and the form fields of the pages in view (and one before and after) where they are now */
	function placeTexts(s: PdfStage, layers: TextLayers, fields: FormLayers) {
		const { view } = s;
		const visible = view.visiblePages(s.rects);
		const places = new Map<number, PagePlace>();
		if (visible.length) {
			const first = Math.max(0, visible[0] - 1);
			const last = Math.min(s.rects.length - 1, visible[visible.length - 1] + 1);
			for (let i = first; i <= last; i++) {
				const rect = s.rects[i];
				places.set(i, { x: view.toScreenX(rect.x), y: view.toScreenY(rect.y), zoom: view.zoom, w: rect.w, h: rect.h, rotate: s.pages[i]?.rotate ?? 0, key: s.pages[i]?.id });
			}
		}
		layers.update(places);
		fields.update(places);
	}

	/** Shows a form field's widget: scrolled into view when it isn't, then focused */
	function showField(s: PdfStage, pdf: PdfDocument, fields: FormLayers, id: string) {
		const field = pdf.fields.find((f) => f.widgets.some((w) => w.id === id));
		const widget = field?.widgets.find((w) => w.id === id);
		const index = widget ? pdf.placeOf(widget) : -1;
		if (!widget || index < 0) return;
		const box = shownBox(widget, pdf.pages[index]);
		const r = s.boxRect(index, { x0: box.x, y0: box.y, x1: box.x + box.w, y1: box.y + box.h });
		if (!r || r.y < 0 || r.x < 0 || r.y + r.h > s.view.height || r.x + r.w > s.view.width) s.scrollToPage(index, Math.max(0, box.y - 40));
		fields.focus(id);
		s.onview?.();
	}

	/** The widgets Tab goes through: fillable fields of the pages there, by page, then in the file's order */
	function tabOrder(pdf: PdfDocument): string[] {
		const widgets = pdf.fields
			.filter((f) => FILLABLE.has(f.kind) && !f.readOnly)
			.flatMap((f) => f.widgets.filter((w) => !w.hidden).map((w, i) => ({ id: w.id, place: pdf.placeOf(w), order: pdf.fields.indexOf(f) * 1000 + i, field: f.name })))
			.filter((w) => w.place >= 0);
		widgets.sort((a, b) => a.place - b.place || a.order - b.order);
		// A radio group is one stop
		const seen = new Set<string>();
		return widgets.filter((w) => {
			const radio = pdf.fields.find((f) => f.name === w.field)?.kind === 'radio';
			if (!radio) return true;
			if (seen.has(w.field)) return false;
			seen.add(w.field);
			return true;
		}).map((w) => w.id);
	}

	/** "Hand" with mouse or pen: the pages follow the pointer */
	function pan(s: PdfStage, x: number, y: number): Gesture {
		let last = { x, y };
		return {
			move(sx, sy) {
				s.panBy(sx - last.x, sy - last.y);
				last = { x: sx, y: sy };
			},
			end() {}
		};
	}

	let measurer: CanvasRenderingContext2D | null = null;
	/** Width of a string in a sans-serif font with Helvetica's metrics: where letters of a PDF's text begin and end */
	function measure(str: string): number {
		measurer ??= document.createElement('canvas').getContext('2d');
		if (!measurer) return str.length;
		measurer.font = fontOf(100);
		return measurer.measureText(str).width;
	}

	/** Highlighter: marks the text from the press to where the pointer is (one page) */
	function mark(s: PdfStage, pdf: PdfDocument, layers: TextLayers, kind: MarkKind, sx: number, sy: number): Gesture | null {
		const hit = s.pageAt(sx, sy);
		if (!hit || pdf.editable !== 'yes') return null;
		const page = hit.index;
		void pdf.texts();
		const start = [hit.x, hit.y];
		let end = start;
		const color = markColors[kind];
		let range: { from: number; to: number } | null = null;
		/** The marked text's boxes, cut between letters by their widths; a highlight's reach below the baseline */
		const boxes = (text: PageText, r: { from: number; to: number }) => {
			const found = boxesOf(text.runs, r.from, r.to, { str: text.str, measure }).filter((b) => b.x1 > b.x0 && b.y1 > b.y0);
			return kind === 'highlight' ? highlightBoxes(found, pdf.pages[page].rotate) : found.map(({ x0, y0, x1, y1 }) => ({ x0, y0, x1, y1 }));
		};
		const update = () => {
			const text = pdf.pageText(page);
			if (!text) return;
			const a = positionAt(text, start[0], start[1], measure);
			const b = positionAt(text, end[0], end[1], measure);
			if (a === null || b === null) return;
			range = { from: Math.min(a, b), to: Math.max(a, b) };
			layers.setPreview({ index: page, boxes: boxes(text, range), color, kind });
		};
		update();
		return {
			move(x, y) {
				end = s.toPage(page, x, y);
				update();
			},
			end(cancelled) {
				layers.setPreview(null);
				const text = pdf.pageText(page);
				if (cancelled || !range || range.from === range.to || !text) return;
				const marked = boxes(text, range);
				if (!marked.length) return;
				pdf.items.addItem(page, {
					id: crypto.randomUUID(),
					type: 'markup',
					kind,
					color,
					boxes: marked,
					dir: pdf.pages[page].rotate,
					text: text.str.slice(range.from, range.to).trim()
				});
			}
		};
	}

	/** "Note": a press on a note selects it and opens its comment, elsewhere on a page places one whose tail points
	 * there (its comment open) */
	function note(s: PdfStage, pdf: PdfDocument, selection: PdfSelection, sx: number, sy: number): Gesture | null {
		const hit = s.pageAt(sx, sy);
		if (!hit || pdf.editable !== 'yes') return null;
		const there = s.itemAt(sx, sy, 4);
		const on = there && pdf.scene(pdf.pages[there.page].id)?.items.find((item) => item.id === there.id);
		return {
			move() {},
			end(cancelled) {
				if (cancelled) return;
				if (on && isNote(on)) {
					selection.select(there.page, new Set([on.id]));
					return onedit?.(on.id);
				}
				const k = NOTE_SIZE / 20;
				const id = pdf.items.addItem(hit.index, { id: crypto.randomUUID(), type: 'note', x: hit.x - 4 * k, y: hit.y - 20 * k, color: noteColor.value, text: '', ...(noteIcon.value !== 'Comment' && { icon: noteIcon.value }) });
				if (!id) return;
				selection.select(hit.index, new Set([id]));
				onedit?.(id);
			}
		};
	}

	/** The item of the editor at a screen point */
	function itemAt(s: PdfStage, pdf: PdfDocument, sx: number, sy: number) {
		const there = s.itemAt(sx, sy, 4);
		const item = there && pdf.scene(pdf.pages[there.page].id)?.items.find((i) => i.id === there.id);
		return item ? { page: there.page, item } : null;
	}

	/** "Text box": a press on one types into it; elsewhere a click places one of auto width, a drag one of the size dragged */
	function textbox(s: PdfStage, pdf: PdfDocument, selection: PdfSelection, sx: number, sy: number): Gesture | null {
		const hit = s.pageAt(sx, sy);
		if (!hit || pdf.editable !== 'yes') return null;
		const on = itemAt(s, pdf, sx, sy);
		let end = [hit.x, hit.y];
		return {
			move(x, y) {
				end = s.toPage(hit.index, x, y);
			},
			end(cancelled) {
				if (cancelled) return;
				if (on && isText(on.item)) {
					selection.select(on.page, new Set([on.item.id]));
					onedit?.(on.item.id);
					return;
				}
				const page = pdf.pages[hit.index];
				const dragged = Math.hypot(end[0] - hit.x, end[1] - hit.y) * s.view.zoom > 8;
				const { size, color, fill, border, borderWidth, align } = textStyle;
				const style = { fill, border, borderWidth: border ? borderWidth : undefined };
				// Dragged: the box as drawn (at least two characters and one line); clicked: auto width from there
				const min = minTextSize({ size, ...style });
				const x = dragged ? Math.min(hit.x, end[0]) : hit.x;
				const y = dragged ? Math.min(hit.y, end[1]) : hit.y - size * 0.6;
				const box = dragged ? { w: Math.max(min.w, Math.abs(end[0] - hit.x)), h: Math.max(min.h, Math.abs(end[1] - hit.y)) } : { w: 0, h: 0 };
				const blank: TextItem = { id: crypto.randomUUID(), type: 'text', x, y, ...box, rot: 0, size, color, text: '', lines: [], ...style, ...(align !== 'left' && { align }), sizing: dragged ? 'fixed' : 'auto-width' };
				const item = withText(blank, '', roomOf(blank, page));
				const id = pdf.items.addItem(hit.index, item);
				if (!id) return;
				selection.select(hit.index, new Set([id]));
				onedit?.(id);
			}
		};
	}

	$effect(() => {
		if (!elements || !textHost || !formHost) return;
		const pdf = doc;
		const el = elements;
		const host = textHost;
		const fieldHost = formHost;
		return untrack(() => {
			const s: PdfStage = new Stage(el, {
				sceneOf: (id) => pdf.scene(id),
				load: () => {},
				backdrop: pdfBackdrop(pdf),
				kit: pdfKit,
				label: '[pdf-editor]'
			});
			const selection: PdfSelection = new Selection(s, pdf.items);
			const suggestion: PdfSuggestion = new ShapeSuggestion(s, pdf.items);
			// A note under the resting mouse shows its comment as a tooltip
			const hover = (e: PointerEvent) => {
				if (e.pointerType !== 'mouse' || e.buttons) return;
				const [x, y] = s.local(e.clientX, e.clientY);
				const on = itemAt(s, pdf, x, y)?.item;
				const text = on && isNote(on) ? on.text : '';
				if (el.root.title !== text) el.root.title = text;
			};
			el.root.addEventListener('pointermove', hover);
			pdf.listener = {
				stroke: (id, scene, item) => s.committed(id, scene, item),
				region: (id, box) => s.regionChanged(id, box),
				backdrop: (id) => s.backdropChanged(id),
				content: (id) => {
					s.contentChanged(id);
					selection.refresh();
					suggestion.updateRect();
				}
			};
			const editable = () => pdf.editable === 'yes';

			// The eraser follows its path in steps of half its radius (events can be far apart or very dense)
			let lastErase: { x: number; y: number } | null = null;
			function erase(sx: number, sy: number, radius: number, mode: EraserMode) {
				if (!editable()) return;
				const from = lastErase ?? { x: sx, y: sy };
				const dist = Math.hypot(sx - from.x, sy - from.y);
				const step = Math.max(1, radius / 2);
				if (lastErase && dist < step) return;
				const n = Math.max(1, Math.ceil(dist / step));
				for (let i = lastErase ? 1 : 0; i <= n; i++) {
					const x = from.x + ((sx - from.x) * i) / n;
					const y = from.y + ((sy - from.y) * i) / n;
					const hit = s.erasableAt(x, y, radius);
					if (!hit || !hit.items.length) continue;
					// Marked text and notes go as a whole (also with the pixel eraser)
					const marks = hit.items.filter((item) => isMarkup(item) || isNote(item));
					if (marks.length) pdf.items.erase(hit.page, marks);
					const strokes = hit.items.filter(isInk);
					if (!strokes.length) continue;
					if (mode === 'stroke') pdf.items.erase(hit.page, strokes);
					else {
						const [px, py] = s.toPage(hit.page, x, y);
						pdf.items.erasePixels(hit.page, strokes, px, py, radius / s.view.zoom);
					}
				}
				lastErase = { x: sx, y: sy };
			}

			const layers = new TextLayers(host, (index) => {
				const page = pdf.pages[index];
				const proxy = page && pdf.proxyOf(page);
				return proxy ? proxy.getPage(page.number) : Promise.resolve(null);
			});
			const fields = new FormLayers(fieldHost, {
				fields: () => pdf.fields,
				font: (name) => pdf.fieldFonts.get(name),
				shows: (widget) => pdf.shows(widget),
				value: (name) => pdf.values.get(name),
				page: (index) => pdf.pages[index],
				placeOf: (widget) => pdf.placeOf(widget),
				editable,
				commit: (name, value, how) => pdf.setField(name, value, how),
				tab: (id, back) => {
					const order = tabOrder(pdf);
					const field = pdf.fields.find((f) => f.widgets.some((w) => w.id === id));
					// A radio button stands for its group
					const at = order.findIndex((w) => w === id || field?.widgets.some((x) => x.id === w));
					if (!order.length) return;
					const next = order[(at + (back ? -1 : 1) + order.length) % order.length];
					showField(s, pdf, fields, next);
				}
			});
			const input = new InputController(
				el.root,
				s,
				{
					tool: () => tools.state(),
					commit: (stroke) => (editable() ? pdf.items.addStroke(stroke.page, stroke) : null),
					commitShape: (page, fit, color, size, style) => {
						if (editable()) pdf.items.addShape(page, fit, color, size, style);
					},
					suggest: (shape) => suggestion.show(shape),
					erase,
					eraseEnd: () => {
						lastErase = null;
						pdf.items.eraseEnd();
					},
					selection,
					hover: () => (tools.penHover = true),
					// Marking tools mark with any pointer; with "Hand" and "Select text" fingers keep panning and
					// pinching, and "Select text" pans outside the text
					gesture: (tool, x, y, e) =>
						isMarkTool(tool)
							? mark(s, pdf, layers, tool, x, y)
							: tool === 'note'
								? note(s, pdf, selection, x, y)
								: tool === 'textbox'
									? textbox(s, pdf, selection, x, y)
									: e.pointerType === 'touch' ? null : pan(s, x, y),
					passthrough: (e) =>
						e.target instanceof Element && ((tools.tool === 'text' && !!e.target.closest('[data-text-layer]')) || !!e.target.closest('[data-form-field]'))
				},
				'[pdf-editor]'
			);
			let viewFrame = 0;
			s.onview = () => {
				if (!viewFrame)
					viewFrame = requestAnimationFrame(() => {
						viewFrame = 0;
						placeTexts(s, layers, fields);
						selection.updateRect();
						suggestion.updateRect();
						onview();
					});
			};
			pdf.onrender = () => {
				s.backgroundReady();
				fields.settle();
			};
			s.setPages(pdf.pages);
			// A double click on a text box with "Select" types into it, on a note opens its comment
			const dblclick = (e: MouseEvent) => {
				if (tools.tool !== 'lasso') return;
				const [x, y] = s.local(e.clientX, e.clientY);
				const on = itemAt(s, pdf, x, y);
				if (!on || !(isText(on.item) || isNote(on.item)) || !editable()) return;
				selection.select(on.page, new Set([on.item.id]));
				onedit?.(on.item.id);
			};
			el.root.addEventListener('dblclick', dblclick);
			// Text boxes drawn before their font was there: drawn again with it
			void loadTextFont().then(() => {
				for (const page of pdf.pages) if (pdf.scene(page.id)?.items.some(isText)) s.contentChanged(page.id);
			});
			const detach = input.attach();
			const detachSurface = attachSurface(el.root, s);
			stage = s;
			texts = layers;
			forms = fields;
			s.onview();
			onready(s, selection, suggestion, (id) => showField(s, pdf, fields, id));
			return () => {
				el.root.removeEventListener('dblclick', dblclick);
				layers.destroy();
				fields.destroy();
				texts = null;
				forms = null;
				detach();
				detachSurface();
				el.root.removeEventListener('pointermove', hover);
				el.root.title = '';
				cancelAnimationFrame(viewFrame);
				selection.clear();
				suggestion.clear();
				pdf.onrender = null;
				pdf.listener = null;
				stage = null;
				s.destroy();
			};
		});
	});

	$effect(() => {
		const on = tools.tool === 'text';
		untrack(() => texts?.setSelectable(on));
	});

	// Form fields: filled in with "Hand", "Select" and "Select text" (other tools draw over them); tinted or not; built
	// anew when they are read or the file becomes editable, their inputs follow the values (undo, other widgets)
	$effect(() => {
		const active = tools.tool === 'hand' || tools.tool === 'lasso' || tools.tool === 'text';
		const highlight = formView.highlight;
		untrack(() => {
			forms?.setActive(active);
			forms?.setHighlight(highlight);
		});
	});
	$effect(() => {
		void doc.fields;
		void doc.editable;
		untrack(() => {
			forms?.rebuild();
			stage?.onview?.();
		});
	});
	$effect(() => {
		void doc.values;
		untrack(() => forms?.refresh());
	});

	// Marking text: the text is read ahead, the pointer is a text cursor (placing notes and text boxes: a cross)
	$effect(() => {
		const marking = isMarkTool(tools.tool);
		const placing = tools.tool === 'note' || tools.tool === 'textbox';
		const root = elements?.root;
		untrack(() => {
			if (marking) void doc.texts();
			if (root) root.style.cursor = marking ? 'text' : placing ? 'crosshair' : '';
		});
	});

	$effect(() => {
		const list = hits;
		const now = current;
		untrack(() => texts?.setHits(list, now));
	});

	// Pages change (rotated; later moved, inserted): the stage follows, the text layers with it
	$effect(() => {
		const pages = doc.pages;
		untrack(() => {
			stage?.setPages(pages);
			stage?.onview?.();
		});
	});
</script>

<SurfaceLayers bind:elements {stage}>
	<!-- The pages' text (selectable with "Select text") and search hits -->
	<div bind:this={textHost} class="pointer-events-none absolute inset-0 overflow-hidden"></div>
	<!-- Form fields to fill in (over the text) -->
	<div bind:this={formHost} class="pointer-events-none absolute inset-0 overflow-hidden"></div>
	{#if stage}{@render children?.(stage)}{/if}
</SurfaceLayers>
