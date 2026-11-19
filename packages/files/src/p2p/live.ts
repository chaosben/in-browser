import { FilesError, type Entry, type FilesErrorCode } from '../entry.js';
import { basename, join, nameProblem, normalize } from '../path.js';
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
/** Open write sessions per connection (more are refused: they hold files and memory on the answering side) */
const MAX_SESSIONS = 16;

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
	/**
	 * The asker is a guest: deleting always goes into the trash, the root it reaches (the shared folder) can't be
	 * deleted or moved, and only its own deletions can be undone
	 */
	guest?: boolean;
}

interface Session {
	path: string;
	/** End of what was written so far (pieces may not leave gaps) */
	end: number;
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
	/** Trash entries this connection made (a guest may only undo those) */
	const trashed = new Set<string>();
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
	/** A path whose entry goes away (deleted, moved): for a guest never the root it reaches */
	function changing(path: unknown): string {
		if (options.guest && normalize(String(path ?? '/')) === '/') throw new Error('files:root');
		return writing(path);
	}
	async function toTrash(path: unknown): Promise<TrashRef> {
		const real = changing(path);
		if (!options.trash) throw new Error('files:readOnly');
		const ref = await options.trash(real);
		trashed.add(ref.entry);
		// The asker gets its own path back (a guest never learns where the shared folder lies)
		return { entry: ref.entry, path: normalize(String(path)) };
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
		const { path, start, end } = params as { path: string; start?: unknown; end?: unknown };
		const file = await tree.read(at(path));
		const part = start === undefined ? file : file.slice(offset(start), end === undefined ? undefined : offset(end));
		return { value: { size: file.size, modified: file.lastModified, type: file.type }, download: part.stream() };
	});
	on('live.mkdir', async (params) => void (await tree.mkdir(writing((params as { path: string }).path))));
	on('live.remove', async (params) => {
		const path = (params as { path: string }).path;
		// A guest never deletes for good
		if (options.guest) await toTrash(path);
		else await tree.remove(changing(path));
	});
	on('live.move', async (params) => {
		const { from, to } = params as { from: string; to: string };
		await tree.move(changing(from), writing(to));
	});
	on('live.trash', async (params) => ({ value: (await toTrash((params as { path: string }).path)) as unknown as Json }));
	on('live.untrash', async (params) => {
		const ref = (params ?? {}) as unknown as Partial<TrashRef>;
		if (typeof ref.entry !== 'string' || typeof ref.path !== 'string') throw new Error('files:notFound');
		const path = writing(ref.path);
		if (!options.untrash) throw new Error('files:readOnly');
		if (options.guest && !trashed.has(ref.entry)) throw new Error('files:notFound');
		await options.untrash({ entry: ref.entry, path });
		trashed.delete(ref.entry);
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
		if (sessions.size >= MAX_SESSIONS) throw new Error('Too many open writes');
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
		const session: Session = { path, end: 0, expect, writer: await writerReady, done, finish, timer: setTimeout(() => {}, 0) };
		touch(id, session);
		sessions.set(id, session);
		return { value: id };
	});
	on('live.chunk', async (params, upload) => {
		const { id, position } = params as { id: string; position: unknown };
		const session = sessions.get(id);
		if (!session || !upload) throw new Error('files:notFound');
		touch(id, session);
		// No gaps (a far position would make a huge file) and no piece larger than the asking side sends
		const at = offset(position);
		if (at > session.end) throw new Error('Gap in a write');
		const data = await limited(upload, PIECE);
		await session.writer.write({ type: 'write', position: at, data: data as Uint8Array<ArrayBuffer> });
		session.end = Math.max(session.end, at + data.length);
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

/** A byte offset from the other side: a whole number ≥ 0 */
function offset(value: unknown): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Bad offset');
	return value;
}

/** Reads an upload completely, refusing more than `max` bytes */
async function limited(upload: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array> {
	const reader = upload.getReader();
	const parts: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) return concat(parts);
		size += value.length;
		if (size > max) throw new Error('Piece too large');
		parts.push(value);
	}
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
