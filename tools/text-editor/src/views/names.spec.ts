import { describe, expect, it } from 'vitest';
import { freeName } from './names';

describe('freeName', () => {
	it('keeps a free base', () => {
		expect(freeName(['a', 'b'], 'c')).toBe('c');
		expect(freeName([], 'c')).toBe('c');
	});

	it('numbers a taken base from 2 on', () => {
		expect(freeName(['key'], 'key')).toBe('key 2');
		expect(freeName(['key', 'key 2', 'key 3'], 'key')).toBe('key 4');
		expect(freeName(['key', 'key 3'], 'key')).toBe('key 2');
	});

	it('uses the separator', () => {
		expect(freeName(['KEY', 'KEY_2'], 'KEY', '_')).toBe('KEY_3');
		expect(freeName(['name'], 'name', '-')).toBe('name-2');
	});

	it('ignores missing names', () => {
		expect(freeName([undefined, 'x'], 'x')).toBe('x 2');
	});
});
