import {
	newId,
	type Annotation,
	type Clip,
	type FreezeClip,
	type Item,
	type Rect,
	type Timeline,
	type TrackState,
	type ZoomSegment
} from '#lib/project/types.js';

/** Shortest allowed clip length in seconds. */
export const MIN_CLIP = 0.05;
/** Shortest duration for annotations and zoom segments. */
export const MIN_ITEM = 0.1;

const EPS = 1e-6;

export const FULL_VIEW: Rect = { x: 0, y: 0, w: 1, h: 1 };

export function emptyTimeline(): Timeline {
	return { items: [], tracks: [], zoom: [] };
}

export const isClip = (item: Item): item is Clip => item.type !== 'annotation';

export function clipDuration(clip: Clip): number {
	return clip.type === 'freeze' ? clip.duration : clip.out - clip.in;
}

export function itemEnd(item: Item): number {
	return item.type === 'annotation' ? item.end : item.start + clipDuration(item);
}

/** Total length: end of the last item (annotations too, e.g. a title on the background). */
export function duration(timeline: Timeline): number {
	return timeline.items.reduce((max, item) => Math.max(max, itemEnd(item)), 0);
}

export function clipsOf(timeline: Timeline): Clip[] {
	return timeline.items.filter(isClip);
}

export function findItem(timeline: Timeline, id: string): Item | undefined {
	return timeline.items.find((item) => item.id === id);
}

interface Timed {
	start: number;
	end: number;
}

const span = (item: Item): Timed => ({ start: item.start, end: itemEnd(item) });
const overlaps = (a: Timed, b: Timed) => a.start < b.end - EPS && b.start < a.end - EPS;

/**
 * Items visible at time `t`, from back to front (drawing order). At the end of the timeline
 * the last frame is held.
 */
export function itemsAt(timeline: Timeline, t: number): Item[] {
	const at = Math.min(t, duration(timeline) - 1e-3);
	return timeline.items
		.filter((item) => item.start <= at && at < itemEnd(item))
		.sort((a, b) => a.track - b.track);
}

/** Number for a new step annotation: one more than the highest so far */
export function nextStepNumber(timeline: Timeline): number {
	let max = 0;
	for (const item of timeline.items) if (item.type === 'annotation' && item.kind === 'step') max = Math.max(max, item.number);
	return max + 1;
}

export function clipsAt(timeline: Timeline, t: number): Clip[] {
	return itemsAt(timeline, t).filter(isClip);
}

/** Time within the source at timeline time `t` (freeze: always the held frame). */
export function sourceTime(clip: Clip, t: number): number {
	if (clip.type === 'freeze') return clip.at;
	return Math.min(Math.max(clip.in + t - clip.start, clip.in), clip.out);
}

// --- Tracks
// Every item sits on a track (0 = back). Higher tracks are drawn later, so they are in front.
// Items on the same track never overlap in time, so the order stays stable when moving –
// the track only changes via `setTrack`.

/**
 * Sets new items and renumbers the tracks without gaps (empty tracks are removed), keeping the order.
 * The track states (`tracks`, index = old track number) move along.
 */
function withItems(timeline: Timeline, items: Item[], tracks = timeline.tracks): Timeline {
	const used = [...new Set(items.map((item) => item.track))].sort((a, b) => a - b);
	const index = new Map(used.map((track, i) => [track, i]));
	return {
		...timeline,
		items: items.map((item) => (index.get(item.track) === item.track ? item : { ...item, track: index.get(item.track)! })),
		tracks: used.map((track) => tracks[track] ?? {})
	};
}

export function trackCount(timeline: Timeline): number {
	return timeline.items.reduce((max, item) => Math.max(max, item.track + 1), 0);
}

export function trackState(timeline: Timeline, track: number): TrackState {
	return timeline.tracks[track] ?? {};
}

export function setTrackState(timeline: Timeline, track: number, patch: Partial<TrackState>): Timeline {
	const tracks = Array.from({ length: Math.max(timeline.tracks.length, track + 1) }, (_, i) => timeline.tracks[i] ?? {});
	tracks[track] = { ...tracks[track], ...patch };
	return { ...timeline, tracks };
}

