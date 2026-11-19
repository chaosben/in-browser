import { toHex } from '../p2p/bytes.js';
import { basename, join, nameKey, nameProblem, parent, segments, stem, uniqueName } from '../path.js';
import type { FileState } from './plan.js';
import type { LogFn } from './log.js';
import { stateOf } from './scan.js';
import { unchanged, type Tree } from './tree.js';

// The single steps of a sync on a tree, with the rules that keep the user's data (see `apply.ts`): writing a file via a
// hidden temporary file, deleting and renaming only what is still as planned, conflict copies, content hashes – and
// a tree as the other side of a sync (`treeSide`). Also used by live requests (`p2p/live.ts`).

/** The other side of a sync: a tree here (`treeSide`) or another device (`rpcSide` in `p2p/session.ts`) */
export interface Other {
	hash(paths: string[]): Promise<Record<string, string | null>>;
	/** Writes the file into `target`; returns its state */
	get(path: string, target: WritableStream<Uint8Array>): Promise<FileState>;
	/** `expect`: the state the plan saw there (`null`: none); `keep`: label for a conflict copy of the version there */
	put(path: string, upload: ReadableStream<Uint8Array>, options: { keep?: string; expect: FileState | null }): Promise<PutResult>;
	mkdir(path: string): Promise<void>;
	remove(path: string, kind: FileState['kind'], expect: FileState | null): Promise<Outcome>;
	rename(from: string, to: string, expect: FileState | null): Promise<Outcome>;
}

/** `stale`: changed since the plan, left alone; `kept`: a folder that isn't empty, left alone */
export type Outcome = 'done' | 'stale' | 'kept';
export type PutResult = { state: FileState; copy: string | null } | { stale: true };

/** Files are hashed in slices of this size (WebCrypto can only hash a whole buffer, not a stream) */
const HASH_SLICE = 64 * 1024 * 1024;

/**
 * Content fingerprint of a file of any size: SHA-256 of the file, or for large files SHA-256 over the SHA-256 of each
 * slice (both sides compute it the same way, so equal fingerprints mean equal content)
 */
export async function hashFile(file: File): Promise<string> {
	if (file.size <= HASH_SLICE) return toHex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
	const digests: Uint8Array[] = [];
	for (let offset = 0; offset < file.size; offset += HASH_SLICE) {
		digests.push(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.slice(offset, offset + HASH_SLICE).arrayBuffer())));
	}
	const all = new Uint8Array(digests.length * 32);
	digests.forEach((digest, i) => all.set(digest, i * 32));
	return `s${toHex(await crypto.subtle.digest('SHA-256', all))}`;
}

/** `/a/Notes.md` → `/a/Notes (conflict Laptop).md`, numbered if taken */
export async function conflictPath(tree: Tree, path: string, label: string): Promise<string> {
	const name = basename(path);
	const base = stem(name);
	const candidate = `${base} (${label})${name.slice(base.length)}`;
	return join(parent(path), uniqueName(candidate, await tree.names(parent(path))));
}

export const validName = (path: string) => segments(path).every((name) => !nameProblem(name));

/** Deletes a file that may still be open for writing for a moment (aborted transfer) */
async function removeSoon(tree: Tree, path: string) {
	for (let attempt = 0; attempt < 20; attempt++) {
		try {
			await tree.remove(path);
			if (!(await tree.stat(path))) return;
		} catch {
			// Still locked by the aborted write
		}
		await new Promise((r) => setTimeout(r, 100));
	}
}

/**
 * Receives a file atomically: into a hidden temporary file next to it first (ignored by every scan), and only when
 * it is complete into place – a connection lost halfway leaves nothing behind. Then, only if the file there is still
 * as `expect`ed: the existing version becomes a conflict copy (`keep`: its label) or is replaced.
 */
