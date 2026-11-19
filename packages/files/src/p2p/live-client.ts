import { FilesError, type Entry } from '../entry.js';
import { basename, join, nameProblem } from '../path.js';
import { blockReader } from '../sources/blocks.js';
import type { RandomAccess, Source, SourceCaps } from '../sources/source.js';
import type { TrashRef } from '../trash.js';
import { concat } from './bytes.js';
import { liftError, PIECE, type LiveCall, type WireEntry } from './live.js';
import type { Json, Rpc } from './rpc.js';

// The asking side of live access (see `live.ts`): the answering device as a source of the shared file system.

/** `LiveCall` over a connection */
export function rpcLiveCall(rpc: Pick<Rpc, 'call'>): LiveCall {
	return async (method, params, upload) => {
		const body = upload && new Blob([upload as BlobPart]).stream();
		if (method !== 'live.read') return { value: await rpc.call(method, params, body ? { upload: body } : {}) };
		const parts: Uint8Array[] = [];
		const value = await rpc.call(method, params, { download: new WritableStream({ write: (chunk) => void parts.push(chunk) }) });
		return { value, bytes: concat(parts) };
	};
}

/** Answering side as a source of the shared file system (paths as the answering side knows them) */
export function liveSource(call: LiveCall, caps: SourceCaps): Source {
	const ask = async (method: string, params: Json, path: string, upload?: Uint8Array) => {
		try {
			return await call(method, params, upload);
		} catch (e) {
			liftError(e, path);
		}
	};
	const toEntry = (path: string, [name, kind, size, modified]: WireEntry): Entry =>
		kind === 'f' ? { name, path: join(path, name), kind: 'file', size, modified } : { name, path: join(path, name), kind: 'directory' };
	const count = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0);
	/**
	 * Only entries that stay inside the listed folder: the other side's names are not trusted (`..` or `a/b` would
	 * point into this browser's own files)
	 */
	const valid = (wire: unknown): wire is WireEntry =>
		Array.isArray(wire) && typeof wire[0] === 'string' && !nameProblem(wire[0]) && (wire[1] === 'f' || wire[1] === 'd');

	async function open(path: string): Promise<RandomAccess> {
		const stat = (await ask('live.stat', { path }, path)).value as WireEntry extends [string, ...infer R] ? R | null : never;
		if (!stat) throw new FilesError('notFound', path);
		if (stat[0] !== 'f') throw new FilesError('notFound', path);
		return blockReader({
			size: count(stat[1]),
			type: '',
			modified: count(stat[2]),
			blockSize: PIECE,
			fetch: async (start, end) => (await ask('live.read', { path, start, end }, path)).bytes ?? new Uint8Array(0)
		});
	}

	return {
		caps,
		async list(path) {
			const wire = (await ask('live.list', { path }, path)).value;
			if (!Array.isArray(wire)) return [];
			return wire.filter(valid).map(([name, kind, size, modified]) => toEntry(path, [name, kind, count(size), count(modified)]));
		},
		async stat(path) {
			const state = (await ask('live.stat', { path }, path)).value as [string, number, number] | null;
			if (!state) return null;
			const name = basename(path);
			return state[0] === 'f'
				? { name, path, kind: 'file', size: state[1], modified: state[2] }
				: { name, path, kind: 'directory' };
		},
		open,
		/** The whole file, fetched piece by piece (a lost piece is fetched again) */
		async read(path) {
			const access = await open(path);
			const parts: BlobPart[] = [];
			for (let start = 0; start < access.size; start += PIECE) {
				parts.push((await access.read(start, Math.min(access.size, start + PIECE))) as BlobPart);
			}
			return new File(parts, basename(path), { lastModified: access.modified });
		},
		async writable(path) {
			const id = (await ask('live.open', { path }, path)).value as string;
			let position = 0;
			let buffer: Uint8Array[] = [];
			let buffered = 0;
			let bufferAt = 0;
			const send = async (at: number, data: Uint8Array) => {
				for (let offset = 0; offset < data.length; offset += PIECE) {
					await ask('live.chunk', { id, position: at + offset }, path, data.subarray(offset, offset + PIECE));
				}
			};
			const flush = async () => {
				if (!buffered) return;
				const data = concat(buffer);
				buffer = [];
				buffered = 0;
				await send(bufferAt, data);
			};
			const bytes = async (data: unknown): Promise<Uint8Array> => {
				if (data instanceof Uint8Array) return data;
				if (data instanceof ArrayBuffer) return new Uint8Array(data);
				if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
				if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
				return new TextEncoder().encode(String(data));
			};
			return new WritableStream<FileSystemWriteChunkType>({
				async write(chunk) {
					let data: Uint8Array;
					let at = position;
					if (chunk && typeof chunk === 'object' && 'type' in chunk && !(chunk instanceof Blob)) {
						const c = chunk as WriteParams;
						if (c.type === 'seek') {
							await flush();
							position = c.position ?? position;
							return;
						}
						if (c.type === 'truncate') throw new FilesError('readOnly', path);
						data = await bytes(c.data);
						if (c.position !== undefined && c.position !== null) at = c.position;
					} else data = await bytes(chunk);
					// Pieces in a row are collected, anything else goes on its own
					if (at !== bufferAt + buffered) {
						await flush();
						bufferAt = at;
					}
					if (!buffered) bufferAt = at;
					buffer.push(data.slice());
					buffered += data.length;
					position = at + data.length;
					if (buffered >= PIECE) await flush();
				},
				async close() {
					await flush();
					await ask('live.close', id, path);
				},
				async abort() {
					await ask('live.abort', id, path).catch(() => {});
				}
			});
		},
		mkdir: async (path) => void (await ask('live.mkdir', { path }, path)),
		remove: async (path) => void (await ask('live.remove', { path }, path)),
		move: async (from, to) => void (await ask('live.move', { from, to }, from)),
		trash: async (path) => (await ask('live.trash', { path }, path)).value as unknown as TrashRef,
		untrash: async (ref) => void (await ask('live.untrash', ref as unknown as Json, ref.path))
	};
}
