// Reads a JW Library database into the id-free model (`model.ts`) and writes a model back into a copy of a
// database JW Library made – its schema, triggers and metadata tables stay as the app expects them, every data
// table is filled anew with fresh ids. Works on an open sql.js database (the worker opens it).

import type { Database, SqlValue } from 'sql.js';
import {
	OLD_MERGE_MARKER,
	MAX_SCHEMA,
	MIN_SCHEMA,
	bookmarkKey,
	canon,
	emptyData,
	formatTime,
	inputKey,
	locKey,
	locationTarget,
	noteTarget,
	playlistKey,
	playlistTarget,
	sortRanges,
	tagKey,
	targetKind,
	targetValue,
	type JwlData,
	type Location,
	type LocKey,
	type PlaylistItem,
	type PlaylistMarker,
	type Tag
} from './model.js';

/** A file JW Library writes that this version can't read */
export class JwlFormatError extends Error {
	constructor(
		readonly reason: 'schema' | 'database' | 'archive',
		detail: string
	) {
		super(detail);
	}
}

type Row = SqlValue[];

function rows(db: Database, sql: string): Row[] {
	return db.exec(sql)[0]?.values ?? [];
}

const num = (v: SqlValue) => (v === null ? null : Number(v));
const str = (v: SqlValue) => (v === null ? null : String(v));

function hasColumn(db: Database, table: string, column: string): boolean {
	return rows(db, `PRAGMA table_info("${table}")`).some((r) => r[1] === column);
}

