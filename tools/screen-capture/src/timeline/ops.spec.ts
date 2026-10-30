import { describe, expect, it } from 'vitest';
import { FORMAT, migrate, parseProject, VERSION, type Annotation, type Clip, type Item, type Timeline, type VideoClip, type ZoomSegment } from '#lib/project/types.js';
import {
	addItem,
	addZoom,
	appendClip,
	bringForward,
	bringToFront,
	clipsAt,
	clipsChanged,
	duration,
	clampFade,
	drawProgress,
	fadeAlpha,
	fadeEdges,
	group,
	insertFreeze,
	itemsAt,
	groupOf,
	moveItem,
	moveItems,
	nextStepNumber,
	pasteItems,
	placeItem,
	remove,
	retimeAnnotation,
	retimeZoom,
	rippleInsert,
	sendBackward,
	sendToBack,
	setTrack,
	setTrackState,
	split,
	trim,
	ungroup,
	viewAt
} from './ops';
import { placeRecording } from '#lib/project/project.js';

const RECT = { x: 0, y: 0, w: 1, h: 1 };

/** Video clip `id` on track `track` from `start` with source range [a, b) */
function clip(id: string, start: number, a: number, b: number, track = 0): Clip {
	return { id, type: 'video', sourceId: 's', start, track, in: a, out: b, rect: RECT };
}

function text(id: string, start: number, end: number, track = 1): Annotation {
	return {
		id,
		type: 'annotation',
		kind: 'text',
		start,
		end,
		fadeIn: 0,
		fadeOut: 0,
		track,
		x: 0,
		y: 0,
		text: id,
		size: 0.05,
		color: '#fff',
		font: 'system',
		align: 'left',
		background: null,
		radius: 0.015,
		padding: 0.02,
		shadow: true
	};
}

function zoom(id: string, start: number, end: number, easeIn = 0.5, easeOut = easeIn): ZoomSegment {
	return { id, start, end, easeIn, easeOut, rect: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } };
}

const tl = (...items: Item[]): Timeline => ({ items, tracks: [], zoom: [] });

/** Compact representation: id → [track, start, end] */
function layout(t: Timeline) {
	return Object.fromEntries(
		t.items.map((i) => {
			const end = i.type === 'annotation' ? i.end : i.start + (i.type === 'freeze' ? i.duration : i.out - i.in);
			return [i.id, [i.track, +i.start.toFixed(3), +end.toFixed(3)]];
		})
	);
}

const tracks = (t: Timeline) => Object.fromEntries(t.items.map((i) => [i.id, i.track]));

describe('basics', () => {
	it('duration is the end of the last item, also with gaps and annotation-only content', () => {
		expect(duration(tl())).toBe(0);
		expect(duration(tl(clip('a', 2, 0, 3)))).toBe(5);
		expect(duration(tl(clip('a', 0, 0, 3), text('t', 1, 8)))).toBe(8);
	});
	it('itemsAt returns back to front, gaps are empty', () => {
		const t = tl(text('t', 0, 10, 2), clip('a', 0, 0, 4), clip('b', 6, 0, 4, 1));
		expect(itemsAt(t, 1).map((i) => i.id)).toEqual(['a', 't']);
		expect(itemsAt(t, 7).map((i) => i.id)).toEqual(['b', 't']);
		expect(clipsAt(t, 5)).toEqual([]);
	});
	it('holds the last frame at the end', () => {
		const t = tl(clip('a', 0, 0, 4));
		expect(clipsAt(t, 4).map((c) => c.id)).toEqual(['a']);
	});
});

