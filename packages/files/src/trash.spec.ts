import { describe, expect, it } from 'vitest';
import { cleanTrash, DEFAULT_RETENTION, entryName, entryPath, expired, infoPath, itemPath, originalPath, parseEntry, parseRetention, suiteRetention, TRASH_ROOT } from './trash';

const day = 24 * 60 * 60 * 1000;

describe('trash entries', () => {
	it('carry the time in a name valid on every system', () => {
		const now = Date.UTC(2026, 10, 18, 10, 22, 33, 123);
		const name = entryName(now);
		expect(name).toMatch(/^20261118-102233-123-[a-z0-9]{4}$/);
		expect(parseEntry(name)).toBe(now);
		expect(parseEntry('something else')).toBeNull();
	});

	it('keep the item under its original path', () => {
		const path = itemPath('20261118-102233-123-abcd', '/Docs/Plan.md');
		expect(path).toBe('/.in-browser-trash/20261118-102233-123-abcd/Docs/Plan.md');
		expect(originalPath(path)).toBe('/Docs/Plan.md');
		expect(originalPath('/.in-browser-trash/20261118-102233-123-abcd/.trashinfo.json')).toBeNull();
		expect(originalPath('/Docs/Plan.md')).toBeNull();
	});

	it.each([
		[entryName(0), 6 * day, 7, false],
		[entryName(0), 8 * day, 7, true],
		[entryName(0), 1000 * day, null, false],
		['foreign folder', 1000 * day, 7, false]
	])('%s expired at %i with retention %s: %s', (name, now, retention, expected) => {
		expect(expired(name, now, retention)).toBe(expected);
	});
});

describe('cleaning the trash with clocks that differ', () => {
	const tree = (files: Record<string, number>, removed: string[]) => ({
		stat: async (path: string) => (path in files ? { kind: 'file' as const, size: 2, modified: files[path] } : null),
		read: async () => new File(['{}'], 'settings.json'),
		names: async () => [...new Set(Object.keys(files).map((path) => path.split('/')[2]))],
		remove: async (path: string) => void removed.push(path)
	});

	it('keeps what arrived on a device whose clock is ahead, and removes what is due by both times', async () => {
		const real = Date.UTC(2026, 10, 1);
		const [fresh, old, arriving] = [entryName(real), entryName(real - 40 * day), entryName(real - 50 * day)];
		// This device's clock is a year ahead: everything arrived “now” by its own clock, `old` 40 of its days ago
		const now = real + 365 * day;
		const removed: string[] = [];
		const files = { [infoPath(fresh)]: now, [infoPath(old)]: now - 40 * day, [`${TRASH_ROOT}/${arriving}/file.txt`]: 0 };
		await cleanTrash(tree(files, removed), now);
		expect(removed).toEqual([entryPath(old)]);
	});
});

describe('retention', () => {
	// A broken file keeps everything (null)
	it.each([
		[null, DEFAULT_RETENTION],
		['{"trashDays":90}', 90],
		['{"trashDays":null}', null],
		['{"trashDays":-3}', DEFAULT_RETENTION],
		['{broken', null]
	])('of the earlier settings file %s: %s', (text, expected) => {
		expect(parseRetention(text)).toBe(expected);
	});

	it('of the suite settings: none when the file holds none, everything kept when broken', () => {
		expect(suiteRetention('{"trash":{"days":7}}')).toBe(7);
		expect(suiteRetention('{"profile":{}}')).toBeUndefined();
		expect(suiteRetention('{broken')).toBeNull();
	});
});
