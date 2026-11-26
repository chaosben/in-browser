// The content of a JW Library database (`userData.db` of a `.jwlibrary` backup or a `.jwlplaylist`) without its
// row ids: every row is known by a natural key (GUIDs, a location's values, a file's hash), so the data of two
// files can be compared and merged, and written back with fresh ids. Pure – no SQLite here (`database.ts` reads and
// writes it). The format: .claude/rules/jwl.md.

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

/** The database versions this package reads (JW Library's own schema numbers) */
export const MIN_SCHEMA = 14;
export const MAX_SCHEMA = 16;

/** The hidden location in-browser put into merged backups until 2026-11-26: never data, dropped when read */
export const OLD_MERGE_MARKER = 'in-browser-merge';

export interface Location {
	book: number | null;
	chapter: number | null;
	document: number | null;
	track: number | null;
	issue: number;
	keySymbol: string | null;
	language: number | null;
	type: number;
	title: string | null;
	specialty: string | null;
	edition: string | null;
}

/** A location's natural key: everything but its title (specialty and edition empty when missing) */
export type LocKey = string;

const n = (v: number | null) => (v === null ? '-' : String(v));
const s = (v: string | null) => (v === null ? '-' : v);

export function locKey(l: Location): LocKey {
	return [s(l.keySymbol), n(l.language), n(l.book), n(l.chapter), n(l.document), n(l.track), l.issue, l.type, l.specialty ?? '', l.edition ?? ''].join('|');
}

export interface BlockRange {
	blockType: number;
	identifier: number;
	start: number | null;
	end: number | null;
}

/** A highlight or underline (`UserMark` with its `BlockRange`s, sorted) */
export interface UserMark {
	guid: string;
	loc: LocKey;
	color: number;
	style: number;
	version: number;
	ranges: BlockRange[];
}

export interface Note {
	guid: string;
	/** The highlight it belongs to (its GUID) */
	mark: string | null;
	loc: LocKey | null;
	title: string | null;
	content: string | null;
	modified: string;
	created: string;
	blockType: number;
	blockId: number | null;
}

/** Tag types: 0 favorites, 1 the user's tags, 2 playlists */
export const TAG_FAVORITES = 0;
export const TAG_USER = 1;
export const TAG_PLAYLIST = 2;

export interface Tag {
	type: number;
	name: string;
}

export const tagKey = (t: Tag) => `${t.type}|${t.name}`;

/** What a tag is put on: `N:<note guid>`, `L:<location key>`, `P:<playlist item key>` */
export type Target = string;
export const noteTarget = (guid: string): Target => `N:${guid}`;
export const locationTarget = (loc: LocKey): Target => `L:${loc}`;
export const playlistTarget = (key: string): Target => `P:${key}`;
export const targetKind = (t: Target) => t[0] as 'N' | 'L' | 'P';
export const targetValue = (t: Target) => t.slice(2);

export interface TagMap {
	/** `tagKey` */
	tag: string;
	target: Target;
	position: number;
}

export interface Bookmark {
	/** The publication it belongs to and its slot (0–9) */
	publication: LocKey;
	slot: number;
	loc: LocKey;
	title: string;
	snippet: string | null;
	blockType: number;
	blockId: number | null;
}

export const bookmarkKey = (b: { publication: LocKey; slot: number }) => `${b.publication}#${b.slot}`;

export interface InputField {
	loc: LocKey;
	tag: string;
	value: string;
}

export const inputKey = (f: { loc: LocKey; tag: string }) => `${f.loc}#${f.tag}`;

/** A file of the archive (`IndependentMedia`): pictures, videos, thumbnails; known by its SHA-256 */
export interface Media {
	name: string;
	path: string;
	mime: string;
	hash: string;
}

export interface PlaylistLocation {
	loc: LocKey;
	type: number;
	baseTicks: number | null;
}

export interface PlaylistMedia {
	hash: string;
	ticks: number;
}

export interface MarkerParagraph {
	document: number;
	paragraph: number;
	index: number;
}

export interface PlaylistMarker {
	label: string;
	start: number;
	duration: number;
	transition: number;
	verses: number[];
	paragraphs: MarkerParagraph[];
}

