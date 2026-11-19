import { describe, expect, it } from 'vitest';
import { selfStale, SELF_STALE_AFTER, staleness } from './staleness.js';

describe('staleness', () => {
	it('counts the missing changes of a device', () => {
		const log = [
			{ o: 'A', n: 1, p: '/a' },
			{ o: 'A', n: 2, p: '/a' },
			{ o: 'A', n: 3, p: '/b' }
		];
		expect(staleness({ lastSeen: 1, lastSync: 7, scope: [], vector: { A: 1 } }, log)).toEqual({ changes: 2, more: false });
	});

	it('warns about this device only when nobody is reachable and the last sync is old', () => {
		const now = 10 * SELF_STALE_AFTER;
		expect(selfStale(now - 2 * SELF_STALE_AFTER, 0, now)).toBe(true);
		expect(selfStale(now - 2 * SELF_STALE_AFTER, 1, now)).toBe(false);
		expect(selfStale(now - 1000, 0, now)).toBe(false);
	});
});
