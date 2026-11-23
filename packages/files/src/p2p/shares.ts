import { basename, isHidden, join, normalize, parent } from '../path.js';
import { sha256, toHex } from './bytes.js';

// Guest shares: a folder of this device – or a single file or package – for a browser outside the group. The guest
// gets a link with a key (100 bits, like pairing), or four words that hand it over (`words.ts`); it works until the
// share is ended or runs out, for one guest at a time (another browser is refused while one is connected). The guest
// gets it as a copy in its own browser, synced with this device (`share-tree.ts`, `sources/share-sync.ts`) and
// deleted there when the share ends.

export interface Share {
	id: string;
	/** The shared entry of My files: a folder, or with `single` a file or package (the name is kept for stored shares) */
	folder: string;
	/** Only the entry itself is shared (a file, a package): the guest sees it alone, never what lies next to it */
	single?: true;
	/** `view`: only reading; `edit`: also writing, uploading, deleting (into this device's trash) */
	mode: 'view' | 'edit';
	/** Key of the link (100 bits, like a pairing key) */
	code: string;
	/** A guest has been connected */
	used?: boolean;
	/** When it ends by itself (ms since 1970); missing: when it is ended */
	expires?: number;
}

/** How long new shares last: the choices, in ms (`null`: until ended) */
export const SHARE_DURATIONS = [60 * 60 * 1000, 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000, null] as const;
export type ShareDuration = (typeof SHARE_DURATIONS)[number];
/** New shares last a day unless chosen otherwise (a forgotten share ends by itself) */
export const DEFAULT_DURATION: ShareDuration = 24 * 60 * 60 * 1000;

/** Has the share run out at `now`? */
export const expired = (share: Pick<Share, 'expires'>, now: number) => share.expires !== undefined && share.expires <= now;

/**
 * Where a path of the guest lies here; `null` outside what is shared and for hidden entries. A folder share: the
 * folder is the guest's root. A single entry: the guest's root shows it alone (its folder, listing only it), and
 * what lies in it when it is a package.
 */
export function sharePath(share: Share, path: string): string | null {
	const inner = normalize(path);
	if (isHidden(inner)) return null;
	if (!share.single) return join(share.folder, inner);
	if (inner === '/') return parent(share.folder);
	const name = `/${basename(share.folder)}`;
	if (inner === name || inner.startsWith(`${name}/`)) return join(parent(share.folder), inner);
	return null;
}

/** The guest's path of what can't be deleted or moved: the shared folder (its root) or the shared entry */
export const shareRoot = (share: Share) => (share.single ? `/${basename(share.folder)}` : '/');

export async function tokenHash(token: string): Promise<string> {
	return toHex(await sha256(`in-browser-share-guest\n${token}`));
}
