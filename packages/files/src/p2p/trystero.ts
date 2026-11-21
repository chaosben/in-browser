import { getRelaySockets, joinRoom } from 'trystero';
import { connectionFingerprints, connectionStats, type Link } from './link.js';
import type { Network } from './network.js';

// Finding the other devices through public Nostr relays (Trystero): only encrypted connection offers pass through
// them (password = room secret); the data then flows directly between the devices (WebRTC, DTLS).

const APP_ID = 'in-browser/files';

/**
 * Where devices find each other. Two devices meet only on a relay both use, so the list is ours, not the library's
 * (its default is picked from a list that changes with its versions – devices on different versions of the site
 * would then wait in different places, online and without an error). The first five are what every version before
 * used; the rest is reserve for failures and rate limits of single relays.
 * Changing it: keep the relays of the versions still in use (open tabs, installed apps, p2p-nodes before their
 * update) for a while, and only ever drop a few at a time.
 */
export const RELAYS: readonly string[] = [
	'wss://relay.mostro.network',
	'wss://relay.nostr.com',
	'wss://nostr.sathoarder.com',
	'wss://relay.nostr.net',
	'wss://relay.ditto.pub',
	'wss://relay.primal.net',
	'wss://relay.snort.social'
];
export const STUN = 'stun:stun.cloudflare.com:3478';

export interface TrysteroOptions {
	/** WebRTC outside the browser (the p2p-node in Node) */
	rtcPolyfill?: typeof RTCPeerConnection;
	/** Other relays than `RELAYS` (tests; the p2p-node's `IN_BROWSER_RELAYS`) */
	relays?: readonly string[];
}

export const createTrysteroNetwork = ({ rtcPolyfill, relays = RELAYS }: TrysteroOptions = {}): Network => ({
	join(roomId, password) {
		const room = joinRoom(
			{
				appId: APP_ID,
				password,
				identity: 'none',
				rtcConfig: { iceServers: [{ urls: STUN }] },
				...(rtcPolyfill ? { rtcPolyfill } : {}),
				relayConfig: { urls: [...relays] }
			},
			roomId
		);
		const action = room.makeAction<Uint8Array>('frame');
		const linkHandlers: ((link: Link, peerId: string) => void)[] = [];
		const unreachableHandlers: ((peerId: string) => void)[] = [];
		const peers = new Map<string, { frames: Set<(frame: Uint8Array<ArrayBuffer>) => void>; closes: Set<() => void>; closed: boolean }>();

		const close = (peerId: string) => {
			const peer = peers.get(peerId);
			if (!peer || peer.closed) return;
			peer.closed = true;
			peers.delete(peerId);
			peer.closes.forEach((handler) => handler());
		};

		room.onPeerJoin(
			({ peerId }) => {
				const peer = { frames: new Set<(frame: Uint8Array<ArrayBuffer>) => void>(), closes: new Set<() => void>(), closed: false };
				peers.set(peerId, peer);
				const link: Link = {
					send: async (frame) => {
						if (peer.closed) throw new Error('Link closed');
						await action.send(frame, { target: peerId });
					},
					onFrame: (handler) => {
						peer.frames.add(handler);
						return () => peer.frames.delete(handler);
					},
					onClose: (handler) => {
						peer.closes.add(handler);
						return () => peer.closes.delete(handler);
					},
					close: () => close(peerId),
					fingerprints: () => {
						const connection = room.getPeers()[peerId]?.connection;
						return connection ? connectionFingerprints(connection) : '';
					},
					stats: async () => {
						const connection = room.getPeers()[peerId]?.connection;
						return connection ? connectionStats(connection) : { type: 'unknown', rtt: null };
					}
				};
				linkHandlers.forEach((handler) => handler(link, peerId));
			},
			{ replay: true }
		);
		room.onPeerLeave(({ peerId }) => close(peerId));
		action.onMessage((data, { peerId }) => {
			const peer = peers.get(peerId);
			if (!peer || peer.closed) return;
			const frame = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data as ArrayBuffer);
			peer.frames.forEach((handler) => handler(frame));
		});
		room.onError((error) => {
			if (error.code === 'peer-connect-failed') unreachableHandlers.forEach((handler) => handler(error.peerId));
		});

		return {
			onLink: (handler) => void linkHandlers.push(handler),
			onUnreachable: (handler) => void unreachableHandlers.push(handler),
			leave: () => {
				for (const peerId of [...peers.keys()]) close(peerId);
				void room.leave();
			}
		};
	}
});

export const trysteroNetwork = createTrysteroNetwork();

/** Relays and whether they are connected (diagnostics) */
export function relayStates(): { url: string; connected: boolean }[] {
	return Object.entries(getRelaySockets()).map(([url, socket]) => ({ url, connected: socket.readyState === WebSocket.OPEN }));
}