export async function receive<T>(
	tree: Tree,
	path: string,
	fill: (target: WritableStream<Uint8Array>) => Promise<T>,
	{ keep, expect, onWrite = () => {} }: { keep?: string; expect: FileState | null; onWrite?: (path: string) => void }
): Promise<{ result: T; copy?: string } | { stale: true }> {
	const temp = join(parent(path), `.p2p-${crypto.randomUUID()}.part`);
	onWrite(temp);
	let result: T;
	try {
		result = await fill(await tree.write(temp));
	} catch (e) {
		await removeSoon(tree, temp);
		throw e;
	}
	try {
		const current = await tree.stat(path);
		if (!unchanged(current, expect)) {
			await removeSoon(tree, temp);
			return { stale: true };
		}
		if (current && current.kind !== 'file') throw new Error(`Not a file: ${path}`);
		// Another entry differing only in case would block the move – find out before the old version is moved away
		const key = nameKey(basename(path));
		const clash = (await tree.names(parent(path))).find((name) => name !== basename(path) && name !== basename(temp) && nameKey(name) === key);
		if (clash) throw new Error(`Name differs only in case from “${clash}”: ${path}`);
		let copy: string | undefined;
		onWrite(path);
		if (current) {
			if (keep) {
				copy = await conflictPath(tree, path, keep);
				onWrite(copy);
				await tree.move(path, copy);
			} else await tree.remove(path);
		}
		await tree.move(temp, path);
		return { result, copy };
	} catch (e) {
		await removeSoon(tree, temp);
		throw e;
	}
}

/** Deletes what the plan saw: a file only while unchanged, a folder only while empty */
export async function discard(tree: Tree, path: string, kind: FileState['kind'], expect: FileState | null, onWrite: (path: string) => void = () => {}): Promise<Outcome> {
	if (kind === 'directory') {
		if ((await tree.names(path)).length) return 'kept';
		onWrite(path);
		await tree.remove(path);
		return 'done';
	}
	const current = await tree.stat(path);
	if (!current) return 'done';
	if (!unchanged(current, expect)) return 'stale';
	onWrite(path);
	await tree.remove(path);
	return 'done';
}

/** Renames (upper/lower case only, see `caseRenames`) while the entry is as the plan saw it */
export async function renameIn(tree: Tree, from: string, to: string, expect: FileState | null, onWrite: (path: string) => void = () => {}): Promise<Outcome> {
	if (!unchanged(await tree.stat(from), expect)) return 'stale';
	onWrite(from);
	onWrite(to);
	await tree.move(from, to);
	return 'done';
}

/**
 * Answer of `get` when the file is no longer there (removed since the plan, e.g. the trash was emptied meanwhile): the
 * step is skipped like any other change since the plan, the next run plans again. Travels as the error message.
 */
export const GONE = 'sync:gone';

/** The other side no longer had the file (`GONE`, also from another device) */
export const isGone = (e: unknown) => e instanceof Error && e.message === GONE;

/** A tree as the other side (the folder on disk of the folder sync; what a device answers in `serve`) */
export function treeSide(tree: Tree, { onWrite = () => {}, log }: { onWrite?: (path: string) => void; log?: LogFn } = {}): Other {
	return {
		async hash(paths) {
			const out: Record<string, string | null> = {};
			for (const path of paths) out[path] = await hashFile(await tree.read(path)).catch(() => null);
			return out;
		},
		async get(path, target) {
			if (!(await tree.stat(path))) {
				await target.abort(GONE).catch(() => {});
				throw new Error(GONE);
			}
			const file = await tree.read(path);
			await file.stream().pipeTo(target);
			return stateOf(file);
		},
		async put(path, upload, { keep, expect }) {
			if (!validName(path)) {
				await upload.cancel().catch(() => {});
				throw new Error(`Invalid name: ${path}`);
			}
			const received = await receive(tree, path, (target) => upload.pipeTo(target), { keep, expect, onWrite });
			if ('stale' in received) {
				log?.('serve.stale', { path, expect });
				return received;
			}
			const state = (await tree.stat(path))!;
			log?.('serve.put', { path, state, ...(received.copy ? { conflictCopy: received.copy } : {}) });
			return { state, copy: received.copy ?? null };
		},
		async mkdir(path) {
			if (!validName(path)) throw new Error(`Invalid name: ${path}`);
			onWrite(path);
			await tree.mkdir(path);
			log?.('serve.mkdir', { path });
		},
		async remove(path, kind, expect) {
			const outcome = await discard(tree, path, kind, expect, onWrite);
			log?.('serve.remove', { path, kind, outcome });
			return outcome;
		},
		async rename(from, to, expect) {
			if (!validName(to)) throw new Error(`Invalid name: ${to}`);
			const outcome = await renameIn(tree, from, to, expect, onWrite);
			log?.('serve.rename', { from, to, outcome });
			return outcome;
		}
	};
}
