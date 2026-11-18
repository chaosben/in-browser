import { isInside } from '../path.js';
import {
	answerHello,
	checkHello,
	INVITE_TTL,
	newInviteCode,
	newRoomSecret,
	nonce,
	pairProof,
	PROTOCOL,
	roomId,
	type HelloAnswer
} from './auth.js';
import { deviceIdOf, type Identity } from './identity.js';
import { advance, mergeDevices, mergeLogs, record, type Change, type DeviceInfo, type Vector } from './knowledge.js';
import type { Link } from './link.js';
import type { LogFn } from '../sync/log.js';
import { createOp, heads, mergeOps, resolve, verifyOps, type Group, type Op } from './members.js';
import { uniqueDeviceName } from './names.js';
import type { Network, NetworkRoom } from './network.js';
import { Rpc, type Handler, type Json } from './rpc.js';
import { exclude as excludeFolder, include as includeFolder, inScope } from './scope.js';
import { drive, Gate, serve, type DriveResult, type Tree } from './session.js';
import { staleness } from './staleness.js';
import type { P2pState, Store } from './store.js';

// One device of a group: finds the others (rooms), signs them in, syncs with them, keeps the member log and what
// everybody knows. Independent of the UI and of the network (the app passes Trystero, the specs an in-page hub).

/** Old rooms are visited this long after a removal, so devices that were offline learn about it */
const OLD_ROOMS_FOR = 30 * 24 * 60 * 60 * 1000;
const HELLO_TIMEOUT = 10_000;
const INTERVAL = 60_000;
/** Paths a session wrote are no local changes for this long */
const OWN_WRITE_FOR = 10_000;
/** A confirmation of held deletions counts for the sessions within this time (on both devices of a session) */
const ALLOW_DELETES_FOR = 60_000;

export interface DeviceView {
	id: string;
	name: string;
	self: boolean;
	online: boolean;
	/** In the room, but no direct connection came about */
	unreachable: boolean;
	/** Has another protocol version */
	outdated: boolean;
	syncing: { done: number; total: number } | null;
	lastSync: number;
	lastSeen: number;
	/** Changes it is missing, as far as known */
	missing: { changes: number; more: boolean } | null;
	scope: string[];
}

export interface P2pView {
	state: 'off' | 'online' | 'removed';
	self: { id: string; name: string } | null;
	devices: DeviceView[];
	invite: { code: string; expires: number } | null;
	scope: string[];
	pendingDeletes: number;
	failed: number;
	/** Last sync of this device with any other */
	lastSync: number;
}

export type DeviceEvent =
	| { type: 'conflicts'; paths: string[] }
	| { type: 'added'; name: string }
	| { type: 'removed'; name: string }
	| { type: 'paired' };

export interface DeviceOptions {
	store: Store;
	tree: Tree;
	network: Network;
	/** Label of a conflict copy: `conflict Laptop` / `Konflikt Laptop` */
	conflictLabel: (deviceName: string) => string;
	onChange?: (view: P2pView) => void;
	onEvent?: (event: DeviceEvent) => void;
	now?: () => number;
	/** Opt-in log for finding errors */
	log?: LogFn;
	/** A device answered with another protocol version (the p2p-node then looks for an update) */
	onOutdated?: (version: number) => void;
}

interface Peer {
	id: string;
	rpc: Rpc;
	link: Link;
	syncing: { done: number; total: number } | null;
	timer?: ReturnType<typeof setTimeout>;
	running?: boolean;
	again?: boolean;
}

export class Device {
	identity!: Identity;
	state!: P2pState;
	group: Group | null = null;
	private peers = new Map<string, Peer>();
	private unreachable = new Set<string>();
	private outdated = new Set<string>();
	private rooms = new Map<string, NetworkRoom>();
	private pairRooms = new Map<string, NetworkRoom>();
	private gate = new Gate();
	private ownWrites = new Map<string, number>();
	/** Until when held deletions may go through (the user confirmed them) */
	private allowDeletesUntil = 0;
	/** Deletions held for confirmation, per device (from the last session with it, whoever drove) */
	private pendingDeletes = new Map<string, number>();
	private failed = 0;
	private interval?: ReturnType<typeof setInterval>;
	private saving: Promise<void> = Promise.resolve();
	private stopped = false;
	/** Raised when this device leaves its group: answers of connections from before are dropped */
	private epoch = 0;

