import { afterEach, describe, expect, it } from 'vitest';
import { exists, list, mkdir, move, open, readText, remove, trashOf, write } from '../../fs.js';
import { createVault, lockConnection, refresh } from '../connections.svelte.js';
import { listConnections, saveConnections } from '../registry.js';
import { lockVault, vaultMaster } from './keys.js';

// An encrypted folder of My files in the real OPFS, used through fs.ts like every tool does: what lies in the
// browser's storage is only ever the encrypted form, and deleting keeps a way back.

const SECRET = 'Das bleibt unter uns';
const LONG = `${'Langer Name '.repeat(16).trim()}.txt`;

/** Every name and content in the whole OPFS of the origin (files, caches, uploads) */
async function everything(dir?: FileSystemDirectoryHandle): Promise<string> {
	dir ??= await navigator.storage.getDirectory();
	let all = '';
	for await (const [name, handle] of dir.entries()) {
		all += `${name}\n`;
		all += handle.kind === 'file' ? await (await (handle as FileSystemFileHandle).getFile()).text() : await everything(handle as FileSystemDirectoryHandle);
	}
	return all;
}

afterEach(async () => {
	for (const c of await listConnections()) lockVault(c.id);
	await saveConnections([]);
	for (const entry of await list('/')) await remove(entry.path);
});

describe.each(['gocryptfs', 'cryptomator'] as const)('encrypted folder (%s)', (format) => {
	it('keeps only the encrypted form in the storage, moves, and deletes into the trash with a way back', async () => {
		const { root } = await createVault('/Tresor', 'passwort', false, format);
		await mkdir(`${root}/Briefe`);
		await write(`${root}/Briefe/Brief.txt`, SECRET);
		await write(`${root}/${LONG}`, 'lang');
		expect((await list(root)).map((e) => e.name).sort()).toEqual(['Briefe', LONG]);
		expect(await readText(`${root}/Briefe/Brief.txt`)).toBe(SECRET);
		// Read in pieces across the decrypted blocks
		const big = 'x'.repeat(5000) + SECRET;
		await write(`${root}/groß.txt`, big);
		const access = await open(`${root}/groß.txt`);
		expect(access.size).toBe(big.length);
		expect(new TextDecoder().decode(await access.read(5000, 5000 + SECRET.length))).toBe(SECRET);

		const stored = await everything();
		for (const plain of [SECRET, 'Briefe', 'Brief.txt', 'Langer Name', 'groß']) expect(stored).not.toContain(plain);

		await move(`${root}/Briefe/Brief.txt`, `${root}/Brief.txt`);
		await move(`${root}/${LONG}`, `${root}/Briefe/${LONG}`);
		expect(await readText(`${root}/Brief.txt`)).toBe(SECRET);
		expect(await readText(`${root}/Briefe/${LONG}`)).toBe('lang');

		const trash = (await trashOf(`${root}/Brief.txt`))!;
		const ref = await trash.trash(`${root}/Brief.txt`);
		expect(ref.path).toBe('/Brief.txt');
		expect(await exists(`${root}/Brief.txt`)).toBe(false);
		await trash.untrash(ref);
		expect(await readText(`${root}/Brief.txt`)).toBe(SECRET);

		// A folder deleted for good takes everything in it along (Cryptomator: also its folders under `d/`)
		const before = await everything();
		await remove(`${root}/Briefe`);
		expect((await list(root)).map((e) => e.name).sort()).toEqual(['Brief.txt', 'groß.txt']);
		expect((await everything()).length).toBeLessThan(before.length);
		if (format === 'cryptomator') {
			let folders = 0;
			for (const prefix of await list('/Tresor/d')) folders += (await list(prefix.path)).length;
			// Only the top folder's own folder is left
			expect(folders).toBe(1);
		}
	});

	it('opens a remembered key without the password, and forgets it when locked', async () => {
		const { root } = await createVault('/Tresor', 'passwort', true, format);
		await write(`${root}/a.txt`, 'a');
		const [connection] = await listConnections();
		expect(connection.kind === 'vault' && connection.remembered).toBeTruthy();
		// As after a reload: nothing in memory, the sealed key from the device's storage
		lockVault(connection.id);
		expect(await readText(`${root}/a.txt`)).toBe('a');

		await lockConnection(connection.id);
		const [locked] = await listConnections();
		expect(locked.kind === 'vault' && locked.remembered).toBeFalsy();
		await refresh();
		await expect(readText(`${root}/a.txt`)).rejects.toMatchObject({ code: 'locked' });
		await expect(vaultMaster({ id: locked.id, path: '/Tresor', format })).rejects.toMatchObject({ code: 'locked' });
	});
});
