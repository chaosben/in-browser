import { describe, expect, it } from 'vitest';
import { basename, extname, isHidden, isInside, join, nameProblem, normalize, parent, safeName, segments, stem, uniqueName } from './path';

describe('normalize', () => {
	it('makes paths absolute without trailing slash', () => {
		expect(normalize('')).toBe('/');
		expect(normalize('/')).toBe('/');
		expect(normalize('a//b/')).toBe('/a/b');
		expect(normalize('/a/./b/../c')).toBe('/a/c');
	});
	it('never goes above the root', () => {
		expect(normalize('/../../a')).toBe('/a');
	});
});

describe('path parts', () => {
	it('join, segments, basename, parent', () => {
		expect(join('/Screen Capture', 'Demo.screencapture', 'project.json')).toBe('/Screen Capture/Demo.screencapture/project.json');
		expect(segments('/a/b')).toEqual(['a', 'b']);
		expect(segments('/')).toEqual([]);
		expect(basename('/a/b.txt')).toBe('b.txt');
		expect(basename('/')).toBe('');
		expect(parent('/a/b')).toBe('/a');
		expect(parent('/a')).toBe('/');
		expect(parent('/')).toBe('/');
	});
	it('extension in lower case, none for dot files', () => {
		expect(extname('Demo.ScreenCapture')).toBe('.screencapture');
		expect(extname('archive.tar.gz')).toBe('.gz');
		expect(extname('.apps')).toBe('');
		expect(extname('README')).toBe('');
		expect(stem('Demo.screencapture')).toBe('Demo');
		expect(stem('.apps')).toBe('.apps');
	});
	it('isInside and isHidden', () => {
		expect(isInside('/a/b', '/a')).toBe(true);
		expect(isInside('/a', '/a')).toBe(true);
		expect(isInside('/ab', '/a')).toBe(false);
		expect(isInside('/x', '/')).toBe(true);
		expect(isHidden('/.apps/screen-capture/library')).toBe(true);
		expect(isHidden('/Screen Capture/Demo.screencapture')).toBe(false);
	});
});

describe('nameProblem', () => {
	it('accepts normal names', () => {
		expect(nameProblem('Demo.screencapture')).toBeNull();
		expect(nameProblem('Übersicht (2) – Entwurf')).toBeNull();
		expect(nameProblem('.apps')).toBeNull();
	});
	it('rejects names that do not work on every system', () => {
		expect(nameProblem('')).toBe('empty');
		expect(nameProblem('   ')).toBe('empty');
		expect(nameProblem('..')).toBe('dots');
		expect(nameProblem('a/b')).toBe('chars');
		expect(nameProblem('a:b')).toBe('chars');
		expect(nameProblem('what?')).toBe('chars');
		expect(nameProblem('CON')).toBe('reserved');
		expect(nameProblem('lpt1.txt')).toBe('reserved');
		expect(nameProblem('name.')).toBe('trailing');
		expect(nameProblem('name ')).toBe('trailing');
		expect(nameProblem(' name')).toBe('trailing');
		expect(nameProblem('x'.repeat(256))).toBe('long');
	});
});

describe('uniqueName', () => {
	it('keeps a free name', () => {
		expect(uniqueName('Demo.screencapture', ['Other'])).toBe('Demo.screencapture');
	});
	it('numbers before the extension, case-insensitive', () => {
		expect(uniqueName('Demo.screencapture', ['demo.SCREENCAPTURE'])).toBe('Demo (2).screencapture');
		expect(uniqueName('Demo.screencapture', ['Demo.screencapture', 'Demo (2).screencapture'])).toBe('Demo (3).screencapture');
		expect(uniqueName('Folder', ['Folder'])).toBe('Folder (2)');
	});
	it('continues an existing number instead of stacking', () => {
		expect(uniqueName('Demo (2).txt', ['Demo (2).txt'])).toBe('Demo (3).txt');
	});
});

describe('safeName', () => {
	it('turns titles into valid names', () => {
		expect(safeName('Recording 10/29/2026, 20:15', 'Project')).toBe('Recording 10-29-2026, 20-15');
		expect(safeName('  Demo…  ', 'Project')).toBe('Demo…');
		expect(safeName('Version 2.', 'Project')).toBe('Version 2');
	});
	it('falls back when nothing usable is left', () => {
		expect(safeName('...', 'Project')).toBe('Project');
		expect(safeName('CON', 'Project')).toBe('Project');
		expect(safeName('', 'Project')).toBe('Project');
	});
});
