<script lang="ts">
	import { untrack } from 'svelte';
	import type { Editor } from '#lib/project/editor.svelte.js';
	import { itemIcon, itemLabel } from '#lib/project/labels.js';
	import type { Annotation, CalloutAnnotation, Clip, Item, Rect, TextAnnotation } from '#lib/project/types.js';
	import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { endLibraryDrag, saveSelection, trackLibraryDrag, type LibraryScope } from '#lib/ui/library.svelte.js';
	import type { Player } from '#lib/preview/player.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import { rememberStyle } from '#lib/project/styles.js';
	import { fontState } from '#lib/render/fonts.svelte.js';
	import { moveAnnotation, overlayBounds } from '#lib/render/overlays.js';
	import { ZOOM_ICON } from '#lib/project/defaults.js';
	import {
		snapAspect,
		snapLine,
		snapMove,
		snapPoint,
		snapTargets,
		type Guides,
		type SnapLine,
		type SnapTargets,
		type Tolerance
	} from '#lib/preview/snap.js';
	import { snapping } from '#lib/ui/snapping.svelte.js';
	import { FULL_VIEW, itemsAt, trackState, updateItem, updateZoom, viewAt, zoomAt } from '#lib/timeline/ops.js';

	interface Props {
		editor: Editor;
		player: Player;
		/** Opens the context menu for the selection, plus entries of the preview */
		itemMenu: (e: MouseEvent, extra?: MenuEntry[]) => void;
	}

	let { editor, player, itemMenu }: Props = $props();

	type Corner = 'nw' | 'ne' | 'sw' | 'se';
	const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se'];
	const MIN_SIZE = 0.01;
	/** Snap distance in screen pixels */
	const SNAP_PX = 6;

	let layer: HTMLDivElement;
	/** Lines snapped to during a drag */
	let guides = $state<Guides | null>(null);
	/** Items the lines of the running drag come from (same order as `SnapTargets.boxes`) */
	let snapSources = $state.raw<{ items: Item[]; boxes: Rect[] }>({ items: [], boxes: [] });

	const timeline = $derived(editor.project.timeline);
	const selectedZoom = $derived(editor.selectedZoom);
	const selectedOverlay = $derived(editor.selectedOverlay);
	const selectedClip = $derived(editor.selectedClip);
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
		const padX = Math.max(0, minPad - r.w) / 2;
		const padY = Math.max(0, minPad - r.h) / 2;
		return `left: ${px(r.x - padX)}; top: ${py(r.y - padY)}; width: ${pw(r.w + 2 * padX)}; height: ${ph(r.h + 2 * padY)}`;
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

	/** Other items the guides snap to (each once) */
	const snappedTo = $derived(
		[...new Set([guides?.x?.box, guides?.y?.box])].filter((box): box is number => box != null && box < snapSources.boxes.length)
	);

	interface DragStep {
		/** Snap distance per axis; `null`: snapping off (switch, or reversed with Alt) */
		tol: Tolerance | null;
		/** Shift: move along one axis only */
		lockAxis: boolean;
	}

	/**
	 * Mouse drag; `onmove` receives the offset in content coordinates. With `libraryKey` (the gesture's undo key)
	 * the selection can be dropped onto the library: there the move is undone and the save dialog opens.
	 */
	function drag(e: PointerEvent, onmove: (dx: number, dy: number, step: DragStep) => void, libraryKey?: string) {
		if (e.button !== 0) return;
		e.stopPropagation();
		e.preventDefault();
		// Arrow keys now move the selection
		layer.focus({ preventScroll: true });
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const rect = layer.getBoundingClientRect();
		const x0 = e.clientX;
		const y0 = e.clientY;
		const { w, h } = view;
		const tol = { x: (SNAP_PX / rect.width) * w, y: (SNAP_PX / rect.height) * h };
		let target: LibraryScope | null = null;
		const move = (ev: PointerEvent) => {
			guides = null;
			if (libraryKey) {
				// Outside the preview area the elements hang at the pointer, on their way to the library
				const away = trackLibraryDrag(editor, ev.clientX, ev.clientY, layer.closest('[data-preview-area]'));
				target = away.target;
				if (away.outside) return editor.cancelGesture(libraryKey);
			}
			onmove(((ev.clientX - x0) / rect.width) * w, ((ev.clientY - y0) / rect.height) * h, {
				tol: snapping.active(ev) ? tol : null,
				lockAxis: ev.shiftKey
			});
		};
		const up = () => {
			guides = null;
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerup', up);
			el.removeEventListener('pointercancel', up);
			editor.endGesture();
			endLibraryDrag();
			if (target) saveSelection(editor, target);
		};
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
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

	/** Size dragged at the corner (text, speech bubble, step) – also used for the next annotation of that type */
	function resizeTo(o: Annotation, size: number, key: string) {
		patchOverlay(o.id, { size }, key);
		rememberStyle(o.kind, { size });
	}

	function moveOverlay(e: PointerEvent, o: Annotation) {
		if (e.button !== 0) return;
		editor.select('item', o.id);
		const key = `move-${o.id}-${e.timeStamp}`;
		const b = bounds(o);
		const targets = targetsFor(o.id);
		drag(e, (dx, dy, step) => {
			const d = moveBy(b, dx, dy, step, targets);
			patchOverlay(o.id, moveAnnotation(o, d.dx, d.dy), key);
		}, key);
	}

	/** Move a corner of a rect, the opposite corner stays fixed. */
	function resized(r: Rect, corner: Corner, dx: number, dy: number): Rect {
		let x1 = r.x;
		let y1 = r.y;
		let x2 = r.x + r.w;
		let y2 = r.y + r.h;
		if (corner.includes('w')) x1 += dx;
		else x2 += dx;
		if (corner.includes('n')) y1 += dy;
		else y2 += dy;
		return {
			x: Math.min(x1, x2),
			y: Math.min(y1, y2),
			w: Math.max(Math.abs(x2 - x1), MIN_SIZE),
			h: Math.max(Math.abs(y2 - y1), MIN_SIZE)
		};
	}

	/** Move a corner keeping the aspect ratio (clips, images, icons); the opposite corner stays fixed */
	function resizedKeepingAspect(r: Rect, corner: Corner, dx: number, dy: number, min = 0.05): Rect {
		const aspect = r.h / r.w;
		const sx = corner.includes('e') ? 1 : -1;
		const sy = corner.includes('s') ? 1 : -1;
		const ax = sx > 0 ? r.x : r.x + r.w;
		const ay = sy > 0 ? r.y : r.y + r.h;
		const w = Math.max((r.w + sx * dx + (r.h + sy * dy) / aspect) / 2, min);
		const h = w * aspect;
		return { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h };
	}

	function resizeOverlay(e: PointerEvent, o: Annotation, corner: Corner) {
		const key = `resize-${o.id}-${e.timeStamp}`;
		const targets = targetsFor(o.id);
		drag(e, (dx, dy, { tol }) => {
			if (o.kind === 'image' || o.kind === 'icon') {
				let rect = resizedKeepingAspect(o.rect, corner, dx, dy, 0.01);
				if (tol) ({ rect, guides } = snapAspect(rect, sign(corner, 'e'), sign(corner, 's'), targets, tol, 0.01));
				return patchOverlay(o.id, { rect }, key);
			}
			if (o.kind === 'arrow' || o.kind === 'line') return;
			if (o.kind === 'text' || o.kind === 'callout') {
				// A corner scales everything (font and a fixed width alike, so the text wraps the same); the
				// opposite corner stays
				const b = overlayBounds(o, W, H);
				const sx = corner.includes('e') ? 1 : -1;
				const sy = corner.includes('s') ? 1 : -1;
				const size = Math.max(0.012, o.size * ((b.h + sy * dy) / b.h));
				const k = size / o.size;
				const boxWidth = o.boxWidth === undefined ? {} : { boxWidth: o.boxWidth * k };
				const x = sx > 0 ? b.x : b.x + b.w * (1 - k);
				const y = sy > 0 ? b.y : b.y + b.h * (1 - k);
				// One patch: within a gesture every update starts from the state before it
				patchOverlay(o.id, { ...boxWidth, x, y, size, radius: o.radius * k, padding: o.padding * k }, key);
				return rememberStyle(o.kind, { size });
			}
			if (o.kind === 'step') {
				// The center stays, the corner sets the diameter
				return resizeTo(o, Math.max(0.02, o.size + 2 * dy), key);
			}
			if (tol) {
				// The dragged corner snaps; the opposite one stays
				const r = o.rect;
				const cx = corner.includes('w') ? r.x : r.x + r.w;
				const cy = corner.includes('n') ? r.y : r.y + r.h;
				const s = snapPoint({ x: cx + dx, y: cy + dy }, targets, tol);
				dx = s.point.x - cx;
				dy = s.point.y - cy;
				guides = s.guides;
			}
			patchOverlay(o.id, { rect: resized(o.rect, corner, dx, dy) }, key);
		});
	}

	/** Direction of a corner: 1 towards east/south, -1 towards west/north */
	const sign = (corner: Corner, towards: 'e' | 's'): 1 | -1 => (corner.includes(towards) ? 1 : -1);

	/** A side of a text box sets a fixed width, the text wraps inside; the opposite side stays */
	function resizeWidth(e: PointerEvent, o: TextAnnotation | CalloutAnnotation, side: 'w' | 'e') {
		const key = `width-${o.id}-${e.timeStamp}`;
		const b = overlayBounds(o, W, H);
		// At least about two characters wide
		const min = (2 * o.size * H + (o.background ? 2 * o.padding * H : 0)) / W;
		const targets = targetsFor(o.id);
		drag(e, (dx, _dy, { tol }) => {
			if (tol) {
				const edge = side === 'e' ? b.x + b.w : b.x;
				const s = snapLine(edge + dx, targets.xs, tol.x);
				dx = s.value - edge;
				guides = { x: s.line, y: null, gaps: [] };
			}
			const boxWidth = Math.max(b.w + (side === 'e' ? dx : -dx), min);
			patchOverlay(o.id, side === 'e' ? { boxWidth } : { boxWidth, x: b.x + b.w - boxWidth }, key);
		});
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

	// --- Clips: a click selects the front-most one (full-frame ones too); move and scale with fixed aspect ratio

	/** Label or edge of the marked zoom area: selects the segment (the layer below would clear the selection) */
	function pickZoom(e: PointerEvent, id: string) {
		e.stopPropagation();
		editor.select('zoom', id);
	}

	/** Same label for the marked and the selected zoom area */
	const zoomLabelClass = 'bg-zoom text-zoom-content absolute top-1 left-1 flex items-center gap-0.5 rounded px-1 text-xs';

	function moveClip(e: PointerEvent, c: Clip) {
		if (e.button !== 0) return;
		editor.select('item', c.id);
		const key = `clip-move-${c.id}-${e.timeStamp}`;
		const r = c.rect;
		const targets = targetsFor(c.id);
		drag(e, (dx, dy, step) => {
			const d = moveBy(r, dx, dy, step, targets);
			editor.update((t) => updateItem(t, c.id, { rect: { ...r, x: r.x + d.dx, y: r.y + d.dy } }), key);
		}, key);
	}

	function resizeClip(e: PointerEvent, c: Clip, corner: Corner) {
		const key = `clip-resize-${c.id}-${e.timeStamp}`;
		const r = c.rect;
		const targets = targetsFor(c.id);
		drag(e, (dx, dy, { tol }) => {
			let rect = resizedKeepingAspect(r, corner, dx, dy);
			if (tol) ({ rect, guides } = snapAspect(rect, sign(corner, 'e'), sign(corner, 's'), targets, tol, 0.05));
			editor.update((t) => updateItem(t, c.id, { rect }), key);
		});
	}

	// --- Zoom segment: view with fixed aspect ratio (w === h in normalized coordinates)

	const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

	function moveZoom(e: PointerEvent) {
		const z = selectedZoom;
		if (!z) return;
		const key = `zoom-move-${z.id}-${e.timeStamp}`;
		const r = z.rect;
		const targets = targetsFor();
		drag(e, (dx, dy, step) => {
			const d = moveBy(r, dx, dy, step, targets);
			const rect = { ...r, x: clamp(r.x + d.dx, 0, 1 - r.w), y: clamp(r.y + d.dy, 0, 1 - r.h) };
			editor.update((t) => updateZoom(t, z.id, { rect }), key);
		});
	}

	function resizeZoom(e: PointerEvent, corner: Corner) {
		const z = selectedZoom;
		if (!z) return;
		const key = `zoom-resize-${z.id}-${e.timeStamp}`;
		const r = z.rect;
		const sx = corner.includes('e') ? 1 : -1;
		const sy = corner.includes('s') ? 1 : -1;
		const ax = sx > 0 ? r.x : r.x + r.w;
		const ay = sy > 0 ? r.y : r.y + r.h;
		const maxW = Math.min(sx > 0 ? 1 - ax : ax, sy > 0 ? 1 - ay : ay);
		drag(e, (dx, dy) => {
			const w = clamp(r.w + (sx * dx + sy * dy) / 2, 0.1, maxW);
			const rect = { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - w, w, h: w };
			editor.update((t) => updateZoom(t, z.id, { rect }), key);
		});
	}

	// --- Arrow keys while the preview has the focus: move the selection by canvas pixels (Shift: 10)

	const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

	/** Running key sequence: one undo step, applied to the state at its first key */
	let nudge: { key: string; apply: (dx: number, dy: number) => void; dx: number; dy: number } | null = null;

	/** Selected element that can be moved here (not on a hidden or locked track) */
	function nudgeTarget(): ((dx: number, dy: number, key: string) => void) | null {
		const z = selectedZoom;
		if (z) {
			const r = z.rect;
			return (dx, dy, key) =>
				editor.update((t) => updateZoom(t, z.id, { rect: { ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) } }), key);
		}
		const o = selectedOverlay;
		if (o && active.some((item) => item.id === o.id)) return (dx, dy, key) => patchOverlay(o.id, moveAnnotation(o, dx, dy), key);
		const c = selectedClip;
		if (c && active.some((item) => item.id === c.id)) {
			const r = c.rect;
			return (dx, dy, key) => editor.update((t) => updateItem(t, c.id, { rect: { ...r, x: r.x + dx, y: r.y + dy } }), key);
		}
		return null;
	}

	/** Minimum size of an annotation's click area (thin lines), as in its `boxStyle` */
	const MIN_HIT = 0.02;

	/** Click area of an item in content coordinates */
	function hitBox(item: Item): Rect {
		if (item.type !== 'annotation') return item.rect;
		const r = bounds(item);
		const padX = Math.max(0, MIN_HIT - r.w) / 2;
		const padY = Math.max(0, MIN_HIT - r.h) / 2;
		return { x: r.x - padX, y: r.y - padY, w: r.w + 2 * padX, h: r.h + 2 * padY };
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
		return `left: ${px(c.includes('w') ? r.x : r.x + r.w)}; top: ${py(c.includes('n') ? r.y : r.y + r.h)}`;
	}

	const handle =
		'absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-black/60 bg-white shadow cursor-pointer';
	const sideHandle =
		'absolute h-4 w-2 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-black/60 bg-white shadow cursor-ew-resize';
	const cursors: Record<Corner, string> = {
		nw: 'cursor-nwse-resize',
		se: 'cursor-nwse-resize',
		ne: 'cursor-nesw-resize',
		sw: 'cursor-nesw-resize'
	};
</script>

<!-- What a guide snaps to: the canvas (frame icon) or another item (its type icon) -->
{#snippet guideBadge(line: SnapLine, style: string)}
	{@const item = line.box === null ? null : snapSources.items[line.box]}
	<span
		class="bg-guide text-guide-content pointer-events-none absolute flex rounded p-0.5"
		{style}
		role="img"
		aria-label={item ? m.preview.snapItem(itemLabel(item, editor)) : m.preview.snapCanvas}
	>
		<span class="{item ? itemIcon(item, editor) : 'icon-[material-symbols-light--crop-free]'} size-3.5" aria-hidden="true"></span>
	</span>
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
		{@const r = selectedZoom.rect}
		<!-- Dim outside the zoom view -->
		<div
			class="border-zoom absolute cursor-move border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
			style={boxStyle(r)}
			onpointerdown={moveZoom}
			role="presentation"
		>
			<span class={zoomLabelClass}>{@render zoomLabel(r)}</span>
		</div>
		{#each CORNERS as c (c)}
			<div
				class="{handle} {cursors[c]}"
				style={cornerPos(r, c)}
				onpointerdown={(e) => resizeZoom(e, c)}
				role="presentation"
			></div>
		{/each}
	{:else}
		<!-- The selected items last, so they are on top: a covered item, once selected, can be moved directly -->
		{#each [...active.filter((i) => !editor.isSelected('item', i.id)), ...active.filter((i) => editor.isSelected('item', i.id))] as item (item.id)}
			{@const selected = editor.isSelected('item', item.id)}
			{@const frame = selected ? 'border-selection border-2 border-dashed' : 'hover:outline-selection/60 hover:outline-1'}
			{#if item.type === 'annotation'}
				<div
					class="absolute cursor-move {frame}"
					style={boxStyle(bounds(item), MIN_HIT)}
					onpointerdown={(e) => moveOverlay(e, item)}
					role="presentation"
				></div>
			{:else}
				<div
					class="absolute cursor-move {frame}"
					style={boxStyle(item.rect)}
					onpointerdown={(e) => moveClip(e, item)}
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

		{#if selectedClip && active.some((c) => c.id === selectedClip.id)}
			{@const c = selectedClip}
			{#each CORNERS as corner (corner)}
				<div
					class="{handle} {cursors[corner]}"
					style={cornerPos(c.rect, corner)}
					onpointerdown={(e) => resizeClip(e, c, corner)}
					role="presentation"
				></div>
			{/each}
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
			{:else if o.kind === 'step'}
				<div
					class="{handle} {cursors.se}"
					style={cornerPos(bounds(o), 'se')}
					onpointerdown={(e) => resizeOverlay(e, o, 'se')}
					role="presentation"
				></div>
			{:else if o.kind === 'text' || o.kind === 'callout'}
				{@const b = bounds(o)}
				{#each CORNERS as c (c)}
					<div
						class="{handle} {cursors[c]}"
						style={cornerPos(b, c)}
						onpointerdown={(e) => resizeOverlay(e, o, c)}
						role="presentation"
					></div>
				{/each}
				<!-- Sides: box width, the text wraps -->
				{#each ['w', 'e'] as const as side (side)}
					<div
						class="{sideHandle}"
						style="left: {px(side === 'w' ? b.x : b.x + b.w)}; top: {py(b.y + b.h / 2)}"
						onpointerdown={(e) => resizeWidth(e, o, side)}
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
				{#each CORNERS as c (c)}
					<div
						class="{handle} {cursors[c]}"
						style={cornerPos(o.rect, c)}
						onpointerdown={(e) => resizeOverlay(e, o, c)}
						role="presentation"
					></div>
				{/each}
			{/if}
		{/if}
	{/if}

	<!-- Lines and equal gaps snapped to while dragging -->
	{#each guides?.gaps ?? [] as gap, i (i)}
		{@const length = Math.round((gap.to - gap.from) * (gap.axis === 'x' ? W : H))}
		{#if gap.axis === 'x'}
			<div
				class="border-guide pointer-events-none absolute flex h-2 -translate-y-1/2 justify-center border-x"
				style="left: {px(gap.from)}; width: {pw(gap.to - gap.from)}; top: {py(gap.at)}"
			>
				<div class="bg-guide absolute inset-x-0 top-1/2 h-px"></div>
				<span class="bg-guide text-guide-content absolute top-2 rounded px-1 text-[10px] leading-4">{m.preview.gap(length)}</span>
			</div>
		{:else}
			<div
				class="border-guide pointer-events-none absolute flex w-2 -translate-x-1/2 items-center border-y"
				style="top: {py(gap.from)}; height: {ph(gap.to - gap.from)}; left: {px(gap.at)}"
			>
				<div class="bg-guide absolute inset-y-0 left-1/2 w-px"></div>
				<span class="bg-guide text-guide-content absolute left-2 rounded px-1 text-[10px] leading-4">{m.preview.gap(length)}</span>
			</div>
		{/if}
	{/each}
	{#each snappedTo as box (box)}
		<div class="outline-guide pointer-events-none absolute outline-1" style={boxStyle(snapSources.boxes[box])}></div>
	{/each}
	{#if guides?.x}
		<div class="bg-guide pointer-events-none absolute inset-y-0 w-px" style="left: {px(guides.x.at)}"></div>
		{@render guideBadge(guides.x, `left: ${px(guides.x.at)}; top: 4px; transform: translateX(-50%)`)}
	{/if}
	{#if guides?.y}
		<div class="bg-guide pointer-events-none absolute inset-x-0 h-px" style="top: {py(guides.y.at)}"></div>
		{@render guideBadge(guides.y, `top: ${py(guides.y.at)}; left: 4px; transform: translateY(-50%)`)}
	{/if}
</div>
