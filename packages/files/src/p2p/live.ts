import { FilesError, type Entry, type FilesErrorCode } from '../entry.js';
import { basename, join, normalize } from '../path.js';
import { blockReader } from '../sources/blocks.js';
import type { RandomAccess, Source, SourceCaps } from '../sources/source.js';
import { receive } from '../sync/apply.js';
import type { FileState } from '../sync/plan.js';
import type { Tree } from '../sync/tree.js';
import type { TrashRef } from '../trash.js';
import { RemoteError, type Handler, type Json, type Rpc } from './rpc.js';

// Live access to the files of another device: one side answers requests on its tree (`serveLive`), the other uses
// them as a source of the shared file system (`liveSource`). Used for folders a device doesn't sync (opened from a
// device that has them) and for guest shares (one folder for a browser outside the group). Nothing here is synced:
// what is written lands on the answering device, whose own sync passes it on.
//
// Data always travels in pieces: reads ask for a byte range (`live.read`), writes go through a session
// (`live.open`, `live.chunk` at a position, `live.close` puts the file in place atomically, `live.abort`).

/** Upper bound of one piece (reads ask for blocks, writes are cut to this) */
export const PIECE = 1024 * 1024;
/** A write session without a piece for this long is dropped */
const SESSION_IDLE = 10 * 60 * 1000;

type WireEntry = [name: string, kind: 'f' | 'd', size: number, modified: number];

/** Errors of the shared file system travel as their code */
function wireError(e: unknown): never {
	if (e instanceof FilesError) throw new Error(`files:${e.code}`);
	throw e;
}

function liftError(e: unknown, path: string): never {
	if (e instanceof RemoteError && e.message.startsWith('files:')) throw new FilesError(e.message.slice(6) as FilesErrorCode, path);
	throw e;
}

const isTemp = (name: string) => name.startsWith('.p2p-') && name.endsWith('.part');

export interface LiveServerOptions {
	tree: Tree;
	/**
	 * Where a requested path lies in `tree`, `null` if the asker may not reach it (a folder this device doesn't sync,
	 * outside a guest's share, hidden internals)
	 */
	resolve: (path: string) => string | null;
	/** Only reading is allowed (a guest share for viewing) */
	readOnly?: boolean | (() => boolean);
	trash?: (path: string) => Promise<TrashRef>;
	untrash?: (ref: TrashRef) => Promise<string>;
	/** A request was answered (e.g. to keep a share alive) */
	onRequest?: () => void;
}

interface Session {
	path: string;
	expect: FileState | null;
	writer: WritableStreamDefaultWriter<FileSystemWriteChunkType>;
	done: Promise<unknown>;
	finish: (ok: boolean) => void;
	timer: ReturnType<typeof setTimeout>;
}