/** All items in the group of `id` (without a group just the item itself) */
export function groupOf(timeline: Timeline, id: string): string[] {
	const group = findItem(timeline, id)?.group;
	if (!group) return [id];
	return timeline.items.filter((item) => item.group === group).map((item) => item.id);
}

/**
 * Links the items: they get a common new group. Groups they already belong to are merged completely, so no
 * half group is left behind.
 */
export function group(timeline: Timeline, ids: string[], groupId = newId()): Timeline {
	const merged = new Set(timeline.items.filter((item) => ids.includes(item.id) && item.group).map((item) => item.group));
	return {
		...timeline,
		items: timeline.items.map((item) =>
			ids.includes(item.id) || (item.group && merged.has(item.group)) ? { ...item, group: groupId } : item
		)
	};
}

/** Unlinks the items */
export function ungroup(timeline: Timeline, ids: string[]): Timeline {
	return {
		...timeline,
		items: timeline.items.map((item) => {
			if (!ids.includes(item.id) || !item.group) return item;
			const { group: _group, ...rest } = item;
			return rest as Item;
		})
	};
}

/** Adds an item – on the track in front of all items it overlaps in time. */
export function addItem(timeline: Timeline, item: Item): Timeline {
	const below = timeline.items.filter((other) => overlaps(span(other), span(item))).map((other) => other.track);
	const track = Math.max(-1, ...below) + 1;
	return withItems(timeline, [...timeline.items, { ...item, track }]);
}

/**
 * Inserts copies of `items` with the earliest one starting at `at`: new ids, links only among the copies, in front
 * of everything they overlap in time, keeping their relative tracks and their place on the canvas.
 */
export function pasteItems(timeline: Timeline, items: readonly Item[], at: number): { timeline: Timeline; ids: string[] } {
	if (!items.length) return { timeline, ids: [] };
	const offset = at - Math.min(...items.map((item) => item.start));
	const lowest = Math.min(...items.map((item) => item.track));
	const groups = new Map<string, string>();
	const copies = items.map((item) => {
		const copy = { ...item, id: newId(), start: item.start + offset } as Item;
		if (copy.type === 'annotation') copy.end += offset;
		if (item.group) {
			if (!groups.has(item.group)) groups.set(item.group, newId());
			copy.group = groups.get(item.group);
		}
		return copy;
	});
	const below = timeline.items
		.filter((other) => copies.some((copy) => overlaps(span(other), span(copy))))
		.map((other) => other.track);
	const base = Math.max(-1, ...below) + 1;
	for (const [i, copy] of copies.entries()) copy.track = base + items[i].track - lowest;
	const result = withItems(timeline, [...timeline.items, ...copies]);
	return { timeline: result, ids: copies.map((copy) => copy.id) };
}

/** Appends a clip on track 0 after its last item. */
export function appendClip(timeline: Timeline, clip: Clip): Timeline {
	const start = timeline.items.filter((item) => item.track === 0).reduce((max, item) => Math.max(max, itemEnd(item)), 0);
	return withItems(timeline, [...timeline.items, { ...clip, start, track: 0 }]);
}

export function updateItem<T extends Item>(timeline: Timeline, id: string, patch: Partial<T>): Timeline {
	return { ...timeline, items: timeline.items.map((item) => (item.id === id ? ({ ...item, ...patch } as Item) : item)) };
}

/** Free range around `t` on the track of `item` (excluding the item itself and `ignore`), open towards the end. */
function room(timeline: Timeline, item: Item, t: number, ignore?: Set<string>) {
	let lo = 0;
	let hi = Infinity;
	for (const other of timeline.items) {
		if (other.id === item.id || other.track !== item.track || ignore?.has(other.id)) continue;
		const end = itemEnd(other);
		if (end <= t + EPS) lo = Math.max(lo, end);
		else if (other.start >= t - EPS) hi = Math.min(hi, other.start);
	}
	return { lo, hi };
}

/**
 * Moves items together by `delta` seconds (lengths stay). Clamped so that none bumps into a
 * neighbor on its track or slips before 0.
 */
