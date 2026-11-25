import { afterEach, describe, expect, it } from 'vitest';
import { removeItems } from '@in-browser/jwl/edits.js';
import { jwlBlob, readJwl } from '@in-browser/jwl/jwl-file.js';
import { sample, template } from '@in-browser/jwl/testing.js';
import { list, read, remove, write } from './fs.js';
import { mergeInto } from './merge.js';

// Merging in the real file system: what a merge keeps is found again by the next one – a playlist item deleted on a
// device that restored the result goes from the file.

afterEach(async () => {
	for (const entry of await list('/')) await remove(entry.path);
});

describe('merging into a file', () => {
	it('lets a deleted playlist item go once the device restored the result', async () => {
		const frame = await template();
		const backup = (deviceName: string, items: string[]) => {
			const { data, files } = sample(['n1'], items);
			return jwlBlob({ kind: 'backup', name: '', deviceName, data, template: frame, files, marker: null });
		};
		const labels = async () => [...(await readJwl(await read('/Kept.jwlibrary'))).data.playlists.values()].map((p) => p.label).sort();
		await write('/Kept.jwlibrary', await backup('tablet', ['One']));
		expect(await mergeInto('/Kept.jwlibrary', await backup('phone', ['One', 'Two', 'Three']))).toBe('merged');
		expect(await labels()).toEqual(['One', 'Three', 'Two']);

		// The phone restores the result, deletes two items and makes its next backup
		const restored = await readJwl(await read('/Kept.jwlibrary'));
		const gone = [...restored.data.playlists].filter(([, p]) => p.label !== 'One').map(([key]) => key);
		const next = await jwlBlob({ kind: 'backup', name: '', deviceName: 'phone', data: removeItems(restored.data, gone), template: restored.database, files: restored.files, marker: restored.data.marker });
		expect(await mergeInto('/Kept.jwlibrary', next)).toBe('merged');
		expect(await labels()).toEqual(['One']);
	});
});
