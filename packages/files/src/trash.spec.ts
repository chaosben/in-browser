import { describe, expect, it } from 'vitest';
import { DEFAULT_RETENTION, entryName, expired, inTrash, itemPath, originalPath, parseEntry, parseRetention } from './trash';

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
		expect(inTrash(path)).toBe(true);
		expect(originalPath(path)).toBe('/Docs/Plan.md');
		expect(originalPath('/.in-browser-trash/20261118-102233-123-abcd/.trashinfo.json')).toBeNull();
		expect(originalPath('/.in-browser-trash/20261118-102233-123-abcd')).toBeNull();
		expect(originalPath('/Docs/Plan.md')).toBeNull();
	});
	it('expire after the retention, never with “keep until emptied”', () => {
		const name = entryName(0);
		expect(expired(name, 6 * day, 7)).toBe(false);
		expect(expired(name, 8 * day, 7)).toBe(true);
		expect(expired(name, 1000 * day, null)).toBe(false);
		expect(expired('foreign folder', 1000 * day, 7)).toBe(false);
	});
});

describe('parseRetention', () => {
	it('reads the setting, falls back to the default, keeps everything when the file is broken', () => {
		expect(parseRetention(null)).toBe(DEFAULT_RETENTION);
		expect(parseRetention('{"trashDays":90}')).toBe(90);
		expect(parseRetention('{"trashDays":null}')).toBeNull();
		expect(parseRetention('{"trashDays":-3}')).toBe(DEFAULT_RETENTION);
		expect(parseRetention('{broken')).toBeNull();
	});
});