export interface PlaylistItem {
	label: string;
	startTrim: number | null;
	endTrim: number | null;
	accuracy: number;
	/** 0 continue, 1 stop, 2 freeze, 3 repeat (`END_ACTIONS`) */
	endAction: number;
	/** The thumbnail's media hash */
	thumbnail: string | null;
	locations: PlaylistLocation[];
	media: PlaylistMedia[];
	markers: PlaylistMarker[];
}

/** One database without ids */
export interface JwlData {
	schema: number;
	locations: Map<LocKey, Location>;
	marks: Map<string, UserMark>;
	notes: Map<string, Note>;
	tags: Map<string, Tag>;
	tagMaps: TagMap[];
	bookmarks: Map<string, Bookmark>;
	inputs: Map<string, InputField>;
	media: Map<string, Media>;
	/** By `playlistKey` */
	playlists: Map<string, PlaylistItem>;
	/** Rows dropped while reading (references to rows that aren't there – JW Library doesn't enforce them) */
	warnings: string[];
}

export function emptyData(schema = MAX_SCHEMA): JwlData {
	return {
		schema,
		locations: new Map(),
		marks: new Map(),
		notes: new Map(),
		tags: new Map(),
		tagMaps: [],
		bookmarks: new Map(),
		inputs: new Map(),
		media: new Map(),
		playlists: new Map(),
		warnings: []
	};
}

/** A shallow copy whose maps and lists may be changed without touching `data` (edits keep the old one for undo) */
export function copyData(data: JwlData): JwlData {
	return {
		...data,
		locations: new Map(data.locations),
		marks: new Map(data.marks),
		notes: new Map(data.notes),
		tags: new Map(data.tags),
		tagMaps: [...data.tagMaps],
		bookmarks: new Map(data.bookmarks),
		inputs: new Map(data.inputs),
		media: new Map(data.media),
		playlists: new Map(data.playlists),
		warnings: [...data.warnings]
	};
}

export function sortRanges(ranges: BlockRange[]): BlockRange[] {
	return ranges.sort((a, b) => a.blockType - b.blockType || a.identifier - b.identifier || (a.start ?? 0) - (b.start ?? 0) || (a.end ?? 0) - (b.end ?? 0));
}

/** Values joined into one string for comparisons */
export const canon = (...parts: unknown[]) => parts.map((p) => (p === null || p === undefined ? '-' : String(p))).join('\x1f');

/** A playlist item's signature: its whole content, so equal items of two files are recognized as one */
export function playlistSignature(item: PlaylistItem): string {
	return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(item)))).slice(0, 24);
}

/** A key for `item` not yet in `taken`: its signature, a second equal item `#2` … */
export function playlistKey(item: PlaylistItem, taken: { has(key: string): boolean }): string {
	const signature = playlistSignature(item);
	let key = signature;
	for (let i = 2; taken.has(key); i++) key = `${signature}#${i}`;
	return key;
}

// --- Times: Android writes `…Z`, Windows `…+00:00`, older data fractions or a space instead of `T` ---

/** The moment a stored time names (ms), NaN if it can't be read; times without a zone are UTC */
export function parseTime(value: string | null | undefined): number {
	if (!value) return NaN;
	let v = value.trim();
	if (v.length > 10 && v[10] === ' ') v = `${v.slice(0, 10)}T${v.slice(11)}`;
	if (/^\d{4}-\d\d-\d\d$/.test(v)) v += 'T00:00:00Z';
	else if (!/(Z|[+-]\d\d:?\d\d)$/i.test(v)) v += 'Z';
	else v = v.replace(/([+-]\d\d)(\d\d)$/, '$1:$2');
	return Date.parse(v);
}

/** `2026-01-02T15:04:05Z`, the way the database stores times */
export function formatTime(ms: number): string {
	return new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
}

/** The same moment in one notation (equal moments written differently compare equal) */
export function canonicalTime(value: string): string {
	const ms = parseTime(value);
	return Number.isNaN(ms) ? value : formatTime(ms);
}
