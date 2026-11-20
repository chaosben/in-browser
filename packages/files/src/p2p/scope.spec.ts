import { describe, expect, it } from 'vitest';
import { canExclude, inScope } from './scope.js';

const entry = '/.in-browser-trash/20261118-102233-123-abcd';

describe('scope', () => {
	// Excluded folders go with everything inside, items in the trash count by where they were
	it.each([
		['/Videos/a.mp4', false],
		['/Videos', false],
		['/Videos2/a', true],
		[`${entry}/Videos/a.mp4`, false],
		[`${entry}/Docs/a.md`, true],
		[`${entry}/.trashinfo.json`, true],
		[entry, true]
	])('%s in scope without /Videos: %s', (path, expected) => {
		expect(inScope(path, ['/Videos'])).toBe(expected);
	});

	it('never excludes app data', () => {
		expect(inScope('/.apps/x/y', ['/.apps'])).toBe(true);
		expect(canExclude('/.apps/x')).toBe(false);
		expect(canExclude('/Docs')).toBe(true);
	});
});