export function moveItems(timeline: Timeline, ids: string[], delta: number): Timeline {
	const moving = timeline.items.filter((item) => ids.includes(item.id));
	if (moving.length === 0) return timeline;
	const ignore = new Set(ids);
	let min = -Infinity;
	let max = Infinity;
	for (const item of moving) {
		const { start, end } = span(item);
		const { lo, hi } = room(timeline, item, (start + end) / 2, ignore);
		min = Math.max(min, lo - start);
		max = Math.min(max, hi - end);
	}
	const d = Math.min(Math.max(delta, min), max);
	if (Math.abs(d) < EPS) return timeline;
	return {
		...timeline,
		items: timeline.items.map((item) => {
			if (!ignore.has(item.id)) return item;
			return item.type === 'annotation'
				? { ...item, start: item.start + d, end: item.end + d }
				: { ...item, start: item.start + d };
		})
	};
}

/** Moves an item to start time `start` (see `moveItems`). */
export function moveItem(timeline: Timeline, id: string, start: number): Timeline {
	const item = findItem(timeline, id);
	return item ? moveItems(timeline, [id], start - item.start) : timeline;
}

/** Sets the start time without regard to neighbors (not before 0); annotations keep their length. */
export function shiftItem(timeline: Timeline, id: string, start: number): Timeline {
	const item = findItem(timeline, id);
	if (!item) return timeline;
	const s = Math.max(0, start);
	return updateItem(timeline, id, item.type === 'annotation' ? { start: s, end: item.end + s - item.start } : { start: s });
}

/**
 * Moves an item to `start` on track `target` (dragged to another track): neighbors on the old track
 * don't stop it; if the target track is occupied there, a new track is inserted (see `setTrack`).
 */
export function placeItem(timeline: Timeline, id: string, start: number, target: number): Timeline {
	return setTrack(shiftItem(timeline, id, start), id, target);
}

/** Sets start/end of an annotation, clamped to the neighbors on its own track. */
export function retimeAnnotation(timeline: Timeline, id: string, start: number, end: number): Timeline {
	const o = findItem(timeline, id);
	if (o?.type !== 'annotation') return timeline;
	const { lo, hi } = room(timeline, o, (o.start + o.end) / 2);
	const s = Math.min(Math.max(start, lo), hi - MIN_ITEM);
	const e = Math.min(Math.max(end, s + MIN_ITEM), hi);
	return updateItem<Annotation>(timeline, id, { start: s, end: e });
}

/**
 * Moves an item to track `target`. If that track is occupied at that time, a new track is
 * inserted: dragged up it lands above the occupying item, dragged down below it.
 * The relative order of all other items stays unchanged.
 */
export function setTrack(timeline: Timeline, id: string, target: number): Timeline {
	const item = findItem(timeline, id);
	if (!item) return timeline;
	target = Math.max(0, Math.round(target));
	if (target === item.track) return timeline;
	const blocked = timeline.items.some((x) => x.id !== id && x.track === target && overlaps(span(x), span(item)));
	if (!blocked) return withItems(timeline, timeline.items.map((x) => (x.id === id ? { ...x, track: target } : x)));
	// Insert a new track (its state is empty)
	const newTrack = target > item.track ? target + 1 : target;
	const items = timeline.items.map((x) => {
		if (x.id === id) return { ...x, track: newTrack };
		return x.track >= newTrack ? { ...x, track: x.track + 1 } : x;
	});
	const tracks = [...timeline.tracks];
	tracks.splice(newTrack, 0, {});
	return withItems(timeline, items, tracks);
}

/** Nearest track above or below the item with an item overlapping in time (visible neighbor). */
function neighborTrack(timeline: Timeline, id: string, direction: 1 | -1): number | null {
	const item = findItem(timeline, id);
	if (!item) return null;
	const tracks = timeline.items
		.filter(
			(x) =>
				x.id !== id &&
				overlaps(span(x), span(item)) &&
				(direction > 0 ? x.track > item.track : x.track < item.track)
		)
		.map((x) => x.track);
	if (tracks.length === 0) return null;
	return direction > 0 ? Math.min(...tracks) : Math.max(...tracks);
}

