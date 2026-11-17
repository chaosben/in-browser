import { describe, expect, it } from 'vitest';
import { BRAND } from './brand.js';
import { COMMIT, sourceUrl } from './build.js';

describe('sourceUrl', () => {
	it('points to the default branch outside a build', () => {
		expect(COMMIT).toBe('dev');
		expect(sourceUrl()).toBe(BRAND.repoUrl);
		expect(sourceUrl('THIRD_PARTY_LICENSES.md')).toBe(`${BRAND.repoUrl}/blob/HEAD/THIRD_PARTY_LICENSES.md`);
	});
});