/** Answers live requests on `tree`; returns the cleanup for when the connection ends (open writes are dropped) */
export function serveLive(handle: (method: string, handler: Handler) => void, options: LiveServerOptions): () => void {
	const { tree } = options;
	const sessions = new Map<string, Session>();
	const readOnly = () => (typeof options.readOnly === 'function' ? options.readOnly() : !!options.readOnly);

	function at(path: unknown): string {
		const asked = normalize(String(path ?? '/'));
		const real = options.resolve(asked);
		if (real === null || basename(real).startsWith('.p2p-')) throw new Error('files:notFound');
		return real;
	}
	function writing(path: unknown): string {
		if (readOnly()) throw new Error('files:readOnly');
		return at(path);
	}
	const on = (method: string, handler: Handler) =>
		handle(method, async (params, upload) => {
			options.onRequest?.();
			try {
				return await handler(params, upload);
			} catch (e) {
				wireError(e);
			}
		});

	on('live.list', async (params) => {
		const asked = normalize(String((params as { path: string }).path ?? '/'));
		const path = at(asked);
		const out: WireEntry[] = [];
		for (const name of await tree.names(path)) {
			// Only what the asker may reach (e.g. no hidden entries for a guest)
			if (isTemp(name) || options.resolve(join(asked, name)) === null) continue;
			const state = await tree.stat(join(path, name));
			if (state) out.push([name, state.kind === 'file' ? 'f' : 'd', state.size, state.modified]);
		}
		return { value: out as unknown as Json };
	});
	on('live.stat', async (params) => {
		const state = await tree.stat(at((params as { path: string }).path));
		return { value: state && ([state.kind === 'file' ? 'f' : 'd', state.size, state.modified] as Json) };
	});
	on('live.read', async (params) => {
		const { path, start, end } = params as { path: string; start?: number; end?: number };
		const file = await tree.read(at(path));
		const part = start === undefined ? file : file.slice(start, end);
		return { value: { size: file.size, modified: file.lastModified, type: file.type }, download: part.stream() };
	});
	on('live.mkdir', async (params) => void (await tree.mkdir(writing((params as { path: string }).path))));
	on('live.remove', async (params) => void (await tree.remove(writing((params as { path: string }).path))));
	on('live.move', async (params) => {
		const { from, to } = params as { from: string; to: string };
		await tree.move(writing(from), writing(to));
	});
	on('live.trash', async (params) => {
		const path = writing((params as { path: string }).path);
		if (!options.trash) throw new Error('files:readOnly');
		return { value: (await options.trash(path)) as unknown as Json };
	});
	on('live.untrash', async (params) => {
		const ref = params as unknown as TrashRef;
		writing(ref.path);
		if (!options.untrash) throw new Error('files:readOnly');
		await options.untrash({ ...ref, path: at(ref.path) });
	});

	// --- Writing in pieces ---
	const drop = (id: string, ok: boolean) => {
		const session = sessions.get(id);
		if (!session) return;
		sessions.delete(id);
		clearTimeout(session.timer);
		session.finish(ok);
	};
	const touch = (id: string, session: Session) => {
		clearTimeout(session.timer);
		session.timer = setTimeout(() => drop(id, false), SESSION_IDLE);
	};
	on('live.open', async (params) => {
		const path = writing((params as { path: string }).path);
		const id = crypto.randomUUID();
		const expect = await tree.stat(path);
		let ready!: (writer: WritableStreamDefaultWriter<FileSystemWriteChunkType>) => void;
		const writerReady = new Promise<WritableStreamDefaultWriter<FileSystemWriteChunkType>>((r) => (ready = r));
		let finish!: (ok: boolean) => void;
		const finished = new Promise<boolean>((r) => (finish = r));
		// `receive` writes next to the file and puts it in place only when complete (and still as it was)
		const done = receive(tree, path, async (target) => {
			const writer = (target as unknown as WritableStream<FileSystemWriteChunkType>).getWriter();
			ready(writer);
			if (!(await finished)) {
				// Frees the temporary file, so `receive` can remove it
				await writer.abort().catch(() => {});
				throw new Error('Aborted');
			}
			await writer.close();
		}, { expect });
		done.catch(() => {});
		const session: Session = { path, expect, writer: await writerReady, done, finish, timer: setTimeout(() => {}, 0) };
		touch(id, session);
		sessions.set(id, session);
		return { value: id };
	});
	on('live.chunk', async (params, upload) => {
		const { id, position } = params as { id: string; position: number };
		const session = sessions.get(id);
		if (!session || !upload) throw new Error('files:notFound');
		touch(id, session);
		const data = new Uint8Array(await new Response(upload).arrayBuffer());
		await session.writer.write({ type: 'write', position, data });
	});
	on('live.close', async (params) => {
		const id = params as string;
		const session = sessions.get(id);
		if (!session) throw new Error('files:notFound');
		drop(id, true);
		const result = (await session.done) as { stale?: true };
		// Changed elsewhere meanwhile: nothing replaced
		if (result.stale) throw new Error('files:exists');
	});
	on('live.abort', async (params) => drop(params as string, false));

	return () => {
		for (const id of [...sessions.keys()]) drop(id, false);
	};
}

// --- The asking side ---

/** One request to the answering side; `upload` goes along as body, read requests come back with `bytes` */
export type LiveCall = (method: string, params: Json, upload?: Uint8Array) => Promise<{ value: Json; bytes?: Uint8Array }>;

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

function concat(parts: Uint8Array[]): Uint8Array {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
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

	async function open(path: string): Promise<RandomAccess> {
		const stat = (await ask('live.stat', { path }, path)).value as WireEntry extends [string, ...infer R] ? R | null : never;
		if (!stat) throw new FilesError('notFound', path);
		if (stat[0] !== 'f') throw new FilesError('notFound', path);
		return blockReader({
			size: stat[1],
			type: '',
			modified: stat[2],
			blockSize: PIECE,
			fetch: async (start, end) => (await ask('live.read', { path, start, end }, path)).bytes ?? new Uint8Array(0)
		});
	}

	return {
		caps,
		list: async (path) => ((await ask('live.list', { path }, path)).value as unknown as WireEntry[]).map((e) => toEntry(path, e)),
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
