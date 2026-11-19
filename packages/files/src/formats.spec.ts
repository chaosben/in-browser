import { describe, expect, it } from 'vitest';
import { FormatError, formatsOf, isPackage, migrateFormat, openUrl } from './formats';

describe('formats', () => {
	it('recognizes packages by extension and kind', () => {
		expect(isPackage('Demo.screencapture', 'directory')).toBe(true);
		expect(isPackage('Demo.ScreenCapture', 'directory')).toBe(true);
		// A plain file with the package extension is not a package
		expect(isPackage('Demo.screencapture', 'file')).toBe(false);
		expect(isPackage('Demo', 'directory')).toBe(false);
		expect(formatsOf('notes.unknown', 'file')).toEqual([]);
	});
	it('opens plain text files in the Text Editor', () => {
		expect(formatsOf('notes.md', 'file').map((f) => f.tool)).toEqual(['text-editor']);
		expect(formatsOf('Config.YAML', 'file').map((f) => f.tool)).toEqual(['text-editor']);
		// Text files are files, never packages
		expect(formatsOf('notes.md', 'directory')).toEqual([]);
		expect(isPackage('notes.md', 'directory')).toBe(false);
		const [format] = formatsOf('a b.txt', 'file');
		expect(openUrl(format, '/Notes/a b.txt')).toBe('/text-editor?path=%2FNotes%2Fa%20b.txt');
	});
	it('offers fallback formats only under "Open with"', () => {
		expect(formatsOf('logo.svg', 'file')).toEqual([]);
		expect(formatsOf('logo.svg', 'file', { fallback: true }).map((f) => f.tool)).toEqual(['text-editor']);
		expect(formatsOf('notes.md', 'file', { fallback: true }).map((f) => f.tool)).toEqual(['text-editor']);
	});
	it('builds the open address with the encoded path', () => {
		const [format] = formatsOf('Demo.screencapture', 'directory');
		expect(openUrl(format, '/Screen Capture/Demo.screencapture')).toBe(
			'/screen-capture/editor?path=%2FScreen%20Capture%2FDemo.screencapture'
		);
	});
});

describe('migrateFormat', () => {
	const steps = { 1: (p: { version: number }) => ({ ...p, version: 2, format: 'x' }) };
	it('runs every step up to the current version', () => {
		expect(migrateFormat({ version: 1 }, 'x', 2, steps)).toEqual({ version: 2, format: 'x' });
	});
	it('rejects newer, foreign and broken documents', () => {
		const reason = (raw: unknown) => {
			try {
				migrateFormat(raw, 'x', 2, steps);
			} catch (e) {
				return e instanceof FormatError ? e.reason : 'other';
			}
		};
		expect(reason({ version: 3, format: 'x' })).toBe('newer');
		expect(reason({ version: 2, format: 'y' })).toBe('unknown');
		expect(reason({ version: 0, format: 'x' })).toBe('unknown');
		expect(reason(null)).toBe('unknown');
	});
});
