// Changes of a JW Library database as the user makes them in JWL Files: each takes the data and gives new data
// (the old one stays untouched – it is the undo step). Pure.

import {
	TAG_PLAYLIST,
	TAG_USER,
	copyData,
	emptyData,
	formatTime,
	noteTarget,
	playlistKey,
	playlistTarget,
	tagKey,
	targetKind,
	targetValue,
	type JwlData,
	type Location,
	type Media,
	type PlaylistItem,
	type TagMap
} from './model.js';

// --- Names of what the data points at ---

/** A location as people read it: its title, else the publication's symbol with book and chapter */
export function locationName(loc: Location | undefined): string {
	if (!loc) return '';
	if (loc.title) return loc.title;
	const parts = [loc.keySymbol ?? ''];
	if (loc.book) parts.push(loc.chapter ? `${loc.book}:${loc.chapter}` : String(loc.book));
	else if (loc.document) parts.push(String(loc.document));
	return parts.filter(Boolean).join(' ');
}

/** The publication a location belongs to: its symbol (and issue), the same for all its documents */
export function publicationOf(loc: Location | undefined): string {
	if (!loc) return '';
	return [loc.keySymbol ?? '', loc.issue ? String(loc.issue) : ''].filter(Boolean).join(' ');
}

// --- Notes ---

export function deleteNotes(data: JwlData, guids: Iterable<string>): JwlData {
	const out = copyData(data);
	const gone = new Set<string>();
	for (const guid of guids) if (out.notes.delete(guid)) gone.add(noteTarget(guid));
	out.tagMaps = out.tagMaps.filter((tm) => !gone.has(tm.target));
	return renumber(out);
}

export function editNote(data: JwlData, guid: string, change: { title?: string; content?: string }, now = Date.now()): JwlData {
	const note = data.notes.get(guid);
	if (!note) return data;
	const title = change.title ?? note.title ?? '';
	const content = change.content ?? note.content ?? '';
	if (title === (note.title ?? '') && content === (note.content ?? '')) return data;
	const out = copyData(data);
	out.notes.set(guid, { ...note, title, content, modified: formatTime(now) });
	return out;
}

// --- Highlights ---

export function deleteMarks(data: JwlData, guids: Iterable<string>): JwlData {
	const out = copyData(data);
	const gone = new Set(guids);
	for (const guid of gone) out.marks.delete(guid);
	// A note stays where its highlight was
	for (const [g, n] of out.notes) if (n.mark && gone.has(n.mark)) out.notes.set(g, { ...n, mark: null });
	return out;
}

export function recolorMarks(data: JwlData, guids: Iterable<string>, color: number): JwlData {
	const out = copyData(data);
	for (const guid of guids) {
		const mark = out.marks.get(guid);
		if (mark && mark.color !== color) out.marks.set(guid, { ...mark, color });
	}
	return out;
}

/** What “Clean up” takes away: highlights without any text, tags of the user on nothing */
export function cleanable(data: JwlData): { marks: string[]; tags: string[] } {
	const used = new Set(data.tagMaps.map((tm) => tm.tag));
	return {
		marks: [...data.marks.values()].filter((m) => !m.ranges.length).map((m) => m.guid),
		tags: [...data.tags].filter(([key, t]) => t.type === TAG_USER && !used.has(key)).map(([key]) => key)
	};
}

export function cleanUp(data: JwlData): JwlData {
	const { marks, tags } = cleanable(data);
	return deleteTags(deleteMarks(data, marks), tags);
}

// --- Tags ---

