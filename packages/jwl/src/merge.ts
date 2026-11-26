// Merging two JW Library databases, unit by unit (decided by the user, 2026-11-26: two ways, no kept states). A
// unit is the smallest piece of data merged as a whole: a group of connected paragraphs with their highlights, a
// note, a tag, a tag on something, a tag's order, a bookmark slot, an input field, a playlist item. What only one
// file has is kept – so nothing is ever deleted by a merge; where both differ, the newer one wins (notes by their
// own time, the rest by the file's). Pure and tested (`merge.spec.ts`); the rules: .claude/rules/jwl.md “Merging”.

import {
	bookmarkKey,
	canon,
	canonicalTime,
	emptyData,
	parseTime,
	tagKey,
	targetKind,
	targetValue,
	type Bookmark,
	type JwlData,
	type LocKey,
	type Note,
	type PlaylistItem,
	type Tag,
	type TagMap,
	type UserMark
} from './model.js';

type Kind = 'marks' | 'note' | 'tag' | 'tagmember' | 'tagorder' | 'bookmark' | 'input' | 'playlist';

/** One unit's state in one database, with what is needed to build it again */
interface Unit {
	canon: string;
	/** A time of its own (notes), NaN otherwise */
	time: number;
	marks?: UserMark[];
	note?: Note;
	tag?: Tag;
	member?: TagMap;
	order?: TagMap[];
	bookmark?: Bookmark;
	input?: { key: string; loc: LocKey; tag: string; value: string };
	playlist?: { key: string; item: PlaylistItem };
}

type Units = Map<string, Unit>;

const kindOf = (id: string) => id.slice(0, id.indexOf(':')) as Kind;

/** A database at a moment (`time`: when it was last changed, ms) */
export interface Snapshot {
	name: string;
	time: number;
	data: JwlData;
}

export interface MergeStats {
	/** Units both files have, differently: the newer one was taken */
	conflicts: number;
	movedBookmarks: number;
	lostBookmarks: number;
}

export interface MergeResult {
	data: JwlData;
	stats: MergeStats;
}

// --- Paragraph groups: a highlight is merged together with every paragraph it touches (in any database) ---

class Grouper {
	private parent = new Map<string, string>();
	private min = new Map<string, string>();

	private find(x: string): string {
		const p = this.parent.get(x);
		if (p === undefined) {
			this.parent.set(x, x);
			return x;
		}
		if (p === x) return x;
		const root = this.find(p);
		this.parent.set(x, root);
		return root;
	}

	private union(a: string, b: string) {
		const ra = this.find(a);
		const rb = this.find(b);
		if (ra !== rb) this.parent.set(ra, rb);
	}

	add(data: JwlData) {
		for (const m of data.marks.values()) for (const k of paragraphKeys(m)) this.union(`guid:${m.guid}`, k);
	}

	finish() {
		for (const x of this.parent.keys()) {
			if (x.startsWith('guid:')) continue;
			const root = this.find(x);
			const cur = this.min.get(root);
			if (cur === undefined || x < cur) this.min.set(root, x);
		}
	}

	group(m: UserMark): string {
		return this.min.get(this.find(`guid:${m.guid}`))!;
	}
}

function paragraphKeys(m: UserMark): string[] {
	if (!m.ranges.length) return [`${m.loc}#mark:${m.guid}`];
	return m.ranges.map((r) => `${m.loc}#${r.blockType}:${r.identifier}`);
}

function markCanon(m: UserMark): string {
	return [canon(m.guid, m.loc, m.color, m.style), ...m.ranges.map((r) => canon('', r.blockType, r.identifier, r.start, r.end))].join('');
}

function marksUnit(marks: UserMark[]): Unit {
	const sorted = [...marks].sort((a, b) => (a.guid < b.guid ? -1 : a.guid > b.guid ? 1 : 0));
	return { canon: sorted.map(markCanon).join('\n'), time: NaN, marks: sorted };
}