/** One step forward: in front of the next item above that is visible at the same time. */
export function bringForward(timeline: Timeline, id: string): Timeline {
	const track = neighborTrack(timeline, id, 1);
	return track === null ? timeline : setTrack(timeline, id, track);
}

/** One step backward: behind the next item below that is visible at the same time. */
export function sendBackward(timeline: Timeline, id: string): Timeline {
	const track = neighborTrack(timeline, id, -1);
	return track === null ? timeline : setTrack(timeline, id, track);
}

export function bringToFront(timeline: Timeline, id: string): Timeline {
	return neighborTrack(timeline, id, 1) === null ? timeline : setTrack(timeline, id, trackCount(timeline));
}

export function sendToBack(timeline: Timeline, id: string): Timeline {
	return neighborTrack(timeline, id, -1) === null ? timeline : setTrack(timeline, id, 0);
}

// --- Ripple: inserted or removed time affects all tracks

function retimeZoomItems(zoom: ZoomSegment[], map: (t: number) => number): ZoomSegment[] {
	const result: ZoomSegment[] = [];
	for (const z of zoom) {
		const start = map(z.start);
		const end = map(z.end);
		if (end - start >= MIN_ITEM) result.push(start === z.start && end === z.end ? z : { ...z, start, end });
	}
	return result;
}

/**
 * `delta` seconds were inserted at `at`: everything starting at or after `at` moves later.
 * Spanning annotations get longer, spanning clips stay as they are.
 */
export function rippleInsert(timeline: Timeline, at: number, delta: number): Timeline {
	if (delta <= 0) return timeline;
	const items = timeline.items.map((item): Item => {
		if (item.start >= at - EPS) {
			return item.type === 'annotation'
				? { ...item, start: item.start + delta, end: item.end + delta }
				: { ...item, start: item.start + delta };
		}
		if (item.type === 'annotation' && item.end > at + EPS) return { ...item, end: item.end + delta };
		return item;
	});
	return { ...timeline, items, zoom: retimeZoomItems(timeline.zoom, (t) => (t >= at ? t + delta : t)) };
}

/**
 * Removes the range [from, to), which must be empty (see `uncovered`): everything after it moves up.
 * Annotations reaching into it are only shortened as a safeguard against rounding.
 */
function rippleRemove(timeline: Timeline, from: number, to: number): Timeline {
	const d = to - from;
	if (d <= 0) return timeline;
	const map = (t: number) => (t <= from ? t : t >= to ? t - d : from);
	const items: Item[] = [];
	for (const item of timeline.items) {
		if (item.type === 'annotation') {
			const start = map(item.start);
			const end = map(item.end);
			if (end - start < MIN_ITEM) continue;
			items.push(start === item.start && end === item.end ? item : { ...item, start, end });
		} else {
			items.push(item.start >= to - EPS ? { ...item, start: item.start - d } : item);
		}
	}
	return { ...withItems(timeline, items), zoom: retimeZoomItems(timeline.zoom, map) };
}

/**
 * Parts of [from, to) where nothing lies – no clip and no annotation. Annotations are independent elements on
 * the canvas, so closing time never drops or shortens one; it only moves along.
 */
function uncovered(timeline: Timeline, from: number, to: number): Timed[] {
	const result: Timed[] = [];
	let t = from;
	const clips = timeline.items
		.map(span)
		.filter((s) => s.end > from + EPS && s.start < to - EPS)
		.sort((a, b) => a.start - b.start);
	for (const s of clips) {
		if (s.start > t + EPS) result.push({ start: t, end: s.start });
		t = Math.max(t, s.end);
	}
	if (to > t + EPS) result.push({ start: t, end: to });
	return result;
}

/** Closes the gaps in [from, to) where nothing remains (from back to front). */
function closeGaps(timeline: Timeline, from: number, to: number): Timeline {
	return uncovered(timeline, from, to).reduceRight((t, gap) => rippleRemove(t, gap.start, gap.end), timeline);
}

// --- Clips & items

