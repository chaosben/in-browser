import { describe, expect, it } from 'vitest';
import { pruneHistory } from './history';

describe('pruneHistory', () => {
	const uses = (s: string) => s.includes('x');

	it('keeps only the undo steps after the last one using it', () => {
		expect(pruneHistory(['a', 'x1', 'b', 'x2', 'c', 'd'], [], uses).undo).toEqual(['c', 'd']);
	});
	it('leaves the history untouched if nothing uses it', () => {
		const undo = ['a', 'b'];
		const redo = ['c'];
		expect(pruneHistory(undo, redo, uses)).toEqual({ undo, redo });
	});
	it('clears redo if any step uses it', () => {
		expect(pruneHistory(['a'], ['b', 'x'], uses)).toEqual({ undo: ['a'], redo: [] });
	});
});