function noteCanon(x: Note): string {
	return canon(x.title, x.content, x.mark, x.loc !== null, x.loc ?? '', x.blockType, x.blockId, canonicalTime(x.modified), canonicalTime(x.created));
}

function extract(data: JwlData, g: Grouper): Units {
	const units: Units = new Map();
	const groups = new Map<string, UserMark[]>();
	for (const m of data.marks.values()) {
		const id = `marks:${g.group(m)}`;
		groups.set(id, [...(groups.get(id) ?? []), m]);
	}
	for (const [id, marks] of groups) units.set(id, marksUnit(marks));
	for (const [guid, x] of data.notes) units.set(`note:${guid}`, { canon: noteCanon(x), time: parseTime(x.modified), note: x });
	for (const [key, t] of data.tags) units.set(`tag:${key}`, { canon: '1', time: NaN, tag: t });
	const orders = new Map<string, TagMap[]>();
	for (const tm of data.tagMaps) {
		units.set(`tagmember:${tm.tag}\x1e${tm.target}`, { canon: '1', time: NaN, member: tm });
		orders.set(tm.tag, [...(orders.get(tm.tag) ?? []), tm]);
	}
	for (const [tag, list] of orders) {
		list.sort((a, b) => a.position - b.position || (a.target < b.target ? -1 : a.target > b.target ? 1 : 0));
		units.set(`tagorder:${tag}`, { canon: list.map((tm) => tm.target).join('\n'), time: NaN, order: list });
	}
	for (const [key, b] of data.bookmarks) units.set(`bookmark:${key}`, { canon: canon(b.loc, b.title, b.snippet, b.blockType, b.blockId), time: NaN, bookmark: b });
	for (const [key, f] of data.inputs) units.set(`input:${key}`, { canon: f.value, time: NaN, input: { key, ...f } });
	for (const [key, item] of data.playlists) units.set(`playlist:${key}`, { canon: '1', time: NaN, playlist: { key, item } });
	return units;
}

const canonOf = (u: Unit | undefined) => u?.canon ?? '';

function tokensOverlap(a: { start: number | null; end: number | null }, b: { start: number | null; end: number | null }): boolean {
	const aStart = a.start ?? -Infinity;
	const bStart = b.start ?? -Infinity;
	const aEnd = a.end ?? Infinity;
	const bEnd = b.end ?? Infinity;
	return aStart <= bEnd && bStart <= aEnd;
}

function overlapsAny(m: UserMark, list: UserMark[]): boolean {
	return list.some((o) => o.loc === m.loc && m.ranges.some((a) => o.ranges.some((b) => a.blockType === b.blockType && a.identifier === b.identifier && tokensOverlap(a, b))));
}

/** A paragraph group with the highlights of others it doesn't have yet – none that would overlap one of another side */
function addMarks(base: Unit | undefined, others: Unit[]): Unit | undefined {
	let marks = [...(base?.marks ?? [])];
	const have = new Set(marks.map((m) => m.guid));
	let added = false;
	for (const other of others) {
		// Highlights of one side may overlap each other (an underline on a highlight): checked only against others
		const existing = marks;
		const accepted: UserMark[] = [];
		for (const m of other.marks ?? []) {
			if (have.has(m.guid) || overlapsAny(m, existing)) continue;
			accepted.push(m);
			have.add(m.guid);
		}
		if (accepted.length) {
			marks = [...existing, ...accepted];
			added = true;
		}
	}
	return added ? marksUnit(marks) : base;
}

