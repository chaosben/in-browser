import { describe, expect, it } from 'vitest';
import { formatsOf, isPackage, openUrl } from './formats';

describe('formats', () => {
	it('recognizes packages by extension and kind', () => {
		expect(isPackage('Demo.screencapture', 'directory')).toBe(true);
		expect(isPackage('Demo.ScreenCapture', 'directory')).toBe(true);
		// A plain file with the package extension is not a package
		expect(isPackage('Demo.screencapture', 'file')).toBe(false);
		expect(isPackage('Demo', 'directory')).toBe(false);
		expect(formatsOf('notes.unknown', 'file')).toEqual([]);
	});
	it('builds the open address with the encoded path', () => {
		const [format] = formatsOf('Demo.screencapture', 'directory');
		expect(openUrl(format, '/Screen Capture/Demo.screencapture')).toBe(
			'/screen-capture/editor?path=%2FScreen%20Capture%2FDemo.screencapture'
		);
	});
});
