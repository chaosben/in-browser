import { describe, expect, it } from 'vitest';
import type { FileState } from '../sync/plan.js';
import { canExclude, exclude, include, inScope, intersect } from './scope.js';

const f: FileState = { kind: 'file', size: 1, modified: 1 };

describe('scope', () => {
	it('excludes folders with everything inside', () => {
		expect(inScope('/Videos/a.mp4', ['/Videos'])).toBe(false);
		expect(inScope('/Videos', ['/Videos'])).toBe(false);
		expect(inScope('/Videos2/a', ['/Videos'])).toBe(true);
		expect(inScope('/.apps/x/y', ['/.apps'])).toBe(true);
		expect(canExclude('/.apps/x')).toBe(false);
		expect(canExclude('/Docs')).toBe(true);
	});
	it('keeps only what both devices take part in', () => {
		const snap = new Map([
			['/a', f],
			['/V/b', f],
			['/P/c', f]
		]);
		expect([...intersect(snap, ['/V'], ['/P']).keys()]).toEqual(['/a']);
	});
	it('maintains the list of excluded folders', () => {
		expect(exclude(['/A/b'], '/A')).toEqual(['/A']);
		expect(exclude(['/A'], '/A/b')).toEqual(['/A']);
		expect(include(['/A', '/B'], '/A/x')).toEqual(['/B']);
	});
});
