import { encodeBase32 } from './base32.js';
import { fromBase64Url, sha256, toBase64Url, utf8 } from './bytes.js';

// The key pair of this device (Ed25519 via WebCrypto). The private key is not extractable; the device ID is a
// fingerprint of the public key, so nobody can claim an ID without holding its key.

export interface Identity {
	/** Device ID: 80 bits of the SHA-256 of the public key, Crockford Base32 */
	id: string;
	/** Public key, raw, base64url */
	key: string;
	privateKey: CryptoKey;
}

export function ed25519Supported(): Promise<boolean> {
	return crypto.subtle
		.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify'])
		.then(() => true)
		.catch(() => false);
}

export async function createIdentity(): Promise<Identity> {
	const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify'])) as CryptoKeyPair;
	return identityOf(pair);
}

/** Identity from a stored key pair */
export async function identityOf(pair: CryptoKeyPair): Promise<Identity> {
	const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
	const key = toBase64Url(raw);
	return { id: await deviceIdOf(key), key, privateKey: pair.privateKey };
}

export async function deviceIdOf(key: string): Promise<string> {
	return encodeBase32(await sha256(fromBase64Url(key)), 80);
}

export async function sign(identity: Identity, data: Uint8Array<ArrayBuffer> | string): Promise<string> {
	const bytes = typeof data === 'string' ? utf8(data) : data;
	return toBase64Url(new Uint8Array(await crypto.subtle.sign('Ed25519', identity.privateKey, bytes)));
}

export async function verify(key: string, signature: string, data: Uint8Array<ArrayBuffer> | string): Promise<boolean> {
	try {
		const publicKey = await crypto.subtle.importKey('raw', fromBase64Url(key), 'Ed25519', false, ['verify']);
		return await crypto.subtle.verify('Ed25519', publicKey, fromBase64Url(signature), typeof data === 'string' ? utf8(data) : data);
	} catch {
		return false;
	}
}