/** Splits a clip at timeline time `t` → [left, right], or null if a part would be too short. */
function splitClip(clip: Clip, t: number): [Clip, Clip] | null {
	const local = t - clip.start;
	if (local < MIN_CLIP || clipDuration(clip) - local < MIN_CLIP) return null;
	// No fade at the cut: the left part keeps only its fade-in, the right part only its fade-out
	if (clip.type === 'freeze') {
		return [
			{ ...clip, duration: local, fadeOut: undefined },
			{ ...clip, id: newId(), start: t, duration: clip.duration - local, fadeIn: undefined }
		];
	}
	return [
		{ ...clip, out: clip.in + local, fadeOut: undefined },
		{ ...clip, id: newId(), start: t, in: clip.in + local, fadeIn: undefined }
	];
}

function splitItem(item: Item, t: number): [Item, Item] | null {
	if (item.type !== 'annotation') return splitClip(item, t);
	if (t - item.start < MIN_ITEM || item.end - t < MIN_ITEM) return null;
	return [
		{ ...item, end: t, fadeOut: 0 },
		{ ...item, id: newId(), start: t, fadeIn: 0 }
	];
}

/** Splits the items `ids` at `t`; if omitted, all clips under `t`. */
export function split(timeline: Timeline, t: number, ids?: string[]): Timeline {
	const targets = ids ? timeline.items.filter((item) => ids.includes(item.id)) : clipsAt(timeline, t);
	let changed = false;
	const items = timeline.items.flatMap((item) => {
		if (!targets.includes(item)) return [item];
		const parts = splitItem(item, t);
		if (!parts) return [item];
		changed = true;
		return parts;
	});
	return changed ? { ...timeline, items } : timeline;
}

/**
 * Removes items – only these, never others. For clips with a picture and `ripple` everything later moves up,
 * as far as nothing else remains in their range; without `ripple` gaps remain. Annotations and clips without
 * a picture (music, microphone) never leave a ripple: removing background sound does not cut the video.
 */
export function remove(
	timeline: Timeline,
	ids: string[],
	ripple = true,
	hasPicture: (sourceId: string) => boolean = () => true
): Timeline {
	const removed = timeline.items.filter((x) => ids.includes(x.id));
	if (removed.length === 0) return timeline;
	let result = withItems(
		timeline,
		timeline.items.filter((x) => !ids.includes(x.id))
	);
	if (!ripple) return result;
	// Merge ranges and close from the end so earlier ranges stay valid
	const ranges: Timed[] = [];
	const cuts = removed.filter((x): x is Clip => isClip(x) && hasPicture(x.sourceId));
	for (const r of cuts.map(span).sort((a, b) => a.start - b.start)) {
		const last = ranges.at(-1);
		if (last && r.start <= last.end + EPS) last.end = Math.max(last.end, r.end);
		else ranges.push({ ...r });
	}
	for (const r of ranges.reverse()) result = closeGaps(result, r.start, r.end);
	return result;
}

/**
 * Trims a clip. Video clips: `edge` sets the in or out point (seconds in the source), clamped to
 * [0, sourceDuration]. Freeze clips: `out` sets the duration. With `ripple` everything later on all
 * tracks moves along (gained time is inserted, lost time closed where there is no clip); without
 * `ripple` the rest stays put and the clip stops at its neighbors at most.
 */
