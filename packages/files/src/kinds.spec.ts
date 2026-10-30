import { describe, expect, it } from 'vitest';
import { previewKind } from './kinds';

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
