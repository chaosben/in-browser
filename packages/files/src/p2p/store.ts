import type { Share } from './shares.js';
import { idbDelete, idbGet, idbSet } from '../sync/idb.js';
import type { Base, BaseEntry } from '../sync/plan.js';
import { identityOf, createIdentity, type Identity } from './identity.js';
import type { Change, DeviceInfo, Vector } from './knowledge.js';
import type { Op } from './members.js';

// What a device keeps about the P2P sync (IndexedDB in the app, memory in the specs)

export interface P2pState {
	v: 1;
	/** Member log of the group (empty: not in a group) */
	ops: Op[];
	/** Excluded folders of this device */
	scope: string[];
	log: Change[];
	vector: Vector;
	devices: Record<string, DeviceInfo>;
	/** Open one-time keys of this device (kept only until used or expired) */
	invites: { code: string; expires: number }[];
	/** Folders shared with a guest (a browser outside the group) */
	shares?: Share[];
	/** This device was removed from its group */
	removed?: true;
}

export const emptyState = (): P2pState => ({ v: 1, ops: [], scope: [], log: [], vector: {}, devices: {}, invites: [] });

export interface Store {
	identity(): Promise<Identity>;
	/** A new key pair (after being removed: the old ID can't come back) */
	resetIdentity(): Promise<Identity>;
	load(): Promise<P2pState>;
	save(state: P2pState): Promise<void>;
	loadBase(peer: string): Promise<Base>;
	saveBase(peer: string, base: Base): Promise<void>;
	clearBases(peers: string[]): Promise<void>;
}

const IDENTITY = 'p2p-identity';
const STATE = 'p2p-state';
const base = (peer: string) => `p2p-base:${peer}`;

export const idbStore: Store = {
	async identity() {
		const pair = await idbGet<CryptoKeyPair>(IDENTITY);
		if (pair) return identityOf(pair);
		return this.resetIdentity();
	},
	async resetIdentity() {
		const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify'])) as CryptoKeyPair;
		// The public key must be exportable to derive the ID; the private one stays inside the browser
		const publicKey = await crypto.subtle.importKey('raw', await crypto.subtle.exportKey('raw', pair.publicKey), 'Ed25519', true, ['verify']);
		await idbSet(IDENTITY, { publicKey, privateKey: pair.privateKey });
		return identityOf({ publicKey, privateKey: pair.privateKey });
	},
	load: async () => (await idbGet<P2pState>(STATE)) ?? emptyState(),
	save: (state) => idbSet(STATE, state),
	loadBase: async (peer) => new Map((await idbGet<[string, BaseEntry][]>(base(peer))) ?? []),
	saveBase: (peer, entries) => idbSet(base(peer), [...entries]),
	async clearBases(peers) {
		for (const peer of peers) await idbDelete(base(peer));
	}
};

/** In memory, for the specs */
export function memoryStore(): Store {
	let identity: Identity | null = null;
	let state = emptyState();
	const bases = new Map<string, Base>();
	return {
		identity: async () => (identity ??= await createIdentity()),
		resetIdentity: async () => (identity = await createIdentity()),
		load: async () => structuredClone(state),
		save: async (next) => void (state = structuredClone(next)),
		loadBase: async (peer) => new Map(bases.get(peer) ?? []),
		saveBase: async (peer, entries) => void bases.set(peer, new Map(entries)),
		clearBases: async (peers) => peers.forEach((peer) => bases.delete(peer))
	};
}
