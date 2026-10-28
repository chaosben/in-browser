<script lang="ts">
	import { untrack } from 'svelte';
	import type { Editor } from '#lib/project/editor.svelte.js';
	import type { Annotation, CalloutAnnotation, Clip, Rect, TextAnnotation } from '#lib/project/types.js';
	import type { Player } from '#lib/preview/player.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import { rememberStyle } from '#lib/project/styles.js';
	import { fontState } from '#lib/render/fonts.svelte.js';
	import { moveAnnotation, overlayBounds } from '#lib/render/overlays.js';
	import { ZOOM_ICON } from '#lib/project/defaults.js';
	import { FULL_VIEW, itemsAt, trackState, updateItem, updateZoom, viewAt, zoomAt } from '#lib/timeline/ops.js';

	interface Props {
		editor: Editor;
		player: Player;
	}

	let { editor, player }: Props = $props();

	type Corner = 'nw' | 'ne' | 'sw' | 'se';
	const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se'];
	const MIN_SIZE = 0.01;

	let layer: HTMLDivElement;

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

	/** Mouse drag; `onmove` receives the offset in content coordinates. */
	function drag(e: PointerEvent, onmove: (dx: number, dy: number) => void) {
		if (e.button !== 0) return;
		e.stopPropagation();
		e.preventDefault();
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const rect = layer.getBoundingClientRect();
		const x0 = e.clientX;
		const y0 = e.clientY;
		const { w, h } = view;
		const move = (ev: PointerEvent) =>
			onmove(((ev.clientX - x0) / rect.width) * w, ((ev.clientY - y0) / rect.height) * h);
		const up = () => {
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerup', up);
			el.removeEventListener('pointercancel', up);
			editor.endGesture();
		};
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
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
		editor.select('item', o.id);
		const key = `move-${o.id}-${e.timeStamp}`;
		drag(e, (dx, dy) => patchOverlay(o.id, moveAnnotation(o, dx, dy), key));
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
		drag(e, (dx, dy) => {
			if (o.kind === 'image' || o.kind === 'icon') {
				return patchOverlay(o.id, { rect: resizedKeepingAspect(o.rect, corner, dx, dy, 0.01) }, key);
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
			patchOverlay(o.id, { rect: resized(o.rect, corner, dx, dy) }, key);
		});
	}

	/** A side of a text box sets a fixed width, the text wraps inside; the opposite side stays */
	function resizeWidth(e: PointerEvent, o: TextAnnotation | CalloutAnnotation, side: 'w' | 'e') {
		const key = `width-${o.id}-${e.timeStamp}`;
		const b = overlayBounds(o, W, H);
		// At least about two characters wide
		const min = (2 * o.size * H + (o.background ? 2 * o.padding * H : 0)) / W;
		drag(e, (dx) => {
			const boxWidth = Math.max(b.w + (side === 'e' ? dx : -dx), min);
			patchOverlay(o.id, side === 'e' ? { boxWidth } : { boxWidth, x: b.x + b.w - boxWidth }, key);
		});
	}

	/** Moves an end of an arrow or line, or the tip of a speech bubble */
	function movePoint(e: PointerEvent, o: Annotation, point: 'from' | 'to' | 'tip') {
		const p = point === 'tip' ? (o.kind === 'callout' ? o.tip : null) : o.kind === 'arrow' || o.kind === 'line' ? o[point] : null;
		if (!p) return;
		const key = `point-${o.id}-${point}-${e.timeStamp}`;
		drag(e, (dx, dy) => patchOverlay(o.id, { [point]: { x: p.x + dx, y: p.y + dy } }, key));
	}

	// --- Clips: a click selects the front-most one (full-frame ones too); move and scale with fixed aspect ratio

	/** Label or edge of the marked zoom area: selects the segment (the layer below would clear the selection) */
	function pickZoom(e: PointerEvent, id: string) {
		e.stopPropagation();
		editor.select('zoom', id);
	}

	/** Same label for the marked and the selected zoom area */
	const zoomLabelClass = 'bg-info text-info-content absolute top-1 left-1 flex items-center gap-0.5 rounded px-1 text-xs';

	function moveClip(e: PointerEvent, c: Clip) {
		editor.select('item', c.id);
		const key = `clip-move-${c.id}-${e.timeStamp}`;
		const r = c.rect;
		drag(e, (dx, dy) => editor.update((t) => updateItem(t, c.id, { rect: { ...r, x: r.x + dx, y: r.y + dy } }), key));
	}

	function resizeClip(e: PointerEvent, c: Clip, corner: Corner) {
		const key = `clip-resize-${c.id}-${e.timeStamp}`;
		const r = c.rect;
		drag(e, (dx, dy) => editor.update((t) => updateItem(t, c.id, { rect: resizedKeepingAspect(r, corner, dx, dy) }), key));
	}

	// --- Zoom segment: view with fixed aspect ratio (w === h in normalized coordinates)

	const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

	function moveZoom(e: PointerEvent) {
		const z = selectedZoom;
		if (!z) return;
		const key = `zoom-move-${z.id}-${e.timeStamp}`;
		const r = z.rect;
		drag(e, (dx, dy) =>
			editor.update(
				(t) =>
					updateZoom(t, z.id, {
						rect: { ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) }
					}),
				key
			)
		);
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

{#snippet zoomLabel(r: Rect)}
	<span class="{ZOOM_ICON} size-3.5" aria-hidden="true"></span>
	{m.preview.zoom((1 / r.w).toFixed(1))}
{/snippet}

<div
	bind:this={layer}
	class="absolute inset-0 overflow-hidden"
	onpointerdown={() => (editor.selection = null)}
	role="presentation"
>
	{#if selectedZoom}
		{@const r = selectedZoom.rect}
		<!-- Dim outside the zoom view -->
		<div
			class="border-info absolute cursor-move border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
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
		{#each active as item (item.id)}
			{@const selected = editor.isSelected('item', item.id)}
			{@const frame = selected ? 'border-primary border-2 border-dashed' : 'hover:outline-primary/60 hover:outline-1'}
			{#if item.type === 'annotation'}
				<div
					class="absolute cursor-move {frame}"
					style={boxStyle(bounds(item), 0.02)}
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

		{#if pausedZoom}
			{@const z = pausedZoom}
			<!-- Marks what the zoom will show. Label and edge select the segment; the area inside stays free for the
				 items below (the zoom often covers almost the whole frame). After the items, so label/edge are on top. -->
			<div
				class="border-info pointer-events-none absolute border-2 border-dashed shadow-[0_0_0_9999px_rgba(0,0,0,0.25)] has-[[data-zoom-pick]:hover]:border-solid"
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
</div>
