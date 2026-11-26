import { describe, expect, it } from 'vitest';
import { itemSeconds, itemTrim, setNoteTags, tagsOfNote, trimItem } from './edits.js';
import { emptyData, noteTarget, tagKey, type PlaylistItem } from './model.js';

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

// Tags of several notes set in one step: a new tag is made once, a name that exists is the same tag, what isn't
// changed stays – a mix-up would tag the wrong notes.
describe('tags of notes', () => {
	it('puts new and existing tags on several notes and takes others off', () => {
		const data = emptyData();
		const study = { type: 1, name: 'Study' };
		const old = { type: 1, name: 'Old' };
		for (const t of [study, old]) data.tags.set(tagKey(t), t);
		for (const guid of ['a', 'b', 'c']) data.notes.set(guid, { guid, mark: null, loc: null, title: guid, content: '', modified: '', created: '', blockType: 0, blockId: null });
		data.tagMaps.push({ tag: tagKey(old), target: noteTarget('a'), position: 0 }, { tag: tagKey(old), target: noteTarget('c'), position: 1 });
		const next = setNoteTags(data, ['a', 'b'], [tagKey(study), '1|Talk'], [tagKey(old)]);
		expect([...next.tags.keys()].sort()).toEqual(['1|Old', '1|Study', '1|Talk']);
		expect(tagsOfNote(next, 'a').sort()).toEqual(['1|Study', '1|Talk']);
		expect(tagsOfNote(next, 'b').sort()).toEqual(['1|Study', '1|Talk']);
		expect(tagsOfNote(next, 'c')).toEqual(['1|Old']);
	});
});
