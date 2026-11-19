import type { RandomAccess } from './source.js';

// Reading a remote file in blocks: only the blocks a read touches are fetched, kept in a small LRU cache, and the next
// ones are fetched ahead while reading goes forward. Local files don't need this (`File.slice` is cheap).

export const BLOCK = 1024 * 1024;

export interface BlockOptions {
	size: number;
	type: string;
	modified: number;
	/** Fetches bytes `start`–`end` (a whole block, the last one shorter) */
	fetch: (start: number, end: number) => Promise<Uint8Array>;
	blockSize?: number;
	/** Blocks kept (default 64 = 64 MiB) */
	maxBlocks?: number;
	/** Blocks fetched ahead after reading forward (default 2) */
	ahead?: number;
}

export function blockReader({ size, type, modified, fetch, blockSize = BLOCK, maxBlocks = 64, ahead = 2 }: BlockOptions): RandomAccess {
	const blocks = new Map<number, Promise<Uint8Array>>();
	let last = -1;

	function block(index: number): Promise<Uint8Array> {
		let promise = blocks.get(index);
		if (promise) {
			// Most recently used last
			blocks.delete(index);
			blocks.set(index, promise);
			return promise;
		}
		const start = index * blockSize;
		promise = fetch(start, Math.min(size, start + blockSize));
		// A failed block is fetched again next time
		promise.catch(() => blocks.get(index) === promise && blocks.delete(index));
		blocks.set(index, promise);
		while (blocks.size > maxBlocks) blocks.delete(blocks.keys().next().value!);
		return promise;
	}

	return {
		size,
		type,
		modified,
		async read(start, end) {
			end = Math.min(end, size);
			if (end <= start) return new Uint8Array(0);
			const first = Math.floor(start / blockSize);
			const lastIndex = Math.floor((end - 1) / blockSize);
			const sequential = first === last || first === last + 1;
			last = lastIndex;
			if (sequential) {
				for (let i = lastIndex + 1; i <= lastIndex + ahead && i * blockSize < size; i++) void block(i).catch(() => {});
			}
			const parts = await Promise.all(Array.from({ length: lastIndex - first + 1 }, (_, i) => block(first + i)));
			const out = new Uint8Array(end - start);
			let offset = 0;
			for (let i = 0; i < parts.length; i++) {
				const blockStart = (first + i) * blockSize;
				const from = Math.max(start, blockStart) - blockStart;
				const to = Math.min(end, blockStart + parts[i].length) - blockStart;
				out.set(parts[i].subarray(from, to), offset);
				offset += to - from;
			}
			return out;
		}
	};
}

/** A local file read in pieces */
export function fileAccess(file: File): RandomAccess {
	return {
		size: file.size,
		type: file.type,
		modified: file.lastModified,
		read: async (start, end) => new Uint8Array(await file.slice(start, end).arrayBuffer())
	};
}
