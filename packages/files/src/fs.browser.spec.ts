import { afterEach, describe, expect, it } from 'vitest';
import { exists, list, mkdir, move, readText, remove, watch, write } from './fs.js';

// The shared file system against the real OPFS of headless Chromium

afterEach(async () => {
	for (const entry of await list('/')) await remove(entry.path);
});

describe('fs in the OPFS', () => {
	it('writes, lists and reads files', async () => {
		await mkdir('/Docs');
		await write('/Docs/a.txt', 'hello');
		expect((await list('/Docs')).map((e) => [e.name, e.kind, e.size])).toEqual([['a.txt', 'file', 5]]);
		expect(await readText('/Docs/a.txt')).toBe('hello');
	});

	it('moves and removes', async () => {
		await write('/a.txt', 'x');
		await move('/a.txt', '/b.txt');
		expect(await exists('/a.txt')).toBe(false);
		await remove('/b.txt');
		expect(await list('/')).toEqual([]);
	});

	it('announces changes to watchers', async () => {
		const seen: string[] = [];
		const stop = watch((paths) => seen.push(...paths));
		await write('/c.txt', 'x');
		stop();
		expect(seen).toContain('/c.txt');
	});
});
