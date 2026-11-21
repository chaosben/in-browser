import { describe, expect, it } from 'vitest';
import { intersect } from '../p2p/scope';
import { caseRenames, deletedLocalFiles, holdDeletes, holdLarge, ignored, plan, type Base, type FileState, type Snapshot } from './plan';

const file = (modified: number, size = 10): FileState => ({ kind: 'file', size, modified });
const dir: FileState = { kind: 'directory', size: 0, modified: 0 };
const snap = (entries: Record<string, FileState>): Snapshot => new Map(Object.entries(entries));
const base = (entries: Record<string, [FileState, FileState]>): Base =>
	new Map(Object.entries(entries).map(([path, [local, disk]]) => [path, { local, disk }]));

/** `both`: the copy overwrites a change of the other side (its old version is kept as a conflict copy) */
const ops = (...args: Parameters<typeof plan>) => plan(...args).map((op) => `${op.type} ${op.path}${'both' in op && op.both ? ' (both)' : ''}`);
const none = snap({});

describe('plan', () => {
	it.each([
		['copies what only one side has', snap({ '/a': file(1) }), snap({ '/b': file(1) }), ['toDisk /a', 'toLocal /b']],
		['the newer version wins, the other is kept', snap({ '/a': file(3) }), snap({ '/a': file(5) }), ['toLocal /a (both)']],
		['remembers identical files and folders', snap({ '/a': file(5), '/d': dir }), snap({ '/a': file(5), '/d': dir }), ['remember /a', 'remember /d']],
		['creates missing folders, parents first', snap({ '/x': dir, '/x/y': dir }), none, ['mkdirDisk /x', 'mkdirDisk /x/y']],
		['leaves a file/folder clash alone', snap({ '/a': file(1) }), snap({ '/a': dir }), ['conflict /a']]
	])('first run: %s', (_, local, disk, expected) => {
		expect(ops(local, disk, base({}))).toEqual(expected);
	});

	// Synced before: /a was file(1) in the browser and file(2) on disk
	it.each([
		['nothing changed: nothing to do', file(1), file(2), []],
		['one side changed: copied', file(7), file(2), ['toDisk /a']],
		['only the size changed: still a change', file(1), file(2, 11), ['toLocal /a']],
		['both changed: the newer wins, the other is kept', file(8), file(9), ['toLocal /a (both)']],
		['both changed at the same time, same size: the same file', file(9), file(9), ['remember /a']],
		['both changed at the same time, other size: both kept', file(9, 11), file(9, 12), ['toLocal /a (both)']],
		['deleted here, unchanged there: deleted there too', null, file(2), ['deleteDisk /a']],
		['deleted there, unchanged here: deleted here too', file(1), null, ['deleteLocal /a']],
		['deleted on one side, changed on the other: the change wins', null, file(5), ['toLocal /a']],
		['gone on both sides: forgotten', null, null, ['forget /a']]
	])('later run: %s', (_, local, disk, expected) => {
		const side = (state: FileState | null) => snap(state ? { '/a': state } : {});
		expect(ops(side(local), side(disk), base({ '/a': [file(1), file(2)] }))).toEqual(expected);
	});

	it('deletes children before their folder', () => {
		const b = base({ '/d': [dir, dir], '/d/x': [file(1), file(1)] });
		expect(ops(snap({ '/d': dir, '/d/x': file(1) }), none, b)).toEqual(['deleteLocal /d/x', 'deleteLocal /d']);
	});
});

describe('ignored', () => {
	it.each(['/a/.DS_Store', '/~$Report.docx', '/video.mp4.part', '/.syncthing.a.tmp', '/.moving-123/a'])('skips %s', (path) => {
		expect(ignored(path)).toBe(true);
		expect(ops(snap({ [path]: file(1) }), none, base({}))).toEqual([]);
	});

	it.each(['/.in-browser-trash/20261118-102233-123-abcd/a.txt', '/.apps/screen-capture/library/library.json'])('syncs %s', (path) => {
		expect(ignored(path)).toBe(false);
	});
});

describe('holdDeletes', () => {
	const files = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`/f${i}`, file(1)]));
	const allSynced = (n: number) => base(Object.fromEntries(Array.from({ length: n }, (_, i) => [`/f${i}`, [file(1), file(1)]])));

	it('counts only files deleted on the other side (to be deleted here)', () => {
		const b = base({ '/a': [file(1), file(1)], '/b': [file(1), file(1)], '/d': [dir, dir] });
		expect(deletedLocalFiles(plan(snap({ '/a': file(1), '/d': dir }), snap({ '/b': file(1) }), b))).toBe(1);
	});

	it('holds deletions when the other side is empty', () => {
		const b = allSynced(2);
		expect(holdDeletes(plan(snap(files(2)), none, b), none, b)).toBe(true);
	});

	it('holds many deletions, lets few through', () => {
		const b = allSynced(40);
		const local = snap(files(40));
		const many = snap(Object.fromEntries(Object.entries(files(40)).slice(20)));
		const few = snap(Object.fromEntries(Object.entries(files(40)).slice(2)));
		expect(holdDeletes(plan(local, many, b), many, b)).toBe(true);
		expect(holdDeletes(plan(local, few, b), few, b)).toBe(false);
	});

	it('never holds the removal of expired trash entries', () => {
		const entry = (i: number) => `/.in-browser-trash/20261118-102233-123-ab${String(i).padStart(2, '0')}/f.txt`;
		const trash = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [entry(i), file(1)]));
		const b = base({ ...Object.fromEntries(Object.keys(trash).map((p) => [p, [file(1), file(1)]])), '/keep.txt': [file(1), file(1)] });
		const local = snap({ ...trash, '/keep.txt': file(1) });
		const cleaned = snap({ '/keep.txt': file(1) });
		expect(holdDeletes(plan(local, cleaned, b), cleaned, b)).toBe(false);
	});
});

