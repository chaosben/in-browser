import { basename, join, normalize } from '../path.js';
import { receive } from '../sync/tree-ops.js';
import type { FileState } from '../sync/plan.js';
import type { Tree } from '../sync/tree.js';
import type { TrashRef } from '../trash.js';
import { concat } from './bytes.js';
import { PIECE, wireError, type WireEntry } from './live.js';
import type { Handler, Json } from './rpc.js';

// The answering side of live access (see `live.ts`): requests on this device's tree, limited to what the asker may reach.

/** Open write sessions per connection (more are refused: they hold files and memory on the answering side) */
const MAX_SESSIONS = 16;
/** A write session without a piece for this long is dropped */
const SESSION_IDLE = 10 * 60 * 1000;
const isTemp = (name: string) => name.startsWith('.p2p-') && name.endsWith('.part');

export interface LiveServerOptions {
	tree: Tree;
	/**
	 * Where a requested path lies in `tree`, `null` if the asker may not reach it (a folder this device doesn't sync,
	 * hidden internals)
	 */
	resolve: (path: string) => string | null;
	/** Only reading is allowed */
	readOnly?: boolean | (() => boolean);
	trash?: (path: string) => Promise<TrashRef>;
	untrash?: (ref: TrashRef) => Promise<string>;
	/** A request was answered (e.g. to keep a share alive) */
	onRequest?: () => void;
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
	/** A path whose entry goes away (deleted, moved): never the root */
	function changing(path: unknown): string {
		if (normalize(String(path ?? '/')) === '/') throw new Error('files:root');
		return writing(path);
	}
	async function toTrash(path: unknown): Promise<TrashRef> {
		const real = changing(path);
		if (!options.trash) throw new Error('files:readOnly');
		const ref = await options.trash(real);
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
			// Only what the asker may reach
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
		await tree.remove(changing((params as { path: string }).path));
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
		await options.untrash({ entry: ref.entry, path });
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
