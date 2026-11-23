import { FilesError } from '../entry.js';
import { roomId, shareProof, wordsProof } from '../p2p/auth.js';
import { wordSecret, type WordCode } from '../p2p/words.js';
import { Rebindable, type LiveEnd } from '../p2p/live-ends.js';
import { randomBytes, sha256, toHex } from '../p2p/bytes.js';
import type { Link } from '../p2p/link.js';
import { filesErrorOf } from '../p2p/live.js';
import type { Network, NetworkRoom } from '../p2p/network.js';
import { Rpc } from '../p2p/rpc.js';
import { isHidden } from '../path.js';
import { idbDelete, idbGet, idbSet } from '../sync/idb.js';
import type { Base } from '../sync/plan.js';
import { folderSource } from './folder.js';
import { shareSync, type ShareSync, type ShareSyncState } from './share-sync.js';
import type { Source } from './source.js';

// The guest's side of a guest share (`p2p/shares.ts`): a browser outside the group gets a folder (or one file) of
// another device as a copy in its own storage, kept in sync (`share-sync.ts`). The session is kept in `localStorage`
// (decided by the user: the sharing device can end it, and it runs out) – so it survives a closed browser – until it
// ends, runs out or is removed; then the copy is deleted (decided by the user). One share per browser; every page
// reads the copy, one of them leads: it holds the connection and syncs (Web Lock `files:share-sync`).

export interface ShareSession {
	code: string;
	/** Binds the share to this browser tab (the first guest keeps it) */
	token: string;
	/** Known after signing in */
	folder?: string;
	host?: string;
	mode?: 'view' | 'edit';
	/** Only one file or package is shared (it opens in its tool) */
	single?: boolean;
	/** When the share runs out (ms since 1970) */
	expires?: number;
	/** The sharing device ended it (or it ran out): never connects again */
	ended?: boolean;
	/** Bytes of the share the guest agreed to fetch (asked when it is large or doesn't fit, `share-sync.ts`) */
	allowed?: number;
}

const KEY = 'files:share';
/** Waiting this long for the sharing device before giving up (it has to have in-browser open) */
const CONNECT_TIMEOUT = 20_000;
/** A held connection's first attempts after a drop: this many, each this long */
const QUICK_TRIES = 4;
const QUICK_TIMEOUT = 6_000;
/** Pauses after failed attempts (public relays limit how often one may announce) */
const BACKOFF = [5_000, 15_000, 60_000];

/** Kept for this page when the browser's storage is blocked */
let fallback: ShareSession | null = null;

export function shareSession(): ShareSession | null {
	let value: ShareSession | null = fallback;
	try {
		value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as ShareSession | null;
	} catch {
		// Storage blocked: this page's
	}
	if (!value || typeof value.code !== 'string' || typeof value.token !== 'string') return null;
	// Run out: ended for good
	return value.expires !== undefined && value.expires <= Date.now() && !value.ended ? { ...value, ended: true } : value;
}

function storeSession(session: ShareSession | null) {
	fallback = session;
	try {
		if (session) localStorage.setItem(KEY, JSON.stringify(session));
		else localStorage.removeItem(KEY);
	} catch {
		// Storage blocked: the share lasts as long as this page
	}
}

/** Calls `listener` when another tab opened, changed or removed the share */
export function onShareSession(listener: () => void): () => void {
	const changed = (e: StorageEvent) => e.key === KEY && listener();
	addEventListener('storage', changed);
	return () => removeEventListener('storage', changed);
}

/** Opens a share from its link (a new key replaces an earlier one of this browser, whose copy goes) */
export function beginShare(code: string): ShareSession {
	const current = shareSession();
	if (current?.code === code) return current;
	stopLeading();
	const session: ShareSession = { code, token: toHex(randomBytes(16)) };
	storeSession(session);
	void dropShareCopies(code);
	return session;
}

/** Removes the share from this browser, with its copy */
export function endShareSession() {
	stopLeading();
	storeSession(null);
	void dropShareCopies();
	tell({ type: 'gone' });
}

// --- The copy in this browser's storage (`shares/<hash of the key>/`, next to `files/` and `cache/`: never in My
// files, so it neither travels to the guest's devices nor into its folder on disk) ---

const SHARES_DIR = 'shares';
const baseKey = (name: string) => `share-base:${name}`;

async function copyName(code: string): Promise<string> {
	return toHex(await sha256(`in-browser-share-copy\n${code}`)).slice(0, 32);
}

const dirs = new Map<string, Promise<FileSystemDirectoryHandle>>();

