<script lang="ts">
	import ClipVisual from './ClipVisual.svelte';
	import { FREEZE_ICON, OVERLAY_KINDS, ZOOM_ICON } from '#lib/project/defaults.js';
	import type { Editor } from '#lib/project/editor.svelte.js';
	import type { Clip, Item } from '#lib/project/types.js';
	import type { Player } from '#lib/preview/player.svelte.js';
	import {
		clipDuration,
		duration as timelineDuration,
		findItem,
		itemEnd,
		moveItem,
		moveItems,
		retimeAnnotation,
		retimeZoom,
		setTrack,
		trackCount,
		trackState,
		trim
	} from '#lib/timeline/ops.js';
	import { m } from '#lib/i18n/index.js';
	import { formatTime } from '#lib/util/format.js';

	interface Props {
		editor: Editor;
		player: Player;
	}

	let { editor, player }: Props = $props();

	const PADDING = 16;
	const RULER = 22;
	const GAP = 4;
	const ZOOM_H = 22;
	const LANE_H = 22;
	const CLIP_H = 48;
	/** Snapping to edges and playhead (pixels) */
	const SNAP_PX = 8;
	const COLORS = ['bg-primary', 'bg-secondary', 'bg-accent', 'bg-info', 'bg-success', 'bg-warning'];

	let scroller: HTMLDivElement;
	let viewWidth = $state(800);
	/** Zoom factor relative to "everything visible" (1 = fits exactly). */
	let zoom = $state(1);
	/** The scale stays fixed during a drag, otherwise the view jumps under the mouse pointer. */
	let lockedTotal = $state<number | null>(null);
	/** Target track when dragging vertically */
	let trackDrop = $state<{ id: string; track: number } | null>(null);
	/** Time snapped to while dragging */
	let snapAt = $state<number | null>(null);
	let content: HTMLDivElement;

	const timeline = $derived(editor.project.timeline);
	const total = $derived(timelineDuration(timeline));
	const pxPerSec = $derived(((viewWidth - 2 * PADDING) / Math.max(lockedTotal ?? total, 1)) * zoom);
	const contentWidth = $derived(Math.max((lockedTotal ?? total) * pxPerSec + 2 * PADDING + 200, viewWidth));

	// One row per track, the top row is the front-most track. Plus an empty row at the top as a drop zone
	// for "new track in front". Tracks with clips are taller (thumbnails).
	const tracks = $derived(trackCount(timeline));
	const zoomTop = RULER + GAP;
	const tracksTop = zoomTop + ZOOM_H + GAP;
	const rows = $derived.by(() => {
		const list: { track: number; top: number; height: number }[] = [];
		let top = tracksTop;
		for (let track = tracks; track >= 0; track--) {
			const hasClips = timeline.items.some((i) => i.track === track && i.type !== 'annotation');
			const height = hasClips ? CLIP_H : LANE_H;
			list.push({ track, top, height });
			top += height;
		}
		return list;
	});
	const rowOf = (track: number) => rows.find((r) => r.track === track) ?? rows[0];
	const height = $derived(rows.at(-1)!.top + rows.at(-1)!.height + GAP);

	/** Track under the mouse position (above/below the area clamped to the outermost tracks) */
	function trackAt(clientY: number) {
		const y = clientY - content.getBoundingClientRect().top;
		const row = rows.find((r) => y < r.top + r.height) ?? rows.at(-1)!;
		return row.track;
	}

	const ticks = $derived.by(() => {
		const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
		const step = steps.find((s) => s * pxPerSec >= 70) ?? 600;
		const list: number[] = [];
		for (let t = 0; t <= total + 1e-6; t += step) list.push(t);
		return { step, list };
	});

	const x = (t: number) => PADDING + t * pxPerSec;

	function timeAt(clientX: number) {
		const rect = scroller.getBoundingClientRect();
		const t = (clientX - rect.left + scroller.scrollLeft - PADDING) / pxPerSec;
		return Math.min(Math.max(t, 0), total);
	}

	/** Timeline time under a mouse position (e.g. for files dragged onto the timeline) */
	export function timeAtClient(clientX: number) {
		return timeAt(clientX);
	}

	function sourceIndex(clip: Clip) {
		return editor.project.sources.findIndex((s) => s.id === clip.sourceId);
	}

	/**
	 * Shared drag logic: less than 4 px of movement counts as a click. `onmove` receives the
	 * offset in seconds (scale at the start).
	 */
	function drag(
		e: PointerEvent,
		handlers: { onmove: (dt: number, ev: PointerEvent) => void; onclick?: () => void; onend?: () => void }
	) {
		if (e.button !== 0) return;
		e.stopPropagation();
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const x0 = e.clientX;
		const y0 = e.clientY;
		const scale = pxPerSec;
		let moved = false;
		lockedTotal = total;
		const onmove = (ev: PointerEvent) => {
			if (!moved && Math.abs(ev.clientX - x0) < 4 && Math.abs(ev.clientY - y0) < 4) return;
			moved = true;
			handlers.onmove((ev.clientX - x0) / scale, ev);
		};
		const onup = () => {
			el.removeEventListener('pointermove', onmove);
			el.removeEventListener('pointerup', onup);
			el.removeEventListener('pointercancel', onup);
			lockedTotal = null;
			snapAt = null;
			// onend still belongs to the gesture (same undo step), afterwards it is ended
			if (moved) handlers.onend?.();
			else handlers.onclick?.();
			editor.endGesture();
		};
		el.addEventListener('pointermove', onmove);
		el.addEventListener('pointerup', onup);
		el.addEventListener('pointercancel', onup);
	}

	// Ruler/background: clicking or dragging sets the playhead
	function scrub(e: PointerEvent, deselect = false) {
		if (e.button !== 0) return;
		if (deselect) editor.selection = null;
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		player.seek(timeAt(e.clientX));
		const onmove = (ev: PointerEvent) => player.seek(timeAt(ev.clientX));
		const onup = () => {
			el.removeEventListener('pointermove', onmove);
			el.removeEventListener('pointerup', onup);
		};
		el.addEventListener('pointermove', onmove);
		el.addEventListener('pointerup', onup);
	}

	/** Snap points: start, playhead and the edges of all other items */
	function snapPoints(exclude: string[]) {
		const points = [0, player.time];
		for (const item of timeline.items) if (!exclude.includes(item.id)) points.push(item.start, itemEnd(item));
		return points;
	}

	/** Snaps a point in time (e.g. a dragged edge). */
	function snapTime(exclude: string[], t: number) {
		const range = SNAP_PX / pxPerSec;
		let best: { at: number; d: number } | null = null;
		for (const p of snapPoints(exclude)) {
			const d = Math.abs(p - t);
			if (d < range && (!best || d < best.d)) best = { at: p, d };
		}
		snapAt = best?.at ?? null;
		return best?.at ?? t;
	}

	/** Snaps `start` (or the end, given length `length`). */
	function snap(exclude: string[], start: number, length: number) {
		const range = SNAP_PX / pxPerSec;
		let best: { start: number; at: number; d: number } | null = null;
		for (const p of snapPoints(exclude)) {
			// Put start or end on the point
			for (const s of [p, p - length]) {
				const d = Math.abs(s - start);
				if (d < range && (!best || d < best.d)) best = { start: s, at: p, d };
			}
		}
		snapAt = best?.at ?? null;
		return best?.start ?? start;
	}

	const locked = (item: Item) => !!trackState(timeline, item.track).locked;

	type Part = 'body' | 'start' | 'end';

	/**
	 * Click or drag an item. A click selects it with its group (Alt: only the item, Ctrl/Shift: add to or
	 * remove from the selection). Dragging horizontally moves all selected items together (stops at the
	 * neighbor), dragging vertically moves a single item to another track.
	 */
	function itemDown(e: PointerEvent, item: Item, part: Part) {
		const { id, start, track } = item;
		const end = itemEnd(item);
		const single = e.altKey;
		if (e.ctrlKey || e.metaKey || e.shiftKey) {
			e.stopPropagation();
			editor.clickItem(id, { single, additive: true });
			return;
		}
		// Already selected: selection stays (drag together), a click without movement reselects
		const wasSelected = editor.isSelected('item', id);
		if (!wasSelected) editor.clickItem(id, { single });
		if (locked(item)) {
			e.stopPropagation();
			return;
		}
		const ids = editor.selectedItems.filter((i) => !locked(i)).map((i) => i.id);
		const key = `item-${id}-${part}-${e.timeStamp}`;
		const x0 = e.clientX;
		const y0 = e.clientY;
		const t0 = timeAt(e.clientX);
		let horizontal = false;
		let current: [number, number] = [start, end];
		drag(e, {
			onclick: () => {
				if (wasSelected) editor.clickItem(id, { single });
				if (item.type !== 'annotation') player.seek(t0);
				else if (player.time < start || player.time >= end) player.seek(start);
			},
			onmove: (dt, ev) => {
				// Vertical (single item only, on the bar itself, from 8 px): show target track, applied on release
				if (ids.length === 1 && part === 'body' && (trackDrop || Math.abs(ev.clientY - y0) >= 8)) {
					const target = trackAt(ev.clientY);
					trackDrop = target === track ? (trackDrop && { id, track }) : { id, track: target };
				}
				// Horizontal: change time, the track stays the same
				horizontal ||= Math.abs(ev.clientX - x0) >= 4;
				if (!horizontal) return;
				if (part === 'body') {
					const s = snap(ids, start + dt, end - start);
					current = [s, s + end - start];
					editor.update((tl) => moveItems(tl, ids, s - start), key);
				} else {
					const edge = snapTime(ids, (part === 'start' ? start : end) + dt);
					current = [part === 'start' ? edge : start, part === 'end' ? edge : end];
					editor.update((tl) => retimeAnnotation(tl, id, current[0], current[1]), key);
				}
			},
			onend: () => {
				if (trackDrop && trackDrop.track !== track) {
					// Same undo step: applied to the state before the drag, hence time and track together
					const target = trackDrop.track;
					const [s] = current;
					editor.update((tl) => setTrack(horizontal ? moveItem(tl, id, s) : tl, id, target), key);
				}
				trackDrop = null;
			}
		});
	}

	/** Trim a clip edge: with ripple (everything later moves along), with Shift without. The edge snaps. */
	function trimDown(e: PointerEvent, clip: Clip, edge: 'in' | 'out') {
		editor.select('item', clip.id);
		if (locked(clip)) return e.stopPropagation();
		const original = clip.type === 'freeze' ? clip.duration : clip[edge];
		const edgeTime = edge === 'in' ? clip.start : itemEnd(clip);
		const sourceDuration = editor.source(clip.sourceId)?.duration ?? 0;
		const key = `trim-${clip.id}-${edge}-${e.timeStamp}`;
		drag(e, {
			onmove: (dt, ev) => {
				const d = snapTime([clip.id], edgeTime + dt) - edgeTime;
				editor.update((tl) => trim(tl, clip.id, edge, original + d, sourceDuration, !ev.shiftKey), key);
				// Move the preview to the edited edge
				const current = findItem(editor.project.timeline, clip.id);
				if (current) player.seek(edge === 'in' ? current.start : itemEnd(current) - 0.001);
			}
		});
	}

	function zoomDown(e: PointerEvent, id: string, part: Part) {
		const z = timeline.zoom.find((item) => item.id === id);
		if (!z) return;
		const { start, end } = z;
		const key = `zoom-${id}-${part}-${e.timeStamp}`;
		editor.select('zoom', id);
		drag(e, {
			onmove: (dt) => {
				const s = part === 'end' ? start : start + dt;
				const en = part === 'start' ? end : end + dt;
				editor.update((tl) => retimeZoom(tl, id, s, en), key);
			}
		});
	}

	// Ctrl + mouse wheel zooms; needs a non-passive listener for preventDefault
	function wheelZoom(node: HTMLElement) {
		const wheel = (e: WheelEvent) => {
			if (!e.ctrlKey) return;
			e.preventDefault();
			zoom = Math.min(Math.max(zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2), 1), 32);
		};
		node.addEventListener('wheel', wheel, { passive: false });
		return () => node.removeEventListener('wheel', wheel);
	}

	// Keep the playhead visible during playback
	$effect(() => {
		const px = x(player.time);
		if (!scroller) return;
		const { scrollLeft, clientWidth } = scroller;
		if (px < scrollLeft || px > scrollLeft + clientWidth - 20) scroller.scrollLeft = px - clientWidth / 3;
	});

	const ring = 'ring-base-content ring-2 ring-offset-1 ring-offset-base-200';
