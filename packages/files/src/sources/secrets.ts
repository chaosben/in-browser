import { idbGet, idbSet } from '../sync/idb.js';

// Passwords and secret keys of connections (WebDAV, S3), kept on this device only: encrypted with AES-GCM under a
// device key that can't be exported (WebCrypto keeps it inside the browser; IndexedDB stores the key object, never
// its bytes). Neither the secret nor the key ever goes into the synced file system, the logs or error messages.

const KEY = 'secret-key';

/** An encrypted secret as stored with its connection */
export interface Sealed {
	iv: Uint8Array;
	data: ArrayBuffer;
}

let key: Promise<CryptoKey> | null = null;

function deviceKey(): Promise<CryptoKey> {
	key ??= (async () => {
		const stored = await idbGet<CryptoKey>(KEY);
		if (stored) return stored;
		const created = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
		await idbSet(KEY, created);
		return created;
	})();
	return key;
}

export async function seal(secret: string): Promise<Sealed> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deviceKey(), new TextEncoder().encode(secret));
	return { iv, data };
}

export async function unseal(sealed: Sealed): Promise<string> {
	const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv as Uint8Array<ArrayBuffer> }, await deviceKey(), sealed.data);
	return new TextDecoder().decode(plain);
}