/** What the existing file (`mine`) and the one merged into it hold together; `files`: the playlist media at hand */
export function mergeFiles(mine: Snapshot, incoming: Snapshot, files?: { has(hash: string): boolean }): MergeResult {
	const g = new Grouper();
	g.add(mine.data);
	g.add(incoming.data);
	g.finish();
	const a = extract(mine.data, g);
	const b = extract(incoming.data, g);
	const stats: MergeStats = { conflicts: 0, movedBookmarks: 0, lostBookmarks: 0 };
	const chosen = new Map<string, Unit>();
	const bookmarkLosers: Unit[] = [];
	const timeOf = (u: Unit, s: Snapshot) => (Number.isNaN(u.time) ? s.time : u.time);
	for (const id of [...new Set([...a.keys(), ...b.keys()])].sort()) {
		const x = a.get(id);
		const y = b.get(id);
		if (!x || !y || x.canon === y.canon) {
			chosen.set(id, (x ?? y)!);
			continue;
		}
		// Both have it, differently: the newer wins (mine on a tie)
		const theirs = timeOf(y, incoming) > timeOf(x, mine);
		const [win, lose] = theirs ? [y, x] : [x, y];
		const kind = kindOf(id);
		if (kind === 'note' || kind === 'marks' || kind === 'bookmark' || kind === 'input') stats.conflicts++;
		if (kind === 'bookmark') bookmarkLosers.push(lose);
		chosen.set(id, kind === 'marks' ? (addMarks(win, [lose]) ?? win) : win);
	}
	return { data: build(chosen, [mine, incoming], bookmarkLosers, stats, files), stats };
}

const BOOKMARK_SLOTS = 10;

function build(chosen: Map<string, Unit>, snaps: Snapshot[], bookmarkLosers: Unit[], stats: MergeStats, files?: { has(hash: string): boolean }): JwlData {
	const data = emptyData(Math.max(...snaps.map((s) => s.data.schema)));
	const members: TagMap[] = [];
	const orders = new Map<string, TagMap[]>();
	for (const id of [...chosen.keys()].sort()) {
		const u = chosen.get(id)!;
		switch (kindOf(id)) {
			case 'marks':
				for (const m of u.marks!) data.marks.set(m.guid, m);
				break;
			case 'note':
				data.notes.set(u.note!.guid, u.note!);
				break;
			case 'tag':
				data.tags.set(tagKey(u.tag!), u.tag!);
				break;
			case 'tagmember':
				members.push(u.member!);
				break;
			case 'tagorder':
				orders.set(u.order![0].tag, u.order!);
				break;
			case 'bookmark':
				data.bookmarks.set(bookmarkKey(u.bookmark!), u.bookmark!);
				break;
			case 'input':
				data.inputs.set(u.input!.key, { loc: u.input!.loc, tag: u.input!.tag, value: u.input!.value });
				break;
			case 'playlist':
				data.playlists.set(u.playlist!.key, u.playlist!.item);
				break;
		}
	}

	// A note keeps its place when its highlight was dropped
	for (const [guid, x] of data.notes) if (x.mark && !data.marks.has(x.mark)) data.notes.set(guid, { ...x, mark: null });

	// Files: the newest description of each; playlist items keep only files at hand
	const byTime = [...snaps].sort((a, b) => a.time - b.time);
	const media = new Map<string, JwlData['media'] extends Map<string, infer M> ? M : never>();
	for (const s of byTime) for (const [hash, m] of s.data.media) media.set(hash, m);
	const usable = (hash: string) => media.has(hash) && (!files || files.has(hash));
	for (const [key, p] of data.playlists) {
		const item: PlaylistItem = { ...p, thumbnail: p.thumbnail && usable(p.thumbnail) ? p.thumbnail : null, media: p.media.filter((pm) => usable(pm.hash)) };
		data.playlists.set(key, item);
		if (item.thumbnail) data.media.set(item.thumbnail, media.get(item.thumbnail)!);
		for (const pm of item.media) data.media.set(pm.hash, media.get(pm.hash)!);
	}

	buildTagMaps(data, members, orders);
	placeBookmarkLosers(data, bookmarkLosers, stats);

	// Every location any database knows (JW Library never deletes them); titles from the newest that has one
	for (const s of byTime)
		for (const [key, l] of s.data.locations) {
			const prev = data.locations.get(key);
			data.locations.set(key, prev && l.title === null ? { ...l, title: prev.title } : l);
		}
	return data;
}