describe('clipsChanged', () => {
	const a = clip('a', 0, 0, 4) as VideoClip;
	const t = tl(a, clip('b', 4, 0, 2), text('t', 0, 3));
	it('ignores the position in the frame and annotations', () => {
		expect(clipsChanged(tl(a, t.items[1], t.items[2]), t)).toBe(false);
		expect(clipsChanged(tl({ ...a, rect: { x: 0.1, y: 0, w: 0.5, h: 0.5 } }, t.items[1], t.items[2]), t)).toBe(false);
		expect(clipsChanged(tl(a, t.items[1], text('t', 1, 5)), t)).toBe(false);
	});
	it('notices changes in time, volume, added and removed clips', () => {
		expect(clipsChanged(tl({ ...a, start: 1 }, t.items[1], t.items[2]), t)).toBe(true);
		expect(clipsChanged(tl({ ...a, volume: 0.5 }, t.items[1], t.items[2]), t)).toBe(true);
		expect(clipsChanged(tl(a, t.items[2]), t)).toBe(true);
		expect(clipsChanged(tl(...t.items, clip('c', 6, 0, 1)), t)).toBe(true);
	});
});

describe('tracks', () => {
	it('addItem places in front of all items overlapping in time', () => {
		let t = tl(clip('a', 0, 0, 10));
		t = addItem(t, text('t1', 1, 3, 0));
		t = addItem(t, text('t2', 2, 4, 0));
		t = addItem(t, text('t3', 5, 6, 0));
		expect(tracks(t)).toEqual({ a: 0, t1: 1, t2: 2, t3: 1 });
	});
	it('appendClip appends to the end of track 0', () => {
		const t = appendClip(tl(clip('a', 0, 0, 3), clip('b', 0, 0, 9, 1)), clip('c', 0, 0, 2));
		expect(layout(t).c).toEqual([0, 3, 5]);
	});
	it('setTrack inserts a new track if the target is occupied', () => {
		const t = tl(clip('a', 0, 0, 10), text('x', 1, 3), text('y', 2, 4, 2));
		expect(tracks(setTrack(t, 'y', 1))).toEqual({ a: 0, x: 2, y: 1 });
		expect(tracks(setTrack(t, 'a', 2))).toEqual({ x: 0, y: 1, a: 2 });
		expect(tracks(setTrack(t, 'x', 0))).toEqual({ a: 1, x: 0, y: 2 });
	});
	it('setTrack onto a free track, empty tracks are removed', () => {
		const t = tl(clip('a', 0, 0, 2), text('x', 5, 6, 3));
		expect(tracks(setTrack(t, 'x', 0))).toEqual({ a: 0, x: 0 });
	});
	it('forward/backward jumps over visible neighbors', () => {
		const t = tl(clip('a', 0, 0, 10), text('x', 1, 3), text('y', 2, 4, 2));
		expect(tracks(bringForward(t, 'a'))).toEqual({ a: 1, x: 0, y: 2 });
		expect(tracks(sendBackward(t, 'y'))).toEqual({ a: 0, x: 2, y: 1 });
		expect(tracks(bringToFront(t, 'a'))).toEqual({ x: 0, y: 1, a: 2 });
		expect(sendToBack(t, 'a')).toBe(t);
	});
	it('moveItem stops at the neighbor on its own track, open towards the end', () => {
		const t = tl(clip('a', 0, 0, 2), clip('b', 5, 0, 2), text('x', 0, 10));
		expect(layout(moveItem(t, 'b', 1)).b).toEqual([0, 2, 4]);
		expect(layout(moveItem(t, 'b', 20)).b).toEqual([0, 20, 22]);
		expect(layout(moveItem(t, 'a', -3)).a).toEqual([0, 0, 2]);
	});
	it('placeItem passes neighbors on the old track when changing tracks', () => {
		const t = tl(clip('a', 0, 0, 5), text('x', 6, 8, 0), text('y', 0, 1, 1));
		expect(layout(placeItem(t, 'x', 2, 1)).x).toEqual([1, 2, 4]);
		// Occupied there: new track above, the annotation keeps its length
		expect(layout(placeItem(t, 'x', 0.5, 1))).toEqual({ a: [0, 0, 5], x: [2, 0.5, 2.5], y: [1, 0, 1] });
		expect(layout(placeItem(t, 'x', -3, 2)).x.slice(1)).toEqual([0, 2]);
	});
	it('retimeAnnotation clamps to the neighbors', () => {
		const t = tl(text('x', 1, 2), text('y', 5, 6));
		expect(layout(retimeAnnotation(t, 'x', -1, 9)).x).toEqual([1, 0, 5]);
	});
});

