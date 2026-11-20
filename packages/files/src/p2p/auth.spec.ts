import { beforeAll, describe, expect, it } from 'vitest';
import { answerHello, checkHello, newInviteCode, pairProof, parseInviteCode, PROTOCOL, shareProof } from './auth.js';
import { groupBase32 } from './base32.js';
import { createIdentity, type Identity } from './identity.js';
import { createOp, heads, type Op } from './members.js';

let a: Identity, b: Identity, x: Identity;
let log: Op[];
beforeAll(async () => {
	[a, b, x] = await Promise.all([createIdentity(), createIdentity(), createIdentity()]);
	const create = await createOp(a, [], { type: 'create', key: a.key, name: 'A', room: 'r' }, 1);
	log = [create];
});

describe('sign-in', () => {
	it('accepts a member answering for this connection only (not relayed)', async () => {
		const answer = await answerHello(a, log, 'n1', 'fp');
		expect((await checkHello(answer, 'n1', 'fp', log)).ok).toBe(true);
		expect(await checkHello(answer, 'n2', 'fp', log)).toEqual({ ok: false, reason: 'signature' });
		expect(await checkHello(answer, 'n1', 'other', log)).toEqual({ ok: false, reason: 'signature' });
	});

	it('rejects non-members and other versions', async () => {
		expect(await checkHello(await answerHello(x, log, 'n', 'fp'), 'n', 'fp', log)).toEqual({ ok: false, reason: 'member' });
		const old = { ...(await answerHello(a, log, 'n', 'fp')), v: PROTOCOL + 1 };
		expect(await checkHello(old, 'n', 'fp', log)).toEqual({ ok: false, reason: 'version' });
	});

	it('learns a just added device from its log', async () => {
		const addB = await createOp(a, heads(log), { type: 'add', device: b.id, key: b.key, name: 'B' }, 2);
		const check = await checkHello(await answerHello(b, [...log, addB], 'n', 'fp'), 'n', 'fp', log);
		expect(check.ok && check.ops.length).toBe(2);
	});

	it('rejects removed devices, even with an old log', async () => {
		const addB = await createOp(a, heads(log), { type: 'add', device: b.id, key: b.key, name: 'B' }, 2);
		const remove = await createOp(a, [addB.id], { type: 'remove', device: b.id, room: 'r2' }, 3);
		const ours = [...log, addB, remove];
		expect(await checkHello(await answerHello(b, [...log, addB], 'n', 'fp'), 'n', 'fp', ours)).toEqual({ ok: false, reason: 'removed' });
	});
});

describe('one-time keys', () => {
	it('parses typed keys and pairing links', () => {
		const code = newInviteCode();
		expect(code).toHaveLength(20);
		expect(parseInviteCode(groupBase32(code).toLowerCase())).toBe(code);
		expect(parseInviteCode(`https://example.org/files#pair=${code}`)).toBe(code);
		expect(parseInviteCode('too-short')).toBeNull();
	});

	it('proofs depend on key, role and connection', async () => {
		const code = newInviteCode();
		expect(await pairProof(code, 'new', 'fp')).toBe(await pairProof(code, 'new', 'fp'));
		expect(await pairProof(code, 'new', 'fp')).not.toBe(await pairProof(code, 'inviter', 'fp'));
		expect(await pairProof(code, 'new', 'fp')).not.toBe(await pairProof(newInviteCode(), 'new', 'fp'));
	});
});

describe('without connection fingerprints', () => {
	it('signs and proves nothing, and accepts nothing (a proof over nothing would hold for any connection)', async () => {
		const code = newInviteCode();
		await expect(answerHello(a, log, 'n', '')).rejects.toThrow('fingerprints');
		await expect(pairProof(code, 'new', '')).rejects.toThrow('fingerprints');
		await expect(shareProof(code, 'guest', '')).rejects.toThrow('fingerprints');
		const answer = await answerHello(a, log, 'n', 'fp');
		expect(await checkHello(answer, 'n', '', log)).toEqual({ ok: false, reason: 'signature' });
	});
});
