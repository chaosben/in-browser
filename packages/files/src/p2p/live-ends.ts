// Live channels: named lines of messages on a signed-in connection – to the guest of a share, to the device sharing
// with this browser, or to another device of the group – for what happens live between two browsers (the remote
// control of a presentation). They ride on the connection's `Rpc` (so they wait for its sign-in and keep their order),
// carry JSON only, never files, and know nothing of what they are for. A message with `latest` replaces one of the
// same key that hasn't gone out yet (a pointer's positions: only the newest counts). Liveness is the users' matter:
// they say hello now and then and count silence (`pdf-editor` `show/control.svelte.ts`).
//
// Live sessions: what a browser offers live (`{ kind, path, title }`, e.g. a presentation of a PDF) is told to the
// other end on the channel `live`; the registry of kinds is `live-sessions.ts`.

import type { Handler, Json, Rpc } from './rpc.js';

/** Who is at the other end */
export interface LivePeer {
	/** Unique while the connection lasts (`guest:<share>`, `host`, `device:<id>`) */
	id: string;
	kind: 'guest' | 'host' | 'device';
	/** The device's name; a guest has none */
	name: string;
	/** The share a guest came through */
	share?: string;
}

export interface LiveEnd {
	readonly peer: LivePeer;
	/** The connection is there (a guest's end to its host comes back after a drop) */
	readonly open: boolean;
	send(channel: string, message: Json, options?: { latest?: string }): void;
	onMessage(channel: string, handler: (message: Json) => void): () => void;
	/** Opened again (a guest's end), or closed for good (`open` false) */
	onState(handler: () => void): () => void;
}

/** What a browser offers live to the other end */
export interface LiveSession {
	/** Kind (`live-sessions.ts`), e.g. `present` */
	kind: string;
	/** The document, as the offering side names it (a guest: its path inside the share) */
	path: string;
	title: string;
}

/** The channel live sessions are told on */
export const SESSIONS = 'live';

const isSession = (s: unknown): s is LiveSession =>
	!!s && typeof s === 'object' && typeof (s as LiveSession).kind === 'string' && typeof (s as LiveSession).path === 'string' && typeof (s as LiveSession).title === 'string';

/** The sessions of a `live` message (checked: the other end may send anything) */
export function sessionsOf(message: Json): LiveSession[] {
	const list = (message as { sessions?: unknown } | null)?.sessions;
	return Array.isArray(list) ? list.filter(isSession).slice(0, 16) : [];
}

/**
 * An end whose connection may be replaced (a guest's end comes back after a drop): handlers stay, messages go out on
 * the connection there is now – or nowhere while there is none (the users repeat what matters).
 */
export class Rebindable implements LiveEnd {
	private rpc: Rpc | null = null;
	private readonly handlers = new Map<string, Set<(message: Json) => void>>();
	private readonly states = new Set<() => void>();
	private readonly waiting = new Map<string, { channel: string; message: Json } | null>();

	constructor(readonly peer: LivePeer) {}

	get open(): boolean {
		return !!this.rpc;
	}

	/** Takes a (signed-in) connection: its `ch` requests reach the handlers; `handle` registers like the owner wants
	 * (behind its sign-in) */
	bind(rpc: Rpc, handle: (method: string, handler: Handler) => void = (m, h) => rpc.handle(m, h)) {
		this.rpc = rpc;
		this.waiting.clear();
		handle('ch', async (params) => {
			const { c, m } = (params ?? {}) as { c?: unknown; m?: Json };
			if (typeof c !== 'string') return;
			for (const h of this.handlers.get(c) ?? []) {
				try {
					h(m ?? null);
				} catch (e) {
					console.error('[P2P] live channel', e);
				}
			}
		});
		this.changed();
	}

	/** The connection went */
	unbind(rpc: Rpc) {
		if (this.rpc !== rpc) return;
		this.rpc = null;
		this.waiting.clear();
		this.changed();
	}

	send(channel: string, message: Json, options: { latest?: string } = {}) {
		const rpc = this.rpc;
		if (!rpc) return;
		const key = options.latest;
		if (key === undefined) return void rpc.call('ch', { c: channel, m: message }).catch(() => {});
		// One of this key on its way: the newest waits, older waiting ones are dropped
		if (this.waiting.has(key)) return void this.waiting.set(key, { channel, message });
		this.waiting.set(key, null);
		const go = (c: string, m: Json) =>
			rpc
				.call('ch', { c, m })
				.catch(() => {})
				.finally(() => {
					const next = this.waiting.get(key);
					if (next && this.rpc === rpc) {
						this.waiting.set(key, null);
						go(next.channel, next.message);
					} else this.waiting.delete(key);
				});
		go(channel, message);
	}

	onMessage(channel: string, handler: (message: Json) => void): () => void {
		const set = this.handlers.get(channel) ?? new Set();
		set.add(handler);
		this.handlers.set(channel, set);
		return () => set.delete(handler);
	}

	onState(handler: () => void): () => void {
		this.states.add(handler);
		return () => this.states.delete(handler);
	}

	private changed() {
		for (const h of [...this.states]) h();
	}
}