/** Keeps tags on what still exists and numbers them per tag: first in the winning order, then the rest */
function buildTagMaps(data: JwlData, members: TagMap[], orders: Map<string, TagMap[]>) {
	const byTag = new Map<string, Map<string, TagMap>>();
	for (const tm of members) {
		const kind = targetKind(tm.target);
		if (kind === 'N' && !data.notes.has(targetValue(tm.target))) continue;
		if (kind === 'P' && !data.playlists.has(targetValue(tm.target))) continue;
		const set = byTag.get(tm.tag) ?? new Map<string, TagMap>();
		set.set(tm.target, tm);
		byTag.set(tm.tag, set);
	}
	// A tag on something keeps the tag
	for (const tag of byTag.keys()) {
		if (data.tags.has(tag)) continue;
		const i = tag.indexOf('|');
		data.tags.set(tag, { type: Number(tag.slice(0, i)), name: tag.slice(i + 1) });
	}
	for (const tag of [...byTag.keys()].sort()) {
		const set = byTag.get(tag)!;
		const list: TagMap[] = [];
		const used = new Set<string>();
		for (const tm of orders.get(tag) ?? []) {
			const m = set.get(tm.target);
			if (m && !used.has(tm.target)) {
				list.push(m);
				used.add(tm.target);
			}
		}
		const rest = [...set.values()].filter((tm) => !used.has(tm.target)).sort((a, b) => a.position - b.position || (a.target < b.target ? -1 : 1));
		[...list, ...rest].forEach((tm, i) => data.tagMaps.push({ ...tm, position: i }));
	}
}

/** A bookmark that lost its slot moves to a free one of the same publication, unless that place is bookmarked */
function placeBookmarkLosers(data: JwlData, losers: Unit[], stats: MergeStats) {
	for (const u of losers) {
		const b = u.bookmark!;
		const taken = new Set<number>();
		let duplicate = false;
		for (const other of data.bookmarks.values()) {
			if (other.publication !== b.publication) continue;
			taken.add(other.slot);
			if (other.loc === b.loc && other.blockType === b.blockType && other.blockId === b.blockId) duplicate = true;
		}
		if (duplicate) continue;
		const slot = Array.from({ length: BOOKMARK_SLOTS }, (_, i) => i).find((i) => !taken.has(i));
		if (slot === undefined) {
			stats.lostBookmarks++;
			continue;
		}
		const moved = { ...b, slot };
		data.bookmarks.set(bookmarkKey(moved), moved);
		stats.movedBookmarks++;
	}
}

/** Whether two databases hold the same data (ids, unused locations and the merge mark aside) */
export function sameContent(a: JwlData, b: JwlData): boolean {
	const g = new Grouper();
	g.add(a);
	g.add(b);
	g.finish();
	const ua = extract(a, g);
	const ub = extract(b, g);
	if (ua.size !== ub.size) return false;
	for (const [id, u] of ua) if (canonOf(ub.get(id)) !== u.canon) return false;
	return true;
}

/** What `after` has that `before` hadn't, what it changed and what it lost – counted over the user's data */
export function difference(before: JwlData, after: JwlData): { added: number; changed: number; removed: number } {
	const count = { added: 0, changed: 0, removed: 0 };
	const compare = <T>(a: Map<string, T>, b: Map<string, T>, same: (x: T, y: T) => boolean) => {
		for (const [key, value] of b) {
			const old = a.get(key);
			if (old === undefined) count.added++;
			else if (!same(old, value)) count.changed++;
		}
		for (const key of a.keys()) if (!b.has(key)) count.removed++;
	};
	compare(before.marks, after.marks, (x, y) => markCanon(x) === markCanon(y));
	compare(before.notes, after.notes, (x, y) => noteCanon(x) === noteCanon(y));
	compare(before.bookmarks, after.bookmarks, (x, y) => canon(x.loc, x.title, x.snippet) === canon(y.loc, y.title, y.snippet));
	compare(before.tags, after.tags, () => true);
	compare(before.inputs, after.inputs, (x, y) => x.value === y.value);
	const items = (d: JwlData) => new Map([...d.playlists.values()].map((p) => [JSON.stringify(p), p]));
	compare(items(before), items(after), () => true);
	return count;
}
