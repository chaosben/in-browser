import { describe, expect, it } from 'vitest';
import { matchesQuery } from './inspector-search';

describe('matchesQuery', () => {
	it('matches everything without a query', () => {
		expect(matchesQuery('', 'Corner radius')).toBe(true);
		expect(matchesQuery('   ', 'Corner radius')).toBe(true);
	});
	it('ignores case and accents', () => {
		expect(matchesQuery('RAD', 'Corner radius')).toBe(true);
		expect(matchesQuery('grö', 'Schriftgröße')).toBe(true);
		expect(matchesQuery('gro', 'Schriftgröße')).toBe(true);
	});
	it('needs every word, in any of the texts', () => {
		expect(matchesQuery('fade out', 'Fade', 'In', 'Out')).toBe(true);
		expect(matchesQuery('fade width', 'Fade', 'In', 'Out')).toBe(false);
	});
});
