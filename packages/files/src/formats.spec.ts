import { describe, expect, it } from 'vitest';
import { FormatError, formatsOf, isPackage, migrateFormat, openUrl } from './formats';

describe('formats', () => {
	it('opens packages only as folders, text files only as files, with the encoded path', () => {
		expect(isPackage('Demo.ScreenCapture', 'directory')).toBe(true);
		expect(isPackage('Demo.screencapture', 'file')).toBe(false);
		expect(formatsOf('notes.md', 'directory')).toEqual([]);
		const [format] = formatsOf('a b.txt', 'file');
		expect(openUrl(format, '/Notes/a b#1.txt')).toBe('/text-editor/editor?path=%2FNotes%2Fa%20b%231.txt');
	});
});

describe('migrateFormat', () => {
	const steps = { 1: (p: { version: number }) => ({ ...p, version: 2, format: 'x' }) };
	const reason = (raw: unknown) => {
		try {
			migrateFormat(raw, 'x', 2, steps);
		} catch (e) {
			return e instanceof FormatError ? e.reason : 'other';
		}
	};

	it('runs every step up to the current version', () => {
		expect(migrateFormat({ version: 1 }, 'x', 2, steps)).toEqual({ version: 2, format: 'x' });
	});

	it.each([
		[{ version: 3, format: 'x' }, 'newer'],
		[{ version: 2, format: 'y' }, 'unknown'],
		[{ version: 0, format: 'x' }, 'unknown'],
		[null, 'unknown']
	])('rejects %j as %s', (raw, expected) => {
		expect(reason(raw)).toBe(expected);
	});
});
