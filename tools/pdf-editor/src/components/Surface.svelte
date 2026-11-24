<script lang="ts">
	// The pages of the open PDF on the shared ink core (stage, tiles, input). Svelte only sets it up; nothing here
	// is reactive while the pages move or ink is drawn. Tools: "Hand" pans with the mouse or pen (fingers always pan and
	// pinch), "Select text" leaves presses on the text of a page to the browser, the highlighter marks the text it is
	// dragged over (character by character, previewed on the text layer); pen, shapes, eraser and select are the
	// core's. What they make becomes annotations when saved.
	import { untrack, type Snippet } from 'svelte';
	import { InputController, type EraserMode, type Gesture } from '@in-browser/ink/input/controller.js';
	import { Selection } from '@in-browser/ink/input/selection.svelte.js';
	import { ShapeSuggestion } from '@in-browser/ink/input/suggestion.svelte.js';
	import { isInk } from '@in-browser/ink/items.js';
	import { highlightBoxes } from '#lib/render/highlight.js';
	import { isCommented, isMarkup, pdfKit, type MarkKind, type MarkupItem } from '#lib/render/markup.js';
	import type { CaretItem } from '#lib/render/caret.js';
	import { isNote, NOTE_SIZE } from '#lib/render/note.js';
	import { DOCUMENT_FONTS } from '@in-browser/graphics/rich-text.js';
	import { loadFonts } from '@in-browser/graphics/fonts.js';
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
	import type { Box } from '@in-browser/ink/geometry.js';
	import { shownBox } from '#lib/model/fields.js';
	import { formView } from '#lib/model/forms.svelte.js';
	import type { PdfDocument } from '#lib/model/document.svelte.js';
	import { caretColor, isCaretTool, isMarkTool, isTextTool, markColors, measureTool, noteColor, noteIcon, newTextFormat, stampChoice, textStyle, tools } from '#lib/model/tools.svelte.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import { stampTool, stampWords } from '#lib/model/stamps.svelte.js';
	import { isLink } from '#lib/render/link.js';
	import { shapePoints, withStyle } from '@in-browser/ink/shapes.js';
	import { contentAt, contentEdit, cornerAt, movedBox, unionBox } from '#lib/model/content.svelte.js';
	import { ContentOverlay, type ContentMark } from '#lib/render/content-overlay.js';
	import type { Matrix } from '@in-browser/pdf/geometry.js';
	import { SNAP_PX, snapMove, snapTargets, type SnapTargets } from '@in-browser/graphics/snap.js';
	import { chosenWord, wordText } from '#lib/model/stamp-words.js';
	import { drawStamp, isStamp, pictureStamp, wordStamp, type StampItem } from '#lib/render/stamp.js';
	import { suiteSettings } from '@in-browser/files/suite-settings.svelte.js';
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
		/** A box (as shown) was dragged open on a page with "Stamp from area" */
		oncapture?: (page: number, box: Box) => void;
		/** A page was clicked with "Attach file": where the file's icon goes (page points) */
		onattach?: (page: number, x: number, y: number) => void;
		/** A page was clicked or tapped with "Hand" (page points): a link there is followed */
		onlink?: (page: number, x: number, y: number) => void;
		/** A distance was drawn with "Calibrate": its length in page points. It stays shown until `clear` is called. */
		oncalibrate?: (points: number, clear: () => void) => void;
	}

	let { doc, onready, onview, hits = [], current = null, children, onedit, oncapture, onattach, onlink, oncalibrate }: Props = $props();

	let elements = $state.raw<StageElements | null>(null);
	let stage = $state.raw<PdfStage | null>(null);
	let textHost = $state<HTMLDivElement>();
	let texts = $state.raw<TextLayers | null>(null);
	let formHost = $state<HTMLDivElement>();
	let forms = $state.raw<FormLayers | null>(null);
	let contentHost = $state<HTMLDivElement>();
	let contentMarks = $state.raw<ContentOverlay | null>(null);

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
				places.set(i, { x: view.toScreenX(rect.x), y: view.toScreenY(rect.y), zoom: view.zoom, w: rect.w, h: rect.h, rotate: s.pages[i]?.rotate ?? 0, key: s.pages[i] && `${s.pages[i].id}|${doc.contentRev(s.pages[i])}` });
			}
		}
		layers.update(places);
		fields.update(places);
		contentMarks?.update(places);
		// Editing content: the objects of the pages in view are read ahead
		if (contentEdit.on) for (const index of places.keys()) void doc.loadContent(index);
	}

	/** "Select objects" (content editing): a press picks the object there (Shift, Ctrl/⌘: adds or takes out) and
	 * drags what is picked; a corner of the frame scales it; beside the objects a frame is dragged open */
	function content(s: PdfStage, pdf: PdfDocument, sx: number, sy: number, e: PointerEvent): Gesture | null {
		const hit = s.pageAt(sx, sy);
		if (!contentEdit.on || !hit || pdf.editable !== 'yes') return null;
		const items = pdf.contentItems(hit.index);
		if (!items) {
			void pdf.loadContent(hit.index);
			return null;
		}
		const tolerance = (e.pointerType === 'mouse' ? 4 : 10) / s.view.zoom;
		const picked = () => (contentEdit.page === hit.index ? items.filter((i) => contentEdit.ids.has(i.id)) : []);
		const frame = unionBox(picked().map((i) => i.box));
		const corner = frame ? cornerAt(frame, hit.x, hit.y, tolerance * 2) : -1;
		const at = contentAt(items, hit.x, hit.y, tolerance);
		const add = e.shiftKey || e.ctrlKey || e.metaKey;
		const inFrame = !!frame && hit.x >= frame.x0 && hit.x <= frame.x1 && hit.y >= frame.y0 && hit.y <= frame.y1;
		let mode: 'scale' | 'move' | 'band' | 'none';
		if (corner >= 0 && frame) mode = 'scale';
		else if (at && add) {
			const ids = new Set(contentEdit.page === hit.index ? contentEdit.ids : []);
			if (!ids.delete(at.id)) ids.add(at.id);
			contentEdit.select(hit.index, ids);
			mode = 'none';
		} else if (at && !(contentEdit.page === hit.index && contentEdit.ids.has(at.id)) && !(inFrame && contentEdit.ids.size > 1)) {
			contentEdit.select(hit.index, [at.id]);
			mode = 'move';
		} else if (at || inFrame) mode = 'move';
		else {
			if (!add) contentEdit.clear();
			mode = 'band';
		}
		contentEdit.hover = null;
		contentEdit.lifted = null;
		const start = [hit.x, hit.y];
		let moved = false;
		// Snapping a move: to the page and to the other objects of its content (not too many to stay quick)
		const page = pdf.pages[hit.index];
		let targets: SnapTargets | null = null;
		const snapTo = () => {
			if (targets) return targets;
			const others = items.filter((i) => !contentEdit.ids.has(i.id)).slice(0, 400);
			targets = snapTargets(others.map((i) => ({ x: i.box.x0, y: i.box.y0, w: i.box.x1 - i.box.x0, h: i.box.y1 - i.box.y0 })), { x: 0, y: 0, w: page.w, h: page.h }, others.map((i) => `content${i.id}`));
			return targets;
		};
		/** A picture of what is dragged, asked for once the drag begins */
		let lifting = false;
		const lift = () => {
			if (lifting) return;
			lifting = true;
			const ids = new Set(contentEdit.ids);
			void pdf.liftedContent(hit.index, ids, s.view.zoom * Math.min(2, devicePixelRatio)).then((canvas) => {
				// Still the same drag (or its drop waiting for the page – not when the page already shows it)
				if (dropped && pdf.contentShown !== shownAtDrop) return;
				if (canvas && lifting && contentEdit.page === hit.index && contentEdit.ids.size === ids.size) contentEdit.lifted = { page: hit.index, canvas, at: dropped };
			});
		};
		let dropped: Matrix | null = null;
		let shownAtDrop = -1;
		return {
			move(x, y, ev) {
				const [px, py] = s.toPage(hit.index, x, y);
				if (!moved && Math.hypot(px - start[0], py - start[1]) * s.view.zoom < 4) return;
				moved = true;
				if (mode === 'move') {
					let dx = px - start[0];
					let dy = py - start[1];
					// Shift keeps the axis moved most along
					if (ev.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
					const to = tools.snap !== ev.altKey ? snapTo() : null;
					const now = contentEdit.page === hit.index ? unionBox(items.filter((i) => contentEdit.ids.has(i.id)).map((i) => i.box)) : null;
					if (to && now) {
						const tolerance = SNAP_PX / s.view.zoom;
						const snapped = snapMove({ x: now.x0 + dx, y: now.y0 + dy, w: now.x1 - now.x0, h: now.y1 - now.y0 }, to, { x: tolerance, y: tolerance });
						if (!ev.shiftKey || dy !== 0) dy += snapped.dy;
						if (!ev.shiftKey || dx !== 0) dx += snapped.dx;
						s.setGuides({ page: hit.index, guides: snapped.guides, targets: to });
					} else s.setGuides(null);
					contentEdit.drag = [1, 0, 0, 1, dx, dy];
					lift();
				} else if (mode === 'scale' && frame) {
					// In proportion, about the opposite corner
					const corners = [[frame.x0, frame.y0], [frame.x1, frame.y0], [frame.x1, frame.y1], [frame.x0, frame.y1]];
					const [ax, ay] = corners[(corner + 2) % 4];
					const [cx, cy] = corners[corner];
					const f = Math.max(0.05, Math.hypot(px - ax, py - ay) / Math.max(1e-6, Math.hypot(cx - ax, cy - ay)));
					contentEdit.drag = [f, 0, 0, f, ax * (1 - f), ay * (1 - f)];
					lift();
				} else if (mode === 'band') {
					contentEdit.band = { page: hit.index, box: { x0: Math.min(start[0], px), y0: Math.min(start[1], py), x1: Math.max(start[0], px), y1: Math.max(start[1], py) } };
				}
			},
			end(cancelled) {
				const drag = contentEdit.drag;
				const band = contentEdit.band;
				contentEdit.drag = contentEdit.band = null;
				s.setGuides(null);
				const applies = !cancelled && !band && !!drag && contentEdit.ids.size > 0;
				// The picture stays where it was dropped until the page shows the change
				dropped = applies ? drag : null;
				shownAtDrop = pdf.contentShown;
				if (!applies) {
					lifting = false;
					contentEdit.lifted = null;
				} else if (contentEdit.lifted) contentEdit.lifted = { ...contentEdit.lifted, at: drag };
				if (cancelled) return;
				if (band) {
					// What lies wholly in the frame
					const b = band.box;
					const inside = items.filter((i) => i.box.x0 >= b.x0 && i.box.x1 <= b.x1 && i.box.y0 >= b.y0 && i.box.y1 <= b.y1).map((i) => i.id);
					contentEdit.select(hit.index, [...(add && contentEdit.page === hit.index ? contentEdit.ids : []), ...inside]);
				} else if (drag && contentEdit.ids.size) pdf.transformContent(hit.index, contentEdit.ids, drag);
			}
		};
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

	/** An insertion mark between the characters before and at `pos` of a page's text (null: no text there) */
	function caretAt(text: PageText, pos: number, rotate: number): CaretItem | null {
		const at = { str: text.str, measure };
		let start = true;
		let b = boxesOf(text.runs, pos, pos + 1, at)[0];
		if (!b) {
			// After the last character
			start = false;
			b = boxesOf(text.runs, pos - 1, pos, at).at(-1)!;
		}
		if (!b) return null;
		const dir = ((rotate % 360) + 360) % 360;
		// On the baseline, at the side the character starts (or ends) in reading direction
		const [x, y] = dir === 90 ? [b.x0, start ? b.y0 : b.y1] : dir === 180 ? [start ? b.x1 : b.x0, b.y0] : dir === 270 ? [b.x1, start ? b.y1 : b.y0] : [start ? b.x0 : b.x1, b.y1];
		return { id: crypto.randomUUID(), type: 'caret', x, y, h: dir % 180 ? b.x1 - b.x0 : b.y1 - b.y0, dir, color: caretColor.value, text: '' };
	}

	/** "Insert text": a click puts a mark between the two characters nearest to it and opens what to insert there */
	function insert(s: PdfStage, pdf: PdfDocument, selection: PdfSelection, sx: number, sy: number): Gesture | null {
		const hit = s.pageAt(sx, sy);
		if (!hit || pdf.editable !== 'yes') return null;
		void pdf.texts();
		return {
			move() {},
			end(cancelled) {
				const text = pdf.pageText(hit.index);
				const pos = !cancelled && text ? positionAt(text, hit.x, hit.y, measure) : null;
				const item = pos !== null && text ? caretAt(text, pos, pdf.pages[hit.index].rotate) : null;
				const id = item && pdf.items.addItem(hit.index, item);
				if (!id) return;
				selection.select(hit.index, new Set([id]));
				onedit?.(id);
			}
		};
	}

	/** Highlighter: marks the text from the press to where the pointer is (one page). `replace`: "Replace text" –
	 * a mark at its end that strikes it out and carries what replaces it (one item), opened to type that */
	function mark(s: PdfStage, pdf: PdfDocument, layers: TextLayers, kind: MarkKind, sx: number, sy: number, replace?: PdfSelection): Gesture | null {
		const hit = s.pageAt(sx, sy);
		if (!hit || pdf.editable !== 'yes') return null;
		const page = hit.index;
		void pdf.texts();
		const start = [hit.x, hit.y];
		let end = start;
		const color = replace ? caretColor.value : markColors[kind];
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
				const item: MarkupItem = { id: crypto.randomUUID(), type: 'markup', kind, color, boxes: marked, dir: pdf.pages[page].rotate, text: text.str.slice(range.from, range.to).trim() };
				const caret = replace ? caretAt(text, range.to, pdf.pages[page].rotate) : null;
				if (!replace || !caret) return void pdf.items.addItem(page, item);
				// One comment: the mark carries the text it replaces
				const id = pdf.items.addItem(page, { ...caret, replaces: marked, marked: item.text });
				if (!id) return;
				replace.select(page, new Set([id]));
				onedit?.(id);
			}
		};
	}

	/** "Highlight area": a box dragged open on a page, in the highlight's color (for what has no text to mark: scans) */
	function area(s: PdfStage, pdf: PdfDocument, layers: TextLayers, sx: number, sy: number): Gesture | null {
		const hit = s.pageAt(sx, sy);
		if (!hit || pdf.editable !== 'yes') return null;
		const page = pdf.pages[hit.index];
		const color = markColors.highlight;
		let end = [hit.x, hit.y];
		const box = () => ({
			x0: Math.max(0, Math.min(hit.x, end[0])),
			y0: Math.max(0, Math.min(hit.y, end[1])),
			x1: Math.min(page.w, Math.max(hit.x, end[0])),
			y1: Math.min(page.h, Math.max(hit.y, end[1]))
		});
		return {
			// A click sets the first corner, the next one the opposite corner
			hold: () => true,
			move(x, y) {
				end = s.toPage(hit.index, x, y);
				layers.setPreview({ index: hit.index, boxes: [box()], color, kind: 'highlight' });
			},
			end(cancelled) {
				layers.setPreview(null);
				const b = box();
				// A click marks nothing
				if (cancelled || (b.x1 - b.x0) * s.view.zoom < 4 || (b.y1 - b.y0) * s.view.zoom < 4) return;
				pdf.items.addItem(hit.index, { id: crypto.randomUUID(), type: 'markup', kind: 'highlight', color, boxes: [b], dir: page.rotate, text: '', area: true });
			}
		};
	}

	/** "Link": a box dragged open on a page becomes a link, opened to say where it leads; a press on a link opens it */
	function link(s: PdfStage, pdf: PdfDocument, layers: TextLayers, selection: PdfSelection, sx: number, sy: number): Gesture | null {
		const hit = s.pageAt(sx, sy);
		if (!hit || pdf.editable !== 'yes') return null;
		const page = pdf.pages[hit.index];
		const on = itemAt(s, pdf, sx, sy);
		let end = [hit.x, hit.y];
		const box = () => ({
			x0: Math.max(0, Math.min(hit.x, end[0])),
			y0: Math.max(0, Math.min(hit.y, end[1])),
			x1: Math.min(page.w, Math.max(hit.x, end[0])),
			y1: Math.min(page.h, Math.max(hit.y, end[1]))
		});
		return {
			// A click sets the first corner, the next one the opposite corner
			hold: () => !(on && isLink(on.item)),
			move(x, y) {
				end = s.toPage(hit.index, x, y);
				layers.setPreview({ index: hit.index, boxes: [box()], color: CAPTURE_TINT, kind: 'highlight' });
			},
			end(cancelled) {
				layers.setPreview(null);
				if (cancelled) return;
				const b = box();
				const dragged = (b.x1 - b.x0) * s.view.zoom >= 4 && (b.y1 - b.y0) * s.view.zoom >= 4;
				if (!dragged && on && isLink(on.item)) {
					selection.select(on.page, new Set([on.item.id]));
					return onedit?.(on.item.id);
				}
				if (!dragged) return;
				const id = pdf.items.addItem(hit.index, { id: crypto.randomUUID(), type: 'link', x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 });
				if (!id) return;
				selection.select(hit.index, new Set([id]));
				onedit?.(id);
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

	/** "Attach file": a click on a page asks for the file whose icon goes there; a press on an attachment selects it */
	function attach(s: PdfStage, pdf: PdfDocument, selection: PdfSelection, sx: number, sy: number): Gesture | null {
		const hit = s.pageAt(sx, sy);
		if (!hit || pdf.editable !== 'yes') return null;
		const there = s.itemAt(sx, sy, 4);
		const on = there && pdf.scene(pdf.pages[there.page].id)?.items.find((item) => item.id === there.id);
		return {
			move() {},
			end(cancelled) {
				if (cancelled) return;
				if (on && isNote(on)) return selection.select(there.page, new Set([on.id]));
				onattach?.(hit.index, hit.x - NOTE_SIZE / 2, hit.y - NOTE_SIZE / 2);
			}
		};
	}

	/** The chosen stamp – a word of the standard or a picture – with its middle at a point of a page, wholly on it
	 * (null while its picture is still being read) */
	function stampItem(pdf: PdfDocument, hit: { index: number; x: number; y: number }): StampItem | null {
		const page = pdf.pages[hit.index];
		if (stampChoice.custom) return stampTool.picture && pictureStamp(stampTool.picture, page, hit.x, hit.y);
		const name = suiteSettings.values.profile.name;
		// Date and time as chosen, each on its own
		const { withDate, withTime } = stampChoice;
		const when = withDate || withTime ? new Intl.DateTimeFormat(intlLocale, { ...(withDate && { dateStyle: 'medium' }), ...(withTime && { timeStyle: 'short' }) }).format(new Date()) : '';
		const word = chosenWord(stampWords.list, stampChoice.word);
		if (!word) return null;
		// As the list shows it (decided by the user: no capitals)
		const text = wordText(word, m.stamps.names);
		const item = wordStamp(word.name ?? 'Custom', text, [stampChoice.withName && name, when].filter(Boolean).join(' · ') || undefined, hit.x, hit.y, word.color);
		item.x = Math.max(0, Math.min(page.w - item.w, item.x));
		item.y = Math.max(0, Math.min(page.h - item.h, item.y));
		return item;
	}

	/** "Stamp": a click places the chosen stamp where the pointer showed it */
	function stamp(s: PdfStage, pdf: PdfDocument, selection: PdfSelection, sx: number, sy: number): Gesture | null {
		const hit = s.pageAt(sx, sy);
		if (!hit || pdf.editable !== 'yes') return null;
		return {
			move() {},
			end(cancelled) {
				const item = cancelled ? null : stampItem(pdf, hit);
				const id = item && pdf.items.addItem(hit.index, item);
				if (id) selection.select(hit.index, new Set([id]));
			}
		};
	}

	/** "Stamp from area": a box dragged open on a page becomes a stamp of what it holds */
	function capture(s: PdfStage, pdf: PdfDocument, layers: TextLayers, sx: number, sy: number): Gesture | null {
		const hit = s.pageAt(sx, sy);
		if (!hit) return null;
		const page = pdf.pages[hit.index];
		let end = [hit.x, hit.y];
		const box = () => ({
			x0: Math.max(0, Math.min(hit.x, end[0])),
			y0: Math.max(0, Math.min(hit.y, end[1])),
			x1: Math.min(page.w, Math.max(hit.x, end[0])),
			y1: Math.min(page.h, Math.max(hit.y, end[1]))
		});
		return {
			// A click sets the first corner, the next one the opposite corner
			hold: () => true,
			move(x, y) {
				end = s.toPage(hit.index, x, y);
				layers.setPreview({ index: hit.index, boxes: [box()], color: CAPTURE_TINT, kind: 'highlight' });
			},
			end(cancelled) {
				layers.setPreview(null);
				const b = box();
				if (cancelled || (b.x1 - b.x0) * s.view.zoom < 4 || (b.y1 - b.y0) * s.view.zoom < 4) return;
				oncapture?.(hit.index, b);
			}
		};
	}
	/** The box of "Stamp from area" while it is dragged open */
	const CAPTURE_TINT = '#3b82f655';

	// The stamp follows the pointer before it is placed (a mouse or a hovering pen; a finger has no place before it taps)
	let stampGhost = $state<HTMLCanvasElement>();
	$effect(() => {
		const root = elements?.root;
		const s = stage;
		const canvas = stampGhost;
		if (!root || !s || !canvas) return;
		const hide = () => (canvas.style.display = 'none');
		const show = (e: PointerEvent) => {
			if (tools.tool !== 'stamp' || e.pointerType === 'touch' || e.buttons || doc.editable !== 'yes') return hide();
			const [sx, sy] = s.local(e.clientX, e.clientY);
			const hit = s.pageAt(sx, sy);
			const item = hit && stampItem(doc, hit);
			if (!hit || !item) return hide();
			const k = s.view.zoom * devicePixelRatio;
			const [w, h] = [Math.max(1, Math.round(item.w * k)), Math.max(1, Math.round(item.h * k))];
			if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];
			const ctx = canvas.getContext('2d');
			if (!ctx) return;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, w, h);
			ctx.setTransform(k, 0, 0, k, -item.x * k, -item.y * k);
			drawStamp(ctx, item);
			canvas.style.width = `${item.w * s.view.zoom}px`;
			canvas.style.height = `${item.h * s.view.zoom}px`;
			canvas.style.transform = `translate(${sx - (hit.x - item.x) * s.view.zoom}px, ${sy - (hit.y - item.y) * s.view.zoom}px)`;
			canvas.style.display = '';
		};
		root.addEventListener('pointermove', show);
		root.addEventListener('pointerleave', hide);
		root.addEventListener('pointerdown', hide);
		return () => {
			root.removeEventListener('pointermove', show);
			root.removeEventListener('pointerleave', hide);
			root.removeEventListener('pointerdown', hide);
			hide();
		};
	});
	$effect(() => {
		if (tools.tool !== 'stamp' && stampGhost) stampGhost.style.display = 'none';
	});

	/** The item of the editor at a screen point */
	function itemAt(s: PdfStage, pdf: PdfDocument, sx: number, sy: number) {
		const there = s.itemAt(sx, sy, 4);
		const item = there && pdf.scene(pdf.pages[there.page].id)?.items.find((i) => i.id === there.id);
		return item ? { page: there.page, item } : null;
	}

	/** "Text box": a press on one types into it; elsewhere a click places one of auto width, a drag one of the size dragged */
	/** How far from its tip a callout's box is put by a click (points: right and up) */
	const CALLOUT_AWAY = [36, -30];

	/** "Callout": press where it should point, drag to where its text goes (a click puts the box a little away);
	 * a press on a text box edits it */
	function callout(s: PdfStage, pdf: PdfDocument, selection: PdfSelection, sx: number, sy: number): Gesture | null {
		const hit = s.pageAt(sx, sy);
		if (!hit || pdf.editable !== 'yes') return null;
		const on = itemAt(s, pdf, sx, sy);
		let end = [hit.x, hit.y];
		const onText = !!on && isText(on.item);
		return {
			// A click sets the tip, the next one where the text goes (on the tip again: a little away)
			hold: () => !onText,
			move(x, y) {
				end = s.toPage(hit.index, x, y);
				if (!onText) s.setRubber({ page: hit.index, points: [hit.x, hit.y, 0.5, end[0], end[1], 0.5], color: textStyle.border ?? textStyle.color, size: 1 });
			},
			end(cancelled) {
				s.setRubber(null);
				if (cancelled) return;
				if (on && isText(on.item)) {
					selection.select(on.page, new Set([on.item.id]));
					onedit?.(on.item.id);
					return;
				}
				const page = pdf.pages[hit.index];
				const dragged = Math.hypot(end[0] - hit.x, end[1] - hit.y) * s.view.zoom > 8;
				const { size, color, fill, border, borderWidth, align } = textStyle;
				// Always framed, so the line has something to end at: the chosen border, else the text's color
				const style = { fill, border: border ?? color, borderWidth: border ? borderWidth : 1 };
				const at = dragged ? end : [hit.x + CALLOUT_AWAY[0], hit.y + CALLOUT_AWAY[1]];
				const min = minTextSize({ size, ...style });
				const x = Math.max(0, Math.min(page.w - min.w, at[0]));
				const y = Math.max(0, Math.min(page.h - min.h, at[1] - min.h / 2));
				const blank: TextItem = { id: crypto.randomUUID(), type: 'text', x, y, w: 0, h: 0, rot: 0, size, color, text: '', lines: [], ...style, ...newTextFormat(), ...(align !== 'left' && { align }), sizing: 'auto-width', callout: [hit.x, hit.y] };
				const id = pdf.items.addItem(hit.index, withText(blank, '', roomOf(blank, page)));
				if (!id) return;
				selection.select(hit.index, new Set([id]));
				onedit?.(id);
			}
		};
	}

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
				const blank: TextItem = { id: crypto.randomUUID(), type: 'text', x, y, ...box, rot: 0, size, color, text: '', lines: [], ...style, ...newTextFormat(), ...(align !== 'left' && { align }), sizing: dragged ? 'fixed' : 'auto-width' };
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
				const text = on && isCommented(on) ? on.text : '';
				if (el.root.title !== text) el.root.title = text;
				// Editing content: the object under the pointer shows its outline
				if (tools.tool === 'content' && contentEdit.on && !e.buttons) {
					const over = s.pageAt(x, y);
					const items = over ? pdf.contentItems(over.index) : null;
					const found = over && items ? contentAt(items, over.x, over.y, 4 / s.view.zoom) : null;
					const now = over && found ? { page: over.index, id: found.id } : null;
					if (now?.page !== contentEdit.hover?.page || now?.id !== contentEdit.hover?.id) contentEdit.hover = now;
				}
				// With "Hand" a link shows that it can be clicked
				if (tools.tool !== 'hand') return;
				const hit = s.pageAt(x, y);
				const at = hit ? pdf.linkAt(hit.index, hit.x, hit.y) : Promise.resolve(null);
				void at.then((found) => {
					if (tools.tool === 'hand') el.root.style.cursor = found ? 'pointer' : '';
				});
			};
			el.root.addEventListener('pointermove', hover);
			pdf.listener = {
				stroke: (id, scene, item) => s.committed(id, scene, item),
				region: (id, box) => s.regionChanged(id, box),
				backdrop: (id) => {
					s.backdropChanged(id);
					// Its text may lie elsewhere now (content edited)
					s.onview?.();
				},
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
					const marks = hit.items.filter((item) => isMarkup(item) || isCommented(item));
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
						if (!editable()) return null;
						const kind = measureTool.kind;
						if (!kind) return pdf.items.addShape(page, fit, color, size, style);
						if (kind === 'calibrate') {
							// Only asked for its real length, never kept; a slip of a few points is no distance
							const points = fit.kind === 'line' ? Math.hypot(fit.x1 - fit.x0, fit.y1 - fit.y0) : 0;
							if (points >= 3 && oncalibrate) {
								s.setRubber({ page, points: shapePoints(fit, size), color, size });
								oncalibrate(points, () => s.setRubber(null));
							}
							return null;
						}
						// A measurement: the shape with what it measures and the PDF's scale; a distance ends in bars
						const drawn = kind === 'distance' && fit.kind === 'line' ? { ...fit, start: 'bar' as const, end: 'bar' as const } : fit;
						return pdf.items.addItem(page, { ...withStyle({ id: crypto.randomUUID(), type: 'shape', fit: drawn, color, size }, style), measure: { kind, ...pdf.measureScale() } });
					},
					path: { fit: (page, id) => pdf.items.shapeFit(page, id), set: (page, id, fit, style) => pdf.items.setFit(page, id, fit, style) },
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
							: tool === 'insert'
								? insert(s, pdf, selection, x, y)
								: tool === 'replace'
								? mark(s, pdf, layers, 'strikeout', x, y, selection)
								: tool === 'area'
								? area(s, pdf, layers, x, y)
								: tool === 'attach'
								? attach(s, pdf, selection, x, y)
								: tool === 'capture'
								? capture(s, pdf, layers, x, y)
								: tool === 'link'
								? link(s, pdf, layers, selection, x, y)
								: tool === 'content'
								? content(s, pdf, x, y, e)
								: tool === 'stamp'
								? stamp(s, pdf, selection, x, y)
								: tool === 'note'
								? note(s, pdf, selection, x, y)
								: tool === 'callout'
									? callout(s, pdf, selection, x, y)
								: isTextTool(tool)
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
				if (!on || !(isText(on.item) || isCommented(on.item) || isLink(on.item) || (isStamp(on.item) && !on.item.image)) || !editable()) return;
				selection.select(on.page, new Set([on.item.id]));
				onedit?.(on.item.id);
			};
			el.root.addEventListener('dblclick', dblclick);
			// A click or tap with "Hand" that didn't move the view follows a link (also one of the file)
			let pressed: [number, number] | null = null;
			const press = (e: PointerEvent) => (pressed = [e.clientX, e.clientY]);
			const click = (e: MouseEvent) => {
				const from = pressed;
				pressed = null;
				if (tools.tool !== 'hand' || !from || Math.hypot(e.clientX - from[0], e.clientY - from[1]) > 5) return;
				const hit = s.pageAt(...s.local(e.clientX, e.clientY));
				if (hit) onlink?.(hit.index, hit.x, hit.y);
			};
			el.root.addEventListener('pointerdown', press);
			el.root.addEventListener('click', click);
			// Text boxes drawn before their font was there: drawn again with it
			void Promise.all([loadTextFont(), loadFonts(DOCUMENT_FONTS)]).then(() => {
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
				el.root.removeEventListener('pointerdown', press);
				el.root.removeEventListener('click', click);
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
		const marking = isMarkTool(tools.tool) || isCaretTool(tools.tool);
		const placing = tools.tool === 'note' || isTextTool(tools.tool) || tools.tool === 'area' || tools.tool === 'stamp' || tools.tool === 'capture' || tools.tool === 'attach' || tools.tool === 'link';
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

	// Content editing: what is picked, hovered and dragged, drawn over the pages
	$effect(() => {
		if (!contentHost) return;
		const overlay = new ContentOverlay(contentHost);
		contentMarks = overlay;
		untrack(() => stage?.onview?.());
		return () => {
			overlay.set([]);
			contentMarks = null;
		};
	});
	$effect(() => {
		const overlay = contentMarks;
		if (!overlay) return;
		void doc.contentChanges;
		const { on, page, ids, drag, band, hover } = contentEdit;
		const marks: ContentMark[] = [];
		if (on && tools.tool === 'content') {
			const items = page !== null ? (doc.contentItems(page) ?? []).filter((i) => ids.has(i.id)) : [];
			const boxes = items.map((i) => movedBox(i.box, drag));
			// Many objects: the frame says enough
			if (page !== null && boxes.length <= 150) for (const box of boxes) marks.push({ index: page, box, kind: 'object' });
			const frame = unionBox(boxes);
			if (page !== null && frame) marks.push({ index: page, box: frame, kind: 'frame' });
			if (hover && !drag && !(hover.page === page && ids.has(hover.id))) {
				const item = doc.contentItems(hover.page)?.find((i) => i.id === hover.id);
				if (item) marks.push({ index: hover.page, box: item.box, kind: 'hover' });
			}
			if (band) marks.push({ index: band.page, box: band.box, kind: 'band' });
		}
		untrack(() => overlay.set(marks));
	});
	// What is dragged, shown moving along; after the drop it stays until the page shows the change
	$effect(() => {
		const overlay = contentMarks;
		if (!overlay) return;
		const { lifted, drag } = contentEdit;
		const matrix = lifted && (drag ?? lifted.at);
		untrack(() => overlay.lift(lifted && matrix ? { index: lifted.page, canvas: lifted.canvas, matrix } : null));
	});
	$effect(() => {
		void doc.contentShown;
		untrack(() => (contentEdit.lifted = null));
	});
	// The switch turned on: the pages in view are read
	$effect(() => {
		if (contentEdit.on) untrack(() => stage?.onview?.());
	});
	// Keys while objects of the content are picked: Del takes them out, the arrows move them (Shift: 10 points),
	// Esc ends the selection (before it leaves the tool)
	$effect(() => {
		const key = (e: KeyboardEvent) => {
			if (!contentEdit.on || tools.tool !== 'content' || contentEdit.page === null || !contentEdit.ids.size) return;
			const t = e.target as HTMLElement | null;
			if (t?.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open], :popover-open')) return;
			const step = e.shiftKey ? 10 : 1;
			const move: Record<string, Matrix> = { ArrowLeft: [1, 0, 0, 1, -step, 0], ArrowRight: [1, 0, 0, 1, step, 0], ArrowUp: [1, 0, 0, 1, 0, -step], ArrowDown: [1, 0, 0, 1, 0, step] };
			if (e.key === 'Delete' || e.key === 'Backspace') {
				doc.removeContent(contentEdit.page, contentEdit.ids);
				contentEdit.clear();
			} else if (move[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) doc.transformContent(contentEdit.page, contentEdit.ids, move[e.key]);
			else if (e.key === 'Escape') contentEdit.clear();
			else return;
			e.preventDefault();
			e.stopImmediatePropagation();
		};
		window.addEventListener('keydown', key, true);
		return () => window.removeEventListener('keydown', key, true);
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
	<!-- What is picked of the pages' own content ("Edit content") -->
	<div bind:this={contentHost} class="pointer-events-none absolute inset-0 overflow-hidden"></div>
	<!-- The stamp about to be placed, at the pointer -->
	<canvas bind:this={stampGhost} class="pointer-events-none absolute top-0 left-0 opacity-60" style:display="none"></canvas>
	{#if stage}{@render children?.(stage)}{/if}
</SurfaceLayers>
