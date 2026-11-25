import { describe, expect, it } from 'vitest';
import { mergeFiles, sameContent, tooMuchLost, loss, type Snapshot } from './merge.js';
import { bookmarkKey, emptyData, locKey, type JwlData, type Location, type Note } from './model.js';

// Every way a merge could lose or mix up data, once: union without a base, order, deletions with a base, a note
// changed on both sides, a bookmark slot taken twice, the question before much is lost, a file merged with itself.

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
	it.each([
		{
			case: 'without a base nothing is deleted – the union',
			mine: data([note('a', 'A', '2026-01-02T00:00:00Z')]),
			incoming: data([note('b', 'B', '2026-01-03T00:00:00Z')]),
			bases: {},
			expected: { a: 'A', b: 'B' }
		},
		{
			case: 'a deletion since the base travels',
			mine: data([note('a', 'A', '2026-01-02T00:00:00Z'), note('b', 'B', '2026-01-02T00:00:00Z')]),
			incoming: data([note('a', 'A', '2026-01-02T00:00:00Z')]),
			bases: { incoming: data([note('a', 'A', '2026-01-02T00:00:00Z'), note('b', 'B', '2026-01-02T00:00:00Z')]) },
			expected: { a: 'A' }
		},
		{
			case: 'a note changed on both sides: the later change counts',
			mine: data([note('a', 'mine', '2026-01-05T00:00:00Z')]),
			incoming: data([note('a', 'theirs', '2026-01-04T00:00:00Z')]),
			bases: { mine: data([note('a', 'old', '2026-01-01T00:00:00Z')]), incoming: data([note('a', 'old', '2026-01-01T00:00:00Z')]) },
			expected: { a: 'mine' }
		},
		{
			case: 'something added meanwhile in mine stays when the other side has a base without it',
			mine: data([note('a', 'A', '2026-01-02T00:00:00Z'), note('c', 'C', '2026-01-06T00:00:00Z')]),
			incoming: data([note('a', 'A2', '2026-01-07T00:00:00Z')]),
			bases: { incoming: data([note('a', 'A', '2026-01-02T00:00:00Z')]) },
			expected: { a: 'A2', c: 'C' }
		}
	])('$case', ({ mine, incoming, bases, expected }) => {
		const base = (d?: JwlData) => (d ? at('base', '2026-01-01T12:00:00Z', d) : null);
		const result = mergeFiles(at('mine', '2026-01-08T00:00:00Z', mine), at('incoming', '2026-01-09T00:00:00Z', incoming), {
			mine: base(bases.mine),
			incoming: base(bases.incoming)
		});
		expect(contents(result.data)).toEqual(expected);
	});

	it('gives the same result in either order when neither has a base', () => {
		const a = data([note('a', 'A', '2026-01-02T00:00:00Z')]);
		const b = data([note('b', 'B', '2026-01-03T00:00:00Z')]);
		const ab = mergeFiles(at('x', '2026-01-08T00:00:00Z', a), at('y', '2026-01-09T00:00:00Z', b), { mine: null, incoming: null });
		const ba = mergeFiles(at('x', '2026-01-08T00:00:00Z', b), at('y', '2026-01-09T00:00:00Z', a), { mine: null, incoming: null });
		expect(sameContent(ab.data, ba.data)).toBe(true);
	});

	it('moves a bookmark that lost its slot to a free one of the same publication', () => {
		const bookmark = (l: Location, title: string) => (d: JwlData) => {
			const b = { publication: locKey(PUB), slot: 0, loc: locKey(l), title, snippet: null, blockType: 0, blockId: null };
			d.bookmarks.set(bookmarkKey(b), b);
		};
		const empty = at('base', '2026-01-01T00:00:00Z', data([]));
		const result = mergeFiles(at('mine', '2026-01-02T00:00:00Z', data([], bookmark(L1, 'one'))), at('incoming', '2026-01-03T00:00:00Z', data([], bookmark(L2, 'two'))), {
			mine: empty,
			incoming: empty
		});
		expect([...result.data.bookmarks.values()].map((b) => [b.slot, b.title]).sort()).toEqual([
			[0, 'two'],
			[1, 'one']
		]);
	});

	it('asks before a merge would remove more than a fifth and more than 20 highlights and notes', () => {
		const many = data(Array.from({ length: 100 }, (_, i) => note(`n${i}`, '', '2026-01-02T00:00:00Z')));
		const few = data(Array.from({ length: 70 }, (_, i) => note(`n${i}`, '', '2026-01-02T00:00:00Z')));
		const result = mergeFiles(at('mine', '2026-01-03T00:00:00Z', many), at('incoming', '2026-01-04T00:00:00Z', few), {
			mine: null,
			incoming: at('base', '2026-01-02T00:00:00Z', many)
		});
		expect(loss(many, result.data)).toEqual({ removed: 30, of: 100 });
		expect(tooMuchLost(loss(many, result.data))).toBe(true);
		expect(tooMuchLost({ removed: 20, of: 50 })).toBe(false);
	});

	it('changes nothing when a file is merged with itself', () => {
		const d = data([note('a', 'A', '2026-01-02T00:00:00Z')]);
		const result = mergeFiles(at('mine', '2026-01-02T00:00:00Z', d), at('incoming', '2026-01-02T00:00:00Z', d), { mine: null, incoming: null });
		expect(sameContent(result.data, d)).toBe(true);
	});
});
