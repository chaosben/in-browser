import type { Share } from './shares.js';
import { idbDelete, idbGet, idbSet } from '../sync/idb.js';
import type { Base, BaseEntry } from '../sync/plan.js';
import { identityOf, createIdentity, type Identity } from './identity.js';
import type { Change, DeviceInfo, Vector } from './knowledge.js';
import type { Op } from './members.js';

// What a device keeps about the P2P sync (IndexedDB in the app, memory in the specs)

/**
 * Version of what a device keeps (`P2pState` and the bases). Raise it with every change older code can't read, add
 * the step to `MIGRATIONS` and a test. A newer state is never read (`StateError`): an older page or p2p-node that
 * finds one leaves the sync to a newer one instead of writing over it.
 */
export const STATE_VERSION = 1;

/** The stored state was written by a newer version */
export class StateError extends Error {
	constructor() {
		super('The sync state was written by a newer version');
		this.name = 'StateError';
	}
}

/** `MIGRATIONS[n]` brings a state of version n to n + 1 */
const MIGRATIONS: Record<number, (state: Record<string, unknown>) => Record<string, unknown>> = {};

/** A stored state as this version reads it (`null`: none stored) */
export function migrateState(stored: unknown): P2pState {
	if (!stored || typeof stored !== 'object') return emptyState();
	let state = stored as Record<string, unknown>;
	let v = typeof state.v === 'number' ? state.v : 1;
	if (v > STATE_VERSION) throw new StateError();
	for (; v < STATE_VERSION; v++) state = { ...MIGRATIONS[v](state), v: v + 1 };
	return state as unknown as P2pState;
}

export interface P2pState {
	v: typeof STATE_VERSION;
	/** Member log of the group (empty: not in a group) */
	ops: Op[];
	/** Room secrets the removals of the log brought, by their hash (`knownRooms`) – never part of the log */
	rooms?: Record<string, string>;
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
	/** Just joined: waits for the user's folder choice before anything is transferred */
	setupPending?: true;
}

export const emptyState = (): P2pState => ({ v: STATE_VERSION, ops: [], scope: [], log: [], vector: {}, devices: {}, invites: [] });

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
	load: async () => migrateState(await idbGet<unknown>(STATE)),
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
