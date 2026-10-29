import { describe, expect, it } from 'vitest';
import { entriesUse, entryDuration, entryName, mediaOf, unusedFiles } from './library';
import { parseProject, type ImageAsset, type Item, type LibraryEntry, type Source } from './types';

const source = (id: string): Source =>
	({ id, file: `${id}.mp4`, name: id, kind: 'import', duration: 10, width: 1920, height: 1080, hasVideo: true, hasAudio: true }) as Source;
const image = (id: string): ImageAsset => ({ id, file: `${id}.png`, name: id, width: 10, height: 10 });
const clip = (sourceId: string, start = 0): Item => ({
	id: `c-${sourceId}`,
	type: 'video',
	sourceId,
	start,
	track: 0,
	in: 2,
	out: 5,
	rect: { x: 0, y: 0, w: 1, h: 1 }
});
const picture = (imageId: string): Item =>
	({ id: `i-${imageId}`, type: 'annotation', kind: 'image', imageId, start: 1, end: 2, track: 1 }) as Item;
const entry = (id: string, items: Item[], sources: Source[] = [], images: ImageAsset[] = []): LibraryEntry => ({
	id,
	name: id,
	items,
	sources,
	images
});

describe('library', () => {
	it('knows which sources and images entries use', () => {
		const entries = [entry('a', [clip('s1'), picture('p1')])];
		expect(entriesUse(entries, 's1')).toBe(true);
		expect(entriesUse(entries, 'p1')).toBe(true);
		expect(entriesUse(entries, 's2')).toBe(false);
	});
	it('picks the media the items use', () => {
		const media = mediaOf([clip('s1'), picture('p1')], [source('s1'), source('s2')], [image('p1'), image('p2')]);
		expect(media.sources.map((s) => s.id)).toEqual(['s1']);
		expect(media.images.map((i) => i.id)).toEqual(['p1']);
	});
	it('frees only the files no other entry uses', () => {
		const removed = entry('a', [clip('s1'), clip('s2')], [source('s1'), source('s2')]);
		const rest = [entry('b', [clip('s2')], [source('s2')])];
		expect(unusedFiles(rest, removed)).toEqual(['s1.mp4', 's1.peaks.json']);
	});
	it('names and measures entries', () => {
		expect(entryName('Arrow', 1)).toBe('Arrow');
		expect(entryName('Arrow', 3)).toBe('Arrow +2');
		expect(entryDuration([clip('s1', 4), picture('p1')])).toBe(6);
	});
	it('parseProject adds an empty library to older projects', () => {
		const p = parseProject({ version: 1, id: 'x', sources: [], timeline: { items: [] } });
		expect(p.library).toEqual([]);
	});
});
