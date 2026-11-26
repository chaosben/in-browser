import { describe, expect, it } from 'vitest';
import { mergeFiles, sameContent, type Snapshot } from './merge.js';
import { bookmarkKey, emptyData, locKey, type JwlData, type Location, type Note, type UserMark } from './model.js';

// Every way a merge could lose or mix up data, once: the union, a note changed on both sides, the highlights of one
// paragraph from both sides, a bookmark slot taken twice, a file merged with itself.

const loc = (document: number): Location => ({
	book: null,
	chapter: null,
	document,
	track: null,
	issue: 0,
	keySymbol: 'w',
	language: 2,
	type: 0,
	title: `Doc ${document}`,
	specialty: null,
	edition: null
});
const L1 = loc(1);
const L2 = loc(2);
const PUB: Location = { ...loc(0), document: null, type: 1, title: 'Publication' };

function note(guid: string, content: string, modified: string): Note {
	return { guid, mark: null, loc: locKey(L1), title: guid, content, modified, created: '2026-01-01T00:00:00Z', blockType: 0, blockId: null };
}

function data(notes: Note[], extra: (d: JwlData) => void = () => {}): JwlData {
	const d = emptyData();
	for (const l of [L1, L2, PUB]) d.locations.set(locKey(l), l);
	for (const n of notes) d.notes.set(n.guid, n);
	extra(d);
	return d;
}

const at = (name: string, iso: string, d: JwlData): Snapshot => ({ name, time: Date.parse(iso), data: d });
const contents = (d: JwlData) => Object.fromEntries([...d.notes.values()].map((n) => [n.guid, n.content]));

describe('merging backups', () => {
	const mine = (d: JwlData) => at('mine', '2026-01-08T00:00:00Z', d);
	const theirs = (d: JwlData) => at('incoming', '2026-01-09T00:00:00Z', d);

	it.each([
		{
			case: 'what only one file has is kept – the union',
			mine: data([note('a', 'A', '2026-01-02T00:00:00Z')]),
			incoming: data([note('b', 'B', '2026-01-03T00:00:00Z')]),
			expected: { a: 'A', b: 'B' },
			conflicts: 0
		},
		{
			case: 'a note changed on both sides: the later change counts, also in the older file',
			mine: data([note('a', 'mine', '2026-01-05T00:00:00Z'), note('b', 'mine', '2026-01-02T00:00:00Z')]),
			incoming: data([note('a', 'theirs', '2026-01-04T00:00:00Z'), note('b', 'theirs', '2026-01-03T00:00:00Z')]),
			expected: { a: 'mine', b: 'theirs' },
			conflicts: 2
		}
	])('$case', ({ mine: a, incoming: b, expected, conflicts }) => {
		const result = mergeFiles(mine(a), theirs(b));
		expect(contents(result.data)).toEqual(expected);
		expect(result.stats.conflicts).toBe(conflicts);
	});

	it('takes the highlights of a paragraph from the newer file, and those of the other that do not overlap them', () => {
		const mark = (guid: string, start: number, end: number): UserMark => ({ guid, loc: locKey(L1), color: 1, style: 0, version: 1, ranges: [{ blockType: 1, identifier: 1, start, end }] });
		const marks = (...list: UserMark[]) => data([], (d) => list.forEach((m) => d.marks.set(m.guid, m)));
		const result = mergeFiles(mine(marks(mark('m1', 0, 5), mark('m2', 20, 25))), theirs(marks(mark('m3', 3, 8))));
		expect([...result.data.marks.keys()].sort()).toEqual(['m2', 'm3']);
	});

	it('moves a bookmark that lost its slot to a free one of the same publication', () => {
		const bookmark = (l: Location, title: string) => (d: JwlData) => {
			const b = { publication: locKey(PUB), slot: 0, loc: locKey(l), title, snippet: null, blockType: 0, blockId: null };
			d.bookmarks.set(bookmarkKey(b), b);
		};
		const result = mergeFiles(mine(data([], bookmark(L1, 'one'))), theirs(data([], bookmark(L2, 'two'))));
		expect([...result.data.bookmarks.values()].map((b) => [b.slot, b.title]).sort()).toEqual([
			[0, 'two'],
			[1, 'one']
		]);
	});

	it('changes nothing when a file is merged with itself', () => {
		const d = data([note('a', 'A', '2026-01-02T00:00:00Z')]);
		const result = mergeFiles(mine(d), theirs(d));
		expect(sameContent(result.data, d)).toBe(true);
		expect(result.stats.conflicts).toBe(0);
	});
});
