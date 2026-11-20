import { describe, expect, it } from 'vitest';
import { decodeBase32, encodeBase32, normalizeBase32 } from './base32.js';

describe('base32', () => {
	it('round-trips bytes and accepts what people type', () => {
		const bytes = new Uint8Array([0, 1, 2, 250, 255, 128, 77, 9, 33, 44]);
		expect(decodeBase32(encodeBase32(bytes))).toEqual(bytes);
		expect(normalizeBase32('k7qf-29xm o1l')).toBe('K7QF29XM011');
		expect(normalizeBase32('K7QF U')).toBeNull();
	});
});