/** The folder holding the copy of a share */
export function shareCopyDir(code: string): Promise<FileSystemDirectoryHandle> {
	let dir = dirs.get(code);
	if (!dir) {
		dir = (async () => (await (await navigator.storage.getDirectory()).getDirectoryHandle(SHARES_DIR, { create: true })).getDirectoryHandle(await copyName(code), { create: true }))();
		dirs.set(code, dir);
		dir.catch(() => dirs.delete(code));
	}
	return dir;
}

/** Deletes the copies of all shares but the one with the key `keep` (none: all) – a share that ended, ran out or was
 * removed leaves nothing in this browser */
export async function dropShareCopies(keep?: string): Promise<void> {
	if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return;
	const kept = keep === undefined ? null : await copyName(keep);
	for (const code of [...dirs.keys()]) if (code !== keep) dirs.delete(code);
	try {
		const root = await navigator.storage.getDirectory();
		const shares = await root.getDirectoryHandle(SHARES_DIR);
		const names: string[] = [];
		for await (const name of shares.keys()) names.push(name);
		for (const name of names) {
			if (name === kept) continue;
			await shares.removeEntry(name, { recursive: true }).catch(() => {});
			await idbDelete(baseKey(name)).catch(() => {});
		}
	} catch {
		// No copies
	}
}

// --- One page leads: it holds the connection and syncs the copy; the others read the copy and hear its state ---

const LOCK = 'files:share-sync';
type Message = { type: 'state'; code: string; state: ShareSyncState } | { type: 'hello' } | { type: 'sync' } | { type: 'gone' };

let channel: BroadcastChannel | null = null;
/** The sync's state as last heard (of the share with this key) */
let known: { code: string; state: ShareSyncState } | null = null;
const stateListeners = new Set<() => void>();
/** Who hears when the share's info changes (each caller of `shareSource`) */
const changes = new Set<() => void>();
/** This page's end of the live channels: bound while this page leads */
const liveEnd = new Rebindable({ id: 'host', kind: 'host', name: '' });
let leading: { code: string; sync: ShareSync; release: () => void } | null = null;
/** The key this page queues (or leads) for */
let queued = '';

function tell(message: Message) {
	try {
		channel?.postMessage(message);
	} catch {
		// Closed with the page
	}
}

function setState(code: string, state: ShareSyncState) {
	known = { code, state };
	for (const listener of [...stateListeners]) listener();
}

function ensureChannel() {
	if (channel || typeof BroadcastChannel === 'undefined') return;
	channel = new BroadcastChannel(LOCK);
	channel.onmessage = (e: MessageEvent<Message>) => {
		const message = e.data;
		if (message.type === 'state') setState(message.code, message.state);
		else if (message.type === 'hello') {
			if (leading && known) tell({ type: 'state', ...known });
		} else if (message.type === 'sync') leading?.sync.syncNow(2000);
		else if (leading) stopLeading();
	};
	tell({ type: 'hello' });
}

/** The state of the sync of this browser's share (`null`: not known yet) */
export function shareSyncState(): ShareSyncState | null {
	const session = shareSession();
	return session && known?.code === session.code ? known.state : null;
}

/** Calls `listener` when the state of the share's sync changes */
export function onShareSync(listener: () => void): () => void {
	ensureChannel();
	stateListeners.add(listener);
	return () => stateListeners.delete(listener);
}

function stopLeading() {
	const was = leading;
	leading = null;
	queued = '';
	was?.sync.close();
	was?.release();
}

/** Queues for the lead of the share's sync; `steal` takes it from the page that has it (a page with a live channel:
 * the channel rides on the one connection) */
function queue(session: ShareSession, steal = false) {
	if (typeof navigator === 'undefined' || !navigator.locks || session.ended) return;
	if (leading?.code === session.code) return;
	if (queued === session.code && !steal) return;
	queued = session.code;
	ensureChannel();
	const code = session.code;
	void navigator.locks
		.request(LOCK, steal ? { steal: true } : {}, async () => {
			if (queued !== code || shareSession()?.code !== code) return;
			await new Promise<void>((release) => void lead(code, release).catch(() => release()));
		})
		.catch(() => {})
		.finally(() => {
			// Taken by another page (or left): the connection goes, and this page waits its turn again
			if (leading?.code === code) {
				const was = leading;
				leading = null;
				was.sync.close();
				was.release();
			}
			if (queued === code) {
				queued = '';
				const current = shareSession();
				if (current?.code === code && !current.ended) setTimeout(() => queue(current), 1000);
			}
		});
}