	constructor(private options: DeviceOptions) {}

	private log: LogFn = (event, data) => this.options.log?.(event, data);

	/** Short name of a device for the log */
	private nameOf(id: string) {
		return `${this.group?.members.get(id)?.name ?? this.group?.removed.get(id)?.name ?? '?'} (${id.slice(0, 6)})`;
	}

	private now() {
		return this.options.now?.() ?? Date.now();
	}

	async start() {
		this.identity = await this.options.store.identity();
		this.state = await this.options.store.load();
		this.state.invites = this.state.invites.filter((invite) => invite.expires > this.now());
		this.group = resolve(this.state.ops);
		this.log('device.start', { self: this.nameOf(this.identity.id), members: this.group ? [...this.group.members.keys()].map((id) => this.nameOf(id)) : [], scope: this.state.scope });
		await this.connect();
		this.interval = setInterval(() => this.scheduleAll(0), INTERVAL);
		this.emit();
	}

	stop() {
		this.stopped = true;
		clearInterval(this.interval);
		for (const room of [...this.rooms.values(), ...this.pairRooms.values()]) room.leave();
		this.rooms.clear();
		this.pairRooms.clear();
		for (const peer of this.peers.values()) peer.rpc.close();
		this.peers.clear();
	}

	// --- Group ---

	async createGroup(name: string) {
		if (this.group) return;
		const op = await createOp(this.identity, [], { type: 'create', key: this.identity.key, name, room: newRoomSecret() }, this.now());
		await this.setOps([op]);
		this.state.removed = undefined;
		await this.connect();
	}

	/** New one-time key; this device listens for the new one while it is valid */
	async invite(): Promise<{ code: string; expires: number }> {
		if (!this.group) throw new Error('No group');
		const invite = { code: newInviteCode(), expires: this.now() + INVITE_TTL };
		this.state.invites = [...this.state.invites, invite];
		await this.save();
		await this.listenForPairing(invite.code);
		this.emit();
		return invite;
	}

	async cancelInvites() {
		this.state.invites = [];
		for (const room of this.pairRooms.values()) room.leave();
		this.pairRooms.clear();
		await this.save();
		this.emit();
	}

	/** Joins the group of another device with its one-time key (both online); resolves once paired */
	async join(code: string, name: string, timeout = 120_000): Promise<void> {
		if (this.group) throw new Error('Already in a group');
		if (this.state.removed) {
			this.identity = await this.options.store.resetIdentity();
			this.state = { ...this.state, removed: undefined, ops: [], devices: {}, log: [], vector: {} };
		}
		const room = this.options.network.join(await roomId('pair', code), code);
		try {
			await new Promise<void>((resolveJoin, rejectJoin) => {
				const timer = setTimeout(() => rejectJoin(new Error('timeout')), timeout);
				room.onLink(async (link) => {
					const rpc = new Rpc(link);
					try {
						const fingerprints = link.fingerprints();
						const reply = (await rpc.call('pair', {
							v: PROTOCOL,
							key: this.identity.key,
							name,
							proof: await pairProof(code, 'new', fingerprints)
						})) as unknown as { ops: Op[]; proof: string };
						if (reply.proof !== (await pairProof(code, 'inviter', fingerprints))) throw new Error('Wrong proof');
						const ops = await verifyOps(reply.ops);
						if (!resolve(ops)?.members.has(this.identity.id)) throw new Error('Not added');
						clearTimeout(timer);
						await this.setOps(ops);
						resolveJoin();
					} catch (e) {
						console.warn('[P2P] pairing failed', e);
					} finally {
						rpc.close();
					}
				});
			});
		} finally {
			room.leave();
		}
		this.options.onEvent?.({ type: 'paired' });
		await this.connect();
	}

	async rename(name: string) {
		await this.addOp({ type: 'rename', name });
	}

	/** Removes another device (or this one: leaving the group) */
	async remove(device: string) {
		const name = this.group?.members.get(device)?.name ?? '';
		await this.addOp({ type: 'remove', device, room: newRoomSecret() });
		this.peers.get(device)?.rpc.close();
		if (device !== this.identity.id) this.options.onEvent?.({ type: 'removed', name });
	}

	/** Leaves the group: removes itself, forgets everything about it (files stay) */
	async leave() {
		if (this.group?.members.has(this.identity.id)) await this.remove(this.identity.id);
		await this.forget();
	}

