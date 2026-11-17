import { describe, expect, it } from 'vitest';
import { GRACE_MS, unusedAssets } from './gc';

describe('unusedAssets', () => {
	const now = 10 * GRACE_MS;
	const old = now - GRACE_MS - 1;
	const fresh = now - 1000;

	it('deletes only unreferenced files older than the grace period', () => {
		const files = [
			{ name: 'used.png', modified: old },
			{ name: 'orphan.png', modified: old },
			{ name: 'just-synced.png', modified: fresh }
		];
		expect(unusedAssets(files, new Set(['used.png']), now)).toEqual(['orphan.png']);
	});
	it('keeps a PDF as long as any page references it', () => {
		const files = [{ name: 'doc.pdf', modified: old }];
		expect(unusedAssets(files, new Set(['doc.pdf']), now)).toEqual([]);
		expect(unusedAssets(files, new Set(), now)).toEqual(['doc.pdf']);
	});
});
