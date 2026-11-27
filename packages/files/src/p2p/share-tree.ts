import { FilesError } from '../entry.js';
import { basename, isHidden, join, parent } from '../path.js';
import { ignored, type Snapshot } from '../sync/plan.js';
import { DIR } from '../sync/scan.js';
import type { Tree } from '../sync/tree.js';
import { besideShare, sharePath, type Share } from './shares.js';

// What a guest's sync session sees of this device (`session.ts` `serve`): the tree of the share and nothing else. The
// guest's paths start at the share (`sharePath`: a folder is its root; a single entry lies alone in it); hidden
// entries are never there; a share for viewing is never written. The share is asked for at every call, so an ended
// one answers nothing more.

/** A file still arriving (`receive` of `sync/tree-ops.ts`): the only hidden name a session may write, next to its file */
const ARRIVING = /^\.p2p-[0-9a-f-]{36}\.part$/;

export function shareTree(tree: Tree, current: () => Share | null): Tree {
	const share = () => {
		const now = current();
		if (!now) throw new FilesError('ended', '/');
		return now;
	};
	/** Where the guest's path lies here; throws outside the share */
	function at(path: string, arriving = false): string {
		const name = basename(path);
		const host = arriving && ARRIVING.test(name) ? within(parent(path), name) : sharePath(share(), path);
		if (!host) throw new FilesError('notFound', path);
		return host;
	}
	/** A file arriving in a folder of the share */
	function within(folder: string, name: string): string | null {
		const host = sharePath(share(), folder);
		return host && join(host, name);
	}
	function writing(path: string): string {
		if (share().mode !== 'edit') throw new FilesError('readOnly', path);
		if (besideShare(share(), path)) throw new FilesError('notFound', path);
		return at(path, true);
	}
	/** The names the guest sees in one of its folders */
	async function names(folder: string): Promise<string[]> {
		const now = share();
		if (now.single && folder === '/') return (await tree.stat(now.folder)) ? [basename(now.folder)] : [];
		const host = sharePath(now, folder);
		if (!host) return [];
		return (await tree.names(host)).filter((name) => !isHidden(`/${name}`) && !ignored(`/${name}`));
	}
	async function scan(folder: string, into: Snapshot): Promise<Snapshot> {
		for (const name of await names(folder)) {
			const path = join(folder, name);
			const state = await tree.stat(at(path));
			if (!state) continue;
			into.set(path, state.kind === 'directory' ? DIR : state);
			if (state.kind === 'directory') await scan(path, into);
		}
		return into;
	}
	return {
		scan: () => scan('/', new Map()),
		async stat(path) {
			const host = ARRIVING.test(basename(path)) ? within(parent(path), basename(path)) : sharePath(share(), path);
			return host ? tree.stat(host) : null;
		},
		read: (path) => tree.read(at(path)),
		write: async (path) => tree.write(writing(path)),
		mkdir: async (path) => tree.mkdir(writing(path)),
		async remove(path) {
			const host = writing(path);
			// Empty for the guest is not empty: hidden entries it never saw would go for good with the folder
			if ((await tree.stat(host))?.kind === 'directory' && (await tree.names(host)).length) throw new FilesError('exists', path);
			await tree.remove(host);
		},
		move: async (from, to) => tree.move(writing(from), writing(to)),
		names
	};
}