	/** After being removed or leaving: back to “no group” (a new key pair for a later pairing) */
	async forget() {
		this.epoch++;
		this.log('device.reset');
		const peers = Object.keys(this.state.devices);
		for (const room of [...this.rooms.values(), ...this.pairRooms.values()]) room.leave();
		this.rooms.clear();
		this.pairRooms.clear();
		for (const peer of this.peers.values()) peer.rpc.close();
		this.peers.clear();
		await this.options.store.clearBases(peers);
		this.identity = await this.options.store.resetIdentity();
		this.state = { ...this.state, ops: [], devices: {}, log: [], vector: {}, invites: [], removed: undefined };
		this.group = null;
		await this.save();
		this.emit();
	}

	/** Folders this device takes part in; `deleted`: excluded folders whose local copy was deleted */
	async setScope(next: string[]) {
		const dropped = next.filter((folder) => !this.state.scope.includes(folder));
		this.log('scope.set', { scope: next, newlyExcluded: dropped });
		this.state.scope = next;
		// Forget the base below newly excluded folders: deleting the local copy must not count as a deletion later,
		// and including them again starts like a first sync (nothing gets deleted)
		if (dropped.length) {
			for (const peer of Object.keys(this.state.devices)) {
				const base = await this.options.store.loadBase(peer);
				for (const path of [...base.keys()]) if (dropped.some((folder) => isInside(path, folder))) base.delete(path);
				await this.options.store.saveBase(peer, base);
			}
		}
		this.touchSelf();
		await this.save();
		// Tell the others first (their sessions with us use our folders), then sync again
		for (const peer of this.peers.values()) {
			peer.rpc
				.call('knowledge', this.knowledge() as unknown as Json)
				.then(async () => {
					if (this.drives(peer.id)) this.schedule(peer, 0);
					else await peer.rpc.call('changed');
				})
				.catch(() => {});
		}
		this.emit();
	}

	async excludeFolder(folder: string) {
		await this.setScope(excludeFolder(this.state.scope, folder));
	}

	async includeFolder(folder: string) {
		await this.setScope(includeFolder(this.state.scope, folder));
	}

	/** A session is running right now (driven or answered) */
	get busy() {
		return this.gate.busy;
	}

	syncNow() {
		this.scheduleAll(0);
		for (const peer of this.peers.values()) if (!this.drives(peer.id)) peer.rpc.call('changed').catch(() => {});
	}

	applyDeletes() {
		this.allowDeletesUntil = this.now() + ALLOW_DELETES_FOR;
		this.log('deletes.allowed');
		this.syncNow();
	}

	private deletesAllowed() {
		return this.now() < this.allowDeletesUntil;
	}

	/** What the last session with `peer` held back; the confirmation ends once nothing waits anymore */
	private setPending(peer: string, count: number) {
		if (count) this.pendingDeletes.set(peer, count);
		else this.pendingDeletes.delete(peer);
		if (!this.pendingDeletes.size) this.allowDeletesUntil = 0;
	}

	/** Changes of the local file system (from `watch`); those a session wrote itself are skipped */
	async localChange(paths: string[]) {
		if (!this.group || !this.state) return;
		const now = this.now();
		// Changes in excluded folders concern only this device
		const own = paths.filter((path) => {
			const until = this.ownWrites.get(path);
			return (!until || until < now) && inScope(path, this.state.scope);
		});
		const skipped = paths.filter((path) => !own.includes(path));
		if (skipped.length) this.log('local.skipped', { paths: skipped, reason: 'written by a sync or outside the folders' });
		if (!own.length) return;
		this.log('local.change', { paths: own });
		let { log, vector } = this.state;
		for (const path of own) ({ log, vector } = record(log, vector, this.identity.id, path));
		this.state.log = log;
		this.state.vector = vector;
		this.touchSelf();
		await this.save();
		for (const peer of this.peers.values()) {
			if (this.drives(peer.id)) this.schedule(peer, 2000);
			else peer.rpc.call('changed').catch(() => {});
		}
		this.emit();
	}

	// --- Rooms and peers ---

