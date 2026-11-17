import { describe, expect, it } from 'vitest';
import { decodeBase32, encodeBase32, groupBase32, normalizeBase32 } from './base32.js';

describe('base32', () => {
	it('round-trips bytes', () => {
		const bytes = new Uint8Array([0, 1, 2, 250, 255, 128, 77, 9, 33, 44]);
		expect(decodeBase32(encodeBase32(bytes))).toEqual(bytes);
	});
	it('encodes a limited number of bits', () => {
		expect(encodeBase32(new Uint8Array(13), 100)).toHaveLength(20);
	});
	it('accepts what people type', () => {
		expect(normalizeBase32('k7qf-29xm o1l')).toBe('K7QF29XM011');
		expect(normalizeBase32('K7QF U')).toBeNull();
		expect(groupBase32('K7QF29XM01')).toBe('K7QF-29XM-01');
	});
});
