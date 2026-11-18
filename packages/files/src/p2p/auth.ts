import { decodeBase32, encodeBase32, normalizeBase32 } from './base32.js';
import { randomBytes, sha256, toBase64Url, utf8 } from './bytes.js';
import { deviceIdOf, sign, verify, type Identity } from './identity.js';
import { mergeOps, resolve, verifyOps, type Group, type Op } from './members.js';

// Signing in after a connection is up, and pairing a new device with a one-time key.
//
// Sign-in: each side asks the other `hello` with a random nonce; the answer is signed over the nonce together with
// the DTLS fingerprints of this very connection, so a relay in the middle can't pass it on. It carries the member
// log, which the asking side merges first (a device added a moment ago is known after that).
//
// Pairing: the one-time key (100 bits) is known to both people's devices only. The new device proves it with an
// HMAC over the fingerprints, the inviting device answers with its own, then signs the `add` entry.

/** Version of the P2P protocol; devices with another one show “please update” instead of syncing */
/** 2: sessions check the expected state before overwriting or deleting, renames, deletions confirmed on either side */
export const PROTOCOL = 2;

export interface HelloAnswer {
	v: number;
	id: string;
	key: string;
	sig: string;
	ops: Op[];
}

export function nonce(): string {
	return toBase64Url(randomBytes(16));
}

const helloContent = (nonce: string, fingerprints: string, id: string) => `in-browser-hello\n${nonce}\n${fingerprints}\n${id}`;

export async function answerHello(identity: Identity, ops: Op[], nonce: string, fingerprints: string): Promise<HelloAnswer> {
	return { v: PROTOCOL, id: identity.id, key: identity.key, sig: await sign(identity, helloContent(nonce, fingerprints, identity.id)), ops };
}

export type HelloCheck =
	| { ok: true; ops: Op[]; group: Group }
	| { ok: false; reason: 'version' | 'signature' | 'group' | 'member' | 'removed' };

/** Checks the answer to our `hello`; on success also returns the merged member log */
export async function checkHello(answer: HelloAnswer, nonce: string, fingerprints: string, ours: Op[]): Promise<HelloCheck> {
	if (answer.v !== PROTOCOL) return { ok: false, reason: 'version' };
	if ((await deviceIdOf(answer.key)) !== answer.id) return { ok: false, reason: 'signature' };
	if (!(await verify(answer.key, answer.sig, helloContent(nonce, fingerprints, answer.id)))) return { ok: false, reason: 'signature' };
	const theirs = await verifyOps(answer.ops ?? []);
	const before = resolve(ours);
	const merged = mergeOps(ours, theirs);
	const group = resolve(merged);
	if (!before || !group || group.id !== before.id) return { ok: false, reason: 'group' };
	if (group.removed.has(answer.id)) return { ok: false, reason: 'removed' };
	if (group.members.get(answer.id)?.key !== answer.key) return { ok: false, reason: 'member' };
	return { ok: true, ops: merged, group };
}

// --- One-time keys ---

/** Validity of a one-time key */
export const INVITE_TTL = 24 * 60 * 60 * 1000;

/** New one-time key: 100 bits, 20 characters Crockford Base32 */
export function newInviteCode(): string {
	return encodeBase32(randomBytes(13), 100);
}

/** Normalized key from what was typed or the pairing link (`…#pair=KEY`); `null` if it isn't one */
export function parseInviteCode(text: string): string | null {
	const fromLink = /[#&?]pair=([^&\s]+)/.exec(text)?.[1];
	const code = normalizeBase32(fromLink ? decodeURIComponent(fromLink) : text);
	return code && code.length === 20 ? code : null;
}

async function hmac(code: string, message: string): Promise<string> {
	const key = await crypto.subtle.importKey('raw', decodeBase32(code) as Uint8Array<ArrayBuffer>, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, utf8(message))));
}

export const pairProof = (code: string, role: 'new' | 'inviter', fingerprints: string) => hmac(code, `in-browser-pair\n${role}\n${fingerprints}`);

/** Room of the group, derived from its secret (relays only see a hash) */
export async function roomId(prefix: 'group' | 'pair', secret: string): Promise<string> {
	return [...(await sha256(`in-browser-${prefix}\n${secret}`))]
		.slice(0, 16)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** New room secret (128 bits) */
export function newRoomSecret(): string {
	return toBase64Url(randomBytes(16));
}
