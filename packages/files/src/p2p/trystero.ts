import { getRelaySockets, joinRoom } from 'trystero';
import { connectionFingerprints, connectionStats, type Link } from './link.js';
import type { Network } from './network.js';

// Finding the other devices through public Nostr relays (Trystero): only encrypted connection offers pass through
// them (password = room secret); the data then flows directly between the devices (WebRTC, DTLS).

const APP_ID = 'in-browser/files';
export const STUN = 'stun:stun.cloudflare.com:3478';

export interface TrysteroOptions {
	/** WebRTC outside the browser (the p2p-node in Node) */
	rtcPolyfill?: typeof RTCPeerConnection;
	/** Other relays than Trystero's public ones (tests) */
	relays?: string[];
}

export const createTrysteroNetwork = ({ rtcPolyfill, relays }: TrysteroOptions = {}): Network => ({
	join(roomId, password) {
		const room = joinRoom(
			{
				appId: APP_ID,
				password,
				identity: 'none',
				rtcConfig: { iceServers: [{ urls: STUN }] },
				...(rtcPolyfill ? { rtcPolyfill } : {}),
				...(relays ? { relayConfig: { urls: relays } } : {})
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
