import { describe, expect, it } from 'vitest';
import { formatAgo } from './format.js';

describe('formatAgo', () => {
	const now = Date.UTC(2026, 0, 10, 12);

	it('says “now” for the last seconds', () => {
		expect(formatAgo(now - 3000, now, 'en')).toBe('now');
	});

	it('picks the largest fitting unit', () => {
		expect(formatAgo(now - 5 * 60_000, now, 'en')).toBe('5 minutes ago');
		expect(formatAgo(now - 3 * 3_600_000, now, 'en')).toBe('3 hours ago');
		expect(formatAgo(now - 2 * 86_400_000, now, 'de')).toBe('vorgestern');
		expect(formatAgo(now - 5 * 86_400_000, now, 'de')).toBe('vor 5 Tagen');
	});
});
