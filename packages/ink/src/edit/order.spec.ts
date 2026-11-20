import { describe, expect, it } from 'vitest';
import { reordered } from './items.js';

const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
const order = (ids: string[], to: Parameters<typeof reordered>[2]) =>
	reordered(items, new Set(ids), to)
		.map((i) => i.id)
		.join('');

describe('reordered', () => {
	it('moves items to the front or back, keeping their own order', () => {
		expect(order(['b', 'd'], 'front')).toBe('acebd');
		expect(order(['b', 'd'], 'back')).toBe('bdace');
	});

	it('moves items one place past the next unselected one', () => {
		expect(order(['b'], 'forward')).toBe('acbde');
		expect(order(['b', 'c'], 'forward')).toBe('adbce');
		expect(order(['e'], 'forward')).toBe('abcde');
		expect(order(['b', 'd'], 'backward')).toBe('badce');
		expect(order(['a'], 'backward')).toBe('abcde');
	});
});
