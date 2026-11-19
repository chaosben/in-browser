import { describe, expect, it } from 'vitest';
import { connectedDocuments, forgetConnected, rememberConnected } from './recent';

function memory(): Storage {
	const map = new Map<string, string>();
	return {
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => void map.set(k, v),
		removeItem: (k) => void map.delete(k),
		clear: () => map.clear(),
		key: (i) => [...map.keys()][i] ?? null,
		get length() {
			return map.size;
		}
	};
}

describe('remembered documents in connected folders', () => {
	it('keeps only connected paths, newest first, without doubles', () => {
		const s = memory();
		rememberConnected('notes', '/:c/a/One.note', s);
		rememberConnected('notes', '/Mine.note', s);
		rememberConnected('notes', '/:c/a/Two.note', s);
		rememberConnected('notes', '/:c/a/One.note', s);
		expect(connectedDocuments('notes', s)).toEqual(['/:c/a/One.note', '/:c/a/Two.note']);
		expect(connectedDocuments('screen-capture', s)).toEqual([]);
	});
	it('forgets and stays bounded', () => {
		const s = memory();
		for (let i = 0; i < 60; i++) rememberConnected('notes', `/:c/a/${i}.note`, s);
		expect(connectedDocuments('notes', s)).toHaveLength(50);
		forgetConnected('notes', '/:c/a/59.note', s);
		expect(connectedDocuments('notes', s)[0]).toBe('/:c/a/58.note');
	});
	it('survives broken storage content', () => {
		const s = memory();
		s.setItem('notes:connected', '{oops');
		expect(connectedDocuments('notes', s)).toEqual([]);
	});
});