async function lead(code: string, release: () => void) {
	const session = shareSession();
	if (!session || session.code !== code || session.ended) return release();
	const dir = await shareCopyDir(code);
	const name = await copyName(code);
	const update = (patch: Partial<ShareSession>) => {
		const current = shareSession();
		if (current?.code !== code) return;
		storeSession({ ...current, ...patch });
		for (const changed of [...changes]) changed();
	};
	const { changed, watch } = await import('../changes.js');
	const { askAboveOf } = await import('../settings.js');
	const { opfsTree } = await import('../sync/opfs-tree.js');
	const { filesMessages } = await import('../i18n/index.svelte.js');
	/** Paths a session just wrote: their announcement is no change of the guest */
	const own = new Map<string, number>();
	const written = new Set<string>();
	let announcing: ReturnType<typeof setTimeout> | undefined;
	const announce = () => {
		clearTimeout(announcing);
		if (!written.size) return;
		const paths = [...written];
		written.clear();
		for (const path of paths) own.set(path, Date.now() + 5000);
		changed(...paths);
	};
	const sync = shareSync({
		session,
		network: async () => (await import('../p2p/trystero.js')).trysteroNetwork,
		dir,
		live: liveEnd,
		base: { load: async () => (await idbGet<Base>(baseKey(name))) ?? new Map(), save: (base) => idbSet(baseKey(name), base) },
		limits: async () => ({
			limit: await askAboveOf(opfsTree).catch(() => null),
			free: await navigator.storage
				.estimate()
				.then(({ quota, usage }) => (quota === undefined ? null : Math.max(0, quota - (usage ?? 0))))
				.catch(() => null)
		}),
		allowed: () => shareSession()?.allowed ?? 0,
		conflictLabel: (side) => filesMessages().p2p.conflictLabel(side === 'mine' ? filesMessages().share.guest : shareSession()?.host || filesMessages().share.host),
		onState(state) {
			if (state.phase === 'synced') announce();
			setState(code, state);
			tell({ type: 'state', code, state });
		},
		onInfo: (info) => update(info),
		onEnded() {
			update({ ended: true });
			void dropShareCopies();
			stopLeading();
		},
		// A session names a path before it writes it: views hear once the file is in place (the end of the session,
		// or a pause between files of a long one)
		onWrite(path) {
			written.add(`${SHARE_ROOT}${path}`);
			clearTimeout(announcing);
			announcing = setTimeout(announce, 1500);
		}
	});
	// Changes of the copy made here (an editor saving, Files) travel soon; run out without a connection: ended
	const unwatch = watch((paths) => {
		const now = Date.now();
		for (const [path, until] of own) if (until < now) own.delete(path);
		if (paths.some((path) => (path === SHARE_ROOT || path.startsWith(`${SHARE_ROOT}/`)) && !own.has(path))) sync.syncNow(2000);
	});
	const expiry = setInterval(() => {
		const current = shareSession();
		if (current?.code !== code || !current.ended) return;
		update({ ended: true });
		void dropShareCopies();
		stopLeading();
	}, 60_000);
	leading = {
		code,
		sync,
		release() {
			clearTimeout(announcing);
			unwatch();
			clearInterval(expiry);
			release();
		}
	};
}

/** Where the share lies in the path space (`path.ts` `connectionRoot('share')`) */
const SHARE_ROOT = '/:c/share';

/** The guest agrees to fetch a share it was asked about (`ShareSyncState.ask`) */
export function allowShareSync() {
	const session = shareSession();
	const ask = shareSyncState()?.ask;
	if (!session || !ask) return;
	storeSession({ ...session, allowed: ask.bytes });
	if (leading) leading.sync.syncNow();
	else tell({ type: 'sync' });
}

/** The source of the share of this browser: its copy here, synced by the leading page */
export function shareSource(session: ShareSession, onChange: () => void): Source {
	changes.add(onChange);
	if (session.ended) void dropShareCopies();
	else queue(session);
	const current = () => {
		const now = shareSession();
		if (!now || now.code !== session.code || now.ended) throw new FilesError('ended', '/');
		return now;
	};
	const copy = async () => folderSource(await shareCopyDir(current().code));
	/** Changing needs a share for editing; the shared file or package itself stays (the share stands on it) */
	const writing = (path: string, entry = false) => {
		const now = current();
		if (now.mode !== 'edit') throw new FilesError('readOnly', path);
		if (entry && now.single && path === `/${now.folder ?? ''}`) throw new FilesError('root', path);
	};
	return {
		caps: {
			get readOnly() {
				return shareSession()?.mode !== 'edit';
			},
			trash: false
		},
		list: async (path) => (await (await copy()).list(path)).filter((entry) => !isHidden(`/${entry.name}`)),
		stat: async (path) => (await copy()).stat(path),
		read: async (path) => (await copy()).read(path),
		async writable(path) {
			writing(path);
			return (await copy()).writable(path);
		},
		async mkdir(path) {
			writing(path);
			return (await copy()).mkdir(path);
		},
		async remove(path) {
			writing(path, true);
			return (await copy()).remove(path);
		},
		async move(from, to) {
			writing(from, true);
			return (await copy()).move(from, to);
		}
	};
}