describe('split', () => {
	it('without a selection, all clips under the playhead', () => {
		const t = split(tl(clip('a', 0, 0, 10), clip('b', 2, 0, 6, 1), text('x', 0, 10, 2)), 4);
		expect(t.items.filter((i) => i.type === 'video').map((c) => [c.track, c.start])).toEqual([
			[0, 0],
			[0, 4],
			[1, 2],
			[1, 4]
		]);
		expect(t.items.filter((i) => i.type === 'annotation')).toHaveLength(1);
	});
	it('with a selection, only that item, annotations too', () => {
		const t = split(tl(clip('a', 0, 0, 10), text('x', 0, 10)), 4, ['x']);
		expect(t.items.map((i) => [i.id === 'a' ? 'a' : i.type, i.start])).toEqual([
			['a', 0],
			['annotation', 0],
			['annotation', 4]
		]);
	});
	it('too close to the boundary → unchanged', () => {
		const t = tl(clip('a', 0, 0, 10));
		expect(split(t, 0.01)).toBe(t);
	});
});

describe('remove', () => {
	it('with ripple only empty time is closed: annotations in the range stay complete and move up', () => {
		const t = tl(clip('a', 0, 0, 2), clip('b', 2, 0, 3), clip('c', 5, 0, 2), text('x', 2.5, 3.5), text('y', 4, 6, 2));
		// Empty were [2, 2.5) and [3.5, 4)
		expect(layout(remove(t, ['b']))).toEqual({ a: [0, 0, 2], x: [1, 2, 3], y: [2, 3, 5], c: [0, 4, 6] });
	});
	it('removing a clip without a picture cuts no time and keeps everything else', () => {
		// Long music under a short video, text where only music is left
		const t = tl(clip('v', 0, 0, 6), { ...clip('m', 0, 0, 12, 1), sourceId: 'music' }, text('x', 9, 10, 2));
		const r = remove(t, ['m'], true, (s) => s !== 'music');
		expect(layout(r)).toEqual({ v: [0, 0, 6], x: [1, 9, 10] });
		expect(duration(r)).toBe(10);
	});
	it('without ripple a gap remains', () => {
		const t = tl(clip('a', 0, 0, 2), clip('b', 2, 0, 3), clip('c', 5, 0, 2));
		expect(layout(remove(t, ['b'], false))).toEqual({ a: [0, 0, 2], c: [0, 5, 7] });
	});
	it('closes only where no other clip remains', () => {
		// Picture-in-picture over part of the deleted range
		const t = tl(clip('a', 0, 0, 2), clip('b', 2, 0, 4), clip('c', 6, 0, 2), clip('p', 3, 0, 1, 1));
		expect(layout(remove(t, ['b']))).toEqual({ a: [0, 0, 2], p: [1, 2, 3], c: [0, 3, 5] });
	});
	it('annotations leave no ripple', () => {
		const t = tl(clip('a', 0, 0, 10), text('x', 2, 4));
		expect(duration(remove(t, ['x']))).toBe(10);
	});
	it('zoom segments move along', () => {
		const t = { ...tl(clip('a', 0, 0, 2), clip('b', 2, 0, 3), clip('c', 5, 0, 5)), zoom: [zoom('z', 6, 8)] };
		expect(remove(t, ['b']).zoom[0]).toMatchObject({ start: 3, end: 5 });
	});
});

