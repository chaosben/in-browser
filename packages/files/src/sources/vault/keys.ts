import { FilesError } from '../../entry.js';
import { seal, unseal, type Sealed } from '../secrets.js';
import { VAULT_FORMATS, type VaultFormatId } from './formats.js';

// The master keys of unlocked encrypted folders, whatever their format (`formats.ts`): in this tab's memory, shared
// with the other tabs of this browser (BroadcastChannel `files:vaults` – one origin, the same reach as the browser's
// storage), gone when the last tab closes. Only when the user chose “Remember on this device” is the master key kept:
// sealed with this device's key (`secrets.ts`) in the folder's connection, so it unlocks by itself – whoever uses
// this browser can open it. Locking forgets it everywhere.

/** What keys need of a vault connection (`registry.ts`) */
export interface VaultRef {
	id: string;
	/** The encrypted folder in My files */
	path: string;
	format: VaultFormatId;
	/** The master key, sealed with the device key – only with “Remember on this device” */
	remembered?: Sealed;
}

type Message = { type: 'hello' } | { type: 'key'; id: string; master: Uint8Array } | { type: 'lock'; id: string };

const unlocked = new Map<string, Uint8Array>();
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
/** Answers of the other tabs to this tab's hello: waited for briefly before a folder counts as locked */
let greeted: Promise<void> | null = null;
/** How long a new tab waits for the other tabs' keys */
const HELLO_WAIT = 300;

const tell = () => listeners.forEach((l) => l());

function ensureChannel() {
	if (channel || typeof BroadcastChannel === 'undefined') return;
	channel = new BroadcastChannel('files:vaults');
	channel.onmessage = (e: MessageEvent<Message>) => {
		const message = e.data;
		if (message.type === 'hello') {
			for (const [id, master] of unlocked) channel?.postMessage({ type: 'key', id, master } satisfies Message);
		} else if (message.type === 'key') {
			if (unlocked.has(message.id)) return;
			unlocked.set(message.id, message.master);
			tell();
		} else if (message.type === 'lock') {
			if (unlocked.delete(message.id)) tell();
		}
	};
	channel.postMessage({ type: 'hello' } satisfies Message);
	greeted = new Promise((resolve) => setTimeout(resolve, HELLO_WAIT));
}

/** Calls `listener` when a folder was unlocked or locked (in any tab) */
export function onVaultKeys(listener: () => void): () => void {
	ensureChannel();
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** The folder is unlocked in this browser now (remembered ones count once they were used) */
export function isUnlocked(id: string): boolean {
	ensureChannel();
	return unlocked.has(id);
}

/** Remembered master keys are kept as text: hex, the same for every format */
const toHex = (key: Uint8Array) => [...key].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => Uint8Array.from(hex.match(/.{2}/g) ?? [], (h) => parseInt(h, 16));

/** The master key of a folder; `locked` when it isn't unlocked in this browser and no key is remembered */
export async function vaultMaster(vault: VaultRef): Promise<Uint8Array> {
	ensureChannel();
	if (!unlocked.has(vault.id) && vault.remembered) {
		const master = fromHex((await unseal(vault.remembered)).replaceAll('-', ''));
		if (!unlocked.has(vault.id)) unlocked.set(vault.id, master);
		tell();
	}
	if (!unlocked.has(vault.id)) await greeted;
	const found = unlocked.get(vault.id);
	if (!found) throw new FilesError('locked', '/');
	return found;
}

/**
 * Unlocks a folder with its password (throws `WrongPassword`, `VaultFormatError`); with `remember` the sealed master
 * key comes back for the connection to keep.
 */
export async function unlockVault(vault: VaultRef, password: string, remember: boolean): Promise<Sealed | null> {
	return addUnlocked(vault, await VAULT_FORMATS[vault.format].unlock(vault.path, password), remember);
}

/** A folder whose master key is known (just created): unlocked like with its password */
export async function addUnlocked(vault: VaultRef, master: Uint8Array, remember: boolean): Promise<Sealed | null> {
	ensureChannel();
	unlocked.set(vault.id, master);
	channel?.postMessage({ type: 'key', id: vault.id, master } satisfies Message);
	tell();
	return remember ? seal(toHex(master)) : null;
}

/** Locks a folder in every tab of this browser (the connection forgets a remembered key: `connections.svelte.ts`) */
export function lockVault(id: string): void {
	ensureChannel();
	if (!unlocked.delete(id) && !channel) return;
	channel?.postMessage({ type: 'lock', id } satisfies Message);
	tell();
}