/** The live channels to the device sharing with this browser (null without a share, or once it ended): this page
 * takes the lead of the share's sync, so the one connection – and the channels on it – are its own */
export function shareLiveEnd(): LiveEnd | null {
	const session = shareSession();
	if (!session || session.ended) return null;
	queue(session, true);
	return liveEnd;
}

export interface ShareInfo {
	folder: string;
	host: string;
	mode: 'view' | 'edit';
	single?: boolean;
	expires?: number;
}

export interface ShareClientOptions {
	onInfo?: (info: ShareInfo) => void;
	/** Signed in on a connection (again after every drop) */
	onRpc?: (rpc: Rpc) => void;
	/** The connection went, or an attempt found nobody – `taken`: another browser is in the share right now */
	onDown?: (taken: boolean) => void;
	/** The sharing device ended the share (or it ran out) */
	onEnded?: () => void;
	/** The live channels' end to bind (one per tab, kept across connections) */
	live?: Rebindable;
	timeout?: number;
	backoff?: number[];
	now?: () => number;
}

export interface ShareClient {
	live: Rebindable;
	close(): void;
}

/**
 * The connection to the sharing device, held: made at once and again after a drop (`network` injectable for the
 * specs). Right after a drop the sharing device is often just coming back (a reload): a few short attempts one after
 * the other find it within seconds; then the share's pauses (public relays limit announcements).
 */
