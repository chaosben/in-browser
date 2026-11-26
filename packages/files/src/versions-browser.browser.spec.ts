import { afterEach, describe, expect, it } from 'vitest';
import { list, readText, remove, write } from './fs.js';
import { folderTree, writeText } from './p2p/testing.js';
import { runSync } from './sync/apply.js';
import { opfsTree } from './sync/opfs-tree.js';
import type { Base } from './sync/plan.js';
import { treeSide } from './sync/tree-ops.js';
import { listTrash, restoreFromTrash } from './trash-browser.js';
import { listAllVersions, removeVersions, restoreVersion, versionsOf } from './versions-browser.js';

// What a sync replaces or deletes in My files is kept as an earlier version of this device, restorable byte for byte

afterEach(async () => {
	for (const entry of await list('/')) await remove(entry.path);
	await removeVersions(await listAllVersions());
});

describe('earlier versions', () => {
	it('keeps what a sync replaced or deleted here, and restores it', async () => {
		const disk = await folderTree('versions-disk');
		let base: Base = new Map();
		const sync = async () =>
			runSync(opfsTree, treeSide(disk), await opfsTree.scan(), await disk.scan(), {
				base,
				saveBase: async (next) => void (base = next),
				conflictLabel: (side) => `conflict ${side}`,
				hold: []
			});
		const old = new Uint8Array([0, 255, 1, 254, 2]);
		await write('/Docs/a.bin', old);
		await write('/Docs/Old/b.md', 'b');
		await write('/Docs/keep.md', 'keep');
		await sync();

		// Changed and deleted in the folder on disk: the browser's versions go into the earlier versions
		await writeText(disk, '/Docs/a.bin', 'new');
		await disk.remove('/Docs/Old/b.md');
		await disk.remove('/Docs/Old');
		await sync();
		expect(await readText('/Docs/a.bin')).toBe('new');

		const [replaced] = await versionsOf('/Docs/a.bin');
		expect(replaced.reason).toBe('replaced');
		const copy = await restoreVersion(replaced, 'earlier version');
		expect(copy).toBe('/Docs/a (earlier version).bin');
		expect(new Uint8Array(await (await opfsTree.read(copy)).arrayBuffer())).toEqual(old);

		// The deleted folder is one entry of the trash, only on this device
		const local = (await listTrash()).filter((item) => item.versions);
		expect(local.map((item) => [item.path, item.kind])).toEqual([['/Docs/Old', 'directory']]);
		await restoreFromTrash(local[0]);
		expect(await readText('/Docs/Old/b.md')).toBe('b');
		expect((await listTrash()).filter((item) => item.versions)).toEqual([]);
		await disk.clear();
	});
});
