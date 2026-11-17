import { canonical, sha256, toBase64Url } from './bytes.js';
import { deviceIdOf, sign, verify, type Identity } from './identity.js';

// Who belongs to the group of devices: a log of signed entries, each pointing to the entries it saw (`parents`,
// hashes) – so concurrent changes of different devices can be told apart from later ones. Devices merge their logs on
// every contact (union) and all compute the same state from them (`resolve`).
//
// Rules:
// - An entry counts only if its author was a member as far as the author could see (its causal past).
// - A removal beats everything the removed device did concurrently (not seen by the removal).
// - Two devices removing each other concurrently are both out – the safe choice; one of them pairs again.
// - Every removal brings a new room secret, so removed devices can't even find the others any more.

export type Body =
	| { type: 'create'; key: string; name: string; room: string }
	| { type: 'add'; device: string; key: string; name: string }
	| { type: 'remove'; device: string; room: string }
	| { type: 'rename'; name: string };

export interface Op {
	/** Hash of the signed content */
	id: string;
	parents: string[];
	/** Device ID of the signer */
	author: string;
	time: number;
	body: Body;
	/** Signature of the author over `id` */
	sig: string;
}

export interface Member {
	key: string;
	name: string;
}

export interface Group {
	/** ID of the group (the `create` entry) */
	id: string;
	members: Map<string, Member>;
	/** Devices that were members once and are removed */
	removed: Map<string, Member>;
	/** Current room secret */
	room: string;
	/** Earlier room secrets with the time they were replaced (devices visit them a while for latecomers) */
	oldRooms: { room: string; until: number }[];
}

const contentOf = (op: Omit<Op, 'id' | 'sig'>) => canonical({ parents: op.parents, author: op.author, time: op.time, body: op.body });

async function idOf(op: Omit<Op, 'id' | 'sig'>): Promise<string> {
	return toBase64Url(await sha256(contentOf(op)));
}

export async function createOp(identity: Identity, parents: string[], body: Body, time = Date.now()): Promise<Op> {
	const unsigned = { parents: [...parents].sort(), author: identity.id, time, body };
	const id = await idOf(unsigned);
	return { ...unsigned, id, sig: await sign(identity, id) };
}

/** Entries whose hash and signature are right (the author's key comes from the `create`/`add` entries) */
export async function verifyOps(ops: Op[]): Promise<Op[]> {
	const keys = new Map<string, string>();
	for (const op of ops) {
		if (op.body.type === 'create') keys.set(op.author, op.body.key);
		if (op.body.type === 'add') keys.set(op.body.device, op.body.key);
	}
	const valid: Op[] = [];
	for (const op of ops) {
		const key = keys.get(op.author);
		if (!key) continue;
		if (op.body.type === 'create' && (await deviceIdOf(op.body.key)) !== op.author) continue;
		if (op.body.type === 'add' && (await deviceIdOf(op.body.key)) !== op.body.device) continue;
		if ((await idOf(op)) !== op.id) continue;
		if (await verify(key, op.sig, op.id)) valid.push(op);
	}
	return valid;
}

/** Union of two logs */
export function mergeOps(a: Op[], b: Op[]): Op[] {
	const byId = new Map(a.map((op) => [op.id, op]));
	for (const op of b) byId.set(op.id, op);
	return [...byId.values()];
}

/** Entries no other entry points to: the parents of the next entry */
export function heads(ops: Op[]): string[] {
	const referenced = new Set(ops.flatMap((op) => op.parents));
	return ops.filter((op) => !referenced.has(op.id)).map((op) => op.id).sort();
}

/** Entries in an order where parents come first (ties by time, then ID – the same on every device) */
function ordered(ops: Op[]): Op[] {
	const byId = new Map(ops.map((op) => [op.id, op]));
	// Entries whose parents are missing (incomplete log) are left out, with everything after them
	const complete = new Map<string, boolean>();
	const isComplete = (op: Op): boolean => {
		const known = complete.get(op.id);
		if (known !== undefined) return known;
		complete.set(op.id, false);
		const ok = op.parents.every((p) => byId.has(p) && isComplete(byId.get(p)!));
		complete.set(op.id, ok);
		return ok;
	};
	const pending = ops.filter(isComplete).sort((a, b) => a.time - b.time || (a.id < b.id ? -1 : 1));
	const done = new Set<string>();
	const out: Op[] = [];
	while (pending.length) {
		const i = pending.findIndex((op) => op.parents.every((p) => done.has(p)));
		const [op] = pending.splice(i, 1);
		done.add(op.id);
		out.push(op);
	}
	return out;
}

/** State of the group from a verified log; `null` without a `create` entry */
export function resolve(ops: Op[]): Group | null {
	const order = ordered(ops);
	const create = order.find((op) => op.body.type === 'create' && op.parents.length === 0);
	if (!create || create.body.type !== 'create') return null;

	// Causal past of every entry
	const ancestors = new Map<string, Set<string>>();
	for (const op of order) {
		const set = new Set<string>();
		for (const p of op.parents) {
			set.add(p);
			for (const a of ancestors.get(p) ?? []) set.add(a);
		}
		ancestors.set(op.id, set);
	}
	const inPast = (op: Op, of: Op) => ancestors.get(of.id)!.has(op.id);
	const byId = new Map(order.map((op) => [op.id, op]));

	// Whether `device` was a member in the causal past of `op` (adds minus effective removals there)
	const memberBefore = (device: string, op: Op) => {
		let member = false;
		for (const id of ancestors.get(op.id)!) {
			const a = byId.get(id)!;
			if (!valid.has(a.id)) continue;
			if ((a.body.type === 'create' && a.author === device) || (a.body.type === 'add' && a.body.device === device)) member = true;
		}
		if (!member) return false;
		for (const id of ancestors.get(op.id)!) {
			const r = byId.get(id)!;
			if (effective.has(r.id) && r.body.type === 'remove' && r.body.device === device) return false;
		}
		return true;
	};

	// One pass in order: every entry only depends on entries before it
	const valid = new Set<string>();
	const effective = new Set<string>();
	for (const op of order) {
		if (op === create) {
			valid.add(op.id);
			continue;
		}
		if (op.body.type === 'create' || !memberBefore(op.author, op)) continue;
		if (op.body.type === 'remove') effective.add(op.id);
		valid.add(op.id);
	}
	// A removal beats entries of the removed device it didn't see (removals stay effective: mutual ones remove both)
	for (const r of order) {
		if (!effective.has(r.id) || r.body.type !== 'remove') continue;
		const device = r.body.device;
		for (const op of order) {
			if (op.author === device && op.body.type !== 'remove' && op !== create && !inPast(op, r)) valid.delete(op.id);
		}
	}

	const members = new Map<string, Member>();
	const removed = new Map<string, Member>();
	members.set(create.author, { key: create.body.key, name: create.body.name });
	let room = create.body.room;
	const oldRooms: Group['oldRooms'] = [];
	for (const op of order) {
		if (!valid.has(op.id) && !effective.has(op.id)) continue;
		const body = op.body;
		if (body.type === 'add' && !members.has(body.device) && !removed.has(body.device)) {
			members.set(body.device, { key: body.key, name: body.name });
		} else if (body.type === 'rename' && valid.has(op.id)) {
			const member = members.get(op.author);
			if (member) member.name = body.name;
		} else if (body.type === 'remove') {
			const member = members.get(body.device);
			if (member) {
				members.delete(body.device);
				removed.set(body.device, member);
			}
			oldRooms.push({ room, until: op.time });
			room = body.room;
		}
	}
	return { id: create.id, members, removed, room, oldRooms };
}
