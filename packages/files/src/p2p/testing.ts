import { handleTree } from '../sync/handle-tree.js';
import type { Tree } from '../sync/tree.js';
import { connectionFingerprints, connectionStats, type Link } from './link.js';

// Helpers for the browser specs (never imported by the app): a Tree over its own OPFS folder per simulated device
// (the same kind of tree as a folder on disk, with its trash inside),
// and two devices connected by a real WebRTC data channel inside the page.

export async function folderTree(name: string): Promise<Tree & { clear(): Promise<void> }> {
	const opfs = await navigator.storage.getDirectory();
	await opfs.removeEntry(name, { recursive: true }).catch(() => {});
	const root = await opfs.getDirectoryHandle(name, { create: true });
	return { ...handleTree(root), clear: () => opfs.removeEntry(name, { recursive: true }).catch(() => {}) };
}

/** Two ends of a real RTCPeerConnection pair inside this page */
export async function linkedPair(): Promise<[Link, Link]> {
	const a = new RTCPeerConnection();
	const b = new RTCPeerConnection();
	a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate);
	b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate);
	const channelA = a.createDataChannel('sync', { ordered: true });
	const channelB = new Promise<RTCDataChannel>((resolve) => (b.ondatachannel = (e) => resolve(e.channel)));
	await a.setLocalDescription();
	await b.setRemoteDescription(a.localDescription!);
	await b.setLocalDescription();
	await a.setRemoteDescription(b.localDescription!);
	const opened = (channel: RTCDataChannel) =>
		channel.readyState === 'open' ? Promise.resolve() : new Promise((resolve) => channel.addEventListener('open', resolve, { once: true }));
	const remote = await channelB;
	await Promise.all([opened(channelA), opened(remote)]);
	return [channelLink(channelA, a), channelLink(remote, b)];
}

export async function writeText(tree: Tree, path: string, text: string) {
	const writable = await tree.write(path);
	const writer = writable.getWriter();
	await writer.write(new TextEncoder().encode(text));
	await writer.close();
}

export async function readText(tree: Tree, path: string) {
	return (await tree.read(path)).text();
}

/** Network inside the page: every two devices in the same room get a real WebRTC connection */
export function hub(): import('./network.js').Network {
	const rooms = new Map<string, Set<Member>>();
	interface Member {
		handlers: ((link: Link, peerId: string) => void)[];
		links: Link[];
		id: string;
	}
	let next = 0;
	return {
		join(roomId) {
			const member: Member = { handlers: [], links: [], id: `m${next++}` };
			const others = [...(rooms.get(roomId) ?? [])];
			rooms.set(roomId, new Set([...others, member]));
			for (const other of others) {
				void linkedPair().then(([mine, theirs]) => {
					if (!rooms.get(roomId)?.has(member) || !rooms.get(roomId)?.has(other)) return;
					member.links.push(mine);
					other.links.push(theirs);
					setTimeout(() => {
						member.handlers.forEach((h) => h(mine, other.id));
						other.handlers.forEach((h) => h(theirs, member.id));
					});
				});
			}
			return {
				onLink: (handler) => void member.handlers.push(handler),
				leave() {
					rooms.get(roomId)?.delete(member);
					member.links.forEach((link) => link.close());
				}
			};
		}
	};
}

/** Waits until `check` is true (polling), fails after `timeout` */
export async function until(check: () => boolean | Promise<boolean>, timeout = 8000, what = 'condition') {
	const end = Date.now() + timeout;
	while (!(await check())) {
		if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
		await new Promise((r) => setTimeout(r, 25));
	}
}

/** Link over one RTCDataChannel (browser specs; frames must stay below the channel's message size limit) */
export function channelLink(channel: RTCDataChannel, connection: RTCPeerConnection): Link {
	channel.binaryType = 'arraybuffer';
	channel.bufferedAmountLowThreshold = 1 << 20;
	const frameHandlers = new Set<(frame: Uint8Array<ArrayBuffer>) => void>();
	const closeHandlers = new Set<() => void>();
	channel.addEventListener('message', (e) => {
		const frame = new Uint8Array(e.data as ArrayBuffer);
		for (const handler of frameHandlers) handler(frame);
	});
	channel.addEventListener('close', () => closeHandlers.forEach((handler) => handler()));
	return {
		async send(frame) {
			if (channel.readyState !== 'open') throw new Error('Link closed');
			channel.send(frame);
			if (channel.bufferedAmount > 4 << 20) {
				await new Promise<void>((resolve) => channel.addEventListener('bufferedamountlow', () => resolve(), { once: true }));
			}
		},
		onFrame(handler) {
			frameHandlers.add(handler);
			return () => frameHandlers.delete(handler);
		},
		onClose(handler) {
			closeHandlers.add(handler);
			return () => closeHandlers.delete(handler);
		},
		close: () => channel.close(),
		fingerprints: () => connectionFingerprints(connection),
		stats: () => connectionStats(connection)
	};
}
