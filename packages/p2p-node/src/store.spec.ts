import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sign, verify } from '@in-browser/files/p2p/identity.js';
import { emptyState } from '@in-browser/files/p2p/store.js';
import { fileStore } from './store.js';

let dir: string;
beforeEach(async () => (dir = await mkdtemp(join(tmpdir(), 'p2p-node-store-'))));
afterEach(() => rm(dir, { recursive: true, force: true }));

describe('fileStore', () => {
	it('keeps the identity across restarts, readable by the owner only', async () => {
		const first = await (await fileStore(dir)).identity();
		const again = await (await fileStore(dir)).identity();
		expect(again.id).toBe(first.id);
		expect(await verify(first.key, await sign(again, 'hello'), 'hello')).toBe(true);
		if (process.platform !== 'win32') expect((await stat(join(dir, 'identity.json'))).mode & 0o777).toBe(0o600);
	});

	it('saves state and bases', async () => {
		const store = await fileStore(dir);
		expect(await store.load()).toEqual(emptyState());
		await store.save({ ...emptyState(), scope: ['/Private'] });
		expect((await (await fileStore(dir)).load()).scope).toEqual(['/Private']);
		await store.saveBase('ABC/1', new Map([['/a', { local: { kind: 'file', size: 1, modified: 2 }, disk: { kind: 'file', size: 1, modified: 3 } }]]));
		expect([...(await store.loadBase('ABC/1')).keys()]).toEqual(['/a']);
		await store.clearBases(['ABC/1']);
		expect((await store.loadBase('ABC/1')).size).toBe(0);
	});

	it('refuses a state of a newer version and keeps it before replacing it', async () => {
		await writeFile(join(dir, 'state.json'), JSON.stringify({ v: 2, future: true }));
		const store = await fileStore(dir);
		// A state written by a newer version is never read as if it were ours
		await expect(store.load()).rejects.toThrow('newer version');
		await store.save(emptyState());
		expect(JSON.parse(await readFile(join(dir, 'state.v2.json'), 'utf8'))).toEqual({ v: 2, future: true });
		expect(JSON.parse(await readFile(join(dir, 'state.json'), 'utf8')).v).toBe(1);
	});
});