	/** Joins the rooms of the group (current and recently replaced) and the pairing rooms of open invites */
	private async connect() {
		if (this.stopped) return;
		const wanted = new Map<string, string>();
		if (this.group && this.group.members.has(this.identity.id)) {
			wanted.set(await roomId('group', this.group.room), this.group.room);
			for (const old of this.group.oldRooms) {
				if (old.until > this.now() - OLD_ROOMS_FOR) wanted.set(await roomId('group', old.room), old.room);
			}
		}
		for (const [id, room] of this.rooms) {
			if (!wanted.has(id)) {
				room.leave();
				this.rooms.delete(id);
			}
		}
		for (const [id, secret] of wanted) {
			if (this.rooms.has(id)) continue;
			const room = this.options.network.join(id, secret);
			room.onLink((link) => this.attach(link));
			room.onUnreachable?.((peerId) => {
				this.log('peer.unreachable', { peer: this.nameOf(peerId) });
				this.unreachable.add(peerId);
				this.emit();
			});
			this.rooms.set(id, room);
		}
		for (const invite of this.state.invites) await this.listenForPairing(invite.code);
	}

	private async listenForPairing(code: string) {
		if (this.pairRooms.has(code) || !this.group) return;
		const room = this.options.network.join(await roomId('pair', code), code);
		room.onLink((link) => {
			const rpc = new Rpc(link);
			rpc.handle('pair', (params) => this.pair(code, params, link.fingerprints()));
			link.onClose(() => rpc.close());
		});
		this.pairRooms.set(code, room);
	}

	/** The inviting side of a pairing */
	private async pair(code: string, params: Json, fingerprints: string) {
		const { v, key, name, proof } = params as { v: number; key: string; name: string; proof: string };
		const invite = this.state.invites.find((i) => i.code === code && i.expires > this.now());
		if (!invite || v !== PROTOCOL || proof !== (await pairProof(code, 'new', fingerprints))) throw new Error('Pairing refused');
		const device = await deviceIdOf(key);
		const taken = [...(this.group?.members.values() ?? [])].map((m) => m.name);
		const unique = uniqueDeviceName(name.trim() || 'Device', taken);
		await this.addOp({ type: 'add', device, key, name: unique });
		this.state.invites = this.state.invites.filter((i) => i !== invite);
		await this.save();
		// Leave the pairing room once the answer is out
		const room = this.pairRooms.get(code);
		this.pairRooms.delete(code);
		setTimeout(() => room?.leave(), 3000);
		this.log('pair.added', { device: unique });
		this.options.onEvent?.({ type: 'added', name: unique });
		this.emit();
		return { value: { ops: this.state.ops, proof: await pairProof(code, 'inviter', fingerprints) } as unknown as Json };
	}

