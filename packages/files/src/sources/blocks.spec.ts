import { describe, expect, it } from 'vitest';
import { blockReader } from './blocks';

function remote(size: number, blockSize = 4) {
	const data = Uint8Array.from({ length: size }, (_, i) => i % 251);
	const fetched: number[] = [];
	const reader = blockReader({
		size,
		type: '',
		modified: 0,
		blockSize,
		maxBlocks: 3,
		ahead: 1,
		fetch: async (start, end) => {
			fetched.push(start);
			return data.slice(start, end);
		}
	});
	return { data, fetched, reader };
}

describe('reading in blocks', () => {
	it('returns exactly the asked bytes, also across blocks and at the end', async () => {
		const { data, reader } = remote(10);
		expect(await reader.read(0, 3)).toEqual(data.slice(0, 3));
		expect(await reader.read(3, 9)).toEqual(data.slice(3, 9));
		expect(await reader.read(8, 20)).toEqual(data.slice(8, 10));
		expect(await reader.read(5, 5)).toEqual(new Uint8Array(0));
	});

	it('fetches a failed block again', async () => {
		let fail = true;
		const reader = blockReader({
			size: 8,
			type: '',
			modified: 0,
			blockSize: 4,
			fetch: async (start, end) => {
				if (fail) throw new Error('gone');
				return new Uint8Array(end - start);
			}
		});
		await expect(reader.read(0, 2)).rejects.toThrow('gone');
		fail = false;
		expect((await reader.read(0, 2)).length).toBe(2);
	});
});
