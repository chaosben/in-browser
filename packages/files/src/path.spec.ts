import { describe, expect, it } from 'vitest';
import { connectionOf, isInside, nameProblem, normalize, parent, safeName, uniqueName } from './path';

describe('paths', () => {
	it('never go above the root', () => {
		expect(normalize('a//b/')).toBe('/a/b');
		expect(normalize('/a/./b/../c')).toBe('/a/c');
		expect(normalize('/../../a')).toBe('/a');
	});

	it('are inside a folder only below it, not beside it', () => {
		expect(isInside('/a/b', '/a')).toBe(true);
		expect(isInside('/a', '/a')).toBe(true);
		expect(isInside('/ab', '/a')).toBe(false);
	});

	it('split off a connected folder, which no real name can reach', () => {
		expect(connectionOf('/:c/ab12/Docs/a.txt')).toEqual({ id: 'ab12', root: '/:c/ab12', inner: '/Docs/a.txt' });
		expect(connectionOf('/:c')).toBeNull();
		expect(connectionOf('/Docs')).toBeNull();
		expect(nameProblem(':c')).toBe('chars');
		expect(parent('/:c/ab12/Docs')).toBe('/:c/ab12');
	});
});

describe('nameProblem', () => {
	it.each(['Demo.screencapture', 'Übersicht (2) – Entwurf', '.apps'])('accepts %s', (name) => {
		expect(nameProblem(name)).toBeNull();
	});

	// Names that don't work on every system
	it.each([
		['   ', 'empty'],
		['..', 'dots'],
		['a/b', 'chars'],
		['what?', 'chars'],
		['lpt1.txt', 'reserved'],
		['name.', 'trailing'],
		[' name', 'trailing'],
		['x'.repeat(256), 'long']
	])('rejects %s (%s)', (name, problem) => {
		expect(nameProblem(name)).toBe(problem);
	});
});

describe('uniqueName', () => {
	it.each([
		['Demo.screencapture', ['Other'], 'Demo.screencapture'],
		['Demo.screencapture', ['demo.SCREENCAPTURE'], 'Demo (2).screencapture'],
		['Demo.screencapture', ['Demo.screencapture', 'Demo (2).screencapture'], 'Demo (3).screencapture'],
		['Folder', ['Folder'], 'Folder (2)'],
		['Demo (2).txt', ['Demo (2).txt'], 'Demo (3).txt']
	])('%s beside %j: %s', (name, taken, expected) => {
		expect(uniqueName(name, taken)).toBe(expected);
	});
});

describe('safeName', () => {
	it.each([
		['Recording 10/29/2026, 20:15', 'Recording 10-29-2026, 20-15'],
		['  Demo…  ', 'Demo…'],
		['Version 2.', 'Version 2'],
		['...', 'Project'],
		['CON', 'Project']
	])('turns %s into %s', (title, expected) => {
		expect(safeName(title, 'Project')).toBe(expected);
	});
});
