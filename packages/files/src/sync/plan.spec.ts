import { describe, expect, it } from 'vitest';
import { deletedLocalFiles, holdDeletes, ignored, plan, type Base, type FileState, type Snapshot } from './plan';

const file = (modified: number, size = 10): FileState => ({ kind: 'file', size, modified });
const dir: FileState = { kind: 'directory', size: 0, modified: 0 };
const snap = (entries: Record<string, FileState>): Snapshot => new Map(Object.entries(entries));
const base = (entries: Record<string, [FileState, FileState]>): Base =>
	new Map(Object.entries(entries).map(([path, [local, disk]]) => [path, { local, disk }]));

const ops = (...args: Parameters<typeof plan>) => plan(...args).map((op) => `${op.type} ${op.path}`);

describe('plan: first run (no base)', () => {
	it('copies what only one side has', () => {
		expect(ops(snap({ '/a.txt': file(1) }), snap({ '/b.txt': file(1) }), base({}))).toEqual(['toDisk /a.txt', 'toLocal /b.txt']);
	});
	it('the newer version wins when both have the file', () => {
		expect(ops(snap({ '/a': file(5) }), snap({ '/a': file(3) }), base({}))).toEqual(['toDisk /a']);
		expect(ops(snap({ '/a': file(3) }), snap({ '/a': file(5) }), base({}))).toEqual(['toLocal /a']);
	});
	it('remembers identical files and existing folders', () => {
		expect(ops(snap({ '/a': file(5), '/d': dir }), snap({ '/a': file(5), '/d': dir }), base({}))).toEqual(['remember /a', 'remember /d']);
	});
	it('creates missing folders, parents first', () => {
		expect(ops(snap({ '/x': dir, '/x/y': dir }), snap({}), base({}))).toEqual(['mkdirDisk /x', 'mkdirDisk /x/y']);
	});
});

describe('plan: later runs', () => {
	const synced = base({ '/a': [file(1), file(2)] });

	it('does nothing without changes', () => {
		expect(ops(snap({ '/a': file(1) }), snap({ '/a': file(2) }), synced)).toEqual([]);
	});
	it('copies a change of one side', () => {
		expect(ops(snap({ '/a': file(7) }), snap({ '/a': file(2) }), synced)).toEqual(['toDisk /a']);
		expect(ops(snap({ '/a': file(1) }), snap({ '/a': file(7, 99) }), synced)).toEqual(['toLocal /a']);
	});
	it('a change of size alone counts as a change', () => {
		expect(ops(snap({ '/a': file(1, 11) }), snap({ '/a': file(2) }), synced)).toEqual(['toDisk /a']);
	});
	it('both changed: the newer one wins', () => {
		expect(ops(snap({ '/a': file(9) }), snap({ '/a': file(8) }), synced)).toEqual(['toDisk /a']);
		expect(ops(snap({ '/a': file(8) }), snap({ '/a': file(9) }), synced)).toEqual(['toLocal /a']);
	});
	it('deleted on one side, unchanged on the other: deleted there too', () => {
		expect(ops(snap({}), snap({ '/a': file(2) }), synced)).toEqual(['deleteDisk /a']);
		expect(ops(snap({ '/a': file(1) }), snap({}), synced)).toEqual(['deleteLocal /a']);
	});
	it('deleted on one side, changed on the other: the change wins', () => {
		expect(ops(snap({}), snap({ '/a': file(5) }), synced)).toEqual(['toLocal /a']);
		expect(ops(snap({ '/a': file(5) }), snap({}), synced)).toEqual(['toDisk /a']);
	});
	it('forgets what is gone on both sides', () => {
		expect(ops(snap({}), snap({}), synced)).toEqual(['forget /a']);
	});
	it('deletes children before their folder', () => {
		const b = base({ '/d': [dir, dir], '/d/x': [file(1), file(1)] });
		expect(ops(snap({ '/d': dir, '/d/x': file(1) }), snap({}), b)).toEqual(['deleteLocal /d/x', 'deleteLocal /d']);
	});
	it('leaves a file/folder clash alone', () => {
		expect(ops(snap({ '/a': file(1) }), snap({ '/a': dir }), base({}))).toEqual(['conflict /a']);
	});
});

describe('ignored', () => {
	it('skips temporary and system files anywhere in the path', () => {
		for (const path of ['/a/.DS_Store', '/Thumbs.db', '/x/desktop.ini', '/~$Report.docx', '/a.crswap', '/video.mp4.part', '/.stversions/a', '/.syncthing.a.tmp', '/.moving-123/a'])
			expect(ignored(path), path).toBe(true);
	});
	it('keeps normal and hidden app data', () => {
		for (const path of ['/Screen Capture/Demo.screencapture/project.json', '/.apps/screen-capture/library/library.json'])
			expect(ignored(path), path).toBe(false);
	});
	it('ignored paths never appear in a plan', () => {
		expect(ops(snap({ '/.DS_Store': file(1) }), snap({}), base({}))).toEqual([]);
	});
});

describe('deletedLocalFiles', () => {
	it('counts only files deleted in the folder on disk (to be deleted in the browser)', () => {
		const b = base({ '/a': [file(1), file(1)], '/b': [file(1), file(1)], '/d': [dir, dir] });
		// /a gone on disk, /b gone in the browser, /d gone on disk (folder: not counted)
		const ops = plan(snap({ '/a': file(1), '/d': dir }), snap({ '/b': file(1) }), b);
		expect(deletedLocalFiles(ops)).toBe(1);
	});
});

describe('plan: changes on both sides', () => {
	it('marks copies that overwrite a change of the other side', () => {
		const synced = base({ '/a': [file(1), file(1)] });
		expect(plan(snap({ '/a': file(9) }), snap({ '/a': file(5) }), synced)).toEqual([{ type: 'toDisk', path: '/a', both: true }]);
		expect(plan(snap({ '/a': file(1) }), snap({ '/a': file(5) }), synced)).toEqual([{ type: 'toLocal', path: '/a' }]);
	});
});

describe('holdDeletes', () => {
	const files = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`/f${i}`, file(1)]));
	const allSynced = (n: number) => base(Object.fromEntries(Array.from({ length: n }, (_, i) => [`/f${i}`, [file(1), file(1)]])));

	it('holds deletions when the other side is empty', () => {
		const b = allSynced(2);
		const local = snap(files(2));
		expect(holdDeletes(plan(local, snap({}), b), snap({}), b)).toBe(true);
	});
	it('holds many deletions, lets few through', () => {
		const b = allSynced(40);
		const local = snap(files(40));
		const many = snap(Object.fromEntries(Object.entries(files(40)).slice(20)));
		const few = snap(Object.fromEntries(Object.entries(files(40)).slice(2)));
		expect(holdDeletes(plan(local, many, b), many, b)).toBe(true);
		expect(holdDeletes(plan(local, few, b), few, b)).toBe(false);
	});
});