export function shareClient(
	session: Pick<ShareSession, 'code' | 'token' | 'ended'>,
	network: () => Promise<Network>,
	{ onInfo = () => {}, onRpc = () => {}, onDown = () => {}, onEnded = () => {}, live = new Rebindable({ id: 'host', kind: 'host', name: '' }), timeout = CONNECT_TIMEOUT, backoff = BACKOFF, now = Date.now }: ShareClientOptions = {}
): ShareClient {
	let room: NetworkRoom | null = null;
	let connecting: Promise<Rpc> | null = null;
	/** Ended or closed: never connects again */
	let final = !!session.ended;
	let failures = 0;
	let again: ReturnType<typeof setTimeout> | undefined;
	let taken = false;
	/** The attempt running now takes the room's links; between attempts they wait */
	let take: ((link: Link) => void) | null = null;
	let waiting: Link[] = [];
	/** The last attempt met somebody in the room */
	let met = false;

	function hold() {
		clearTimeout(again);
		if (final || connecting) return;
		taken = false;
		const quick = failures < QUICK_TRIES;
		// A quick attempt that met nobody waits on in the room it is in (entering it again would only announce again –
		// public relays count that); one that met somebody who wasn't the sharing device starts anew
		connecting = connect(quick ? Math.min(QUICK_TIMEOUT, timeout) : timeout, !quick || met).then(
			(rpc) => {
				failures = 0;
				return rpc;
			},
			(e: unknown) => {
				connecting = null;
				if (!final) {
					const retryAt = now() + (quick ? 0 : backoff[Math.min(failures - QUICK_TRIES, backoff.length - 1)]);
					again = setTimeout(hold, Math.max(500, retryAt - now()));
					failures++;
					onDown(taken);
				}
				throw e;
			}
		);
		connecting.catch(() => {});
	}

	function end(notify: boolean) {
		const first = !final;
		final = true;
		clearTimeout(again);
		void connecting?.then((rpc) => rpc.close()).catch(() => {});
		connecting = null;
		room?.leave();
		room = null;
		take = null;
		waiting = [];
		if (first && notify) onEnded();
	}

	async function connect(limit: number, fresh: boolean): Promise<Rpc> {
		const net = await network();
		if (fresh || !room) {
			room?.leave();
			waiting = [];
			room = net.join(await roomId('share', session.code), session.code);
			room.onLink((link) => (take ? take(link) : waiting.push(link)));
		}
		met = false;
		// Other guests of the share are in the room too: every link is asked, the first that proves to be the host wins
		// (a guest answers "unknown request" or not at all) – all within one time limit
		return new Promise<Rpc>((resolve, reject) => {
			let done = false;
			const asking = new Set<Rpc>();
			const finish = (result: { rpc: Rpc } | { error: unknown }) => {
				if (done) return;
				done = true;
				clearTimeout(timer);
				for (const other of asking) if (!('rpc' in result) || other !== result.rpc) other.close();
				asking.clear();
				if ('rpc' in result) resolve(result.rpc);
				else {
					// Until the next attempt, links wait
					take = null;
					reject(result.error);
				}
			};
			const timer = setTimeout(() => finish({ error: new FilesError('offline', '/') }), limit);
			take = (link) => {
				if (done || final) return link.close();
				met = true;
				const rpc = new Rpc(link);
				asking.add(rpc);
				void hello(link, rpc).then(
					() => {
						if (done || final) return rpc.close();
						rpc.handle('share.ended', async () => end(true));
						live.bind(rpc);
						link.onClose(() => {
							if (connecting) connecting = null;
							live.unbind(rpc);
							if (final) return;
							onDown(false);
							// At once again (the sharing device may just have reloaded)
							again = setTimeout(hold, 500);
						});
						finish({ rpc });
						onRpc(rpc);
					},
					(e: unknown) => {
						asking.delete(rpc);
						rpc.close();
						const error = filesErrorOf(e, '/');
						if (error?.code === 'ended') {
							end(true);
							finish({ error });
						} else if (error?.code === 'taken') {
							// Another guest is in: out of the room until the next attempt (the host stops offering meanwhile)
							taken = true;
							room?.leave();
							room = null;
							finish({ error });
						}
						// Else not the host: wait for the next link
					}
				);
			};
			for (const link of waiting.splice(0)) take(link);
		});
	}

	/** Signs in on a link; fails unless the other end proves to be the sharing device */
	async function hello(link: Link, rpc: Rpc) {
		const fingerprints = link.fingerprints();
		const reply = (await rpc.call('share.hello', { proof: await shareProof(session.code, 'guest', fingerprints), token: session.token })) as {
			proof: string;
			folder: string;
			host: string;
			mode: 'view' | 'edit';
			single?: boolean;
			expires?: number;
		};
		if (reply.proof !== (await shareProof(session.code, 'host', fingerprints))) throw new Error('Not the sharing device');
		onInfo({
			folder: reply.folder,
			host: reply.host,
			mode: reply.mode === 'edit' ? 'edit' : 'view',
			...(reply.single === true && { single: true }),
			...(typeof reply.expires === 'number' && { expires: reply.expires })
		});
	}

	hold();
	return { live, close: () => end(false) };
}

/** How long typed words wait for the sharing device */
const WORDS_TIMEOUT = 30_000;

/**
 * The key of a share from its word code (`p2p/words.ts`): meets the sharing device in the code's room and has it
 * hand the key over, both proving they know the code. Throws `FilesError` `ended` (no such code, run out, used)
 * or `offline` (nobody answered in time).
 */
export async function codeFromWords(code: WordCode, network: () => Promise<Network>, timeout = WORDS_TIMEOUT): Promise<string> {
	const secret = await wordSecret(code);
	const net = await network();
	const room = net.join(await roomId('words', secret), secret);
	try {
		return await new Promise<string>((resolve, reject) => {
			let done = false;
			const timer = setTimeout(() => finish(() => reject(new FilesError('offline', '/'))), timeout);
			const finish = (then: () => void) => {
				if (done) return;
				done = true;
				clearTimeout(timer);
				then();
			};
			room.onLink((link) => {
				if (done) return link.close();
				const rpc = new Rpc(link);
				void (async () => {
					const fingerprints = link.fingerprints();
					const reply = (await rpc.call('words.hello', { proof: await wordsProof(secret, 'guest', fingerprints) })) as { proof?: string; code?: string };
					if (reply.proof !== (await wordsProof(secret, 'host', fingerprints)) || typeof reply.code !== 'string') throw new Error('Not the sharing device');
					return reply.code;
				})().then(
					(key) => finish(() => resolve(key)),
					(e: unknown) => {
						// Another guest typing the same words, or the code was used or ran out
						if (filesErrorOf(e, '/')?.code === 'ended') finish(() => reject(new FilesError('ended', '/')));
					}
				).finally(() => rpc.close());
			});
		});
	} finally {
		room.leave();
	}
}
