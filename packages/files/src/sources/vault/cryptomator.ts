import { scryptAsync } from '@noble/hashes/scrypt.js';
import { VaultFormatError, WrongPassword } from './errors.js';
import { Siv } from './siv.js';

// The Cryptomator format (vault format 8 with `SIV_GCM`, https://docs.cryptomator.org/security/architecture/ –
// its vaults open with Cryptomator and back): what an encrypted folder looks like on disk, without the file system
// around it (that is `cryptomator-source.ts`).
//   masterkey.cryptomator  JSON: the two master keys (encryption, MAC), each wrapped (AES-KW) with a key from the
//                          password (scrypt)
//   vault.cryptomator      a JWT signed with the master keys: format 8, `SIV_GCM`, the length from which names are
//                          shortened
//   d/XX/YYYY…/            one folder per folder of the vault, named by the hash of its id (the top folder's is `""`);
//                          the hierarchy is not visible
//   names                  AES-SIV of the name with the folder's id as associated data, base64url, `.c9r`; a folder is
//                          `<name>.c9r/dir.c9r` holding its id; names longer than the threshold become
//                          `<sha1>.c9s/` with `name.c9s` and `contents.c9r` or `dir.c9r`
//   contents               a header (nonce, AES-GCM of the file's own content key), then chunks of 32 KiB, each AES-GCM
//                          with its own nonce and the chunk number and header nonce as associated data
// Only WebCrypto (AES-KW, AES-GCM, HMAC, SHA-1, AES-SIV built on AES-CBC/CTR in `siv.ts`) and scrypt (`@noble/hashes`).

export const MASTERKEY_FILE = 'masterkey.cryptomator';
export const CONFIG_FILE = 'vault.cryptomator';
export const DATA_DIR = 'd';
export const C9R = '.c9r';
export const C9S = '.c9s';
export const DIR_FILE = 'dir.c9r';
export const CONTENTS_FILE = 'contents.c9r';
export const NAME_FILE = 'name.c9s';
export const DIR_ID_BACKUP = 'dirid.c9r';
export const SYMLINK_FILE = 'symlink.c9r';

const HEADER_NONCE = 12;
export const HEADER_LEN = 68;
export const PLAIN_CHUNK = 32 * 1024;
const TAG = 16;
export const CIPHER_CHUNK = HEADER_NONCE + PLAIN_CHUNK + TAG;
const DEFAULT_THRESHOLD = 220;
/** scrypt cost of a new vault (Cryptomator's default) */
const NEW_COST = 2 ** 15;
const KEY_ID = 'masterkeyfile:masterkey.cryptomator';

// --- Bytes ---