export function trim(
	timeline: Timeline,
	clipId: string,
	edge: 'in' | 'out',
	value: number,
	sourceDuration: number,
	ripple = true
): Timeline {
	const clip = findItem(timeline, clipId);
	if (!clip || clip.type === 'annotation') return timeline;
	const { lo, hi } = room(timeline, clip, clip.start + clipDuration(clip) / 2);
	const end = itemEnd(clip);

	if (clip.type === 'freeze') {
		if (edge === 'in') return timeline;
		let length = Math.max(value, MIN_CLIP);
		if (!ripple) length = Math.min(length, hi - clip.start);
		return resize(timeline, clip, { duration: length }, end, ripple);
	}

	if (edge === 'out') {
		let out = Math.max(Math.min(value, sourceDuration), clip.in + MIN_CLIP);
		if (!ripple) out = Math.min(out, clip.in + hi - clip.start);
		return resize(timeline, clip, { out }, end, ripple);
	}

	// In point: without ripple the clip end stays put, the start moves (at most up to the neighbor).
	let inPoint = Math.min(Math.max(value, 0), clip.out - MIN_CLIP);
	if (!ripple) {
		inPoint = Math.max(inPoint, clip.in - (clip.start - lo));
		if (inPoint === clip.in) return timeline;
		return updateItem(timeline, clip.id, { in: inPoint, start: clip.start + inPoint - clip.in });
	}
	const delta = clip.in - inPoint;
	if (Math.abs(delta) < EPS) return timeline;
	if (delta > 0) {
		// More material at the front: insert time at the clip start, the clip itself stays there
		const inserted = rippleInsert(timeline, clip.start, delta);
		return updateItem(inserted, clip.id, { in: inPoint, start: clip.start });
	}
	// Less material at the front: start moves later, the resulting gap is closed
	const moved = updateItem(timeline, clip.id, { in: inPoint, start: clip.start - delta });
	return closeGaps(moved, clip.start, clip.start - delta);
}

/** Changes the length of a clip at its end (`end` = previous end). */
function resize(timeline: Timeline, clip: Clip, patch: Partial<Clip>, end: number, ripple: boolean): Timeline {
	const next = { ...clip, ...patch } as Clip;
	const delta = clipDuration(next) - clipDuration(clip);
	if (Math.abs(delta) < EPS) return timeline;
	const updated = updateItem(timeline, clip.id, patch);
	if (!ripple) return updated;
	return delta > 0 ? rippleInsert(updated, end, delta) : closeGaps(updated, end + delta, end);
}

/**
 * Inserts stills at `t`: for the clips `ids`, if omitted for all clips under `t` (only clips with a
 * picture, see `hasVideo`). Everything later moves back by `seconds`; other clips under `t` are
 * split and move along so everything stays in sync. A freeze clip under `t` is extended; at the end
 * of a clip its last frame is held.
 */
export function insertFreeze(
	timeline: Timeline,
	t: number,
	seconds: number,
	ids?: string[],
	hasVideo: (sourceId: string) => boolean = () => true
): Timeline {
	if (seconds <= 0) return timeline;
	const under = clipsAt(timeline, t);
	const targets = under.filter((c) => (!ids || ids.includes(c.id)) && hasVideo(c.sourceId));
	if (targets.length === 0) return timeline;
	// Near a clip boundary insert exactly there (no slivers)
	for (const c of targets) {
		if (Math.abs(t - c.start) < MIN_CLIP) t = c.start;
		else if (Math.abs(itemEnd(c) - t) < MIN_CLIP) t = itemEnd(c);
	}

	const freezes: FreezeClip[] = [];
	const extend = new Map<string, FreezeClip>();
	const items = timeline.items.flatMap((item): Item[] => {
		if (!under.includes(item as Clip) || item.type === 'annotation') return [item];
		if (!targets.includes(item)) return splitClip(item, t) ?? [item];
		if (item.type === 'freeze') {
			extend.set(item.id, item);
			return [item];
		}
		const at = t >= itemEnd(item) - EPS ? Math.max(item.in, item.out - 0.001) : sourceTime(item, t);
		freezes.push({
			id: newId(),
			type: 'freeze',
			sourceId: item.sourceId,
			track: item.track,
			rect: item.rect,
			shape: item.shape,
			anchor: item.anchor,
			group: item.group,
			start: t,
			at,
			duration: seconds
		});
		return splitClip(item, t) ?? [item];
	});

	const shifted = rippleInsert({ ...timeline, items }, t, seconds);
	// Extended freeze clips keep their start (even if it was exactly at `t`)
	const extended = shifted.items.map((item) => {
		const original = extend.get(item.id);
		return original ? { ...original, duration: original.duration + seconds } : item;
	});
	return { ...shifted, items: [...extended, ...freezes] };
}

// --- Zoom segments (non-overlapping, sorted by start time)

function sortZoom(zoom: ZoomSegment[]) {
	return [...zoom].sort((a, b) => a.start - b.start);
}

