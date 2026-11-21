import { beforeAll, describe, expect, it } from 'vitest';
import { createIdentity, type Identity } from './identity.js';
import { createOp, heads, knownRooms, mergeOps, resolve, roomHashOf, verifyOps, type Op } from './members.js';

// Real Ed25519 signatures (WebCrypto in Node)

let a: Identity, b: Identity, c: Identity, x: Identity;
beforeAll(async () => {
	[a, b, c, x] = await Promise.all([createIdentity(), createIdentity(), createIdentity(), createIdentity()]);
});

const add = (by: Identity, parents: Op[], who: Identity, name: string, time: number) =>
	createOp(by, heads(parents), { type: 'add', device: who.id, key: who.key, name }, time);
const names = (ops: Op[]) => [...(resolve(ops)?.members.values() ?? [])].map((m) => m.name).sort();

async function group() {
	const create = await createOp(a, [], { type: 'create', key: a.key, name: 'A', room: 'r0' }, 1);
	const addB = await add(a, [create], b, 'B', 2);
	const addC = await add(b, [create, addB], c, 'C', 3);
	return [create, addB, addC];
}

describe('members', () => {
	it('ignores entries of non-members', async () => {
		const log = await group();
		const sneaky = await add(x, log, x, 'X', 4);
		expect(names([...log, sneaky])).toEqual(['A', 'B', 'C']);
	});

	it('drops forged or altered entries', async () => {
		const log = await group();
		const forged = { ...(await add(a, log, x, 'X', 4)), author: b.id };
		const altered = { ...(await add(a, log, x, 'X', 4)), time: 5 };
		expect(await verifyOps([...log, forged, altered])).toEqual(log);
		const fakeKey = { ...(await add(a, log, x, 'X', 4)) };
		fakeKey.body = { type: 'add', device: x.id, key: c.key, name: 'X' };
		expect(await verifyOps([...log, fakeKey])).toEqual(log);
	});

	it('removes a device and rotates the room', async () => {
		const log = await group();
		const remove = await createOp(a, heads(log), { type: 'remove', device: c.id, room: 'r1' }, 10);
		const g = resolve([...log, remove])!;
		expect([...g.members.values()].map((m) => m.name).sort()).toEqual(['A', 'B']);
		expect([...g.removed.keys()]).toEqual([c.id]);
		expect(g.room).toBe('r1');
		expect(g.oldRooms).toEqual([{ room: 'r0', until: 10 }]);
	});

	it('keeps the new room secret out of the log: only who has it knows the room', async () => {
		const log = await group();
		const roomHash = await roomHashOf('r1');
		const ops = [...log, await createOp(a, heads(log), { type: 'remove', device: c.id, roomHash }, 10)];
		expect(JSON.stringify(ops)).not.toContain('"r1"');
		// The removed device (and a member that hasn't been told yet) only has the old room
		expect(resolve(ops)).toMatchObject({ room: null, oldRooms: [{ room: 'r0', until: 10 }] });
		expect(resolve(ops, await knownRooms(ops, { [roomHash]: 'r1' }))!.room).toBe('r1');
		// A secret that doesn't match the hash of a removal is not taken
		expect(await knownRooms(ops, { [roomHash]: 'other', [await roomHashOf('x')]: 'x' })).toEqual({});
	});

	it('a removal beats what the removed device did concurrently', async () => {
		const log = await group();
		const remove = await createOp(a, heads(log), { type: 'remove', device: c.id, room: 'r1' }, 10);
		const concurrent = await add(c, log, x, 'X', 11);
		expect(names([...log, remove, concurrent])).toEqual(['A', 'B']);
	});

	it('entries a device made before its removal stay', async () => {
		const log = await group();
		const addX = await add(c, log, x, 'X', 5);
		const remove = await createOp(a, heads([...log, addX]), { type: 'remove', device: c.id, room: 'r1' }, 10);
		expect(names([...log, addX, remove])).toEqual(['A', 'B', 'X']);
	});

	it('a removed device can no longer act', async () => {
		const log = await group();
		const remove = await createOp(a, heads(log), { type: 'remove', device: c.id, room: 'r1' }, 10);
		const after = await add(c, [...log, remove], x, 'X', 11);
		expect(names([...log, remove, after])).toEqual(['A', 'B']);
	});

	it('two devices removing each other concurrently are both out', async () => {
		const log = await group();
		const r1 = await createOp(a, heads(log), { type: 'remove', device: c.id, room: 'r1' }, 10);
		const r2 = await createOp(c, heads(log), { type: 'remove', device: a.id, room: 'r2' }, 10);
		const g = resolve([...log, r1, r2])!;
		expect([...g.members.values()].map((m) => m.name)).toEqual(['B']);
		// Same result on every device, whatever order the entries arrive in
		expect(resolve([r2, ...log, r1])!.room).toBe(g.room);
	});

	it('renames only by the device itself', async () => {
		const log = await group();
		const own = await createOp(b, heads(log), { type: 'rename', name: 'Laptop' }, 5);
		const other = await createOp(c, heads([...log, own]), { type: 'rename', name: 'Phone' }, 6);
		expect(names([...log, own, other])).toEqual(['A', 'Laptop', 'Phone']);
	});

	it('merges logs from different devices', async () => {
		const log = await group();
		const onB = await createOp(b, heads(log), { type: 'rename', name: 'B2' }, 5);
		const onC = await createOp(c, heads(log), { type: 'rename', name: 'C2' }, 5);
		const merged = mergeOps([...log, onB], [...log, onC]);
		expect(merged).toHaveLength(5);
		expect(names(merged)).toEqual(['A', 'B2', 'C2']);
		expect(heads(merged)).toEqual([onB.id, onC.id].sort());
	});

	it('leaves out entries whose parents are missing', async () => {
		const [create, addB, addC] = await group();
		expect(names([create, addC])).toEqual(['A']);
		expect(names([create, addB])).toEqual(['A', 'B']);
	});
});
