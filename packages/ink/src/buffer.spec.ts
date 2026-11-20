import { describe, expect, it } from 'vitest';
import { PointBuffer } from './buffer';

describe('PointBuffer', () => {
	it('grows beyond its start size and keeps the points', () => {
		const buf = new PointBuffer();
		for (let i = 0; i < 5000; i++) buf.push(i, i * 2, 0.5);
		expect(buf.length).toBe(5000);
		expect(buf.y(4999)).toBe(9998);
		const copy = buf.toArray();
		expect(copy).toHaveLength(15000);
		buf.reset();
		expect(buf.length).toBe(0);
		expect(copy[3]).toBe(1);
	});
});