export function zoomAt(timeline: Timeline, t: number): ZoomSegment | null {
	return timeline.zoom.find((z) => z.start <= t && t < z.end) ?? null;
}

/** Free range around `t` (between the neighboring zoom segments, clamped to the timeline). */
function zoomGap(timeline: Timeline, t: number, ignoreId?: string) {
	let lo = 0;
	let hi = duration(timeline);
	for (const z of timeline.zoom) {
		if (z.id === ignoreId) continue;
		if (z.end <= t) lo = Math.max(lo, z.end);
		else if (z.start >= t) hi = Math.min(hi, z.start);
	}
	return { lo, hi };
}

/** Creates a zoom segment at `t` (up to `length` seconds). If `t` is already inside a segment → unchanged. */
export function addZoom(timeline: Timeline, segment: ZoomSegment): Timeline {
	if (zoomAt(timeline, segment.start)) return timeline;
	const { hi } = zoomGap(timeline, segment.start);
	const end = Math.min(segment.end, hi);
	if (end - segment.start < MIN_ITEM) return timeline;
	return { ...timeline, zoom: sortZoom([...timeline.zoom, { ...segment, end }]) };
}

export function updateZoom(timeline: Timeline, id: string, patch: Partial<Omit<ZoomSegment, 'start' | 'end'>>): Timeline {
	return { ...timeline, zoom: timeline.zoom.map((z) => (z.id === id ? { ...z, ...patch } : z)) };
}

/** Sets start/end of a zoom segment, clamped to the neighbors. */
export function retimeZoom(timeline: Timeline, id: string, start: number, end: number): Timeline {
	const segment = timeline.zoom.find((z) => z.id === id);
	if (!segment) return timeline;
	const { lo, hi } = zoomGap(timeline, segment.start + (segment.end - segment.start) / 2, id);
	const s = Math.min(Math.max(start, lo), hi - MIN_ITEM);
	const e = Math.min(Math.max(end, s + MIN_ITEM), hi);
	return { ...timeline, zoom: sortZoom(timeline.zoom.map((z) => (z.id === id ? { ...z, start: s, end: e } : z))) };
}

export function removeZoom(timeline: Timeline, id: string): Timeline {
	return { ...timeline, zoom: timeline.zoom.filter((z) => z.id !== id) };
}

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

/**
 * Where a fade-in ends and a fade-out starts within [start, end] (`fadeIn`/`fadeOut` in seconds, 0: none). If both
 * together are longer than the element, they are shortened proportionally.
 */
export function fadeEdges(start: number, end: number, fadeIn = 0, fadeOut = 0): [number, number] {
	const fin = Math.max(fadeIn, 0);
	const fout = Math.max(fadeOut, 0);
	const k = fin + fout > 0 ? Math.min(1, (end - start) / (fin + fout)) : 1;
	return [start + fin * k, end - fout * k];
}

/** Largest allowed duration of one fade so both together never exceed the element's `duration` */
export function clampFade(value: number, other: number, duration: number): number {
	return Math.max(0, Math.min(value, duration - Math.max(other, 0)));
}

/** Opacity/volume factor 0…1 at time `t`: rises linearly during the fade-in, falls during the fade-out */
export function fadeAlpha(t: number, start: number, end: number, fadeIn = 0, fadeOut = 0): number {
	const [inEnd, outStart] = fadeEdges(start, end, fadeIn, fadeOut);
	let p = 1;
	if (inEnd > start) p = Math.min(p, (t - start) / (inEnd - start));
	if (outStart < end) p = Math.min(p, (end - t) / (end - outStart));
	return Math.min(Math.max(p, 0), 1);
}

/** Visible view at time `t`, with smooth transitions at the segment boundaries. */
export function viewAt(timeline: Timeline, t: number): Rect {
	const z = zoomAt(timeline, t);
	if (!z) return FULL_VIEW;
	const k = easeInOut(fadeAlpha(t, z.start, z.end, z.easeIn, z.easeOut));
	return {
		x: z.rect.x * k,
		y: z.rect.y * k,
		w: 1 + (z.rect.w - 1) * k,
		h: 1 + (z.rect.h - 1) * k
	};
}
