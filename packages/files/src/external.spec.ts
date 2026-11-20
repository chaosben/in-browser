import { describe, expect, it } from 'vitest';
import { answer, confirmState } from '@in-browser/brand/ui/confirm.svelte.js';
import { ExternalVersions } from './documents.js';

/** Answers the open question on the next turn */
const reply = (ok: boolean, checked = false) => queueMicrotask(() => answer(ok, checked));

describe('ExternalVersions', () => {
	it('asks once per version and doesn’t ask again about one declined', async () => {
		const versions = new ExternalVersions();
		reply(false);
		expect(await versions.shouldReload('a.txt', 'v1')).toBe(false);
		expect(await versions.shouldReload('a.txt', 'v1')).toBe(false);
		expect(confirmState.current).toBeNull();
		reply(true);
		expect(await versions.shouldReload('a.txt', 'v2')).toBe(true);
	});

	it('gives questions arriving while one is open its answer', async () => {
		const versions = new ExternalVersions();
		const first = versions.shouldReload('a.txt', 'v1');
		const second = versions.shouldReload('a.txt', 'v2');
		reply(true);
		expect(await Promise.all([first, second])).toEqual([true, true]);
	});
});
