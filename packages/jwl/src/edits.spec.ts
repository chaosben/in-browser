import { describe, expect, it } from 'vitest';
import { itemSeconds, itemTrim, trimItem } from './edits.js';
import { emptyData, type PlaylistItem } from './model.js';

// Trimming as JW Library keeps it (read from a backup of the user's, 2026-11-25): the start as an offset, the end
// as what is cut off at the end – a wrong reading would make JW Library play another part, unnoticed.

const song = (startTrim: number | null, endTrim: number | null): PlaylistItem => ({
	label: 'Wahre Liebe ohne Grenzen',
	startTrim,
	endTrim,
	accuracy: 1,
	endAction: 0,
	thumbnail: null,
	locations: [{ loc: 'imc', type: 0, baseTicks: 2_660_000_000 }],
	media: [],
	markers: []
});

describe('trimming playlist items', () => {
	it.each([
		{ name: 'a piece of music trimmed in JW Library', item: song(1_033_050_000, 457_970_000), seconds: 116.898, start: 103.305, end: 220.203 },
		{ name: 'an untrimmed one', item: song(null, null), seconds: 266, start: 0, end: 266 }
	])('$name: its length and part, written back as it was', ({ item, seconds, start, end }) => {
		expect(itemSeconds(item)).toBeCloseTo(seconds, 3);
		expect(itemTrim(item)).toEqual({ start: expect.closeTo(start, 3), end: expect.closeTo(end, 3), length: 266 });
		const data = emptyData();
		data.playlists.set('k', song(null, null));
		const trimmed = trimItem(data, 'k', { start, end }).playlists.get('k')!;
		expect([trimmed.startTrim, trimmed.endTrim]).toEqual([item.startTrim, item.endTrim]);
	});
});
