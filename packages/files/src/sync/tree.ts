import type { FileState, Snapshot } from './plan.js';

/**
 * A file system as the syncs see it: the shared OPFS in the app (`opfs-tree.ts`), a folder on disk (`handle-tree.ts`
 * in the browser, `fsTree` in the p2p-node) or a separate folder per simulated device in the specs.
 */
export interface Tree {
	/** Everything below the root; throws when something can't be read (never reports it as missing) */
	scan(): Promise<Snapshot>;
	stat(path: string): Promise<FileState | null>;
	read(path: string): Promise<File>;
	/** Replaces the file's content when the stream closes (creates missing folders) */
	write(path: string): Promise<WritableStream<Uint8Array>>;
	mkdir(path: string): Promise<void>;
	remove(path: string): Promise<void>;
	/** Moves or renames (also in upper/lower case only); `to` must not exist */
	move(from: string, to: string): Promise<void>;
	/** Names in a folder (`[]` if it doesn't exist; throws if it can't be read) */
	names(folder: string): Promise<string[]>;
}

/** Whether a path is still in the state a plan saw (`null`: not there) */
export function unchanged(current: FileState | null, expected: FileState | null): boolean {
	if (!current || !expected) return current === expected;
	if (current.kind !== expected.kind) return false;
	return current.kind === 'directory' || (current.size === expected.size && current.modified === expected.modified);
}