describe('trim', () => {
	const t = tl(clip('a', 0, 0, 4), clip('b', 4, 0, 4), text('x', 5, 6));
	it('out point with ripple', () => {
		expect(layout(trim(t, 'a', 'out', 3, 10))).toMatchObject({ a: [0, 0, 3], b: [0, 3, 7], x: [1, 4, 5] });
		expect(layout(trim(t, 'a', 'out', 6, 10))).toMatchObject({ a: [0, 0, 6], b: [0, 6, 10], x: [1, 7, 8] });
	});
	it('out point without ripple stops at the neighbor', () => {
		expect(layout(trim(t, 'a', 'out', 3, 10, false))).toMatchObject({ a: [0, 0, 3], b: [0, 4, 8] });
		expect(layout(trim(t, 'a', 'out', 6, 10, false))).toMatchObject({ a: [0, 0, 4] });
	});
	it('trimming keeps annotations over the trimmed part', () => {
		const u = tl(clip('a', 0, 0, 4), clip('b', 4, 0, 4), text('x', 3, 3.5));
		expect(layout(trim(u, 'a', 'out', 2, 10))).toMatchObject({ a: [0, 0, 2], x: [1, 2, 2.5], b: [0, 2.5, 6.5] });
	});
	it('in point with ripple: start stays, later items move', () => {
		const r = trim(t, 'b', 'in', 1, 10);
		expect(layout(r)).toMatchObject({ a: [0, 0, 4], b: [0, 4, 7], x: [1, 4, 5] });
		expect(r.items.find((i) => i.id === 'b')).toMatchObject({ in: 1 });
	});
	it('in point without ripple: end stays, start moves up to the neighbor', () => {
		const t2 = tl(clip('a', 0, 0, 2), clip('b', 4, 3, 7));
		expect(layout(trim(t2, 'b', 'in', 4, 10, false))).toMatchObject({ b: [0, 5, 8] });
		expect(layout(trim(t2, 'b', 'in', 0, 10, false))).toMatchObject({ b: [0, 2, 8] });
	});
	it('extend in point with ripple', () => {
		const t2 = tl(clip('a', 0, 0, 2), clip('b', 2, 3, 7));
		expect(layout(trim(t2, 'b', 'in', 1, 10))).toMatchObject({ a: [0, 0, 2], b: [0, 2, 8] });
	});
});

describe('rippleInsert', () => {
	it('shifts later items, stretches spanning annotations, leaves spanning clips', () => {
		const t = rippleInsert(tl(clip('a', 0, 0, 10, 1), clip('b', 5, 0, 2), text('x', 2, 6, 2)), 4, 3);
		expect(layout(t)).toEqual({ a: [1, 0, 10], b: [0, 8, 10], x: [2, 2, 9] });
	});
});

describe('insertFreeze', () => {
	it('without a selection, for all clips under the playhead', () => {
		const t = insertFreeze(tl(clip('a', 0, 10, 20), clip('p', 2, 0, 6, 1), text('x', 7, 8, 2)), 4, 2);
		const freezes = t.items.filter((i) => i.type === 'freeze');
		expect(freezes.map((f) => [f.track, f.start, f.type === 'freeze' && f.at, f.type === 'freeze' && f.duration])).toEqual([
			[0, 4, 14, 2],
			[1, 4, 2, 2]
		]);
		expect(duration(t)).toBe(12);
		expect(layout(t).x).toEqual([2, 9, 10]);
	});
	it('with a selection, only for that clip, others are split and stay in sync', () => {
		const t = insertFreeze(tl(clip('a', 0, 0, 10), clip('p', 2, 0, 6, 1)), 4, 2, ['a']);
		expect(t.items.filter((i) => i.type === 'freeze')).toHaveLength(1);
		const p = t.items.filter((i) => i.track === 1).map((i) => [i.start, i.type === 'video' && i.in]);
		expect(p).toEqual([
			[2, 0],
			[6, 2]
		]);
	});
	it('the still keeps shape and window position', () => {
		const t = insertFreeze(tl({ ...clip('a', 0, 0, 10), shape: 'rounded', anchor: 'top-left' }), 4, 2);
		const freeze = t.items.find((i) => i.type === 'freeze');
		expect(freeze && 'anchor' in freeze && [freeze.shape, freeze.anchor]).toEqual(['rounded', 'top-left']);
	});
	it('clips without a picture get no still, only a gap', () => {
		const t = insertFreeze(tl(clip('a', 0, 0, 10), { ...clip('m', 0, 0, 10, 1), sourceId: 'mic' }), 4, 2, undefined, (s) => s !== 'mic');
		expect(t.items.filter((i) => i.type === 'freeze').map((f) => f.track)).toEqual([0]);
		expect(t.items.filter((i) => i.track === 1).map((i) => i.start)).toEqual([0, 6]);
	});
	it('holds the last frame at the end of a clip', () => {
		const t = insertFreeze(tl(clip('a', 0, 0, 5)), 5, 2);
		expect(t.items.find((i) => i.type === 'freeze')).toMatchObject({ start: 5, duration: 2, at: 4.999 });
	});
	it('extends when on a freeze clip', () => {
		let t = insertFreeze(tl(clip('a', 0, 0, 5)), 2, 2);
		t = insertFreeze(t, 3, 1);
		expect(t.items.filter((i) => i.type === 'freeze')).toHaveLength(1);
		expect(duration(t)).toBe(8);
	});
	it('in a gap without a clip → unchanged', () => {
		const t = tl(clip('a', 0, 0, 2), clip('b', 5, 0, 2));
		expect(insertFreeze(t, 3, 2)).toBe(t);
	});
});