	/** A device connected in a group room: sign in both ways, then sync */
	private attach(link: Link) {
		const rpc = new Rpc(link);
		const epoch = this.epoch;
		const current = () => epoch === this.epoch && !this.state.removed;
		let peerId: string | null = null;
		let verified!: (ok: boolean) => void;
		const signedIn = new Promise<boolean>((resolveSignIn) => (verified = resolveSignIn));
		const guarded = (handler: Handler): Handler => async (params, upload) => {
			if (!(await signedIn) || !current()) throw new Error('Not signed in');
			return handler(params, upload);
		};
		const handle = (method: string, handler: Handler) => rpc.handle(method, guarded(handler));

		rpc.handle('hello', async (params) => {
			const answer = await answerHello(this.identity, this.state.ops, (params as { nonce: string }).nonce, link.fingerprints());
			return { value: { ...answer, info: this.knowledge() } as unknown as Json };
		});
		const release = serve(
			{ handle },
			{
				tree: this.options.tree,
				gate: this.gate,
				onWrite: (path) => this.ownWrite(path),
				scope: () => this.state.scope,
				allowDeletes: () => this.deletesAllowed(),
				onEnd: (summary) => {
					if (!peerId) return;
					this.setPending(peerId, summary.pendingDeletes);
					this.emit();
				},
				log: (event, data) => this.log(event, { ...data, from: peerId ? this.nameOf(peerId) : '?' })
			}
		);
		link.onClose(release);
		handle('changed', async () => {
			if (peerId) this.scheduleById(peerId, 500);
		});
		handle('members', async (params) => {
			await this.mergeMembers(await verifyOps(params as unknown as Op[]));
		});
		handle('knowledge', async (params) => {
			const theirs = params as unknown as Knowledge;
			if (peerId) await this.takeKnowledge(peerId, theirs, theirs.syncedWith === this.identity.id);
			return { value: this.knowledge() as unknown as Json };
		});
		handle('sizes', async (params) => ({ value: (await this.folderSizes(params as string)) as unknown as Json }));

		const fail = () => {
			verified(false);
			rpc.close();
		};
		const timer = setTimeout(fail, HELLO_TIMEOUT);
		const myNonce = nonce();
		rpc
			.call('hello', { nonce: myNonce })
			.then(async (reply) => {
				const answer = reply as unknown as HelloAnswer & { info: Knowledge };
				const check = await checkHello(answer, myNonce, link.fingerprints(), this.state.ops);
				clearTimeout(timer);
				if (epoch !== this.epoch) return fail();
				if (!check.ok) {
					this.log('signIn.rejected', { peer: answer.id ? this.nameOf(answer.id) : '?', reason: check.reason });
					if (check.reason === 'version') {
						this.outdated.add(answer.id);
						this.options.onOutdated?.(answer.v);
						this.emit();
					}
					return fail();
				}
				peerId = answer.id;
				this.outdated.delete(peerId);
				this.unreachable.delete(peerId);
				this.peers.get(peerId)?.rpc.close();
				const peer: Peer = { id: peerId, rpc, link, syncing: null };
				this.peers.set(peerId, peer);
				link.onClose(() => {
					this.log('peer.closed', { peer: this.nameOf(peer.id) });
					if (this.peers.get(peer.id) === peer) this.peers.delete(peer.id);
					clearTimeout(peer.timer);
					this.emit();
				});
				await this.mergeMembers(check.ops);
				if (!this.group?.members.has(peerId)) return fail();
				await this.takeKnowledge(peerId, answer.info, false);
				verified(true);
				// Entries the partner didn't have when it answered (e.g. a rename made during the sign-in) follow now
				const theirs = new Set((answer.ops ?? []).map((op) => op.id));
				if (this.state.ops.some((op) => !theirs.has(op.id))) rpc.call('members', this.state.ops as unknown as Json).catch(() => {});
				this.log('signIn.ok', { peer: this.nameOf(peerId), drives: this.drives(peerId) });
				this.emit();
				if (this.drives(peerId)) this.schedule(peer, 0);
			})
			.catch(fail);
	}

	/** This device drives the sync with `peer` (the smaller ID drives) */
	private drives(peer: string) {
		return this.identity.id < peer;
	}

	private scheduleAll(delay: number) {
		for (const peer of this.peers.values()) if (this.drives(peer.id)) this.schedule(peer, delay);
	}

	private scheduleById(id: string, delay: number) {
		const peer = this.peers.get(id);
		if (peer && this.drives(id)) this.schedule(peer, delay);
	}

	private schedule(peer: Peer, delay: number) {
		clearTimeout(peer.timer);
		peer.timer = setTimeout(() => {
			if (peer.running) peer.again = true;
			else void this.syncWith(peer);
		}, delay);
	}

	private async syncWith(peer: Peer) {
		if (this.peers.get(peer.id) !== peer) return;
		peer.running = true;
		let result: DriveResult | null = null;
		try {
			const info = this.state.devices[peer.id];
			const base = await this.options.store.loadBase(peer.id);
			const names = (id: string) => this.group?.members.get(id)?.name ?? '';
			const allow = this.deletesAllowed();
			this.log('session.start', { peer: this.nameOf(peer.id), base: base.size, theirScope: info?.scope ?? [] });
			result = await drive(peer.rpc, {
				tree: this.options.tree,
				gate: this.gate,
				scope: { mine: this.state.scope, theirs: info?.scope ?? [] },
				base,
				saveBase: (b) => this.options.store.saveBase(peer.id, b),
				conflictLabel: (side) => this.options.conflictLabel(names(side === 'mine' ? this.identity.id : peer.id)),
				onTheirScope: (scope) => {
					const known = this.state.devices[peer.id];
					if (known) known.scope = scope;
				},
				allowDeletes: allow,
				onWrite: (path) => this.ownWrite(path),
				onProgress: (done, total) => {
					peer.syncing = { done, total };
					this.emit();
				},
				log: (event, data) => this.log(event, { ...data, peer: this.nameOf(peer.id) })
			});
			if (result.busy) {
				this.log('session.busy', { peer: this.nameOf(peer.id) });
				this.schedule(peer, 2000 + Math.random() * 2000);
				return;
			}
			this.setPending(peer.id, result.pendingDeletes);
			this.failed = result.failed;
			if (result.conflicts.length) this.options.onEvent?.({ type: 'conflicts', paths: result.conflicts });
			if (!result.failed && !result.pendingDeletes && !result.skipped) {
				const theirs = (await peer.rpc.call('knowledge', { ...this.knowledge(), syncedWith: peer.id } as unknown as Json)) as unknown as Knowledge;
				await this.takeKnowledge(peer.id, theirs, true);
			}
		} catch (e) {
			console.warn('[P2P] sync failed', e);
			this.log('session.error', { peer: this.nameOf(peer.id), error: e instanceof Error ? e.message : String(e) });
		} finally {
			peer.running = false;
			peer.syncing = null;
			this.emit();
			// Conflict copies are new files: one more run brings them over; skipped steps (changed meanwhile) as well
			if (peer.again || result?.conflicts.length || result?.skipped) {
				peer.again = false;
				this.schedule(peer, result?.skipped ? 2000 : 500);
			}
		}
	}