</script>

{#snippet edges(ondown: (e: PointerEvent, part: Part) => void)}
	<div
		class="absolute top-0 bottom-0 left-0 w-1.5 cursor-ew-resize hover:bg-black/40"
		onpointerdown={(e) => ondown(e, 'start')}
		role="separator"
		aria-label={m.timeline.moveStart}
	></div>
	<div
		class="absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-black/40"
		onpointerdown={(e) => ondown(e, 'end')}
		role="separator"
		aria-label={m.timeline.moveEnd}
	></div>
{/snippet}

{#snippet toggle(track: number, key: 'hidden' | 'muted' | 'locked', on: boolean)}
	{@const label = { hidden: m.timeline.hideTrack, muted: m.timeline.muteTrack, locked: m.timeline.lockTrack }[key]}
	<button
		class="btn btn-ghost btn-xs btn-square size-5 min-h-0 {on ? 'text-warning' : 'opacity-50 hover:opacity-100'}"
		onclick={() => editor.setTrackState(track, { [key]: !on })}
		title={label}
		aria-label={label}
		aria-pressed={on}
	>
		{#if key === 'hidden'}
			<span class="{on ? 'icon-[material-symbols-light--visibility-off-outline]' : 'icon-[material-symbols-light--visibility-outline]'} size-4" aria-hidden="true"></span>
		{:else if key === 'muted'}
			<span class="{on ? 'icon-[material-symbols-light--volume-off-outline]' : 'icon-[material-symbols-light--volume-up-outline]'} size-4" aria-hidden="true"></span>
		{:else}
			<span class="{on ? 'icon-[material-symbols-light--lock-outline]' : 'icon-[material-symbols-light--lock-open-outline]'} size-4" aria-hidden="true"></span>
		{/if}
	</button>
{/snippet}

<div class="bg-base-200 rounded-box flex flex-col gap-1 p-2" data-timeline>
	<div class="flex items-center gap-3 px-1 text-xs">
		<span class="opacity-70" title={m.timeline.zoom}>
			<span class="icon-[material-symbols-light--zoom-in] size-5" aria-hidden="true"></span>
		</span>
		<input
			type="range"
			class="range range-xs w-40"
			min="0"
			max="5"
			step="0.01"
			bind:value={() => Math.log2(zoom), (v) => (zoom = 2 ** v)}
			aria-label={m.timeline.zoomLabel}
		/>
		<button class="btn btn-ghost btn-xs" onclick={() => (zoom = 1)}>
			<span class="icon-[material-symbols-light--fit-screen-outline] size-4" aria-hidden="true"></span> {m.timeline.fitAll}
		</button>
		<span class="ml-auto opacity-60">{m.timeline.hint}</span>
	</div>

	<div class="flex">
		<!-- Track headers stay put when scrolling horizontally -->
		<div class="relative w-20 shrink-0" style="height: {height}px">
			<div
				class="bg-base-300 absolute inset-x-0 flex items-center justify-center rounded-l opacity-80"
				style="top: {zoomTop}px; height: {ZOOM_H}px"
				title={m.timeline.zoomTrack}
			>
				<span class="{ZOOM_ICON} size-4" aria-hidden="true"></span>
			</div>
			{#each rows as row (row.track)}
				{@const state = trackState(timeline, row.track)}
				<div
					class="bg-base-300 absolute inset-x-0 flex items-center gap-0.5 rounded-l pl-1 text-[10px]"
					style="top: {row.top}px; height: {row.height - 1}px"
				>
					{#if row.track === tracks}
						<span class="w-full text-center opacity-60" title={m.timeline.newTrack}>+</span>
					{:else}
						<span
							class="w-4 shrink-0 text-center opacity-80"
							title={`${m.timeline.track(row.track + 1)}${row.track === tracks - 1 && tracks > 1 ? ` (${m.timeline.front})` : ''}`}
						>
							{row.track + 1}
						</span>
						{@render toggle(row.track, 'hidden', !!state.hidden)}
						{@render toggle(row.track, 'muted', !!state.muted)}
						{@render toggle(row.track, 'locked', !!state.locked)}
					{/if}
				</div>
			{/each}
		</div>

		<div class="relative min-w-0 flex-1">
		<!-- Scrollbar always present (overflow-x-scroll): if it only appeared on long timelines, the layout would jump -->
		<div
			bind:this={scroller}
			bind:clientWidth={viewWidth}
			class="relative overflow-x-scroll overflow-y-hidden select-none [scrollbar-width:thin]"
			{@attach wheelZoom}
		>
			<div bind:this={content} class="relative" style="width: {contentWidth}px; height: {height}px">
				<!-- Background: clicking sets the playhead and clears the selection -->
				<div class="absolute inset-0" onpointerdown={(e) => scrub(e, true)} role="presentation"></div>

				<!-- Ruler -->
				<div
					class="border-base-content/20 absolute inset-x-0 top-0 cursor-pointer border-b"
					style="height: {RULER}px"
					onpointerdown={(e) => scrub(e)}
					role="presentation"
				>
					{#each ticks.list as t (t)}
						<div
							class="border-base-content/30 pointer-events-none absolute top-0 h-full border-l pl-1 text-[10px] opacity-70"
							style="left: {x(t)}px"
						>
							{formatTime(t, ticks.step < 1 ? 1 : 0)}
						</div>
					{/each}
				</div>

				<!-- Zoom track -->
				{#each timeline.zoom as z (z.id)}
					<div
						class="bg-info/70 text-info-content absolute flex items-center gap-1 overflow-hidden rounded px-2 text-[10px] font-semibold
							{editor.isSelected('zoom', z.id) ? ring : ''}"
						style="left: {x(z.start)}px; width: {Math.max((z.end - z.start) * pxPerSec, 4)}px; top: {zoomTop}px; height: {ZOOM_H}px"
						onpointerdown={(e) => zoomDown(e, z.id, 'body')}
						role="button"
						tabindex="-1"
						aria-label={m.timeline.zoomSegment}
					>
						<span class="{ZOOM_ICON} size-3.5 shrink-0" aria-hidden="true"></span>
						<span class="truncate">{(1 / z.rect.w).toFixed(1)}×</span>
						{@render edges((e, part) => zoomDown(e, z.id, part))}
					</div>
				{/each}

				<!-- Tracks (alternating background), target track while dragging -->
				{#each rows as row, i (row.track)}
					<div
						class="pointer-events-none absolute inset-x-0 {i % 2 ? 'bg-base-content/[0.03]' : ''}"
						style="top: {row.top}px; height: {row.height}px"
					></div>
				{/each}
				{#if trackDrop}
					{@const row = rowOf(trackDrop.track)}
					<div
						class="border-primary bg-primary/15 pointer-events-none absolute inset-x-0 border-y-2 border-dashed"
						style="top: {row.top}px; height: {row.height}px"
					></div>
				{/if}

				{#each timeline.items as item (item.id)}
					{@const row = rowOf(item.track)}
					{@const width = (itemEnd(item) - item.start) * pxPerSec}
					{@const selected = editor.isSelected('item', item.id)}
					{@const state = trackState(timeline, item.track)}
					{@const dim = state.hidden ? 'opacity-35' : state.locked ? 'opacity-60' : ''}
					{#if item.type === 'annotation'}
						<div
							class="bg-warning/80 text-warning-content absolute flex items-center gap-1 overflow-hidden rounded px-2 text-[10px] font-semibold
								{selected ? ring : ''} {dim}"
							style="left: {x(item.start)}px; width: {Math.max(width, 4)}px; top: {row.top + 1}px; height: {row.height - 2}px"
							onpointerdown={(e) => itemDown(e, item, 'body')}
							role="button"
							tabindex="-1"
							aria-label={OVERLAY_KINDS[item.kind].label}
						>
							<span class="{OVERLAY_KINDS[item.kind].icon} size-3.5 shrink-0" aria-hidden="true"></span>
							<span class="truncate"
								>{item.kind === 'text' || item.kind === 'callout'
									? item.text
									: item.kind === 'step'
										? m.kinds.stepN(item.number)
										: item.kind === 'image'
											? (editor.image(item.imageId)?.name ?? OVERLAY_KINDS.image.label)
											: item.kind === 'icon'
												? item.icon.name
												: OVERLAY_KINDS[item.kind].label}</span
							>
							{@render edges((e, part) => itemDown(e, item, part))}
						</div>
					{:else}
						{@const source = editor.source(item.sourceId)}
						<div
							class="bg-base-300 absolute overflow-hidden rounded-md shadow {selected ? ring : ''} {dim}"
							style="left: {x(item.start) + 1}px; width: {Math.max(width - 2, 2)}px; top: {row.top + 1}px; height: {row.height - 2}px"
							onpointerdown={(e) => itemDown(e, item, 'body')}
							role="button"
							tabindex="-1"
							aria-label={item.type === 'freeze' ? m.timeline.freeze : (source?.name ?? m.timeline.missingSource)}
						>
							{#if source}
								<ClipVisual
									projectId={editor.project.id}
									{source}
									clip={item}
									width={Math.max(width - 2, 2)}
									height={row.height - 2}
								/>
							{/if}
							{#if item.type === 'freeze'}
								<div
									class="pointer-events-none absolute inset-0"
									style="background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 6px, transparent 6px 12px)"
								></div>
							{/if}
							<!-- Source as a thin color stripe, the image itself stays unaltered -->
							<div class="pointer-events-none absolute inset-x-0 top-0 h-[3px] {COLORS[sourceIndex(item) % COLORS.length]}"></div>
							{#if width > 50}
								<div
									class="pointer-events-none relative mt-1.5 ml-3 flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-1 rounded bg-black/60 px-1.5 text-[11px] leading-5 font-semibold text-white"
								>
									{#if item.type === 'freeze'}
									<span class="{FREEZE_ICON} size-3.5 shrink-0" aria-hidden="true"></span>
								{:else if source && !source.hasVideo}
									<span class="icon-[material-symbols-light--music-note] size-3.5 shrink-0" aria-hidden="true"></span>
								{/if}
									<span class="truncate">{item.type === 'freeze' ? m.timeline.freeze : (source?.name ?? m.timeline.missingSource)}</span>
									<span class="shrink-0 font-normal opacity-80">· {formatTime(clipDuration(item))}</span>
								</div>
							{/if}
							{#if item.type === 'video'}
								<div
									class="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize bg-black/25 hover:bg-white/60"
									onpointerdown={(e) => trimDown(e, item, 'in')}
									role="separator"
									aria-label={m.timeline.trimStart}
								></div>
							{/if}
							<div
								class="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize bg-black/25 hover:bg-white/60"
								onpointerdown={(e) => trimDown(e, item, 'out')}
								role="separator"
								aria-label={item.type === 'freeze' ? m.timeline.changeDuration : m.timeline.trimEnd}
							></div>
						</div>
					{/if}
				{/each}

				{#if snapAt !== null}
					<div class="bg-primary pointer-events-none absolute w-px" style="left: {x(snapAt)}px; top: {tracksTop}px; height: {height - tracksTop}px"></div>
				{/if}

				<!-- Playhead -->
				<div class="bg-error pointer-events-none absolute top-0 bottom-0 z-10 w-0.5" style="left: {x(player.time)}px">
					<div class="bg-error absolute top-0 -left-1.5 h-3 w-3.5 rounded-b-sm"></div>
				</div>
			</div>
		</div>
		</div>
	</div>
</div>
