import { describe, expect, it } from 'vitest';
import { matches, previewKind, sortItems, toItem } from './items';

const file = (name: string, size = 0, modified = 0) => toItem({ name, path: `/${name}`, kind: 'file', size, modified });
const folder = (name: string) => toItem({ name, path: `/${name}`, kind: 'directory' });

describe('toItem', () => {
	it('treats packages as files', () => {
		expect(toItem({ name: 'Demo.screencapture', path: '/Demo.screencapture', kind: 'directory' }).folder).toBe(false);
		expect(folder('Docs').folder).toBe(true);
		expect(file('a.txt').formats).toEqual([]);
	});
});

describe('previewKind', () => {
	it('by extension, case-insensitive', () => {
		expect(previewKind('a.PNG')).toBe('image');
		expect(previewKind('logo.svg')).toBe('image');
		expect(previewKind('clip.webm')).toBe('video');
		expect(previewKind('song.flac')).toBe('audio');
		expect(previewKind('notes.md')).toBe('text');
		expect(previewKind('archive.zip')).toBeNull();
		expect(previewKind('README')).toBeNull();
	});
});

describe('sortItems', () => {
	const items = [file('b10.txt', 5, 3), folder('Zeta'), file('b2.txt', 50, 1), folder('alpha'), file('a.mp4', 1, 2)];
	const names = (key: Parameters<typeof sortItems>[1], desc = false) => sortItems(items, key, desc).map((i) => i.name);

	it('folders first, names naturally and case-insensitive', () => {
		expect(names('name')).toEqual(['alpha', 'Zeta', 'a.mp4', 'b2.txt', 'b10.txt']);
	});
	it('descending keeps folders first', () => {
		expect(names('name', true)).toEqual(['Zeta', 'alpha', 'b10.txt', 'b2.txt', 'a.mp4']);
	});
	it('by size, date and type', () => {
		expect(names('size')).toEqual(['alpha', 'Zeta', 'a.mp4', 'b10.txt', 'b2.txt']);
		expect(names('modified')).toEqual(['alpha', 'Zeta', 'b2.txt', 'a.mp4', 'b10.txt']);
		expect(names('kind')).toEqual(['alpha', 'Zeta', 'a.mp4', 'b2.txt', 'b10.txt']);
	});
});

describe('matches', () => {
	it('every word must occur', () => {
		expect(matches(file('Projekt Demo.txt'), 'demo proj')).toBe(true);
		expect(matches(file('Projekt Demo.txt'), 'demo zebra')).toBe(false);
		expect(matches(file('a.txt'), '  ')).toBe(true);
	});
});