	// --- Member log ---

	private async addOp(body: Op['body']) {
		const op = await createOp(this.identity, heads(this.state.ops), body, this.now());
		this.log('members.add', { type: body.type, ...('device' in body ? { device: this.nameOf(body.device) } : {}), ...('name' in body ? { name: body.name } : {}) });
		await this.setOps([...this.state.ops, op]);
		for (const peer of this.peers.values()) peer.rpc.call('members', this.state.ops as unknown as Json).catch(() => {});
		await this.connect();
	}

	private async mergeMembers(ops: Op[]) {
		const merged = mergeOps(this.state.ops, ops);
		if (merged.length === this.state.ops.length) return;
		const roomBefore = this.group?.room;
		const known = new Set(this.state.ops.map((op) => op.id));
		this.log('members.merged', { new: ops.filter((op) => !known.has(op.id)).map((op) => `${op.body.type} by ${this.nameOf(op.author)}`) });
		await this.setOps(merged);
		for (const [id, peer] of this.peers) if (!this.group?.members.has(id)) peer.rpc.close();
		if (this.group?.room !== roomBefore || !this.group?.members.has(this.identity.id)) await this.connect();
	}

	private async setOps(ops: Op[]) {
		this.state.ops = ops;
		this.group = resolve(ops);
		if (this.group?.removed.has(this.identity.id)) {
			this.log('members.selfRemoved');
			this.state.removed = true;
			for (const room of [...this.rooms.values(), ...this.pairRooms.values()]) room.leave();
			this.rooms.clear();
			this.pairRooms.clear();
			for (const peer of this.peers.values()) peer.rpc.close();
			this.peers.clear();
		}
		this.touchSelf();
		await this.save();
		this.emit();
	}

	// --- What devices know ---

	private knowledge(): Knowledge {
		return { log: this.state.log, vector: this.state.vector, scope: this.state.scope, devices: this.state.devices };
	}

	/** Merges what another device knows; `synced`: right after a sync without failures with it */
	private async takeKnowledge(peer: string, theirs: Knowledge, synced: boolean) {
		const now = this.now();
		const log = mergeLogs(this.state.log, theirs.log ?? []);
		this.state.log = log;
		this.state.devices = mergeDevices(this.state.devices, theirs.devices ?? {});
		const info = this.state.devices[peer] ?? { lastSeen: 0, lastSync: 0, scope: [], vector: {} };
		this.state.devices[peer] = { ...info, lastSeen: now, scope: theirs.scope ?? [], vector: theirs.vector ?? {} };
		if (synced) {
			const theirVector = theirs.vector ?? {};
			const theirScope = theirs.scope ?? [];
			const before = this.state.vector;
			this.state.vector = advance(this.state.vector, this.state.scope, theirVector, theirScope, log);
			this.log('knowledge.synced', { peer: this.nameOf(peer), before, after: this.state.vector, theirs: theirVector });
			// The partner takes over our numbers the same way; compute its result here too, so both sides know it
			this.state.devices[peer].vector = advance(theirVector, theirScope, this.state.vector, this.state.scope, log);
			this.state.devices[peer].lastSync = now;
			this.markSynced(now);
		}
		this.touchSelf();
		await this.save();
		this.emit();
	}

	private markSynced(now: number) {
		this.touchSelf();
		this.state.devices[this.identity.id].lastSync = now;
	}

