import { afterEach, describe, expect, it } from 'vitest';
import { exists, list, readText, remove, write } from './fs.js';
import { emptyTrash, listTrash, moveToTrash, restoreFromTrash, setTrashRetention, trashRetention } from './trash-browser.js';
import { SETTINGS_PATH, TRASH_ROOT } from './trash.js';

// The trash in the real OPFS: what the user deletes, restored where it was

afterEach(async () => {
	for (const entry of await list('/')) await remove(entry.path);
});

describe('trash', () => {
	it('keeps deleted files and folders under their original path and restores them – under a free name if taken', async () => {
		await write('/Docs/notes.txt', 'old');
		await write('/Docs/Project/a.md', 'a');
		await moveToTrash(['/Docs/notes.txt', '/Docs/Project']);
		expect(await exists('/Docs/notes.txt')).toBe(false);
		expect(await exists('/Docs/Project')).toBe(false);
		const items = await listTrash();
		expect(items.map((i) => [i.path, i.kind, i.size]).sort()).toEqual([
			['/Docs/Project', 'directory', 1],
			['/Docs/notes.txt', 'file', 3]
		]);
		// The trash is an ordinary hidden folder of the file system, so both syncs carry it
		expect(await exists(`${TRASH_ROOT}/${items[0].entry}/.trashinfo.json`)).toBe(true);

		await write('/Docs/notes.txt', 'new');
		const restored = await Promise.all(items.map((item) => restoreFromTrash(item)));
		expect(restored.sort()).toEqual(['/Docs/Project', '/Docs/notes (2).txt']);
		expect(await readText('/Docs/notes (2).txt')).toBe('old');
		expect(await readText('/Docs/Project/a.md')).toBe('a');
		expect(await listTrash()).toEqual([]);
	});

	it('leaves out entries that are still arriving, and empties for good', async () => {
		await write(`${TRASH_ROOT}/20261118-102233-123-abcd/.trashinfo.json`, JSON.stringify({ path: '/x.txt', kind: 'file', deleted: 1 }));
		expect(await listTrash()).toEqual([]);
		await write('/y.txt', 'y');
		await moveToTrash(['/y.txt']);
		expect(await listTrash()).toHaveLength(1);
		await emptyTrash();
		expect(await exists(TRASH_ROOT)).toBe(false);
	});

	it('stores the retention in the synced settings, keeping other settings', async () => {
		expect(await trashRetention()).toBe(30);
		await write(SETTINGS_PATH, JSON.stringify({ other: 1 }));
		await setTrashRetention(null);
		expect(await trashRetention()).toBeNull();
		expect(JSON.parse(await readText(SETTINGS_PATH))).toEqual({ other: 1, trashDays: null });
	});
});