function tables(db: Database): Set<string> {
	return new Set(rows(db, "SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => String(r[0])));
}

export function schemaOf(db: Database): number {
	return Number(rows(db, 'PRAGMA user_version')[0]?.[0] ?? 0);
}

/** The database's content; rows pointing at rows that aren't there are dropped and named in `warnings` */
export function readData(db: Database): JwlData {
	const schema = schemaOf(db);
	if (schema < MIN_SCHEMA || schema > MAX_SCHEMA) throw new JwlFormatError('schema', `schema ${schema}`);
	const out = emptyData(schema);
	const warn = (text: string) => out.warnings.push(text);
	const has = tables(db);

	// Locations
	const locById = new Map<number, LocKey>();
	const extra = hasColumn(db, 'Location', 'Specialty') ? 'Specialty, Edition' : 'NULL, NULL';
	for (const r of rows(db, `SELECT LocationId, BookNumber, ChapterNumber, DocumentId, Track, IssueTagNumber, KeySymbol, MepsLanguage, Type, Title, ${extra} FROM Location`)) {
		const loc: Location = {
			book: num(r[1]),
			chapter: num(r[2]),
			document: num(r[3]),
			track: num(r[4]),
			issue: Number(r[5] ?? 0),
			keySymbol: str(r[6]),
			language: num(r[7]),
			type: Number(r[8]),
			title: str(r[9]),
			specialty: str(r[10]),
			edition: str(r[11])
		};
		if (loc.keySymbol === OLD_MERGE_MARKER) continue;
		const key = locKey(loc);
		locById.set(Number(r[0]), key);
		out.locations.set(key, loc);
	}

	// Highlights and their ranges
	const markById = new Map<number, string>();
	for (const r of rows(db, 'SELECT UserMarkId, ColorIndex, LocationId, StyleIndex, UserMarkGuid, Version FROM UserMark')) {
		const guid = String(r[4]);
		const loc = locById.get(Number(r[2]));
		if (!loc) {
			warn(`UserMark ${guid}: location ${r[2]} missing`);
			continue;
		}
		markById.set(Number(r[0]), guid);
		out.marks.set(guid, { guid, loc, color: Number(r[1]), style: Number(r[3]), version: Number(r[5]), ranges: [] });
	}
	for (const r of rows(db, 'SELECT UserMarkId, BlockType, Identifier, StartToken, EndToken FROM BlockRange')) {
		const guid = markById.get(Number(r[0]));
		if (guid) out.marks.get(guid)!.ranges.push({ blockType: Number(r[1]), identifier: Number(r[2]), start: num(r[3]), end: num(r[4]) });
	}
	for (const mark of out.marks.values()) sortRanges(mark.ranges);

	// Notes
	const noteById = new Map<number, string>();
	for (const r of rows(db, 'SELECT NoteId, Guid, UserMarkId, LocationId, Title, Content, LastModified, Created, BlockType, BlockIdentifier FROM Note')) {
		const guid = String(r[1]);
		let mark: string | null = null;
		if (r[2] !== null) {
			mark = markById.get(Number(r[2])) ?? null;
			if (!mark) warn(`Note ${guid}: highlight ${r[2]} missing`);
		}
		let loc: LocKey | null = null;
		if (r[3] !== null) {
			loc = locById.get(Number(r[3])) ?? null;
			if (!loc) warn(`Note ${guid}: location ${r[3]} missing`);
		}
		noteById.set(Number(r[0]), guid);
		out.notes.set(guid, {
			guid,
			mark,
			loc,
			title: str(r[4]),
			content: str(r[5]),
			modified: String(r[6] ?? ''),
			created: String(r[7] ?? ''),
			blockType: Number(r[8] ?? 0),
			blockId: num(r[9])
		});
	}

	// Tags
	const tagById = new Map<number, string>();
	for (const r of rows(db, 'SELECT TagId, Type, Name FROM Tag')) {
		const tag: Tag = { type: Number(r[1]), name: String(r[2]) };
		tagById.set(Number(r[0]), tagKey(tag));
		out.tags.set(tagKey(tag), tag);
	}

	// Files
	const mediaById = new Map<number, string>();
	const mediaByPath = new Map<string, string>();
	if (has.has('IndependentMedia'))
		for (const r of rows(db, 'SELECT IndependentMediaId, OriginalFilename, FilePath, MimeType, Hash FROM IndependentMedia')) {
			const media = { name: String(r[1]), path: String(r[2]), mime: String(r[3]), hash: String(r[4]) };
			mediaById.set(Number(r[0]), media.hash);
			mediaByPath.set(media.path, media.hash);
			out.media.set(media.hash, media);
		}

	// Playlist items with their locations, files and markers
	const items = new Map<number, PlaylistItem>();
	if (has.has('PlaylistItem')) {
		for (const r of rows(db, 'SELECT PlaylistItemId, Label, StartTrimOffsetTicks, EndTrimOffsetTicks, Accuracy, EndAction, ThumbnailFilePath FROM PlaylistItem ORDER BY PlaylistItemId')) {
			let thumbnail: string | null = null;
			if (r[6] !== null) {
				thumbnail = mediaByPath.get(String(r[6])) ?? null;
				if (!thumbnail) warn(`PlaylistItem ${r[1]}: thumbnail ${r[6]} missing`);
			}
			items.set(Number(r[0]), {
				label: String(r[1]),
				startTrim: num(r[2]),
				endTrim: num(r[3]),
				accuracy: Number(r[4]),
				endAction: Number(r[5]),
				thumbnail,
				locations: [],
				media: [],
				markers: []
			});
		}
		if (has.has('PlaylistItemLocationMap'))
			for (const r of rows(db, 'SELECT PlaylistItemId, LocationId, MajorMultimediaType, BaseDurationTicks FROM PlaylistItemLocationMap')) {
				const loc = locById.get(Number(r[1]));
				const item = items.get(Number(r[0]));
				if (item && loc) item.locations.push({ loc, type: Number(r[2]), baseTicks: num(r[3]) });
			}
		for (const r of rows(db, 'SELECT PlaylistItemId, IndependentMediaId, DurationTicks FROM PlaylistItemIndependentMediaMap')) {
			const hash = mediaById.get(Number(r[1]));
			const item = items.get(Number(r[0]));
			if (item && hash) item.media.push({ hash, ticks: Number(r[2]) });
		}
		if (has.has('PlaylistItemMarker')) {
			const markers = new Map<number, { owner: number; marker: PlaylistMarker }>();
			for (const r of rows(db, 'SELECT PlaylistItemMarkerId, PlaylistItemId, Label, StartTimeTicks, DurationTicks, EndTransitionDurationTicks FROM PlaylistItemMarker ORDER BY PlaylistItemMarkerId'))
				markers.set(Number(r[0]), {
					owner: Number(r[1]),
					marker: { label: String(r[2]), start: Number(r[3]), duration: Number(r[4]), transition: Number(r[5]), verses: [], paragraphs: [] }
				});
			if (has.has('PlaylistItemMarkerBibleVerseMap'))
				for (const r of rows(db, 'SELECT PlaylistItemMarkerId, VerseId FROM PlaylistItemMarkerBibleVerseMap')) markers.get(Number(r[0]))?.marker.verses.push(Number(r[1]));
			if (has.has('PlaylistItemMarkerParagraphMap'))
				for (const r of rows(db, 'SELECT PlaylistItemMarkerId, MepsDocumentId, ParagraphIndex, MarkerIndexWithinParagraph FROM PlaylistItemMarkerParagraphMap'))
					markers.get(Number(r[0]))?.marker.paragraphs.push({ document: Number(r[1]), paragraph: Number(r[2]), index: Number(r[3]) });
			for (const { owner, marker } of markers.values()) {
				marker.verses.sort((a, b) => a - b);
				marker.paragraphs.sort((a, b) => a.document - b.document || a.paragraph - b.paragraph || a.index - b.index);
				items.get(owner)?.markers.push(marker);
			}
		}
	}
	const itemKey = new Map<number, string>();
	for (const [id, item] of items) {
		item.locations.sort((a, b) => (canon(a.loc, a.type) < canon(b.loc, b.type) ? -1 : 1));
		item.media.sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
		item.markers.sort((a, b) => a.start - b.start);
		const key = playlistKey(item, out.playlists);
		itemKey.set(id, key);
		out.playlists.set(key, item);
	}

	// Tag assignments
	for (const r of rows(db, 'SELECT PlaylistItemId, LocationId, NoteId, TagId, Position FROM TagMap ORDER BY TagId, Position')) {
		const tag = tagById.get(Number(r[3]));
		if (!tag) {
			warn(`TagMap: tag ${r[3]} missing`);
			continue;
		}
		let target: string | undefined;
		if (r[2] !== null) target = noteById.get(Number(r[2])) && noteTarget(noteById.get(Number(r[2]))!);
		else if (r[1] !== null) target = locById.get(Number(r[1])) && locationTarget(locById.get(Number(r[1]))!);
		else if (r[0] !== null) target = itemKey.get(Number(r[0])) && playlistTarget(itemKey.get(Number(r[0]))!);
		if (!target) {
			warn(`TagMap: target of tag ${r[3]} missing`);
			continue;
		}
		out.tagMaps.push({ tag, target, position: Number(r[4]) });
	}

	// Bookmarks
	for (const r of rows(db, 'SELECT LocationId, PublicationLocationId, Slot, Title, Snippet, BlockType, BlockIdentifier FROM Bookmark')) {
		const loc = locById.get(Number(r[0]));
		const publication = locById.get(Number(r[1]));
		if (!loc || !publication) {
			warn(`Bookmark ${r[3]}: location missing`);
			continue;
		}
		const bookmark = { publication, slot: Number(r[2]), loc, title: String(r[3]), snippet: str(r[4]), blockType: Number(r[5] ?? 0), blockId: num(r[6]) };
		out.bookmarks.set(bookmarkKey(bookmark), bookmark);
	}

	// Input fields of publications
	if (has.has('InputField'))
		for (const r of rows(db, 'SELECT LocationId, TextTag, Value FROM InputField')) {
			const loc = locById.get(Number(r[0]));
			if (!loc) {
				warn(`InputField ${r[1]}: location missing`);
				continue;
			}
			const field = { loc, tag: String(r[1]), value: String(r[2]) };
			out.inputs.set(inputKey(field), field);
		}
	return out;
}

/** Emptied before writing; everything else (`LastModified`, `PlaylistItemAccuracy`, metadata tables) stays */
const DATA_TABLES = [
	'TagMap',
	'PlaylistItemMarkerParagraphMap',
	'PlaylistItemMarkerBibleVerseMap',
	'PlaylistItemMarker',
	'PlaylistItemIndependentMediaMap',
	'PlaylistItemLocationMap',
	'PlaylistItem',
	'IndependentMedia',
	'InputField',
	'Bookmark',
	'Note',
	'BlockRange',
	'UserMark',
	'Tag',
	'Location'
];

export interface WriteOptions {
	/** Time for `LastModified` (ms) */
	modified: number;
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Replaces the data of `db` (a database JW Library made, read with `readData` or not) by `data`. Ids are assigned
 * anew in the order of the natural keys. Returns the path of each file in the archive by its hash.
 */
export function writeData(db: Database, data: JwlData, options: WriteOptions): Map<string, string> {
	const has = tables(db);
	const withEdition = hasColumn(db, 'Location', 'Specialty');
	db.exec('PRAGMA foreign_keys = OFF');
	db.exec('BEGIN');
	try {
		for (const table of DATA_TABLES) if (has.has(table)) db.exec(`DELETE FROM "${table}"`);
		const run = (sql: string, all: SqlValue[][]) => {
			if (!all.length) return;
			const statement = db.prepare(sql);
			try {
				for (const values of all) statement.run(values);
			} finally {
				statement.free();
			}
		};

		// Locations: two rows that the table's unique constraints take for one share an id
		const locId = new Map<LocKey, number>();
		const unique1 = new Map<string, number>();
		const unique2 = new Map<string, number>();
		const locRows: SqlValue[][] = [];
		const addLocation = (id: number, l: Location) =>
			locRows.push(
				withEdition
					? [id, l.book, l.chapter, l.document, l.track, l.issue, l.keySymbol, l.language, l.type, l.title, l.specialty, l.edition]
					: [id, l.book, l.chapter, l.document, l.track, l.issue, l.keySymbol, l.language, l.type, l.title]
			);
		let next = 1;
		for (const key of [...data.locations.keys()].sort(byString)) {
			const l = data.locations.get(key)!;
			const u1 = l.book !== null && l.chapter !== null && l.keySymbol !== null && l.language !== null ? canon(l.book, l.chapter, l.keySymbol, l.language, l.type) : '';
			const u2 =
				l.keySymbol !== null && l.language !== null && l.document !== null && l.track !== null
					? canon(l.keySymbol, l.issue, l.language, l.document, l.track, l.type, l.specialty ?? '', l.edition ?? '')
					: '';
			const same = (u1 && unique1.get(u1)) || (u2 && unique2.get(u2));
			if (same) {
				locId.set(key, same);
				continue;
			}
			addLocation(next, l);
			locId.set(key, next);
			if (u1) unique1.set(u1, next);
			if (u2) unique2.set(u2, next);
			next++;
		}
		run(
			withEdition
				? 'INSERT INTO Location (LocationId, BookNumber, ChapterNumber, DocumentId, Track, IssueTagNumber, KeySymbol, MepsLanguage, Type, Title, Specialty, Edition) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
				: 'INSERT INTO Location (LocationId, BookNumber, ChapterNumber, DocumentId, Track, IssueTagNumber, KeySymbol, MepsLanguage, Type, Title) VALUES (?,?,?,?,?,?,?,?,?,?)',
			locRows
		);
		const loc = (key: LocKey) => {
			const id = locId.get(key);
			if (id === undefined) throw new Error(`location missing: ${key}`);
			return id;
		};

		// Highlights
		const markId = new Map<string, number>();
		const markRows: SqlValue[][] = [];
		const rangeRows: SqlValue[][] = [];
		[...data.marks.keys()].sort(byString).forEach((guid, i) => {
			const m = data.marks.get(guid)!;
			markId.set(guid, i + 1);
			markRows.push([i + 1, m.color, loc(m.loc), m.style, m.guid, m.version]);
			for (const r of m.ranges) rangeRows.push([rangeRows.length + 1, r.blockType, r.identifier, r.start, r.end, i + 1]);
		});
		run('INSERT INTO UserMark (UserMarkId, ColorIndex, LocationId, StyleIndex, UserMarkGuid, Version) VALUES (?,?,?,?,?,?)', markRows);
		run('INSERT INTO BlockRange (BlockRangeId, BlockType, Identifier, StartToken, EndToken, UserMarkId) VALUES (?,?,?,?,?,?)', rangeRows);

		// Notes
		const noteId = new Map<string, number>();
		run(
			'INSERT INTO Note (NoteId, Guid, UserMarkId, LocationId, Title, Content, LastModified, Created, BlockType, BlockIdentifier) VALUES (?,?,?,?,?,?,?,?,?,?)',
			[...data.notes.keys()].sort(byString).map((guid, i) => {
				const x = data.notes.get(guid)!;
				noteId.set(guid, i + 1);
				return [i + 1, x.guid, x.mark ? (markId.get(x.mark) ?? null) : null, x.loc ? loc(x.loc) : null, x.title, x.content, x.modified, x.created, x.blockType, x.blockId];
			})
		);

		// Tags
		const tagId = new Map<string, number>();
		const tags = [...data.tags.values()].sort((a, b) => a.type - b.type || byString(a.name, b.name));
		run(
			'INSERT INTO Tag (TagId, Type, Name) VALUES (?,?,?)',
			tags.map((t, i) => {
				tagId.set(tagKey(t), i + 1);
				return [i + 1, t.type, t.name];
			})
		);

		// Files: two with the same path get one named after its hash
		const mediaId = new Map<string, number>();
		const mediaPath = new Map<string, string>();
		const usedPaths = new Set<string>();
		run(
			'INSERT INTO IndependentMedia (IndependentMediaId, OriginalFilename, FilePath, MimeType, Hash) VALUES (?,?,?,?,?)',
			[...data.media.keys()].sort(byString).map((hash, i) => {
				const m = data.media.get(hash)!;
				let path = m.path;
				if (usedPaths.has(path)) path = uuidOf(hash);
				usedPaths.add(path);
				mediaId.set(hash, i + 1);
				mediaPath.set(hash, path);
				return [i + 1, m.name, path, m.mime, m.hash];
			})
		);

		// Playlist items
		const itemId = new Map<string, number>();
		const itemRows: SqlValue[][] = [];
		const itemLocRows: SqlValue[][] = [];
		const itemMediaRows: SqlValue[][] = [];
		const markerRows: SqlValue[][] = [];
		const verseRows: SqlValue[][] = [];
		const paragraphRows: SqlValue[][] = [];
		[...data.playlists.keys()].sort(byString).forEach((key, i) => {
			const p = data.playlists.get(key)!;
			const id = i + 1;
			itemId.set(key, id);
			itemRows.push([id, p.label, p.startTrim, p.endTrim, p.accuracy, p.endAction, p.thumbnail ? (mediaPath.get(p.thumbnail) ?? null) : null]);
			const seen = new Set<number>();
			for (const pl of p.locations) {
				const l = loc(pl.loc);
				if (seen.has(l)) continue;
				seen.add(l);
				itemLocRows.push([id, l, pl.type, pl.baseTicks]);
			}
			for (const pm of p.media) {
				const m = mediaId.get(pm.hash);
				if (m !== undefined) itemMediaRows.push([id, m, pm.ticks]);
			}
			for (const marker of p.markers) {
				const markerId = markerRows.length + 1;
				markerRows.push([markerId, id, marker.label, marker.start, marker.duration, marker.transition]);
				for (const v of marker.verses) verseRows.push([markerId, v]);
				for (const pp of marker.paragraphs) paragraphRows.push([markerId, pp.document, pp.paragraph, pp.index]);
			}
		});
		run('INSERT INTO PlaylistItem (PlaylistItemId, Label, StartTrimOffsetTicks, EndTrimOffsetTicks, Accuracy, EndAction, ThumbnailFilePath) VALUES (?,?,?,?,?,?,?)', itemRows);
		if (has.has('PlaylistItemLocationMap')) run('INSERT INTO PlaylistItemLocationMap (PlaylistItemId, LocationId, MajorMultimediaType, BaseDurationTicks) VALUES (?,?,?,?)', itemLocRows);
		run('INSERT INTO PlaylistItemIndependentMediaMap (PlaylistItemId, IndependentMediaId, DurationTicks) VALUES (?,?,?)', itemMediaRows);
		if (has.has('PlaylistItemMarker')) {
			run('INSERT INTO PlaylistItemMarker (PlaylistItemMarkerId, PlaylistItemId, Label, StartTimeTicks, DurationTicks, EndTransitionDurationTicks) VALUES (?,?,?,?,?,?)', markerRows);
			run('INSERT INTO PlaylistItemMarkerBibleVerseMap (PlaylistItemMarkerId, VerseId) VALUES (?,?)', verseRows);
			run('INSERT INTO PlaylistItemMarkerParagraphMap (PlaylistItemMarkerId, MepsDocumentId, ParagraphIndex, MarkerIndexWithinParagraph) VALUES (?,?,?,?)', paragraphRows);
		}

		// Tag assignments, numbered per tag in their order
		const maps = [...data.tagMaps].sort((a, b) => (tagId.get(a.tag) ?? 0) - (tagId.get(b.tag) ?? 0) || a.position - b.position);
		const seenMaps = new Set<string>();
		const positions = new Map<number, number>();
		const mapRows: SqlValue[][] = [];
		for (const tm of maps) {
			const tag = tagId.get(tm.tag);
			if (tag === undefined) continue;
			const value = targetValue(tm.target);
			const kind = targetKind(tm.target);
			const target = kind === 'N' ? noteId.get(value) : kind === 'L' ? locId.get(value) : itemId.get(value);
			if (target === undefined) continue;
			const row = [kind === 'P' ? target : null, kind === 'L' ? target : null, kind === 'N' ? target : null];
			const key = canon(tag, ...row);
			if (seenMaps.has(key)) continue;
			seenMaps.add(key);
			const position = positions.get(tag) ?? 0;
			positions.set(tag, position + 1);
			mapRows.push([mapRows.length + 1, ...row, tag, position]);
		}
		run('INSERT INTO TagMap (TagMapId, PlaylistItemId, LocationId, NoteId, TagId, Position) VALUES (?,?,?,?,?,?)', mapRows);

		// Bookmarks
		const seenSlots = new Set<string>();
		const bookmarkRows: SqlValue[][] = [];
		for (const key of [...data.bookmarks.keys()].sort(byString)) {
			const b = data.bookmarks.get(key)!;
			const publication = loc(b.publication);
			if (seenSlots.has(`${publication}#${b.slot}`)) continue;
			seenSlots.add(`${publication}#${b.slot}`);
			bookmarkRows.push([bookmarkRows.length + 1, loc(b.loc), publication, b.slot, b.title, b.snippet, b.blockType, b.blockId]);
		}
		run('INSERT INTO Bookmark (BookmarkId, LocationId, PublicationLocationId, Slot, Title, Snippet, BlockType, BlockIdentifier) VALUES (?,?,?,?,?,?,?,?)', bookmarkRows);

		// Input fields
		if (has.has('InputField')) {
			const seenFields = new Set<string>();
			const fieldRows: SqlValue[][] = [];
			for (const key of [...data.inputs.keys()].sort(byString)) {
				const f = data.inputs.get(key)!;
				const id = loc(f.loc);
				if (seenFields.has(`${id}\0${f.tag}`)) continue;
				seenFields.add(`${id}\0${f.tag}`);
				fieldRows.push([id, f.tag, f.value]);
			}
			run('INSERT INTO InputField (LocationId, TextTag, Value) VALUES (?,?,?)', fieldRows);
		}

		db.run('UPDATE LastModified SET LastModified = ?', [formatTime(options.modified)]);
		db.exec('COMMIT');
		db.exec('VACUUM');
		return mediaPath;
	} catch (error) {
		try {
			db.exec('ROLLBACK');
		} catch {
			// Committed already (the error came later)
		}
		throw error;
	}
}

/** SQLite's own checks of a written database */
export function verify(db: Database): void {
	const integrity = rows(db, 'PRAGMA integrity_check')[0]?.[0];
	if (integrity !== 'ok') throw new JwlFormatError('database', `integrity_check: ${integrity}`);
	const broken = rows(db, 'PRAGMA foreign_key_check')[0];
	if (broken) throw new JwlFormatError('database', `foreign_key_check: ${broken[0]} references missing ${broken[2]}`);
}

function uuidOf(hash: string): string {
	const h = (hash + '0'.repeat(32)).slice(0, 32);
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
