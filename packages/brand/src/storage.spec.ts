import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadJson, readStored, storeJson, writeStored } from './storage';

describe('storage', () => {
	let data: Map<string, string>;
	beforeEach(() => {
		data = new Map();
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => data.get(k) ?? null,
			setItem: (k: string, v: string) => void data.set(k, v),
			removeItem: (k: string) => void data.delete(k)
		});
	});
	afterEach(() => vi.unstubAllGlobals());

	it('falls back on missing or broken JSON', () => {
		expect(loadJson('t:b', 3)).toBe(3);
		data.set('t:b', '{oops');
		expect(loadJson('t:b', 3)).toBe(3);
		storeJson('t:b', { n: 1 });
		expect(loadJson('t:b', null)).toEqual({ n: 1 });
	});
	it('never throws when storage is blocked', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		});
		expect(readStored('t:c')).toBeNull();
		expect(loadJson('t:c', 'd')).toBe('d');
		expect(() => storeJson('t:c', 1)).not.toThrow();
	});
});
