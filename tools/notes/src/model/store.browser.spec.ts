import { afterEach, describe, expect, it } from 'vitest';
import { list, mkdir, remove, write } from '@in-browser/files/fs.js';
import { connectionRoot } from '@in-browser/files/path.js';
import { saveConnections } from '@in-browser/files/sources/registry.js';
import { connectedDocuments } from '@in-browser/files/sources/recent.js';
import { cleanupAssets, listNotebooks, readNotebook, readPage, rememberNotebook, writeNotebook, writePage } from './store';
import { newNotebook, type Stroke } from './types';

// Notebooks against the real OPFS of headless Chromium

afterEach(async () => {
	for (const entry of await list('/')) await remove(entry.path);
	await saveConnections([]);
	localStorage.clear();
});

describe('notebook store', () => {
	it('saves and loads a notebook with a page', async () => {
		const path = '/School/Math.note';
		await mkdir(`${path}/pages`);
		const notebook = newNotebook();
		await writeNotebook(path, notebook);
		const id = notebook.pages[0].id;
		await writePage(path, id, { items: [{ id: 's', tool: 'pen', color: '#1e293b', size: 1.5, points: new Float32Array([1, 2, 0.5, 30, 40, 0.8]) }] });

		const back = await readNotebook(path);
		expect(back.pages.map((p) => p.id)).toEqual([id]);
		const page = await readPage(path, id);
		expect((page.items[0] as Stroke).points[3]).toBeCloseTo(30, 1);
		// A page without a file (not synced yet) is empty
		expect((await readPage(path, 'missing')).items).toEqual([]);

		const listed = await listNotebooks();
		expect(listed.map((n) => [n.path, n.name, n.pages])).toEqual([[path, 'Math', 1]]);
	});

	it('keeps fresh assets when cleaning up', async () => {
		const path = '/A.note';
		await mkdir(`${path}/assets`);
		const notebook = newNotebook();
		await writeNotebook(path, notebook);
		await write(`${path}/assets/fresh.png`, 'x');
		await cleanupAssets(path, notebook, () => []);
		expect((await list(`${path}/assets`)).map((e) => e.name)).toEqual(['fresh.png']);
	});

	it('works in a connected folder and lists notebooks remembered there', async () => {
		const disk = await (await navigator.storage.getDirectory()).getDirectoryHandle('disk', { create: true });
		await saveConnections([{ id: 'd1', kind: 'folder', name: 'Disk', handle: disk }]);
		const path = `${connectionRoot('d1')}/Trip.note`;
		await mkdir(`${path}/pages`);
		await writeNotebook(path, newNotebook());
		// Not searched: only listed once remembered
		expect(await listNotebooks()).toEqual([]);
		rememberNotebook(path);
		expect((await listNotebooks()).map((n) => [n.path, n.name])).toEqual([[path, 'Trip']]);
		expect((await disk.getDirectoryHandle('Trip.note')).kind).toBe('directory');
		// A connection that is gone: forgotten
		rememberNotebook(`${connectionRoot('gone')}/Old.note`);
		await listNotebooks();
		expect(connectedDocuments('notes')).toEqual([path]);
		await (await navigator.storage.getDirectory()).removeEntry('disk', { recursive: true });
	});
});
