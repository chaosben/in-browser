import { describe, expect, it } from 'vitest';
import { FORMAT, migrate, parseProject, VERSION, type Annotation, type Clip, type Item, type Timeline, type VideoClip, type ZoomSegment } from '#lib/project/types.js';
import {
	addItem,
	addZoom,
	clipsChanged,
	duration,
	group,
	insertFreeze,
	moveItems,
	pasteItems,
	placeItem,
	remove,
	retimeAnnotation,
	retimeZoom,
	rippleInsert,
	setTrack,
	setTrackState,
	split,
	trim
} from './ops';

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

describe('clipsChanged', () => {
	const a = clip('a', 0, 0, 4) as VideoClip;
	const t = tl(a, clip('b', 4, 0, 2), text('t', 0, 3));
	it('notices changes in time, volume, added and removed clips, not of the position in the frame', () => {
		expect(clipsChanged(tl({ ...a, rect: { x: 0.1, y: 0, w: 0.5, h: 0.5 } }, t.items[1], t.items[2]), t)).toBe(false);
		expect(clipsChanged(tl({ ...a, start: 1 }, t.items[1], t.items[2]), t)).toBe(true);
		expect(clipsChanged(tl({ ...a, volume: 0.5 }, t.items[1], t.items[2]), t)).toBe(true);
		expect(clipsChanged(tl(a, t.items[2]), t)).toBe(true);
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
	it('setTrack inserts a new track if the target is occupied', () => {
		const t = tl(clip('a', 0, 0, 10), text('x', 1, 3), text('y', 2, 4, 2));
		expect(tracks(setTrack(t, 'y', 1))).toEqual({ a: 0, x: 2, y: 1 });
		expect(tracks(setTrack(t, 'a', 2))).toEqual({ x: 0, y: 1, a: 2 });
		expect(tracks(setTrack(t, 'x', 0))).toEqual({ a: 1, x: 0, y: 2 });
	});
	it('moveItems of one item stops at the neighbor on its own track, open towards the end', () => {
		const t = tl(clip('a', 0, 0, 2), clip('b', 5, 0, 2), text('x', 0, 10));
		expect(layout(moveItems(t, ['b'], -4)).b).toEqual([0, 2, 4]);
		expect(layout(moveItems(t, ['b'], 15)).b).toEqual([0, 20, 22]);
		expect(layout(moveItems(t, ['a'], -3)).a).toEqual([0, 0, 2]);
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
	it('lengthening fills free room on its track first: music beside a video pushes nothing', () => {
		// Music on track 1 inside video a, video b right after a
		const u = tl(clip('a', 0, 0, 4), clip('b', 4, 0, 4), clip('m', 0, 0, 2, 1), text('x', 5, 6, 2));
		expect(layout(trim(u, 'm', 'out', 3, 20))).toMatchObject({ a: [0, 0, 4], b: [0, 4, 8], m: [1, 0, 3], x: [2, 5, 6] });
		expect(layout(trim(u, 'm', 'out', 6, 20))).toMatchObject({ a: [0, 0, 4], b: [0, 4, 8], m: [1, 0, 6], x: [2, 5, 6] });
	});
	it('lengthening beyond the gap pushes only the excess, on all tracks', () => {
		const u = tl(clip('a', 0, 0, 2), clip('b', 3, 0, 4), clip('c', 3, 0, 1, 1), text('x', 5, 6, 2));
		expect(layout(trim(u, 'a', 'out', 4, 10))).toMatchObject({ a: [0, 0, 4], b: [0, 4, 8], c: [1, 4, 5], x: [2, 6, 7] });
	});
	it('extend in point fills the gap before the clip first', () => {
		const u = tl(clip('a', 0, 0, 2), clip('b', 4, 3, 7), text('x', 9, 10));
		expect(layout(trim(u, 'b', 'in', 2, 10))).toMatchObject({ a: [0, 0, 2], b: [0, 3, 8], x: [1, 9, 10] });
		// Gap of 2 s, 3 s more material: the clip reaches back to a, the remaining second moves it and the rest
		const r = trim(u, 'b', 'in', 0, 10);
		expect(layout(r)).toMatchObject({ a: [0, 0, 2], b: [0, 2, 9], x: [1, 10, 11] });
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
	it('clips without a picture get no still, only a gap', () => {
		const t = insertFreeze(tl(clip('a', 0, 0, 10), { ...clip('m', 0, 0, 10, 1), sourceId: 'mic' }), 4, 2, undefined, (s) => s !== 'mic');
		expect(t.items.filter((i) => i.type === 'freeze').map((f) => f.track)).toEqual([0]);
		expect(t.items.filter((i) => i.track === 1).map((i) => i.start)).toEqual([0, 6]);
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
});

describe('parseProject', () => {
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
		const p = parseProject({ version: 1, id: 'x', sources: [{ id: 's', width: 1, height: 1 }], background: '#000000', timeline: { items: [] } });
		expect(p).toMatchObject({ format: FORMAT, version: VERSION, images: [] });
		expect(p.timeline).toEqual({ items: [], tracks: [], zoom: [] });
		expect(p.sources[0].hasVideo).toBe(true);
		expect(migrate({ version: 1 })).toEqual({ version: 2, format: 'screen-capture' });
		const images = [{ id: 'i', file: 'i.png', name: 'Logo', width: 10, height: 10 }];
		expect(parseProject({ version: 1, id: 'x', sources: [], timeline: { items: [] }, images }).images).toEqual(images);
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
	it('merges existing groups completely', () => {
		const t = group(
			tl({ ...clip('a', 0, 0, 5), group: 'r' }, { ...clip('b', 0, 0, 5, 1), group: 'r' }, { ...text('x', 1, 2), group: 's' }, { ...text('y', 1, 2, 3), group: 's' }, text('z', 1, 2, 4)),
			['a', 'x'],
			'g'
		);
		expect(t.items.map((i) => i.group)).toEqual(['g', 'g', 'g', 'g', undefined]);
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
	it('links the copies among themselves only', () => {
		const original = tl({ ...clip('a', 0, 0, 2), group: 'g' }, { ...text('t', 0, 2), group: 'g' });
		const { timeline, ids } = pasteItems(original, original.items, 5);
		const copies = ids.map((id) => timeline.items.find((i) => i.id === id)!);
		expect(copies[0].group).toBeDefined();
		expect(copies[0].group).toBe(copies[1].group);
		expect(copies[0].group).not.toBe('g');
	});
});

