import { isHidden, join, normalize } from '../path.js';

// Guest shares: one folder of this device for a browser outside the group. The guest gets a link with a key (100
// bits, like pairing); it works until the share is ended, for one guest at a time (another browser is refused while
// one is connected). The guest opens the folder live (`live.ts`): nothing of it stays in its browser.

export interface Share {
	id: string;
	/** Shared folder of My files */
	folder: string;
	/** `view`: only reading; `edit`: also writing, uploading, deleting (into this device's trash) */
	mode: 'view' | 'edit';
	/** Key of the link (100 bits, like a pairing key) */
	code: string;
	/** Ends then; `null`: until ended by hand (all new shares – older ones could have a time) */
	expires: number | null;
	/** A guest has been connected (older shares: the hash of the guest they were bound to) */
	used?: boolean;
	guest?: string;
}

export const isActive = (share: Share, now: number) => share.expires === null || share.expires > now;

/** Where a path of the guest lies here: inside the shared folder, never hidden entries; `null` otherwise */
export function sharePath(share: Share, path: string): string | null {
	const inner = normalize(path);
	if (isHidden(inner)) return null;
	return join(share.folder, inner);
}

export async function tokenHash(token: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`in-browser-share-guest\n${token}`));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
