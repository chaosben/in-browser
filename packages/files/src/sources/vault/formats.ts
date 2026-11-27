import type { Source } from '../source.js';
import { cryptomatorFormat } from './cryptomator-source.js';
import { gocryptfsFormat } from './gocryptfs-source.js';

export { VaultFormatError, WrongPassword } from './errors.js';

// The formats of encrypted folders (decided by the user, 2026-11-27: the technology is a choice – gocryptfs and
// Cryptomator, others behind the same interface). Everything outside `vault/` knows only `VaultFormat`: the
// connection stores its format's id, unlocking finds it by the folder's files, and a new folder is made in the format
// the user picks. A new format is a module implementing it plus an entry in `VAULT_FORMATS` (and its texts).

export type VaultFormatId = 'gocryptfs' | 'cryptomator';

export interface VaultFormat {
	id: VaultFormatId;
	/** Shown name (a product name, the same in every language) */
	name: string;
	/** The folder of My files (a path) is one of this format, by the files only it has */
	detect(folder: string): Promise<boolean>;
	/** The same folder wherever it lies now: a hash of what identifies its key (throws `VaultFormatError`) */
	fingerprint(folder: string): Promise<string>;
	/** Its master key, opened with the password (throws `WrongPassword`, `VaultFormatError`) */
	unlock(folder: string, password: string): Promise<Uint8Array>;
	/** Makes the folder (new, empty) an encrypted folder of this format protected by `password`; its master key */
	create(folder: string, password: string): Promise<Uint8Array>;
	/** The master key the way this format's own programs take it (to write down); `null` where the format's own
	 * program makes the way back (Cryptomator's recovery key) */
	showKey(master: Uint8Array): string | null;
	/** The decrypted view of the folder; `master` throws `locked` while it isn't unlocked */
	source(folder: string, master: () => Promise<Uint8Array>): Source;
}

export const VAULT_FORMATS: Record<VaultFormatId, VaultFormat> = { gocryptfs: gocryptfsFormat, cryptomator: cryptomatorFormat };

/** What a new encrypted folder is made in unless the user picks another */
export const DEFAULT_VAULT_FORMAT: VaultFormatId = 'gocryptfs';

/** The format of an encrypted folder of My files, `null` if it is none */
export async function detectFormat(folder: string): Promise<VaultFormat | null> {
	for (const format of Object.values(VAULT_FORMATS)) if (await format.detect(folder)) return format;
	return null;
}