const encoder = new TextEncoder();
const strictDecoder = new TextDecoder('utf-8', { fatal: true });

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const part of parts) {
		out.set(part, at);
		at += part.length;
	}
	return out;
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
/** base64url with padding (Cryptomator's names) */
const toBase64Url = (bytes: Uint8Array) => toBase64(bytes).replaceAll('+', '-').replaceAll('/', '_');
/** base64url without padding (JWT) */
const toJwt = (bytes: Uint8Array) => toBase64Url(bytes).replace(/=+$/, '');

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]*={0,2}$/.test(text)) return null;
	try {
		const plain = text.replaceAll('-', '+').replaceAll('_', '/');
		return fromBase64(plain.endsWith('=') ? plain : plain + '='.repeat((4 - (plain.length % 4)) % 4));
	} catch {
		return null;
	}
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function toBase32(bytes: Uint8Array): string {
	let out = '';
	let bits = 0;
	let value = 0;
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			out += BASE32[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
	return out.padEnd(Math.ceil(out.length / 8) * 8, '=');
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const digest = async (algorithm: 'SHA-1' | 'SHA-256', bytes: Uint8Array) => new Uint8Array(await crypto.subtle.digest(algorithm, bytes as Uint8Array<ArrayBuffer>));

// --- Masterkey file and vault configuration ---

export interface MasterkeyFile {
	salt: Uint8Array;
	cost: number;
	blockSize: number;
	/** The wrapped encryption key */
	primary: Uint8Array;
	/** The wrapped MAC key */
	hmac: Uint8Array;
}

/** Reads `masterkey.cryptomator`; throws `VaultFormatError` */
export function parseMasterkeyFile(text: string): MasterkeyFile {
	let json: Record<string, unknown>;
	try {
		json = JSON.parse(text) as Record<string, unknown>;
		const cost = json.scryptCostParam;
		const blockSize = json.scryptBlockSize;
		if (typeof cost !== 'number' || typeof blockSize !== 'number' || cost < 2 || cost & (cost - 1)) throw new Error('scrypt');
		// A cost no device could pay (or a damaged file) is refused before it fills the memory: 128·N·r bytes
		if (cost > 2 ** 20 || 128 * cost * blockSize > 2 ** 30) throw new VaultFormatError('unsupported', `scrypt N=${cost}`);
		return {
			salt: fromBase64(String(json.scryptSalt)),
			cost,
			blockSize,
			primary: fromBase64(String(json.primaryMasterKey)),
			hmac: fromBase64(String(json.hmacMasterKey))
		};
	} catch (e) {
		if (e instanceof VaultFormatError) throw e;
		throw new VaultFormatError('invalid', MASTERKEY_FILE);
	}
}

async function kek(file: Pick<MasterkeyFile, 'salt' | 'cost' | 'blockSize'>, password: string): Promise<CryptoKey> {
	const bytes = await scryptAsync(encoder.encode(password.normalize('NFC')), file.salt, { N: file.cost, r: file.blockSize, p: 1, dkLen: 32, maxmem: 2 ** 31 });
	return crypto.subtle.importKey('raw', bytes as Uint8Array<ArrayBuffer>, 'AES-KW', false, ['wrapKey', 'unwrapKey']);
}

async function unwrap(wrapped: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
	const unwrapped = await crypto.subtle.unwrapKey('raw', wrapped as Uint8Array<ArrayBuffer>, key, 'AES-KW', { name: 'HMAC', hash: 'SHA-256', length: 256 }, true, ['sign']);
	return new Uint8Array(await crypto.subtle.exportKey('raw', unwrapped));
}

/** The master key (encryption key, then MAC key – 64 bytes); throws `WrongPassword` */
export async function unlockMasterkey(file: MasterkeyFile, password: string): Promise<Uint8Array> {
	const key = await kek(file, password);
	try {
		return concat(await unwrap(file.primary, key), await unwrap(file.hmac, key));
	} catch {
		throw new WrongPassword();
	}
}

const HMAC = { 'HS256': 'SHA-256', 'HS384': 'SHA-384', 'HS512': 'SHA-512' } as const;

function decodeJwt(token: string): { header: Record<string, unknown>; payload: Record<string, unknown>; signed: Uint8Array; signature: Uint8Array } {
	const parts = token.trim().split('.');
	const [header, payload, signature] = parts.map((p) => fromBase64Url(p));
	if (parts.length !== 3 || !header || !payload || !signature) throw new VaultFormatError('invalid', CONFIG_FILE);
	try {
		return {
			header: JSON.parse(strictDecoder.decode(header)) as Record<string, unknown>,
			payload: JSON.parse(strictDecoder.decode(payload)) as Record<string, unknown>,
			signed: encoder.encode(`${parts[0]}.${parts[1]}`),
			signature
		};
	} catch {
		throw new VaultFormatError('invalid', CONFIG_FILE);
	}
}

/** Checks the configuration before any password is asked: a vault this can't open (another format, a Cryptomator
 * Hub vault, the older cipher combination) throws `VaultFormatError` */
export function checkConfig(token: string): void {
	const { header, payload } = decodeJwt(token);
	if (header.kid !== KEY_ID) throw new VaultFormatError('unsupported', `key ${String(header.kid)}`);
	if (!(String(header.alg) in HMAC)) throw new VaultFormatError('unsupported', `alg ${String(header.alg)}`);
	if (payload.format !== 8) throw new VaultFormatError('unsupported', `format ${String(payload.format)}`);
	if (payload.cipherCombo !== 'SIV_GCM') throw new VaultFormatError('unsupported', String(payload.cipherCombo));
}

/** The configuration, checked with the master key: its name shortening threshold */
export async function verifyConfig(token: string, master: Uint8Array): Promise<{ threshold: number }> {
	checkConfig(token);
	const { header, payload, signed, signature } = decodeJwt(token);
	const key = await crypto.subtle.importKey('raw', master as Uint8Array<ArrayBuffer>, { name: 'HMAC', hash: HMAC[header.alg as keyof typeof HMAC] }, false, ['verify']);
	if (!(await crypto.subtle.verify('HMAC', key, signature as Uint8Array<ArrayBuffer>, signed as Uint8Array<ArrayBuffer>))) throw new VaultFormatError('invalid', CONFIG_FILE);
	const threshold = payload.shorteningThreshold;
	return { threshold: typeof threshold === 'number' && threshold > 0 ? threshold : DEFAULT_THRESHOLD };
}

/** A new master key (encryption key, then MAC key) */
export const newMasterkey = () => random(64);

/** The two files of a new vault with `master`, protected by `password` */
export async function newVaultFiles(master: Uint8Array, password: string, cost = NEW_COST): Promise<{ masterkey: string; config: string }> {
	const params = { salt: random(8), cost, blockSize: 8 };
	const key = await kek(params, password);
	const wrap = async (raw: Uint8Array) => {
		const plain = await crypto.subtle.importKey('raw', raw as Uint8Array<ArrayBuffer>, { name: 'HMAC', hash: 'SHA-256', length: 256 }, true, ['sign']);
		return new Uint8Array(await crypto.subtle.wrapKey('raw', plain, key, 'AES-KW'));
	};
	const macKey = await crypto.subtle.importKey('raw', master.slice(32) as Uint8Array<ArrayBuffer>, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const version = new Uint8Array(4);
	new DataView(version.buffer).setInt32(0, 999);
	const masterkey = {
		version: 999,
		scryptSalt: toBase64(params.salt),
		scryptCostParam: cost,
		scryptBlockSize: 8,
		primaryMasterKey: toBase64(await wrap(master.slice(0, 32))),
		hmacMasterKey: toBase64(await wrap(master.slice(32))),
		versionMac: toBase64(new Uint8Array(await crypto.subtle.sign('HMAC', macKey, version)))
	};
	const header = toJwt(encoder.encode(JSON.stringify({ kid: KEY_ID, typ: 'JWT', alg: 'HS256' })));
	const payload = toJwt(encoder.encode(JSON.stringify({ jti: crypto.randomUUID(), format: 8, shorteningThreshold: DEFAULT_THRESHOLD, cipherCombo: 'SIV_GCM' })));
	const signKey = await crypto.subtle.importKey('raw', master as Uint8Array<ArrayBuffer>, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const signature = new Uint8Array(await crypto.subtle.sign('HMAC', signKey, encoder.encode(`${header}.${payload}`)));
	return { masterkey: `${JSON.stringify(masterkey, null, 2)}\n`, config: `${header}.${payload}.${toJwt(signature)}` };
}

// --- Contents ---

/** Plain size of an encrypted file of `cipherSize` bytes */
export function plainSize(cipherSize: number): number {
	const body = cipherSize - HEADER_LEN;
	if (body <= 0) return 0;
	return Math.max(0, body - Math.ceil(body / CIPHER_CHUNK) * (HEADER_NONCE + TAG));
}

function chunkData(chunk: number, headerNonce: Uint8Array): Uint8Array<ArrayBuffer> {
	const data = new Uint8Array(8 + headerNonce.length);
	new DataView(data.buffer).setBigUint64(0, BigInt(chunk));
	data.set(headerNonce, 8);
	return data;
}

export interface FileHeader {
	nonce: Uint8Array;
	key: CryptoKey;
}

/** Kinds of entries in a folder of `d/` */
export type CipherEntry = 'name' | 'long' | 'internal';

/** What an entry of a vault folder is, by its name */
export function cipherEntryKind(name: string): CipherEntry {
	if (name === DIR_ID_BACKUP) return 'internal';
	if (name.endsWith(C9R)) return 'name';
	if (name.endsWith(C9S)) return 'long';
	return 'internal';
}

/** The keys of one unlocked vault */
export class CryptomatorKeys {
	private constructor(
		private siv: Siv,
		private headerKey: CryptoKey,
		readonly threshold: number
	) {}

	static async create(master: Uint8Array, threshold: number): Promise<CryptomatorKeys> {
		const enc = master.slice(0, 32);
		return new CryptomatorKeys(await Siv.create(enc, master.slice(32)), await crypto.subtle.importKey('raw', enc, 'AES-GCM', false, ['encrypt', 'decrypt']), threshold);
	}

	/** The folder of `d/` that holds the folder with `dirId` (`d/XX/YYYY…`) */
	async dirPath(dirId: string): Promise<string> {
		const hash = toBase32(await digest('SHA-1', await this.siv.encrypt(encoder.encode(dirId))));
		return `${DATA_DIR}/${hash.slice(0, 2)}/${hash.slice(2)}`;
	}

	/** The entry name of `name` in the folder `dirId` (`stored`), and for long names the full one for `name.c9s` */
	async encryptName(name: string, dirId: string): Promise<{ stored: string; long: string | null }> {
		const full = toBase64Url(await this.siv.encrypt(encoder.encode(name.normalize('NFC')), encoder.encode(dirId))) + C9R;
		if (full.length <= this.threshold) return { stored: full, long: null };
		return { stored: toBase64Url(await digest('SHA-1', encoder.encode(full))) + C9S, long: full };
	}

	/** The plain name of an encrypted one (with `.c9r`), `null` when it isn't one of this folder */
	async decryptName(full: string, dirId: string): Promise<string | null> {
		if (!full.endsWith(C9R)) return null;
		const bytes = fromBase64Url(full.slice(0, -C9R.length));
		if (!bytes) return null;
		const plain = await this.siv.decrypt(bytes, encoder.encode(dirId));
		if (!plain) return null;
		try {
			const name = strictDecoder.decode(plain);
			return name && name !== '.' && name !== '..' && !/[/\0]/.test(name) ? name : null;
		} catch {
			return null;
		}
	}

	/** A file's whole encrypted content (also an empty file has its header) */
	async encryptFile(plain: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
		const nonce = random(HEADER_NONCE);
		const contentKey = random(32);
		const payload = concat(new Uint8Array(8).fill(0xff), contentKey);
		const header = concat(nonce, new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, this.headerKey, payload)));
		const key = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
		const chunks: Promise<Uint8Array>[] = [];
		for (let at = 0, no = 0; at < plain.length; at += PLAIN_CHUNK, no++) {
			const chunkNonce = random(HEADER_NONCE);
			const piece = plain.subarray(at, at + PLAIN_CHUNK) as Uint8Array<ArrayBuffer>;
			chunks.push(crypto.subtle.encrypt({ name: 'AES-GCM', iv: chunkNonce, additionalData: chunkData(no, nonce) }, key, piece).then((c) => concat(chunkNonce, new Uint8Array(c))));
		}
		return concat(header, ...(await Promise.all(chunks)));
	}

	/** The header of a file (its first `HEADER_LEN` bytes) */
	async header(bytes: Uint8Array): Promise<FileHeader> {
		if (bytes.length < HEADER_LEN) throw new VaultFormatError('invalid', 'header');
		const nonce = bytes.slice(0, HEADER_NONCE);
		const payload = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, this.headerKey, bytes.subarray(HEADER_NONCE, HEADER_LEN) as Uint8Array<ArrayBuffer>));
		return { nonce, key: await crypto.subtle.importKey('raw', payload.slice(8, 40), 'AES-GCM', false, ['decrypt']) };
	}

	/** Decrypts chunks `first`… of a file (`cipher`: those chunks' bytes, the last one may be shorter) */
	async decryptChunks(cipher: Uint8Array, first: number, header: FileHeader): Promise<Uint8Array<ArrayBuffer>> {
		const chunks: Promise<Uint8Array>[] = [];
		for (let at = 0, no = first; at < cipher.length; at += CIPHER_CHUNK, no++) {
			const chunk = cipher.subarray(at, at + CIPHER_CHUNK);
			if (chunk.length < HEADER_NONCE + TAG) throw new VaultFormatError('invalid', 'chunk');
			const iv = chunk.subarray(0, HEADER_NONCE) as Uint8Array<ArrayBuffer>;
			chunks.push(
				crypto.subtle
					.decrypt({ name: 'AES-GCM', iv, additionalData: chunkData(no, header.nonce) }, header.key, chunk.subarray(HEADER_NONCE) as Uint8Array<ArrayBuffer>)
					.then((p) => new Uint8Array(p))
			);
		}
		return concat(...(await Promise.all(chunks)));
	}

	/** A file's whole plain content */
	async decryptFile(cipher: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
		return this.decryptChunks(cipher.subarray(HEADER_LEN), 0, await this.header(cipher));
	}
}

/** The same vault wherever it lies: a hash of its wrapped encryption key */
export async function fingerprintOf(file: MasterkeyFile): Promise<string> {
	return [...(await digest('SHA-256', file.primary))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
