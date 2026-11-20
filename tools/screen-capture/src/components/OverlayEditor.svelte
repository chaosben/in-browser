<script lang="ts">
	import { untrack } from 'svelte';
	import type { Editor } from '#lib/project/editor.svelte.js';
	import { itemIcon, itemLabel } from '#lib/project/labels.js';
	import type {
		Annotation,
		CalloutAnnotation,
		Clip,
		IconAnnotation,
		ImageAnnotation,
		Item,
		Rect,
		TextAnnotation,
		ZoomSegment
	} from '#lib/project/types.js';
	import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { endLibraryDrag, saveSelection, trackLibraryDrag, type LibraryScope } from '#lib/ui/library.svelte.js';
	import type { Player } from '#lib/preview/player.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import { rememberStyle } from '#lib/project/styles.js';
	import { fontState } from '#lib/render/fonts.svelte.js';
	import { LINE_HEIGHT as TEXT_LINE_HEIGHT, moveAnnotation, overlayBounds } from '#lib/render/overlays.js';
	import { resizeTextBox, type TextHandle, type TextSizing } from '@in-browser/graphics/text-box.js';
	import { FULL, dragCrop, fullRect, type CropHandle } from '#lib/project/crop.js';
	import {
		clampZoomRect,
		cornerPoint,
		CORNERS,
		CROP_HANDLES,
		padded,
		resized,
		resizedKeepingAspect,
		resizedZoom,
		sign,
		type Corner
	} from '#lib/project/geometry.js';
	import { ZOOM_ICON } from '#lib/project/defaults.js';
	import {
		snapAspect,
		snapLine,
		SNAP_PX,
		snapMove,
		snapPoint,
		snapTargets,
		guideView,
		type Guides,
		type SnapTargets,
		type Tolerance
	} from '@in-browser/graphics/snap.js';
	import { snapping } from '#lib/ui/snapping.svelte.js';
	import SnapGuides from '@in-browser/graphics/SnapGuides.svelte';
	import { FULL_VIEW, itemsAt, trackState, updateItem, updateZoom, viewAt, zoomAt } from '#lib/timeline/ops.js';
	import { pointerDrag } from '@in-browser/brand/ui/drag.js';

	interface Props {
		editor: Editor;
		player: Player;
		/** Opens the context menu for the selection, plus entries of the preview */
		itemMenu: (e: MouseEvent, extra?: MenuEntry[]) => void;
	}

	let { editor, player, itemMenu }: Props = $props();

	/** Movement in screen pixels below which a press with a click alternative counts as a click */
	const CLICK_PX = 3;

	let layer: HTMLDivElement;
	/** Lines snapped to during a drag */
	let guides = $state<Guides | null>(null);
	/** Items the lines of the running drag come from (same order as `SnapTargets.boxes`) */
	let snapSources = $state.raw<{ items: Item[]; boxes: Rect[] }>({ items: [], boxes: [] });

	const timeline = $derived(editor.project.timeline);
	const selectedZoom = $derived(editor.selectedZoom);
	const selectedOverlay = $derived(editor.selectedOverlay);
	const selectedClip = $derived(editor.selectedClip);
	const croppingClip = $derived(editor.croppingClip);
	// When paused (and while editing a zoom segment) the preview shows the full frame, so everything stays editable;
	// the zoom is seen during playback and in the export.
	const full = $derived(!!selectedZoom || !player.playing);
	const view = $derived(full ? FULL_VIEW : viewAt(timeline, player.time));
	/** Zoom segment under the playhead, marked while paused */
	const pausedZoom = $derived(!player.playing && !selectedZoom ? zoomAt(timeline, player.time) : null);
	// Back to front so items in front are also on top when clicked. Excludes items on
	// hidden/locked tracks and audio-only clips (no picture).
	const active = $derived(
		itemsAt(timeline, player.time).filter((item) => {
			const state = trackState(timeline, item.track);
			if (state.hidden || state.locked) return false;
			return item.type === 'annotation' || !!editor.source(item.sourceId)?.hasVideo;
		})
	);
	const W = $derived(editor.project.width);
	const H = $derived(editor.project.height);

	$effect(() => {
		player.forcedView = full ? FULL_VIEW : null;
		// redraw reads reactive values itself (e.g. the time) – they must not trigger this effect
		untrack(() => player.redraw());
		return () => (player.forcedView = null);
	});

	/** Bounds of an annotation; text sizes change once their font has loaded */
	function bounds(o: Annotation) {
		void fontState.version;
		return overlayBounds(o, W, H);
	}

	/** Content coordinates → CSS percent within the visible view */
	const px = (v: number) => `${(v - view.x) / view.w * 100}%`;
	const py = (v: number) => `${(v - view.y) / view.h * 100}%`;
	const pw = (v: number) => `${(v / view.w) * 100}%`;
	const ph = (v: number) => `${(v / view.h) * 100}%`;

	function boxStyle(r: Rect, minPad = 0) {
		const b = padded(r, minPad);
		return `left: ${px(b.x)}; top: ${py(b.y)}; width: ${pw(b.w)}; height: ${ph(b.h)}`;
	}

	/** Lines to snap to: canvas and the other visible items under the playhead (locked ones too) */
	function targetsFor(exclude?: string) {
		const items = itemsAt(timeline, player.time)
			.filter((item) => item.id !== exclude && !trackState(timeline, item.track).hidden)
			.filter((item) => item.type === 'annotation' || !!editor.source(item.sourceId)?.hasVideo);
		const boxes = items.map((item) => (item.type === 'annotation' ? bounds(item) : item.rect));
		snapSources = { items, boxes };
		return snapTargets(boxes);
	}

	/** The guides as shown: what each line snaps to (the canvas or an item with its type icon), gaps in pixels */
	const guideMarks = $derived(
		guides &&
			guideView(
				guides,
				snapSources.boxes,
				{ x: 0, y: 0, w: 1, h: 1 },
				(box) => {
					const item = box === null ? null : snapSources.items[box];
					return item
						? { icon: itemIcon(item, editor), label: m.preview.snapItem(itemLabel(item, editor)) }
						: { icon: 'icon-[material-symbols-light--crop-free]', label: m.preview.snapCanvas };
				},
				(gap) => m.preview.gap(Math.round((gap.to - gap.from) * (gap.axis === 'x' ? W : H)))
			)
	);

	interface DragStep {
		/** Snap distance per axis; `null`: snapping off (switch, or reversed with Alt) */
		tol: Tolerance | null;
		/** Shift: move along one axis only (corners: keep the proportions) */
		lockAxis: boolean;
		/** K held: a text box's font scales with its box */
		scaleText: boolean;
	}

	/** K held (as Figma's scale tool): a text box's handles scale its font too */
	let scaleKey = false;
	/** A drag in the preview is running: K then scales instead of playing */
	let dragging = false;
	$effect(() => {
		const key = (down: boolean) => (e: KeyboardEvent) => {
			if (e.key.toLowerCase() !== 'k' || e.ctrlKey || e.metaKey || e.altKey) return;
			if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')) return;
			scaleKey = down;
			if (!dragging) return;
			// While dragging, K is not "Play" (captured before the editor's shortcuts)
			e.preventDefault();
			e.stopImmediatePropagation();
		};
		const down = key(true);
		const up = key(false);
		const blur = () => (scaleKey = false);
		window.addEventListener('keydown', down, true);
		window.addEventListener('keyup', up, true);
		window.addEventListener('blur', blur);
		return () => {
			window.removeEventListener('keydown', down, true);
			window.removeEventListener('keyup', up, true);
			window.removeEventListener('blur', blur);
		};
	});

	/**
	 * Mouse drag; `onmove` receives the offset in content coordinates. With `libraryKey` (the gesture's undo key)
	 * the selection can be dropped onto the library: there the move is undone and the save dialog opens. With
	 * `onclick` the drag only starts after `CLICK_PX`; released before, `onclick` runs instead.
	 */
	function drag(
		e: PointerEvent,
		onmove: (dx: number, dy: number, step: DragStep) => void,
		libraryKey?: string,
		onclick?: () => void
	) {
		if (e.button !== 0) return;
		e.stopPropagation();
		e.preventDefault();
		// Arrow keys now move the selection
		layer.focus({ preventScroll: true });
		const rect = layer.getBoundingClientRect();
		const x0 = e.clientX;
		const y0 = e.clientY;
		const { w, h } = view;
		const tol = { x: (SNAP_PX / rect.width) * w, y: (SNAP_PX / rect.height) * h };
		let target: LibraryScope | null = null;
		let moved = !onclick;
		dragging = true;
		const move = (ev: PointerEvent) => {
			if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < CLICK_PX) return;
			moved = true;
			guides = null;
			if (libraryKey) {
				// Outside the preview area the elements hang at the pointer, on their way to the library
				const away = trackLibraryDrag(editor, ev.clientX, ev.clientY, layer.closest('[data-preview-area]'));
				target = away.target;
				if (away.outside) return editor.cancelGesture(libraryKey);
			}
			onmove(((ev.clientX - x0) / rect.width) * w, ((ev.clientY - y0) / rect.height) * h, {
				tol: snapping.active(ev) ? tol : null,
				lockAxis: ev.shiftKey,
				scaleText: scaleKey
			});
		};
		pointerDrag(e, move, () => {
			dragging = false;
			guides = null;
			editor.endGesture();
			endLibraryDrag();
			if (!moved) return onclick?.();
			if (target) saveSelection(editor, target);
		});
	}

	/** Offset of a moved box: Shift keeps it on the axis it moved most along, then it snaps on the free axes */
	function moveBy(box: Rect, dx: number, dy: number, step: DragStep, targets: SnapTargets) {
		const locked = step.lockAxis ? (Math.abs(dx) >= Math.abs(dy) ? 'y' : 'x') : null;
		if (locked === 'x') dx = 0;
		if (locked === 'y') dy = 0;
		if (step.tol) {
			const s = snapMove({ ...box, x: box.x + dx, y: box.y + dy }, targets, step.tol);
			if (locked !== 'x') dx += s.dx;
			if (locked !== 'y') dy += s.dy;
			guides = {
				x: locked === 'x' ? null : s.guides.x,
				y: locked === 'y' ? null : s.guides.y,
				gaps: s.guides.gaps.filter((g) => g.axis !== locked)
			};
		}
		return { dx, dy };
	}

	function patchOverlay(id: string, patch: Partial<Annotation>, key: string) {
		editor.update((t) => updateItem(t, id, patch), key);
	}

	/** Size dragged at the corner (text, speech bubble, step, click) – also used for the next annotation of that type */
	function resizeTo(o: Annotation, size: number, key: string) {
		patchOverlay(o.id, { size }, key);
		rememberStyle(o.kind, { size });
	}

	/**
	 * Pressed on a selected item with an unselected one in front: a click (no drag) selects the front one, since the
	 * selected item's area lies on top. `undefined` otherwise – then the pressed item is selected right away.
	 */
	function clickInFront(e: PointerEvent, id: string): (() => void) | undefined {
		if (!editor.isSelected('item', id)) return void editor.select('item', id);
		const front = itemsUnder(e)[0];
		if (!front || front.id === id || editor.isSelected('item', front.id)) return void editor.select('item', id);
		return () => editor.select('item', front.id);
	}

	/** What moving an item or zoom view changes: its box (for snapping) and the patch for an offset (`key`: undo step) */
	function moveTargetOf(target: Item | ZoomSegment): { box: Rect; apply: (dx: number, dy: number, key: string) => void } {
		if (!('type' in target)) {
			const z = target;
			return {
				box: z.rect,
				apply: (dx, dy, key) =>
					editor.update((t) => updateZoom(t, z.id, { rect: clampZoomRect({ ...z.rect, x: z.rect.x + dx, y: z.rect.y + dy }) }), key)
			};
		}
		const item = target;
		if (item.type === 'annotation') {
			return { box: bounds(item), apply: (dx, dy, key) => patchOverlay(item.id, moveAnnotation(item, dx, dy), key) };
		}
		const r = item.rect;
		return {
			box: r,
			apply: (dx, dy, key) => editor.update((t) => updateItem(t, item.id, { rect: { ...r, x: r.x + dx, y: r.y + dy } }), key)
		};
	}

	/** Drags an item or the selected zoom view; items can also be dropped onto the library */
	function startMove(e: PointerEvent, target: Item | ZoomSegment, onclick?: () => void) {
		const isItem = 'type' in target;
		const key = `move-${target.id}-${e.timeStamp}`;
		const { box, apply } = moveTargetOf(target);
		const targets = targetsFor(isItem ? target.id : undefined);
		drag(
			e,
			(dx, dy, step) => {
				const d = moveBy(box, dx, dy, step, targets);
				apply(d.dx, d.dy, key);
			},
			isItem ? key : undefined,
			onclick
		);
	}

	function moveItem(e: PointerEvent, item: Item) {
		if (e.button !== 0) return;
		startMove(e, item, clickInFront(e, item.id));
	}

	/** Scales a clip, image or icon at a corner keeping its aspect ratio; the nearer edge snaps */
	function resizeKeepingAspect(e: PointerEvent, item: Clip | ImageAnnotation | IconAnnotation, corner: Corner, min: number) {
		const key = `resize-${item.id}-${e.timeStamp}`;
		const r = item.rect;
		const targets = targetsFor(item.id);
		drag(e, (dx, dy, { tol }) => {
			let rect = resizedKeepingAspect(r, corner, dx, dy, min);
			if (tol) ({ rect, guides } = snapAspect(rect, sign(corner, 'e'), sign(corner, 's'), targets, tol, min));
			editor.update((t) => updateItem(t, item.id, { rect }), key);
		});
	}

	function resizeOverlay(e: PointerEvent, o: Annotation, corner: Corner) {
		if (o.kind === 'image' || o.kind === 'icon') return resizeKeepingAspect(e, o, corner, 0.01);
		const key = `resize-${o.id}-${e.timeStamp}`;
		const targets = targetsFor(o.id);
		drag(e, (dx, dy, step) => {
			const { tol } = step;
			if (o.kind === 'arrow' || o.kind === 'line') return;
			if (o.kind === 'text' || o.kind === 'callout') return resizeText(o, corner, dx, dy, step, key, targets);
			if (o.kind === 'step' || o.kind === 'click') {
				// The center stays, the corner sets the diameter
				return resizeTo(o, Math.max(0.02, o.size + 2 * dy), key);
			}
			if (tol) {
				// The dragged corner snaps; the opposite one stays
				const c = cornerPoint(o.rect, corner);
				const s = snapPoint({ x: c.x + dx, y: c.y + dy }, targets, tol);
				dx = s.point.x - c.x;
				dy = s.point.y - c.y;
				guides = s.guides;
			}
			patchOverlay(o.id, { rect: resized(o.rect, corner, dx, dy) }, key);
		});
	}

	/** The sides of a text box: left/right set its width, top/bottom a fixed size; the opposite side stays */
	function resizeTextSide(e: PointerEvent, o: TextAnnotation | CalloutAnnotation, side: 'n' | 'e' | 's' | 'w') {
		const key = `width-${o.id}-${e.timeStamp}`;
		const targets = targetsFor(o.id);
		drag(e, (dx, dy, step) => resizeText(o, side, dx, dy, step, key, targets));
	}

	/**
	 * A text box resized like in Figma (`resizeTextBox`): handles change only the box – a side the width (auto width
	 * becomes auto height), top, bottom and corners a fixed size; Shift keeps a corner's proportions; K scales the
	 * font along. The dragged edge snaps. One patch per step: within a gesture every update starts from the state
	 * before it.
	 */
	function resizeText(o: TextAnnotation | CalloutAnnotation, handle: TextHandle, dx: number, dy: number, step: DragStep, key: string, targets: SnapTargets) {
		const b = overlayBounds(o, W, H);
		const east = handle.includes('e');
		const west = handle.includes('w');
		const south = handle.includes('s');
		const north = handle.includes('n');
		if (step.tol) {
			// The dragged edges snap
			const sx = east || west ? snapLine((east ? b.x + b.w : b.x) + dx, targets.xs, step.tol.x) : null;
			const sy = north || south ? snapLine((south ? b.y + b.h : b.y) + dy, targets.ys, step.tol.y) : null;
			if (sx) dx = sx.value - (east ? b.x + b.w : b.x);
			if (sy) dy = sy.value - (south ? b.y + b.h : b.y);
			guides = { x: sx?.line ?? null, y: sy?.line ?? null, gaps: [] };
		}
		const pad = o.background ? o.padding * H : 0;
		const sizing: TextSizing = o.boxWidth === undefined ? 'auto-width' : o.boxHeight === undefined ? 'auto-height' : 'fixed';
		const r = resizeTextBox({ x: b.x * W, y: b.y * H, w: b.w * W, h: b.h * H }, sizing, handle, dx * W, dy * H, {
			keepAspect: step.lockAxis,
			scaleText: step.scaleText,
			// About two characters wide, one line high
			minW: 2 * o.size * H + 2 * pad,
			minH: o.size * H * TEXT_LINE_HEIGHT + 2 * pad
		});
		const box = {
			boxWidth: r.sizing === 'auto-width' ? undefined : r.rect.w / W,
			boxHeight: r.sizing === 'fixed' ? r.rect.h / H : undefined
		};
		if (r.scale === 1) return patchOverlay(o.id, { x: r.rect.x / W, y: r.rect.y / H, ...box }, key);
		const k = r.scale;
		const size = o.size * k;
		patchOverlay(o.id, { x: r.rect.x / W, y: r.rect.y / H, ...box, size, radius: o.radius * k, padding: o.padding * k }, key);
		rememberStyle(o.kind, { size });
	}

	/** Moves an end of an arrow or line, or the tip of a speech bubble */
	function movePoint(e: PointerEvent, o: Annotation, point: 'from' | 'to' | 'tip') {
		const p = point === 'tip' ? (o.kind === 'callout' ? o.tip : null) : o.kind === 'arrow' || o.kind === 'line' ? o[point] : null;
		if (!p) return;
		const key = `point-${o.id}-${point}-${e.timeStamp}`;
		const targets = targetsFor(o.id);
		drag(e, (dx, dy, { tol }) => {
			let next = { x: p.x + dx, y: p.y + dy };
			if (tol) ({ point: next, guides } = snapPoint(next, targets, tol));
			patchOverlay(o.id, { [point]: next }, key);
		});
	}

	// --- Zoom segment: view with fixed aspect ratio (w === h in normalized coordinates)

	function resizeZoom(e: PointerEvent, z: ZoomSegment, corner: Corner) {
		const key = `zoom-resize-${z.id}-${e.timeStamp}`;
		const r = z.rect;
		drag(e, (dx, dy) => editor.update((t) => updateZoom(t, z.id, { rect: resizedZoom(r, corner, dx, dy) }), key));
	}

	/** Label or edge of the marked zoom area: selects the segment (the layer below would clear the selection) */
	function pickZoom(e: PointerEvent, id: string) {
		e.stopPropagation();
		editor.select('zoom', id);
	}

	/** Same label for the marked and the selected zoom area */
	const zoomLabelClass = 'bg-zoom text-zoom-content absolute top-1 left-1 flex items-center gap-0.5 rounded px-1 text-xs';

	// --- Clips

	/** Crop mode: an edge or corner crops the clip; the content stays in place, the moved edges snap */
	function cropClip(e: PointerEvent, c: Clip, handle: CropHandle) {
		const source = editor.source(c.sourceId);
		if (!source) return;
		const key = `clip-crop-${c.id}-${e.timeStamp}`;
		const crop = c.crop ?? FULL;
		const whole = fullRect(c.rect, crop);
		const r = c.rect;
		const ex = handle.includes('w') ? r.x : handle.includes('e') ? r.x + r.w : null;
		const ey = handle.includes('n') ? r.y : handle.includes('s') ? r.y + r.h : null;
		const targets = targetsFor(c.id);
		drag(e, (dx, dy, { tol }) => {
			if (tol) {
				const sx = ex === null ? null : snapLine(ex + dx, targets.xs, tol.x);
				const sy = ey === null ? null : snapLine(ey + dy, targets.ys, tol.y);
				if (sx && ex !== null) dx = sx.value - ex;
				if (sy && ey !== null) dy = sy.value - ey;
				guides = { x: sx?.line ?? null, y: sy?.line ?? null, gaps: [] };
			}
			editor.setCrop(c.id, dragCrop(crop, handle, dx, dy, whole, source), key);
		});
	}

	// --- Arrow keys while the preview has the focus: move the selection by canvas pixels (Shift: 10)

	const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

	/** Running key sequence: one undo step, applied to the state at its first key */
	let nudge: { key: string; apply: (dx: number, dy: number) => void; dx: number; dy: number } | null = null;

	/** Selected element that can be moved here (not on a hidden or locked track) */
	function nudgeTarget(): ((dx: number, dy: number, key: string) => void) | null {
		if (selectedZoom) return moveTargetOf(selectedZoom).apply;
		const item = [selectedOverlay, selectedClip].find((i) => i && active.some((a) => a.id === i.id));
		return item ? moveTargetOf(item).apply : null;
	}

	/** Minimum size of an annotation's click area (thin lines), as in its `boxStyle` */
	const MIN_HIT = 0.02;

	/** Click area of an item in content coordinates */
	function hitBox(item: Item): Rect {
		return item.type === 'annotation' ? padded(bounds(item), MIN_HIT) : item.rect;
	}

	/** Editable items under a mouse position, the front one first */
	function itemsUnder(e: MouseEvent): Item[] {
		const rect = layer.getBoundingClientRect();
		const x = view.x + ((e.clientX - rect.left) / rect.width) * view.w;
		const y = view.y + ((e.clientY - rect.top) / rect.height) * view.h;
		return active
			.filter((item) => {
				const r = hitBox(item);
				return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
			})
			.reverse();
	}

	/** Item highlighted from the context menu */
	let highlighted = $state<string | null>(null);

	/**
	 * Right click: selects the front item unless one under the pointer is already selected; with several items
	 * under the pointer, the menu lists them to select a covered one.
	 */
	function onContextMenu(e: MouseEvent) {
		if (selectedZoom) return itemMenu(e);
		const under = itemsUnder(e);
		if (!under.length) editor.selection = null;
		else if (!under.some((item) => editor.isSelected('item', item.id))) editor.clickItem(under[0].id);
		layer.focus({ preventScroll: true });
		const pick: MenuEntry[] =
			under.length > 1
				? [
						{ heading: m.menu.pickElement },
						...under.map((item) => ({
							label: itemLabel(item, editor),
							icon: itemIcon(item, editor),
							run: () => editor.clickItem(item.id),
							onhover: (on: boolean) => (highlighted = on ? item.id : null)
						}))
					]
				: [];
		itemMenu(e, pick);
	}

	/** Tab / Shift+Tab: next / previous item under the playhead, front to back */
	function cycle(back: boolean) {
		const order = [...active].reverse();
		if (!order.length) return;
		const current = order.findIndex((item) => editor.isSelected('item', item.id));
		const next = current < 0 ? (back ? order.length - 1 : 0) : (current + (back ? -1 : 1) + order.length) % order.length;
		editor.clickItem(order[next].id);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && croppingClip) {
			e.preventDefault();
			return editor.endCrop();
		}
		if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
			e.preventDefault();
			return cycle(e.shiftKey);
		}
		const dir = ARROWS[e.key];
		// Ctrl/Cmd + arrows stay with the editor (track order)
		if (!dir || e.ctrlKey || e.metaKey || e.altKey) return;
		if (!nudge) {
			const move = nudgeTarget();
			if (!move) return;
			const key = `nudge-${e.timeStamp}`;
			nudge = { key, apply: (dx, dy) => move(dx, dy, key), dx: 0, dy: 0 };
		}
		// Not the frame step of the editor's shortcuts
		e.preventDefault();
		e.stopPropagation();
		const px = e.shiftKey ? 10 : 1;
		nudge.dx += (dir[0] * px) / W;
		nudge.dy += (dir[1] * px) / H;
		nudge.apply(nudge.dx, nudge.dy);
	}

	function endNudge() {
		if (!nudge) return;
		nudge = null;
		editor.endGesture();
	}

	function cornerPos(r: Rect, c: Corner) {
		const p = cornerPoint(r, c);
		return `left: ${px(p.x)}; top: ${py(p.y)}`;
	}

	const handle =
		'absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-black/60 bg-white shadow cursor-pointer';
	const sideHandle =
		'absolute h-4 w-2 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-black/60 bg-white shadow cursor-ew-resize';
	const sideHandleNS =
		'absolute h-2 w-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-black/60 bg-white shadow cursor-ns-resize';
	const cursors: Record<Corner, string> = {
		nw: 'cursor-nwse-resize',
		se: 'cursor-nwse-resize',
		ne: 'cursor-nesw-resize',
		sw: 'cursor-nesw-resize'
	};
	// Crop handles look different from the scaling ones: filled bars in the selection color
	const cropBase = 'absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white bg-selection shadow';
	const cropCorner = `${cropBase} size-3.5`;
	const cropSideNS = `${cropBase} h-2 w-5`;
	const cropSideEW = `${cropBase} h-5 w-2`;
	const cropCursors: Record<CropHandle, string> = {
		...cursors,
		n: 'cursor-ns-resize',
		s: 'cursor-ns-resize',
		w: 'cursor-ew-resize',
		e: 'cursor-ew-resize'
	};