describe('multi-selection & groups', () => {
	it('moveItems moves together up to the tightest limit', () => {
		const t = tl(clip('a', 2, 0, 2), clip('b', 2, 0, 2, 1), clip('n', 5, 0, 1, 1));
		expect(layout(moveItems(t, ['a', 'b'], 3))).toMatchObject({ a: [0, 3, 5], b: [1, 3, 5] });
		expect(layout(moveItems(t, ['a', 'b'], -5))).toMatchObject({ a: [0, 0, 2], b: [1, 0, 2] });
	});
	it('remove with multiple items closes the combined ranges', () => {
		const t = tl(clip('a', 0, 0, 2), clip('b', 2, 0, 2), clip('w', 2, 0, 2, 1), clip('c', 4, 0, 2));
		expect(layout(remove(t, ['b', 'w']))).toEqual({ a: [0, 0, 2], c: [0, 2, 4] });
	});
	it('groupOf and ungroup', () => {
		const t = tl({ ...clip('a', 0, 0, 2), group: 'g' }, { ...clip('b', 0, 0, 2, 1), group: 'g' }, clip('c', 2, 0, 2));
		expect(groupOf(t, 'a')).toEqual(['a', 'b']);
		expect(groupOf(t, 'c')).toEqual(['c']);
		expect(groupOf(ungroup(t, ['a', 'b']), 'a')).toEqual(['a']);
	});
	it('placeRecording creates linked tracks at the same time', () => {
		const src = (id: string, hasVideo = true) => ({
			id,
			file: `${id}.mp4`,
			name: id,
			kind: 'recording' as const,
			duration: 5,
			hasVideo,
			width: hasVideo ? 1280 : 0,
			height: hasVideo ? 720 : 0,
			hasAudio: true
		});
		const t = placeRecording(tl(clip('x', 0, 0, 3)), { screen: src('s'), camera: src('c'), mic: src('m', false) }, 1920, 1080);
		const [screen, cam, mic] = t.items.slice(1);
		expect([screen.track, screen.start, cam.track, cam.start, mic.track, mic.start]).toEqual([0, 3, 1, 3, 2, 3]);
		expect(new Set([screen.group, cam.group, mic.group]).size).toBe(1);
		expect(cam.type === 'video' && cam.rect.x + cam.rect.w).toBeLessThan(1);
	});
});

describe('track states', () => {
	it('move along when tracks are compacted or inserted', () => {
		let t = setTrackState(tl(clip('a', 0, 0, 5), text('x', 0, 5, 1), text('y', 0, 5, 2)), 2, { muted: true });
		t = remove(t, ['x']);
		expect(t.tracks).toEqual([{}, { muted: true }]);
		// a moves to a new top track, track 0 becomes empty and is removed – "muted" stays with y
		t = setTrack(t, 'a', 2);
		expect(layout(t)).toMatchObject({ y: [0, 0, 5], a: [1, 0, 5] });
		expect(t.tracks).toEqual([{ muted: true }, {}]);
		// Inserted tracks start without state
		expect(setTrack(t, 'a', 0).tracks).toEqual([{}, { muted: true }]);
	});
});