	private touchSelf() {
		if (!this.identity) return;
		const info = this.state.devices[this.identity.id] ?? { lastSeen: 0, lastSync: 0, scope: [], vector: {} };
		this.state.devices[this.identity.id] = { ...info, lastSeen: this.now(), scope: this.state.scope, vector: this.state.vector };
	}

	private ownWrite(path: string) {
		this.ownWrites.set(path, this.now() + OWN_WRITE_FOR);
		if (this.ownWrites.size > 5000) {
			const now = this.now();
			for (const [p, until] of this.ownWrites) if (until < now) this.ownWrites.delete(p);
		}
	}

	private async folderSizes(folder: string): Promise<Record<string, number>> {
		const sizes: Record<string, number> = {};
		for (const [path, state] of await this.options.tree.scan()) {
			if (state.kind !== 'file' || !isInside(path, folder) || path === folder) continue;
			const child = folder === '/' ? '/' + path.split('/')[1] : folder + '/' + path.slice(folder.length + 1).split('/')[0];
			sizes[child] = (sizes[child] ?? 0) + state.size;
		}
		return sizes;
	}

	/** How the connections to the other devices run (diagnostics) */
	async connectionStats(): Promise<{ id: string; name: string; connection: string; rtt: number | null }[]> {
		return Promise.all(
			[...this.peers.values()].map(async (peer) => {
				const stats = (await peer.link.stats?.().catch(() => null)) ?? { type: 'unknown', rtt: null };
				return { id: peer.id, name: this.group?.members.get(peer.id)?.name ?? '', connection: stats.type, rtt: stats.rtt };
			})
		);
	}

	/** Sizes of the subfolders of `folder` on every connected device (for choosing folders) */
	async remoteSizes(folder: string): Promise<Record<string, Record<string, number>>> {
		const out: Record<string, Record<string, number>> = {};
		await Promise.all(
			[...this.peers.values()].map(async (peer) => {
				out[peer.id] = (await peer.rpc.call('sizes', folder).catch(() => ({}))) as Record<string, number>;
			})
		);
		out[this.identity.id] = await this.folderSizes(folder);
		return out;
	}

	private save() {
		const snapshot = structuredClone(this.state);
		this.saving = this.saving.then(() => this.options.store.save(snapshot)).catch((e) => console.error('[P2P]', e));
		return this.saving;
	}

	// --- View ---

	view(): P2pView {
		const group = this.group;
		if (!this.identity || !this.state) return { state: 'off', self: null, devices: [], invite: null, scope: [], pendingDeletes: 0, failed: 0, lastSync: 0 };
		if (this.state.removed) return { ...this.view0(), state: 'removed' };
		if (!group) return this.view0();
		const devices: DeviceView[] = [...group.members].map(([id, member]) => {
			const info = this.state.devices[id];
			const self = id === this.identity.id;
			const peer = this.peers.get(id);
			return {
				id,
				name: member.name,
				self,
				online: self || !!peer,
				unreachable: !peer && this.unreachable.has(id),
				outdated: this.outdated.has(id),
				syncing: peer?.syncing ?? null,
				lastSync: info?.lastSync ?? 0,
				lastSeen: info?.lastSeen ?? 0,
				missing: self || !info ? null : (({ changes, more }) => ({ changes, more }))(staleness(info, this.state.log)),
				scope: info?.scope ?? []
			};
		});
		devices.sort((a, b) => Number(b.self) - Number(a.self) || a.name.localeCompare(b.name));
		return {
			...this.view0(),
			state: 'online',
			self: { id: this.identity.id, name: group.members.get(this.identity.id)?.name ?? '' },
			devices
		};
	}

	private view0(): P2pView {
		const invite = this.state.invites.filter((i) => i.expires > this.now()).at(-1) ?? null;
		return {
			state: 'off',
			self: null,
			devices: [],
			invite,
			scope: this.state.scope,
			pendingDeletes: [...this.pendingDeletes.values()].reduce((sum, n) => sum + n, 0),
			failed: this.failed,
			lastSync: this.state.devices[this.identity.id]?.lastSync ?? 0
		};
	}

	private emit() {
		this.options.onChange?.(this.view());
	}
}

export interface Knowledge {
	log: Change[];
	vector: Vector;
	scope: string[];
	devices: Record<string, DeviceInfo>;
	/** Set when sent right after a sync with the receiver */
	syncedWith?: string;
}
