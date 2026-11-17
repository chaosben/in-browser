import { basename, parent, segments } from '../path.js';
import type { FileState } from '../sync/plan.js';
import { scan, stateOf } from '../sync/scan.js';
import { channelLink, type Link } from './link.js';
import type { Tree } from './session.js';

// Helpers for the browser specs (never imported by the app): a Tree over its own OPFS folder per simulated device,
// and two devices connected by a real WebRTC data channel inside the page.

export async function folderTree(name: string): Promise<Tree & { clear(): Promise<void> }> {
	const opfs = await navigator.storage.getDirectory();
	await opfs.removeEntry(name, { recursive: true }).catch(() => {});
	const root = await opfs.getDirectoryHandle(name, { create: true });
	const dir = async (path: string, create = false) => {
		let handle = root;
		for (const part of segments(path)) handle = await handle.getDirectoryHandle(part, { create });
		return handle;
	};
	const file = async (path: string, create = false) => (await dir(parent(path), create)).getFileHandle(basename(path), { create });
	return {
		scan: () => scan(root),
		async stat(path): Promise<FileState | null> {
			try {
				return stateOf(await (await file(path)).getFile());
			} catch {
				try {
					await dir(path);
					return { kind: 'directory', size: 0, modified: 0 };
				} catch {
					return null;
				}
			}
		},
		read: async (path) => (await file(path)).getFile(),
		write: async (path) => (await file(path, true)).createWritable(),
		mkdir: async (path) => void (await dir(path, true)),
		remove: async (path) => (await dir(parent(path))).removeEntry(basename(path), { recursive: true }),
		async move(from, to) {
			const source = await (await file(from)).getFile();
			const target = await (await file(to, true)).createWritable();
			await source.stream().pipeTo(target);
			await (await dir(parent(from))).removeEntry(basename(from));
		},
		async names(folder) {
			try {
				const names: string[] = [];
				for await (const key of (await dir(folder)).keys()) names.push(key);
				return names;
			} catch {
				return [];
			}
		},
		clear: () => opfs.removeEntry(name, { recursive: true }).catch(() => {})
	};
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