describe('Zoom', () => {
	it('addZoom never overlaps', () => {
		let t = addZoom(tl(clip('a', 0, 0, 20)), zoom('a', 5, 10));
		t = addZoom(t, zoom('b', 7, 9));
		expect(t.zoom.map((z) => z.id)).toEqual(['a']);
		t = addZoom(t, zoom('c', 2, 8));
		expect(t.zoom.map((z) => [z.id, z.start, z.end])).toEqual([
			['c', 2, 5],
			['a', 5, 10]
		]);
	});
	it('retimeZoom stays between the neighbors', () => {
		const t = { ...tl(clip('a', 0, 0, 20)), zoom: [zoom('a', 2, 4), zoom('b', 6, 8), zoom('c', 12, 14)] };
		expect(retimeZoom(t, 'b', 1, 15).zoom[1]).toMatchObject({ start: 4, end: 12 });
	});
	it('viewAt eases in and out', () => {
		const t = { ...tl(clip('a', 0, 0, 20)), zoom: [zoom('a', 2, 6, 1)] };
		expect(viewAt(t, 1)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
		expect(viewAt(t, 4)).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
		expect(viewAt(t, 2.5).w).toBeCloseTo(0.75);
		expect(viewAt(t, 2).w).toBe(1);
		expect(viewAt(t, 5.5).w).toBeCloseTo(0.75);
		expect(viewAt(t, 6)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
	});
	it('viewAt eases in and out separately', () => {
		const t = { ...tl(clip('a', 0, 0, 20)), zoom: [zoom('a', 2, 6, 2, 0)] };
		expect(viewAt(t, 3).w).toBeCloseTo(0.75);
		expect(viewAt(t, 5.9).w).toBe(0.5);
	});
});

describe('fadeAlpha', () => {
	it('rises and falls linearly, each side on its own', () => {
		expect(fadeAlpha(0.5, 0, 10, 1, 2)).toBeCloseTo(0.5);
		expect(fadeAlpha(5, 0, 10, 1, 2)).toBe(1);
		expect(fadeAlpha(9, 0, 10, 1, 2)).toBeCloseTo(0.5);
		expect(fadeAlpha(9.9, 0, 10, 1, 0)).toBe(1);
		expect(fadeAlpha(3, 0, 10)).toBe(1);
	});
	it('clampFade keeps both fades within the duration', () => {
		expect(clampFade(3, 1, 2)).toBe(1);
		expect(clampFade(0.5, 1, 2)).toBe(0.5);
		expect(clampFade(1, 3, 2)).toBe(0);
	});
	it('shortens fades longer than the element proportionally', () => {
		expect(fadeEdges(0, 2, 3, 1)).toEqual([1.5, 1.5]);
		expect(fadeAlpha(1.5, 0, 2, 3, 1)).toBe(1);
	});
});

describe('nextStepNumber', () => {
	const step = (id: string, number: number): Annotation => ({
		id,
		type: 'annotation',
		kind: 'step',
		start: 0,
		end: 1,
		fadeIn: 0,
		fadeOut: 0,
		track: 1,
		x: 0.5,
		y: 0.5,
		size: 0.07,
		number,
		color: '#ef4444',
		shadow: true
	});
	it('starts at 1 and continues after the highest number', () => {
		expect(nextStepNumber(tl(text('t', 0, 1)))).toBe(1);
		expect(nextStepNumber(tl(step('a', 1), step('b', 4), step('c', 2)))).toBe(5);
	});
});

describe('parseProject', () => {
	it('accepts version 1', () => {
		const p = parseProject({
			version: 1,
			id: 'x',
			sources: [{ id: 's', width: 1, height: 1 }],
			background: '#000000',
			timeline: { items: [] }
		});
		expect(p.timeline).toEqual({ items: [], tracks: [], zoom: [] });
		expect(p.sources[0].hasVideo).toBe(true);
	});
	it('older projects get an empty image list, existing ones stay', () => {
		const base = { version: 1, id: 'x', sources: [], timeline: { items: [] } };
		expect(parseProject(base).images).toEqual([]);
		const images = [{ id: 'i', file: 'i.png', name: 'Logo', width: 10, height: 10 }];
		expect(parseProject({ ...base, images }).images).toEqual(images);
	});
	it('fills in font, alignment and shadow of older annotations so they look the same', () => {
		const old = (kind: string, extra = {}) => ({ id: kind, type: 'annotation', kind, start: 0, end: 1, track: 0, ...extra });
		const p = parseProject({
			version: 1,
			id: 'x',
			sources: [],
			timeline: {
				items: [old('text', { background: '#000000a6', size: 0.1 }), old('text', { background: null }), old('arrow'), old('blur')]
			}
		});
		const [boxed, plain, arrow, blur] = p.timeline.items as unknown as Record<string, unknown>[];
		expect(boxed).toMatchObject({ font: 'system', align: 'left', shadow: false });
		// Corners and padding were fixed shares of the font size
		expect(boxed.radius).toBeCloseTo(0.03);
		expect(boxed.padding).toBeCloseTo(0.04);
		expect(plain).toMatchObject({ font: 'system', shadow: true });
		expect(arrow).toMatchObject({ shadow: true });
		expect(arrow.font).toBeUndefined();
		expect(blur.shadow).toBeUndefined();
		// The former fade switch becomes 0.2 s at both ends
		expect(boxed).toMatchObject({ fadeIn: 0.2, fadeOut: 0.2 });
		// Idempotent: filled items stay the same objects
		const again = parseProject(p);
		again.timeline.items.forEach((item, i) => expect(item).toBe(p.timeline.items[i]));
	});
	it('migrates version 1 to the current format', () => {
		const p = parseProject({ version: 1, id: 'x', sources: [], timeline: { items: [] } });
		expect(p).toMatchObject({ format: FORMAT, version: VERSION });
		expect(migrate({ version: 1 })).toEqual({ version: 2, format: 'screen-capture' });
	});
	it('accepts the current version as is', () => {
		const p = parseProject({ format: 'screen-capture', version: 2, id: 'x', sources: [], timeline: { items: [] } });
		expect(p.version).toBe(2);
	});
	it('rejects unknown data, other tools and newer versions', () => {
		expect(() => parseProject({ foo: 1 })).toThrow();
		expect(() => parseProject({ version: 3, format: 'screen-capture', sources: [], timeline: { items: [] } })).toThrow(/newer/);
		// Version 2 without the format name: not a Screen Capture project
		expect(() => parseProject({ version: 2, sources: [], timeline: { items: [] } })).toThrow();
		expect(() => parseProject({ version: 2, format: 'other-tool', sources: [], timeline: { items: [] } })).toThrow();
		expect(() => parseProject({ version: 0, sources: [], timeline: { items: [] } })).toThrow();
	});
});

describe('group', () => {
	it('links loose items', () => {
		const t = group(tl(clip('a', 0, 0, 5), text('x', 1, 2), clip('b', 0, 0, 5, 2)), ['a', 'x'], 'g');
		expect(t.items.map((i) => i.group)).toEqual(['g', 'g', undefined]);
	});
	it('merges existing groups completely', () => {
		const t = group(
			tl({ ...clip('a', 0, 0, 5), group: 'r' }, { ...clip('b', 0, 0, 5, 1), group: 'r' }, { ...text('x', 1, 2), group: 's' }, { ...text('y', 1, 2, 3), group: 's' }, text('z', 1, 2, 4)),
			['a', 'x'],
			'g'
		);
		expect(t.items.map((i) => i.group)).toEqual(['g', 'g', 'g', 'g', undefined]);
	});
	it('leaves other items untouched', () => {
		const loose = text('z', 1, 2, 4);
		const t = group(tl(clip('a', 0, 0, 5), clip('b', 0, 0, 5, 1), loose), ['a', 'b'], 'g');
		expect(t.items[2]).toBe(loose);
	});
});

describe('parseProject fades', () => {
	it('turns the former fade switch and zoom transition into separate values', () => {
		const p = parseProject({
			version: 1,
			id: 'x',
			sources: [],
			timeline: {
				items: [
					{ id: 'a', type: 'annotation', kind: 'arrow', start: 0, end: 1, track: 0, fade: false },
					{ id: 'b', type: 'annotation', kind: 'arrow', start: 0, end: 1, track: 0, fade: true }
				],
				zoom: [{ id: 'z', start: 0, end: 2, ease: 0.8, rect: { x: 0, y: 0, w: 0.5, h: 0.5 } }]
			}
		});
		const [off, on] = p.timeline.items as unknown as Record<string, unknown>[];
		expect(off).toMatchObject({ fadeIn: 0, fadeOut: 0 });
		expect(on).toMatchObject({ fadeIn: 0.2, fadeOut: 0.2 });
		expect('fade' in on).toBe(false);
		expect(p.timeline.zoom[0]).toMatchObject({ easeIn: 0.8, easeOut: 0.8 });
		expect('ease' in p.timeline.zoom[0]).toBe(false);
		expect(parseProject(p).timeline.zoom[0]).toBe(p.timeline.zoom[0]);
	});
});

describe('split and fades', () => {
	it('does not fade at the cut', () => {
		const c = { ...clip('a', 0, 0, 10), fadeIn: 1, fadeOut: 1 };
		const [left, right] = split(tl(c), 5).items as Clip[];
		expect(left).toMatchObject({ fadeIn: 1 });
		expect(left.fadeOut).toBeUndefined();
		expect(right).toMatchObject({ fadeOut: 1 });
		expect(right.fadeIn).toBeUndefined();
	});
});

describe('pasteItems', () => {
	it('starts the copy at the playhead, keeping the spacing', () => {
		const original = tl(clip('a', 0, 0, 2), text('t', 1, 3));
		const { timeline, ids } = pasteItems(original, original.items, 10);
		const [a, t] = ids.map((id) => timeline.items.find((i) => i.id === id)!);
		expect(a.start).toBe(10);
		expect(t.start).toBe(11);
		expect(t.type === 'annotation' && t.end).toBe(13);
	});
	it('gets new ids and puts the copy in front of what it overlaps, keeping its track order', () => {
		const original = tl(clip('a', 0, 0, 4), text('t', 0, 4, 1));
		const { timeline, ids } = pasteItems(original, original.items, 1);
		expect(ids).not.toContain('a');
		const [a, t] = ids.map((id) => timeline.items.find((i) => i.id === id)!);
		expect(a.track).toBe(2);
		expect(t.track).toBe(3);
	});
	it('stays low where nothing overlaps', () => {
		const original = tl(clip('a', 0, 0, 2), text('t', 0, 2, 3));
		const { timeline, ids } = pasteItems(original, [original.items[1]], 5);
		expect(timeline.items.find((i) => i.id === ids[0])!.track).toBe(0);
	});
	it('links the copies among themselves only', () => {
		const original = tl({ ...clip('a', 0, 0, 2), group: 'g' }, { ...text('t', 0, 2), group: 'g' });
		const { timeline, ids } = pasteItems(original, original.items, 5);
		const copies = ids.map((id) => timeline.items.find((i) => i.id === id)!);
		expect(copies[0].group).toBeDefined();
		expect(copies[0].group).toBe(copies[1].group);
		expect(copies[0].group).not.toBe('g');
	});
});

describe('drawProgress', () => {
	it('draws within drawIn seconds after the start', () => {
		expect(drawProgress(1, 1, 0.5)).toBe(0);
		expect(drawProgress(1.25, 1, 0.5)).toBe(0.5);
		expect(drawProgress(3, 1, 0.5)).toBe(1);
	});
	it('without drawIn the shape is there at once', () => {
		expect(drawProgress(1, 1, 0)).toBe(1);
		expect(drawProgress(1, 1)).toBe(1);
	});
});