describe('excluded folders of the synced folder', () => {
	it('excluding deletes nothing on either side, and taking the folder in again only merges', () => {
		const synced = base({ '/A': [dir, dir], '/A/x': [file(1), file(1)], '/b': [file(1), file(1)] });
		const local = snap({ '/A': dir, '/A/x': file(1), '/b': file(1) });
		// While excluded, the folder is deleted on disk: not compared, so nothing happens here
		const disk = snap({ '/b': file(1) });
		const scope = ['/A'];
		expect(ops(intersect(local, [], scope), intersect(disk, [], scope), intersect(synced, [], scope))).toEqual([]);
		// The base kept by that run has no entries of the folder anymore: taken in again, the file goes back to disk
		expect(ops(local, disk, intersect(synced, [], scope))).toEqual(['mkdirDisk /A', 'toDisk /A/x']);
	});
});

describe('holdLarge', () => {
	const big = 600;
	const disk = snap({ '/Videos': dir, '/Videos/a': dir, '/Videos/a/1.mp4': file(1, big), '/Videos/2.mp4': file(1, big), '/Docs': dir, '/Docs/x.txt': file(1), '/.apps': dir, '/.apps/n': file(1, 5000) });
	const kept = (o: ReturnType<typeof holdLarge>) => o.ops.map((op) => `${op.type} ${op.path}`).sort();
	const limits = { limit: { in: 1000, out: 1000 }, free: {}, allowed: [] };

	it('holds everything inside a new folder that reaches the limit, lets the rest through', () => {
		const out = holdLarge(plan(none, disk, new Map()), none, disk, limits);
		expect(out.held).toEqual([{ path: '/Videos', bytes: 2 * big, direction: 'in', full: false }]);
		expect(kept(out)).toEqual(['mkdirLocal /.apps', 'mkdirLocal /Docs', 'toLocal /.apps/n', 'toLocal /Docs/x.txt']);
	});

	it('holds what does not fit even without a limit; confirmed folders go through', () => {
		const ops = plan(none, disk, new Map());
		expect(holdLarge(ops, none, disk, { limit: { in: null, out: null }, free: { in: 1000 }, allowed: [] }).held.map((h) => [h.path, h.full])).toEqual([['/Videos', true]]);
		expect(holdLarge(ops, none, disk, { ...limits, allowed: ['/Videos'] }).held).toEqual([]);
	});

	it('only new folders: files added to a folder both sides have are never held', () => {
		const b = base({ '/Videos': [dir, dir], '/Videos/a': [dir, dir] });
		const local = snap({ '/Videos': dir, '/Videos/a': dir });
		expect(holdLarge(plan(local, disk, b), local, disk, limits).held).toEqual([]);
	});
});

describe('caseRenames', () => {
	it('renames on the other side what was renamed here in upper/lower case only, also when changed', () => {
		const b = base({ '/a.txt': [file(1), file(1)] });
		const result = caseRenames(snap({ '/A.txt': file(5) }), snap({ '/a.txt': file(1) }), b);
		expect(result.renames).toEqual([{ type: 'renameDisk', path: '/A.txt', from: '/a.txt', kind: 'file' }]);
		// Planned as if done: only the change is left to copy, nothing to delete
		expect(ops(result.local, result.disk, result.base)).toEqual(['toDisk /A.txt']);
	});

	it('works the other way round, and for folders with everything inside', () => {
		const b = base({ '/docs': [dir, dir], '/docs/x': [file(1), file(1)] });
		const result = caseRenames(snap({ '/docs': dir, '/docs/x': file(1) }), snap({ '/Docs': dir, '/Docs/x': file(1) }), b);
		expect(result.renames).toEqual([{ type: 'renameLocal', path: '/Docs', from: '/docs', kind: 'directory' }]);
		expect(plan(result.local, result.disk, result.base)).toEqual([]);
	});

	it('leaves everything else to the plan: no base, both spellings present, ambiguous', () => {
		expect(caseRenames(snap({ '/A.txt': file(1) }), snap({ '/a.txt': file(1) }), base({})).renames).toEqual([]);
		const b = base({ '/a.txt': [file(1), file(1)] });
		expect(caseRenames(snap({ '/A.txt': file(1), '/a.txt': file(1) }), snap({ '/a.txt': file(1) }), b).renames).toEqual([]);
		expect(caseRenames(snap({ '/A.txt': file(1), '/a.TXT': file(1) }), snap({ '/a.txt': file(1) }), b).renames).toEqual([]);
	});
});
