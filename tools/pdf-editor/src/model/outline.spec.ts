import { describe, expect, it } from 'vitest';
import { indent, moveBy, moveTo, outdent, removeAll, visible, type Bookmark } from './outline.js';

// A tree written as text: "a(b c) d" – a holds b and c, d follows a
function tree(text: string): Bookmark[] {
	const tokens = text.match(/[()]|[^\s()]+/g) ?? [];
	let at = 0;
	const list = (): Bookmark[] => {
		const out: Bookmark[] = [];
		while (at < tokens.length && tokens[at] !== ')') {
			const id = tokens[at++];
			const items = tokens[at] === '(' ? (at++, list()) : [];
			if (tokens[at] === ')' && items.length) at++;
			out.push({ id, title: id, target: null, items });
		}
		return out;
	};
	return list();
}
const text = (t: readonly Bookmark[] | null): string => (t ? t.map((b) => (b.items.length ? `${b.id}(${text(b.items)})` : b.id)).join(' ') : 'null');

describe('bookmarks', () => {
	it.each([
		['up', 'a b c', ['c'], (t: Bookmark[], ids: Set<string>) => moveBy(t, ids, -1), 'a c b'],
		['down, the entries inside go along', 'a(x) b', ['a'], (t: Bookmark[], ids: Set<string>) => moveBy(t, ids, 1), 'b a(x)'],
		['two neighbours down together', 'a b c', ['a', 'b'], (t: Bookmark[], ids: Set<string>) => moveBy(t, ids, 1), 'c a b'],
		['not past the end', 'a b', ['b'], (t: Bookmark[], ids: Set<string>) => moveBy(t, ids, 1), 'null'],
		['in: into the one before, as its last', 'a(x) b', ['b'], indent, 'a(x b)'],
		['not in without one before', 'a b', ['a'], indent, 'null'],
		['out: right after its parent, in order', 'a(x y z) b', ['x', 'y'], outdent, 'a(z) x y b'],
		['dragged into another', 'a b(x)', ['a'], (t: Bookmark[], ids: Set<string>) => moveTo(t, ids, 'b', 'inside'), 'b(x a)'],
		['never into itself', 'a(x) b', ['a'], (t: Bookmark[], ids: Set<string>) => moveTo(t, ids, 'x', 'after'), 'a(x) b'],
		['deleted with what is inside', 'a(x) b', ['a'], (t: Bookmark[], ids: Set<string>) => removeAll(t, ids), 'b']
	])('%s', (_, start, ids, change, expected) => {
		expect(text(change(tree(start), new Set(ids)))).toBe(expected);
	});

	it('shows the entries below the open ones only', () => {
		const t = tree('a(x(y)) b');
		expect(visible(t, new Set(['a'])).map((v) => `${v.bookmark.id}${v.depth}`)).toEqual(['a0', 'x1', 'b0']);
		expect(visible(t, new Set(['a', 'x'])).map((v) => v.parent)).toEqual([null, 'a', 'x', null]);
	});
});
