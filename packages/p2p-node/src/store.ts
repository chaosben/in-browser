import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { identityOf, type Identity } from '@in-browser/files/p2p/identity.js';
import { emptyState, type P2pState, type Store } from '@in-browser/files/p2p/store.js';
import type { Base, BaseEntry } from '@in-browser/files/sync/plan.js';

// What the p2p-node keeps about the sync, as JSON files in its instance folder (readable by its user only):
// `identity.json` (key pair), `state.json`, `bases/<device>.json`. Unlike the browser, the private key must be
// stored exportable – the folder's permissions protect it.

/** Version of `state.json`; a different one on disk is kept as `state.v<n>.json` before it is replaced */
const STATE_VERSION: P2pState['v'] = 1;

async function readJson<T>(file: string): Promise<T | undefined> {
	try {
		return JSON.parse(await readFile(file, 'utf8')) as T;
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
		throw e;
	}
}

/** Written to a temporary file first, so a crash never leaves half a file */
async function writeJson(file: string, value: unknown) {
	const temp = `${file}.${process.pid}.tmp`;
	await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
	await rename(temp, file);
}

interface StoredIdentity {
	publicKey: JsonWebKey;
	privateKey: JsonWebKey;
}

async function newIdentity(file: string): Promise<Identity> {
	const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
	const stored: StoredIdentity = {
		publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey),
		privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey)
	};
	await writeJson(file, stored);
	return loadIdentity(stored);
}

async function loadIdentity(stored: StoredIdentity): Promise<Identity> {
	const publicKey = await crypto.subtle.importKey('jwk', stored.publicKey, 'Ed25519', true, ['verify']);
	const privateKey = await crypto.subtle.importKey('jwk', stored.privateKey, 'Ed25519', false, ['sign']);
	return identityOf({ publicKey, privateKey });
}

const safe = (peer: string) => peer.replace(/[^A-Za-z0-9]/g, '_');

export async function fileStore(dir: string): Promise<Store> {
	await mkdir(join(dir, 'bases'), { recursive: true, mode: 0o700 });
	const identityFile = join(dir, 'identity.json');
	const stateFile = join(dir, 'state.json');
	const baseFile = (peer: string) => join(dir, 'bases', `${safe(peer)}.json`);
	return {
		async identity() {
			const stored = await readJson<StoredIdentity>(identityFile);
			return stored ? loadIdentity(stored) : newIdentity(identityFile);
		},
		resetIdentity: () => newIdentity(identityFile),
		load: async () => (await readJson<P2pState>(stateFile)) ?? emptyState(),
		async save(state) {
			const old = await readJson<{ v?: number }>(stateFile);
			if (old && old.v !== STATE_VERSION) await copyFile(stateFile, join(dir, `state.v${old.v}.json`));
			await writeJson(stateFile, state);
		},
		loadBase: async (peer) => new Map((await readJson<[string, BaseEntry][]>(baseFile(peer))) ?? []) as Base,
		saveBase: (peer, entries) => writeJson(baseFile(peer), [...entries]),
		async clearBases(peers) {
			for (const peer of peers) await rm(baseFile(peer), { force: true });
		}
	};
}
