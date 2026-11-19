// What a build of the site publishes for the p2p-node under `/p2p-node/`: `version.json` (this manifest),
// `version.json.sig` (Ed25519 signature of exactly those bytes, base64url), the sync process `peer-<commit>.js`
// and `starter.js`. The starter trusts a manifest only with a valid signature of the key below, and a file only
// with the SHA-256 the manifest names – so whoever controls the hosting alone can't run code on the nodes. The
// private key never enters the repository (see `scripts/build.ts`).

/** Version of the starter (`starter.ts`); a manifest can require a newer one for its sync process */
export const STARTER_VERSION = 1;

/** Public release key (Ed25519, raw, base64url) */
export const RELEASE_KEY = '2KGRb82KM5mWDO9mmhTx4fnyjUtBW7Cj0pP8SRLArbg';

export interface ReleaseFile {
	/** File name under `/p2p-node/` */
	file: string;
	/** SHA-256, hex */
	sha256: string;
}

export interface Manifest {
	/** Commit of the build (`abc1234`, `-dirty` for local builds); the node follows any change, also back */
	commit: string;
	/** P2P protocol version of this build (`PROTOCOL` in `@in-browser/files/p2p/auth.ts`) */
	protocol: number;
	/** Lowest Node major version the sync process runs on */
	node: number;
	peer: ReleaseFile;
	/** Current starter; `min` = oldest starter that may run this sync process */
	starter: ReleaseFile & { version: number; min: number };
}

// Self-contained on purpose: `scripts/build.ts` and the starter load this module under plain Node, which can't
// resolve the workspace's TypeScript imports (the same helpers live in `@in-browser/files/p2p/bytes.ts`).

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
	const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
	return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signManifest(bytes: Uint8Array<ArrayBuffer>, privateKey: CryptoKey): Promise<string> {
	return toBase64Url(new Uint8Array(await crypto.subtle.sign('Ed25519', privateKey, bytes)));
}

/** The manifest if the signature is valid, otherwise `null` */
export async function verifyManifest(bytes: Uint8Array<ArrayBuffer>, signature: string, key = RELEASE_KEY): Promise<Manifest | null> {
	try {
		const publicKey = await crypto.subtle.importKey('raw', fromBase64Url(key), 'Ed25519', false, ['verify']);
		if (!(await crypto.subtle.verify('Ed25519', publicKey, fromBase64Url(signature.trim()), bytes))) return null;
		const manifest = JSON.parse(new TextDecoder().decode(bytes)) as Manifest;
		return isManifest(manifest) ? manifest : null;
	} catch {
		return null;
	}
}

const safeFile = (name: unknown) => typeof name === 'string' && /^[A-Za-z0-9._-]+$/.test(name) && !name.startsWith('.');
const isFile = (f: Partial<ReleaseFile> | undefined) => !!f && safeFile(f.file) && typeof f.sha256 === 'string' && /^[0-9a-f]{64}$/.test(f.sha256);

function isManifest(m: Partial<Manifest>): m is Manifest {
	return (
		typeof m.commit === 'string' &&
		/^[A-Za-z0-9-]+$/.test(m.commit) &&
		typeof m.protocol === 'number' &&
		typeof m.node === 'number' &&
		isFile(m.peer) &&
		isFile(m.starter) &&
		typeof m.starter?.version === 'number' &&
		typeof m.starter.min === 'number'
	);
}