</script>

<!-- Scaling handles at the corners of `r` -->
{#snippet cornerHandles(r: Rect, ondown: (e: PointerEvent, corner: Corner) => void, corners: Corner[] = CORNERS)}
	{#each corners as c (c)}
		<div class="{handle} {cursors[c]}" style={cornerPos(r, c)} onpointerdown={(e) => ondown(e, c)} role="presentation"></div>
	{/each}
{/snippet}

{#snippet zoomLabel(r: Rect)}
	<span class="{ZOOM_ICON} size-3.5" aria-hidden="true"></span>
	{m.preview.zoom((1 / r.w).toFixed(1))}
{/snippet}

<div
	bind:this={layer}
	class="absolute inset-0 overflow-hidden outline-none"
	tabindex="-1"
	onpointerdown={(e) => {
		if (e.button !== 0) return;
		editor.selection = null;
		layer.focus({ preventScroll: true });
	}}
	onkeydown={onKeyDown}
	onkeyup={(e) => {
		if (ARROWS[e.key]) endNudge();
	}}
	onfocusout={endNudge}
	oncontextmenu={onContextMenu}
	role="presentation"
>
	{#if selectedZoom}
		{@const z = selectedZoom}
		<!-- Dim outside the zoom view -->
		<div
			class="border-zoom absolute cursor-move border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
			style={boxStyle(z.rect)}
			onpointerdown={(e) => startMove(e, z)}
			role="presentation"
		>
			<span class={zoomLabelClass}>{@render zoomLabel(z.rect)}</span>
		</div>
		{@render cornerHandles(z.rect, (e, c) => resizeZoom(e, z, c))}
	{:else}
		<!-- The selected items last, so they are on top: a covered item, once selected, can be moved directly -->
		{#each [...active.filter((i) => !editor.isSelected('item', i.id)), ...active.filter((i) => editor.isSelected('item', i.id))] as item (item.id)}
			{@const selected = editor.isSelected('item', item.id)}
			{@const frame = selected ? 'border-selection border-2 border-dashed' : 'hover:outline-selection/60 hover:outline-1'}
			{#if item.type === 'annotation'}
				<div
					class="absolute cursor-move {frame}"
					style={boxStyle(bounds(item), MIN_HIT)}
					onpointerdown={(e) => moveItem(e, item)}
					role="presentation"
				></div>
			{:else}
				<div
					class="absolute cursor-move {frame}"
					style={boxStyle(item.rect)}
					onpointerdown={(e) => moveItem(e, item)}
					ondblclick={() => editor.startCrop(item.id)}
					role="presentation"
				></div>
			{/if}
		{/each}

		{@const lit = highlighted && active.find((item) => item.id === highlighted)}
		{#if lit}
			<!-- Element pointed at in the context menu -->
			<div class="bg-selection/20 outline-selection pointer-events-none absolute outline-2 outline-dashed" style={boxStyle(hitBox(lit))}></div>
		{/if}

		{#if pausedZoom}
			{@const z = pausedZoom}
			<!-- Marks what the zoom will show. Label and edge select the segment; the area inside stays free for the
				 items below (the zoom often covers almost the whole frame). After the items, so label/edge are on top. -->
			<div
				class="border-zoom pointer-events-none absolute border-2 border-dashed shadow-[0_0_0_9999px_rgba(0,0,0,0.25)] has-[[data-zoom-pick]:hover]:border-solid"
				style={boxStyle(z.rect)}
			>
				{#each ['-top-1 inset-x-0 h-2', '-bottom-1 inset-x-0 h-2', '-left-1 inset-y-0 w-2', '-right-1 inset-y-0 w-2'] as edge (edge)}
					<div
						class="pointer-events-auto absolute cursor-pointer {edge}"
						data-zoom-pick
						title={m.preview.selectZoom}
						onpointerdown={(e) => pickZoom(e, z.id)}
						role="presentation"
					></div>
				{/each}
				<button
					type="button"
					class="{zoomLabelClass} pointer-events-auto cursor-pointer hover:brightness-110"
					data-zoom-pick
					title={m.preview.selectZoom}
					aria-label={m.preview.selectZoom}
					onpointerdown={(e) => pickZoom(e, z.id)}
				>
					{@render zoomLabel(z.rect)}
				</button>
			</div>
		{/if}

		{#if croppingClip && active.some((c) => c.id === croppingClip.id)}
			{@const c = croppingClip}
			<!-- Crop mode: outline of the whole source, handles crop instead of scaling -->
			<div class="outline-selection pointer-events-none absolute outline-2 outline-dashed" style={boxStyle(fullRect(c.rect, c.crop))}></div>
			{#each CROP_HANDLES as { handle: h, at } (h)}
				{@const [x, y] = at(c.rect)}
				<div
					class="{h.length === 2 ? cropCorner : h === 'n' || h === 's' ? cropSideNS : cropSideEW} {cropCursors[h]}"
					style="left: {px(x)}; top: {py(y)}"
					title={m.inspector.crop}
					onpointerdown={(e) => cropClip(e, c, h)}
					role="presentation"
				></div>
			{/each}
		{:else if selectedClip && active.some((c) => c.id === selectedClip.id)}
			{@const c = selectedClip}
			{@render cornerHandles(c.rect, (e, corner) => resizeKeepingAspect(e, c, corner, 0.05))}
		{/if}

		{#if selectedOverlay && active.some((o) => o.id === selectedOverlay.id)}
			{@const o = selectedOverlay}
			{#if o.kind === 'arrow' || o.kind === 'line'}
				<div
					class="{handle} cursor-crosshair"
					style="left: {px(o.from.x)}; top: {py(o.from.y)}"
					onpointerdown={(e) => movePoint(e, o, 'from')}
					role="presentation"
				></div>
				<div
					class="{handle} cursor-crosshair rounded-full"
					style="left: {px(o.to.x)}; top: {py(o.to.y)}"
					onpointerdown={(e) => movePoint(e, o, 'to')}
					role="presentation"
				></div>
			{:else if o.kind === 'step' || o.kind === 'click'}
				{@render cornerHandles(bounds(o), (e, c) => resizeOverlay(e, o, c), ['se'])}
			{:else if o.kind === 'text' || o.kind === 'callout'}
				{@const b = bounds(o)}
				{@render cornerHandles(b, (e, c) => resizeOverlay(e, o, c))}
				<!-- Sides: left/right the width (the text wraps), top/bottom a fixed size -->
				{#each ['n', 'e', 's', 'w'] as const as side (side)}
					<div
						class={side === 'e' || side === 'w' ? sideHandle : sideHandleNS}
						style="left: {px(side === 'w' ? b.x : side === 'e' ? b.x + b.w : b.x + b.w / 2)}; top: {py(side === 'n' ? b.y : side === 's' ? b.y + b.h : b.y + b.h / 2)}"
						onpointerdown={(e) => resizeTextSide(e, o, side)}
						role="presentation"
					></div>
				{/each}
				{#if o.kind === 'callout'}
					<div
						class="{handle} cursor-crosshair rounded-full"
						style="left: {px(o.tip.x)}; top: {py(o.tip.y)}"
						onpointerdown={(e) => movePoint(e, o, 'tip')}
						role="presentation"
					></div>
				{/if}
			{:else}
				{@render cornerHandles(o.rect, (e, c) => resizeOverlay(e, o, c))}
			{/if}
		{/if}
	{/if}

	<!-- Lines and equal gaps snapped to while dragging -->
	<SnapGuides view={guideMarks} unit={{ x: px, y: py, w: pw, h: ph }} />
</div>
