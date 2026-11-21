import { isHidden } from '../path.js';
import type { Snapshot } from './plan.js';

// Sizes for choosing folders before a sync starts: per folder what is here, what is there, and what would travel
// each way (files only one side has). Pure, so both the folder sync and the device setup use it.

export interface FolderAmounts {
	here: number;
	there: number;
	/** Bytes of files only the other side has (would come here) */
	in: number;
	/** Bytes of files only this side has (would go there) */
	out: number;
}

const none = (): FolderAmounts => ({ here: 0, there: 0, in: 0, out: 0 });

/** Amounts of every visible folder of both snapshots (hidden folders, tool data and the trash always travel) */
export function folderAmounts(here: Snapshot, there: Snapshot): Map<string, FolderAmounts> {
	const out = new Map<string, FolderAmounts>();
	const add = (path: string, key: keyof FolderAmounts, bytes: number) => {
		for (let i = path.indexOf('/', 1); i > 0; i = path.indexOf('/', i + 1)) {
			const folder = path.slice(0, i);
			const amounts = out.get(folder) ?? none();
			amounts[key] += bytes;
			out.set(folder, amounts);
		}
	};
	for (const [snapshot, other, side, travel] of [
		[here, there, 'here', 'out'],
		[there, here, 'there', 'in']
	] as const) {
		for (const [path, state] of snapshot) {
			if (isHidden(path)) continue;
			if (state.kind === 'directory') {
				if (!out.has(path)) out.set(path, none());
				continue;
			}
			add(path, side, state.size);
			if (!other.has(path)) add(path, travel, state.size);
		}
	}
	return out;
}

/** The direct subfolders of `folder` among the amounts */
export function subfolders(amounts: Map<string, FolderAmounts>, folder: string): string[] {
	const prefix = folder === '/' ? '/' : folder + '/';
	return [...amounts.keys()].filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'));
}

/**
 * Top-level folders to leave out at first: what would come here reaches the limit (suite setting `sync.askAbove`)
 * or doesn't fit into the free space. The user can change that before starting.
 */
export function preselectExcluded(top: { path: string; in: number }[], limit: number | null, free: number | null): string[] {
	return top.filter((f) => f.in > 0 && ((limit !== null && f.in >= limit) || (free !== null && f.in > free))).map((f) => f.path);
}
