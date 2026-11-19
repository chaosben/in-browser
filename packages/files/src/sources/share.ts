import { FilesError } from '../entry.js';
import { roomId, shareProof } from '../p2p/auth.js';
import type { Link } from '../p2p/link.js';
import { liveSource, rpcLiveCall, type LiveCall } from '../p2p/live.js';
import type { Network, NetworkRoom } from '../p2p/network.js';
import { RemoteError, Rpc } from '../p2p/rpc.js';
import type { Source } from './source.js';

// The guest's side of a guest share (`p2p/shares.ts`): a browser outside the group opens one folder of another device
// live. The session lives in `sessionStorage` (this tab only – also across reloads and tool changes in it) and is gone
// with the tab; nothing of the folder is stored. Each tab connects itself (no leading tab, no device of its own).

export interface ShareSession {
	code: string;
	/** Binds the share to this browser tab (the first guest keeps it) */
	token: string;
	/** Known after signing in */
	folder?: string;
	host?: string;
	mode?: 'view' | 'edit';
	/** The sharing device ended it (or it ran out): never connects again */
	ended?: boolean;
}

const KEY = 'files:share';
/** Waiting this long for the sharing device before giving up (it has to have in-browser open) */
const CONNECT_TIMEOUT = 20_000;
/** Pauses after failed attempts (public relays limit how often one may announce) */
const BACKOFF = [5_000, 15_000, 60_000];

export function shareSession(): ShareSession | null {
	try {
		const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as ShareSession | null;
		return value && typeof value.code === 'string' && typeof value.token === 'string' ? value : null;
	} catch {
		return null;
	}
}

function storeSession(session: ShareSession | null) {
	try {
		if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
		else sessionStorage.removeItem(KEY);
	} catch {
		// Storage blocked: the share lasts as long as this page
	}
}

/** Opens a share from its link (a new key replaces an earlier one of this tab) */
export function beginShare(code: string): ShareSession {
	const current = shareSession();
	if (current?.code === code) return current;
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	const session: ShareSession = { code, token: [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('') };
	storeSession(session);
	client = null;
	return session;
}

export function endShareSession() {
	client?.close();
	client = null;
	storeSession(null);
}

interface ShareClient {
	source: Source;
	close(): void;
}

let client: ShareClient | null = null;

/** The source of the share of this tab (one connection, made when first used) */
export function shareSource(session: ShareSession, onChange: () => void): Source {
	if (!client) {
		const update = (patch: Partial<ShareSession>) => {
			storeSession({ ...(shareSession() ?? session), ...patch });
			onChange();
		};
		client = shareClient(session, async () => (await import('../p2p/trystero.js')).trysteroNetwork, {
			onInfo: (info) => update(info),
			onEnded: () => update({ ended: true })
		});
	}
	return client.source;
}

export interface ShareClientOptions {
	onInfo?: (info: { folder: string; host: string; mode: 'view' | 'edit' }) => void;
	/** The sharing device ended the share (or it ran out) */
	onEnded?: () => void;
	timeout?: number;
	backoff?: number[];
	now?: () => number;
}

/** A connection to the sharing device as a source (`network` injectable for the specs) */
export function shareClient(
	session: Pick<ShareSession, 'code' | 'token' | 'mode' | 'ended'>,
	network: () => Promise<Network>,
	{ onInfo = () => {}, onEnded = () => {}, timeout = CONNECT_TIMEOUT, backoff = BACKOFF, now = Date.now }: ShareClientOptions = {}
): ShareClient {
	const caps = { readOnly: session.mode === 'view', trash: true };
	let room: NetworkRoom | null = null;
	let connecting: Promise<Rpc> | null = null;
	/** Ended or refused for good: answered at once, never connects again */
	let final: FilesError | null = session.ended ? new FilesError('ended', '/') : null;
	let failures = 0;
	let retryAt = 0;

	function end(error: FilesError, notify = true) {
		const first = !final;
		final = error;
		void connecting?.then((rpc) => rpc.close()).catch(() => {});
		connecting = null;
		room?.leave();
		room = null;
		if (first && notify && error.code === 'ended') onEnded();
	}

	async function connect(): Promise<Rpc> {
		const net = await network();
		// A room is entered once per attempt (each entry is announced on the relays)
		room?.leave();
		room = net.join(await roomId('share', session.code), session.code);
		const joined = room;
		const link = await new Promise<Link>((resolve, reject) => {
			const timer = setTimeout(() => reject(new FilesError('offline', '/')), timeout);
			joined.onLink((l) => {
				clearTimeout(timer);
				resolve(l);
			});
		});
		const rpc = new Rpc(link);
		rpc.handle('share.ended', async () => end(new FilesError('ended', '/')));
		link.onClose(() => {
			if (connecting) connecting = null;
		});
		const fingerprints = link.fingerprints();
		let reply: { proof: string; folder: string; host: string; mode: 'view' | 'edit' };
		try {
			reply = (await rpc.call('share.hello', { proof: await shareProof(session.code, 'guest', fingerprints), token: session.token })) as typeof reply;
		} catch (e) {
			rpc.close();
			if (e instanceof RemoteError && e.message === 'files:ended') {
				const error = new FilesError('ended', '/');
				end(error);
				throw error;
			}
			// Another guest is in it: out of the room until the next attempt (the host stops offering meanwhile)
			room?.leave();
			room = null;
			throw e instanceof RemoteError && e.message === 'files:taken' ? new FilesError('taken', '/') : e;
		}
		if (reply.proof !== (await shareProof(session.code, 'host', fingerprints))) {
			rpc.close();
			throw new FilesError('offline', '/');
		}
		caps.readOnly = reply.mode !== 'edit';
		onInfo({ folder: reply.folder, host: reply.host, mode: reply.mode });
		return rpc;
	}

	const call: LiveCall = async (method, params, upload) => {
		if (final) throw final;
		if (!connecting) {
			// After a failed attempt: wait a while before announcing again
			if (now() < retryAt) throw new FilesError('offline', '/');
			connecting = connect().then(
				(rpc) => {
					failures = 0;
					return rpc;
				},
				(e: unknown) => {
					connecting = null;
					if (!final) {
						retryAt = now() + backoff[Math.min(failures, backoff.length - 1)];
						failures++;
					}
					throw e;
				}
			);
		}
		const rpc = await connecting;
		try {
			return await rpcLiveCall(rpc)(method, params, upload);
		} catch (e) {
			if (final) throw final;
			throw e;
		}
	};

	return {
		source: liveSource(call, caps),
		close() {
			end(new FilesError('ended', '/'), false);
		}
	};
}