/** The user's tags with how many things carry them, by name */
export function userTags(data: JwlData): { key: string; name: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const tm of data.tagMaps) counts.set(tm.tag, (counts.get(tm.tag) ?? 0) + 1);
	return [...data.tags]
		.filter(([, t]) => t.type === TAG_USER)
		.map(([key, t]) => ({ key, name: t.name, count: counts.get(key) ?? 0 }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function deleteTags(data: JwlData, keys: Iterable<string>): JwlData {
	const out = copyData(data);
	const gone = new Set(keys);
	for (const key of gone) out.tags.delete(key);
	out.tagMaps = out.tagMaps.filter((tm) => !gone.has(tm.tag));
	return out;
}

/** Moves everything of the tags `from` onto `into` (each thing once) and removes them */
export function mergeTags(data: JwlData, from: Iterable<string>, into: string): JwlData {
	const out = copyData(data);
	const sources = new Set([...from].filter((k) => k !== into));
	const has = new Set(out.tagMaps.filter((tm) => tm.tag === into).map((tm) => tm.target));
	const kept: TagMap[] = [];
	for (const tm of out.tagMaps) {
		if (!sources.has(tm.tag)) kept.push(tm);
		else if (!has.has(tm.target)) {
			has.add(tm.target);
			kept.push({ ...tm, tag: into, position: Number.MAX_SAFE_INTEGER });
		}
	}
	out.tagMaps = kept;
	for (const key of sources) out.tags.delete(key);
	return renumber(out);
}

/** Renames a tag; a name another tag of its kind has merges the two */
export function renameTag(data: JwlData, key: string, name: string): JwlData {
	const tag = data.tags.get(key);
	const trimmed = name.trim();
	if (!tag || !trimmed || trimmed === tag.name) return data;
	const renamed = { type: tag.type, name: trimmed };
	const next = tagKey(renamed);
	if (data.tags.has(next)) return mergeTags(data, [key], next);
	const out = copyData(data);
	out.tags.delete(key);
	out.tags.set(next, renamed);
	out.tagMaps = out.tagMaps.map((tm) => (tm.tag === key ? { ...tm, tag: next } : tm));
	return out;
}

export function addTag(data: JwlData, name: string, type = TAG_USER): { data: JwlData; key: string } {
	const tag = { type, name: name.trim() };
	const key = tagKey(tag);
	if (data.tags.has(key)) return { data, key };
	const out = copyData(data);
	out.tags.set(key, tag);
	return { data: out, key };
}

/** Puts the tag on the notes or takes it off */
export function tagNotes(data: JwlData, guids: Iterable<string>, tag: string, on: boolean): JwlData {
	const out = copyData(data);
	const targets = new Set([...guids].map(noteTarget));
	if (on) {
		const has = new Set(out.tagMaps.filter((tm) => tm.tag === tag).map((tm) => tm.target));
		for (const target of targets) if (!has.has(target)) out.tagMaps.push({ tag, target, position: Number.MAX_SAFE_INTEGER });
	} else out.tagMaps = out.tagMaps.filter((tm) => !(tm.tag === tag && targets.has(tm.target)));
	return renumber(out);
}

/**
 * The tags of notes in one step: the tags `on` put on every one of them (a user's tag not there yet – known by its
 * `tagKey` – is made first), those `off` taken off
 */
export function setNoteTags(data: JwlData, guids: Iterable<string>, on: Iterable<string>, off: Iterable<string>): JwlData {
	const notes = [...guids];
	let out = data;
	for (const key of on) {
		if (!out.tags.has(key)) out = addTag(out, key.slice(key.indexOf('|') + 1)).data;
		out = tagNotes(out, notes, key, true);
	}
	for (const key of off) out = tagNotes(out, notes, key, false);
	return out;
}

export const tagsOfNote = (data: JwlData, guid: string) => data.tagMaps.filter((tm) => tm.target === noteTarget(guid)).map((tm) => tm.tag);

// --- Bookmarks ---

export function deleteBookmarks(data: JwlData, keys: Iterable<string>): JwlData {
	const out = copyData(data);
	for (const key of keys) out.bookmarks.delete(key);
	return out;
}

// --- Playlists: a tag of type 2 whose assignments are the items, in order ---

export interface PlaylistView {
	key: string;
	name: string;
	/** Item keys in order */
	items: string[];
}

export function playlists(data: JwlData): PlaylistView[] {
	return [...data.tags]
		.filter(([, t]) => t.type === TAG_PLAYLIST)
		.map(([key, t]) => ({
			key,
			name: t.name,
			items: data.tagMaps
				.filter((tm) => tm.tag === key && targetKind(tm.target) === 'P' && data.playlists.has(targetValue(tm.target)))
				.sort((a, b) => a.position - b.position)
				.map((tm) => targetValue(tm.target))
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

const TICKS = 10_000_000;

/** The untrimmed length in ticks: its own file's (a picture: how long it is shown), else the publication's media */
export function itemTicks(item: PlaylistItem): number | null {
	return item.media[0]?.ticks ?? item.locations[0]?.baseTicks ?? null;
}

/** Seconds an item lasts: its length with the trims taken off */
export function itemSeconds(item: PlaylistItem): number {
	return Math.max(0, (itemTicks(item) ?? 0) - (item.startTrim ?? 0) - (item.endTrim ?? 0)) / TICKS;
}

export type ItemKind = 'picture' | 'video' | 'audio' | 'other';

/** What an item shows: by its file's type, else by the publication's location (type 3 video, 2 audio) */
export function itemKind(data: JwlData, item: PlaylistItem): ItemKind {
	const mime = item.media[0] ? data.media.get(item.media[0].hash)?.mime : undefined;
	if (mime) return mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('image/') ? 'picture' : 'other';
	const loc = item.locations[0] ? data.locations.get(item.locations[0].loc) : undefined;
	return loc?.type === 3 ? 'video' : loc?.type === 2 ? 'audio' : 'other';
}

/** The part played, in seconds from the start of the untrimmed media; null when the length isn't known */
export function itemTrim(item: PlaylistItem): { start: number; end: number; length: number } | null {
	const ticks = itemTicks(item);
	if (!ticks) return null;
	return { start: (item.startTrim ?? 0) / TICKS, end: (ticks - (item.endTrim ?? 0)) / TICKS, length: ticks / TICKS };
}

/**
 * Plays only `start`…`end` (seconds from the media's start) of a video or a piece of music. JW Library keeps the
 * start as `StartTrimOffsetTicks` and what is cut off at the end as `EndTrimOffsetTicks` (from the end, not a
 * position); no cut is `null`.
 */
export function trimItem(data: JwlData, key: string, { start, end }: { start: number; end: number }): JwlData {
	const item = data.playlists.get(key);
	const ticks = item ? itemTicks(item) : null;
	if (!item || !ticks) return data;
	const from = Math.min(Math.max(0, Math.round(start * TICKS)), ticks);
	const to = Math.min(Math.max(from, Math.round(end * TICKS)), ticks);
	if (to <= from) return data;
	const out = copyData(data);
	out.playlists.set(key, { ...item, startTrim: from > 0 ? from : null, endTrim: ticks - to > 0 ? ticks - to : null });
	return out;
}

/** Positions 0, 1 … per tag in their current order */
function renumber(data: JwlData): JwlData {
	const byTag = new Map<string, TagMap[]>();
	for (const tm of data.tagMaps) byTag.set(tm.tag, [...(byTag.get(tm.tag) ?? []), tm]);
	data.tagMaps = [...byTag.values()].flatMap((list) => list.sort((a, b) => a.position - b.position).map((tm, i) => ({ ...tm, position: i })));
	return data;
}

/** Removes playlists with their items */
export function deletePlaylists(data: JwlData, keys: Iterable<string>): JwlData {
	const out = copyData(data);
	const gone = new Set(keys);
	const items = new Set(out.tagMaps.filter((tm) => gone.has(tm.tag) && targetKind(tm.target) === 'P').map((tm) => targetValue(tm.target)));
	for (const key of gone) out.tags.delete(key);
	// An item another tag still shows stays
	for (const tm of out.tagMaps) if (!gone.has(tm.tag) && targetKind(tm.target) === 'P') items.delete(targetValue(tm.target));
	for (const item of items) out.playlists.delete(item);
	out.tagMaps = out.tagMaps.filter((tm) => !gone.has(tm.tag) && !(targetKind(tm.target) === 'P' && items.has(targetValue(tm.target))));
	return out;
}

export function renamePlaylist(data: JwlData, key: string, name: string): JwlData {
	const tag = data.tags.get(key);
	if (!tag || !name.trim() || data.tags.has(tagKey({ type: TAG_PLAYLIST, name: name.trim() }))) return data;
	return renameTag(data, key, name);
}

/** One playlist of `data` as the data of a `.jwlplaylist` */
export function playlistData(data: JwlData, key: string): JwlData {
	const list = playlists(data).find((p) => p.key === key);
	const out = emptyData(data.schema);
	if (!list) return out;
	out.tags.set(key, data.tags.get(key)!);
	list.items.forEach((item, position) => {
		const p = data.playlists.get(item)!;
		out.playlists.set(item, p);
		out.tagMaps.push({ tag: key, target: playlistTarget(item), position });
		for (const pl of p.locations) out.locations.set(pl.loc, data.locations.get(pl.loc)!);
		for (const hash of [p.thumbnail, ...p.media.map((m) => m.hash)]) if (hash && data.media.has(hash)) out.media.set(hash, data.media.get(hash)!);
	});
	return out;
}

/** A name not yet taken by a playlist: `name`, `name (2)` … */
export function freePlaylistName(data: JwlData, name: string): string {
	const taken = new Set(playlists(data).map((p) => p.name.toLowerCase()));
	let candidate = name.trim() || 'Playlist';
	const base = candidate;
	for (let i = 2; taken.has(candidate.toLowerCase()); i++) candidate = `${base} (${i})`;
	return candidate;
}

/** Puts the playlists of `other` (a `.jwlplaylist`) into `data`, under free names */
export function importPlaylists(data: JwlData, other: JwlData): JwlData {
	let out = copyData(data);
	for (const list of playlists(other)) {
		const name = freePlaylistName(out, list.name);
		const added = addTag(out, name, TAG_PLAYLIST);
		out = copyData(added.data);
		list.items.forEach((item, position) => {
			const p = other.playlists.get(item)!;
			const key = playlistKey(p, out.playlists);
			out.playlists.set(key, p);
			out.tagMaps.push({ tag: added.key, target: playlistTarget(key), position });
			for (const pl of p.locations) if (!out.locations.has(pl.loc) && other.locations.has(pl.loc)) out.locations.set(pl.loc, other.locations.get(pl.loc)!);
			for (const hash of [p.thumbnail, ...p.media.map((m) => m.hash)]) if (hash && other.media.has(hash)) out.media.set(hash, other.media.get(hash)!);
		});
	}
	return out;
}

export function editItem(data: JwlData, key: string, change: { label?: string; seconds?: number; endAction?: number }): JwlData {
	const item = data.playlists.get(key);
	if (!item) return data;
	const next: PlaylistItem = { ...item };
	if (change.label !== undefined && change.label.trim()) next.label = change.label.trim();
	if (change.endAction !== undefined) next.endAction = change.endAction;
	if (change.seconds !== undefined && item.media[0]) {
		const ticks = Math.max(0, Math.round(change.seconds * TICKS)) + (item.startTrim ?? 0) + (item.endTrim ?? 0);
		next.media = [{ ...item.media[0], ticks }, ...item.media.slice(1)];
	}
	const out = copyData(data);
	out.playlists.set(key, next);
	return out;
}

/** Moves items of a playlist one place up (-1) or down (1), the picked ones as a block */
export function moveItems(data: JwlData, playlist: string, keys: Iterable<string>, by: -1 | 1): JwlData {
	const list = playlists(data).find((p) => p.key === playlist);
	if (!list) return data;
	const moving = new Set(keys);
	const order = [...list.items];
	const swap = (i: number, j: number) => ([order[i], order[j]] = [order[j], order[i]]);
	if (by < 0) {
		for (let i = 1; i < order.length; i++) if (moving.has(order[i]) && !moving.has(order[i - 1])) swap(i, i - 1);
	} else for (let i = order.length - 2; i >= 0; i--) if (moving.has(order[i]) && !moving.has(order[i + 1])) swap(i, i + 1);
	return reorder(data, playlist, order);
}

export function reorder(data: JwlData, playlist: string, order: string[]): JwlData {
	const out = copyData(data);
	const place = new Map(order.map((key, i) => [playlistTarget(key), i]));
	out.tagMaps = out.tagMaps.map((tm) => (tm.tag === playlist && place.has(tm.target) ? { ...tm, position: place.get(tm.target)! } : tm));
	return renumber(out);
}

export function removeItems(data: JwlData, keys: Iterable<string>): JwlData {
	const out = copyData(data);
	const gone = new Set([...keys].map(playlistTarget));
	for (const target of gone) out.playlists.delete(targetValue(target));
	out.tagMaps = out.tagMaps.filter((tm) => !gone.has(tm.target));
	return renumber(out);
}

/** A new item for a picture or video already hashed (`media`, `thumbnail`) */
export interface NewItem {
	label: string;
	seconds: number;
	endAction: number;
	media: Media;
	thumbnail: Media;
}

/** Adds items at the end of a playlist (`at`: before that place) */
export function addItems(data: JwlData, playlist: string, items: NewItem[], at?: number): JwlData {
	const list = playlists(data).find((p) => p.key === playlist);
	if (!list) return data;
	const out = copyData(data);
	const keys: string[] = [];
	for (const n of items) {
		out.media.set(n.media.hash, n.media);
		out.media.set(n.thumbnail.hash, n.thumbnail);
		const item: PlaylistItem = {
			label: n.label,
			startTrim: null,
			endTrim: null,
			accuracy: 1,
			endAction: n.endAction,
			thumbnail: n.thumbnail.hash,
			locations: [],
			media: [{ hash: n.media.hash, ticks: Math.max(0, Math.round(n.seconds * 10_000_000)) }],
			markers: []
		};
		const key = playlistKey(item, out.playlists);
		out.playlists.set(key, item);
		out.tagMaps.push({ tag: playlist, target: playlistTarget(key), position: Number.MAX_SAFE_INTEGER });
		keys.push(key);
	}
	const order = [...list.items];
	order.splice(at ?? order.length, 0, ...keys);
	return reorder(out, playlist, order);
}
