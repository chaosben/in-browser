import { scryptAsync } from '@noble/hashes/scrypt.js';
import { VaultFormatError, WrongPassword } from './errors.js';

export { VaultFormatError, WrongPassword };

// The gocryptfs format (version 2, https://github.com/rfjakob/gocryptfs – its folders open with gocryptfs and back):
// what an encrypted folder looks like on disk, without the file system around it (that is `source.ts`).
//   gocryptfs.conf   JSON in the top folder: the master key, encrypted with a key from the password (scrypt)
//   gocryptfs.diriv  16 random bytes in every folder: the tweak of the names in it
//   names            EME (AES-256) of the name padded to 16 bytes, base64url; too long ones become
//                    `gocryptfs.longname.<sha256>` with the encrypted name in `<that>.name`
//   contents         a header (version 2, a random file id of 16 bytes), then blocks of 4096 bytes, each AES-256-GCM
//                    with its own nonce and the block number and file id as associated data
// Keys come from the master key by HKDF-SHA256. Only WebCrypto and scrypt (`@noble/hashes`) are used; EME's single
// AES blocks are built from AES-CTR (encrypting) and AES-CBC (decrypting), which WebCrypto has.

export const CONFIG_FILE = 'gocryptfs.conf';
export const DIRIV_FILE = 'gocryptfs.diriv';
const LONGNAME_PREFIX = 'gocryptfs.longname.';
const LONGNAME_SUFFIX = '.name';

export const HEADER_LEN = 18;
const FILE_ID_LEN = 16;
export const PLAIN_BS = 4096;
const TAG_LEN = 16;
const DIRIV_LEN = 16;
/** Longest name in bytes (a limit of the systems gocryptfs runs on) */
const NAME_MAX = 255;

/** Feature flags this implementation reads and writes; `DirIV` and `EMENames` are required */
const KNOWN_FLAGS = new Set(['HKDF', 'GCMIV128', 'DirIV', 'EMENames', 'LongNames', 'Raw64']);
/** Flags of a new folder – what `gocryptfs -init` writes on a computer with AES support */
const NEW_FLAGS = ['HKDF', 'GCMIV128', 'DirIV', 'EMENames', 'LongNames', 'Raw64'];
/** scrypt cost of a new folder (2^16, as `gocryptfs -init`) */
const NEW_LOG_N = 16;

export interface GocryptfsConfig {
	encryptedKey: Uint8Array;
	scrypt: { salt: Uint8Array; n: number; r: number; p: number; keyLen: number };
	flags: Set<string>;
	/** Encrypted names longer than this are stored as long names (255 unless set) */
	longNameMax: number;
}

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

function xor(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(a.length);
	for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
	return out;
}

const isZero = (bytes: Uint8Array) => bytes.every((b) => b === 0);

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
	const binary = atob(text);
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary);
}

/** base64url, without padding (`Raw64`) or with */
function toBase64Url(bytes: Uint8Array, raw: boolean): string {
	const text = toBase64(bytes).replaceAll('+', '-').replaceAll('/', '_');
	return raw ? text.replace(/=+$/, '') : text;
}

/** Strict base64url: only the one spelling the encoder writes (no stray characters or padding bits) */
function fromBase64Url(text: string, raw: boolean): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]*={0,2}$/.test(text)) return null;
	if (raw ? text.includes('=') : text.length % 4 !== 0) return null;
	let bytes: Uint8Array<ArrayBuffer>;
	try {
		bytes = fromBase64(text.replaceAll('-', '+').replaceAll('_', '/'));
	} catch {
		return null;
	}
	return toBase64Url(bytes, raw) === text ? bytes : null;
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

// --- The configuration ---

function field<T>(value: unknown, check: (v: unknown) => v is T, name: string): T {
	if (!check(value)) throw new VaultFormatError('invalid', name);
	return value;
}
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

/** Reads `gocryptfs.conf`; throws `VaultFormatError` for anything it can't open */
export function parseConfig(text: string): GocryptfsConfig {
	let json: Record<string, unknown>;
	try {
		json = JSON.parse(text) as Record<string, unknown>;
	} catch {
		throw new VaultFormatError('invalid', 'not JSON');
	}
	if (!json || typeof json !== 'object') throw new VaultFormatError('invalid', 'not an object');
	if (json.Version !== 2) throw new VaultFormatError('unsupported', `version ${String(json.Version)}`);
	const flags = new Set(field(json.FeatureFlags, (v): v is string[] => Array.isArray(v) && v.every(isString), 'FeatureFlags'));
	const unknown = [...flags].filter((f) => !KNOWN_FLAGS.has(f));
	if (unknown.length) throw new VaultFormatError('unsupported', unknown.join(', '));
	if (!flags.has('DirIV') || !flags.has('EMENames')) throw new VaultFormatError('unsupported', 'names without DirIV/EMENames');
	const scrypt = field(json.ScryptObject, (v): v is Record<string, unknown> => !!v && typeof v === 'object', 'ScryptObject');
	const n = field(scrypt.N, isNumber, 'N');
	// A cost no device could pay (or a damaged file) is refused before it fills the memory: scrypt needs 128·N·r bytes
	if (n & (n - 1) || n > 2 ** 20 || 128 * n * field(scrypt.R, isNumber, 'R') > 2 ** 30) throw new VaultFormatError('unsupported', `scrypt N=${n}`);
	let encryptedKey: Uint8Array;
	let salt: Uint8Array;
	try {
		encryptedKey = fromBase64(field(json.EncryptedKey, isString, 'EncryptedKey'));
		salt = fromBase64(field(scrypt.Salt, isString, 'Salt'));
	} catch (e) {
		if (e instanceof VaultFormatError) throw e;
		throw new VaultFormatError('invalid', 'base64');
	}
	const longNameMax = json.LongNameMax === undefined ? NAME_MAX : field(json.LongNameMax, isNumber, 'LongNameMax');
	return {
		encryptedKey,
		scrypt: { salt, n, r: scrypt.R as number, p: field(scrypt.P, isNumber, 'P'), keyLen: field(scrypt.KeyLen, isNumber, 'KeyLen') },
		flags,
		longNameMax: flags.has('LongNames') ? longNameMax : Number.MAX_SAFE_INTEGER
	};
}

/** The key that encrypts the master key in the configuration (version 1.3 and later: HKDF and 128-bit nonces) */
async function keyEncrypter(scryptHash: Uint8Array, hkdf: boolean) {
	const key = hkdf ? await hkdfDerive(scryptHash, 'AES-GCM file content encryption') : scryptHash;
	return new Gcm(await gcmKey(key), hkdf ? 16 : 12);
}

function passwordHash(config: GocryptfsConfig, password: string): Promise<Uint8Array> {
	const { salt, n, r, p, keyLen } = config.scrypt;
	return scryptAsync(encoder.encode(password), salt, { N: n, r, p, dkLen: keyLen, maxmem: 2 ** 31 });
}

/** The master key of a folder; throws `WrongPassword` */
export async function unlockMasterKey(config: GocryptfsConfig, password: string): Promise<Uint8Array> {
	const gcm = await keyEncrypter(await passwordHash(config, password), config.flags.has('HKDF'));
	try {
		const key = await gcm.open(config.encryptedKey, 0n, null);
		if (key.length !== 32) throw new WrongPassword();
		return key;
	} catch {
		throw new WrongPassword();
	}
}

/** A new random master key */
export const newMasterKey = () => random(32);

/** `gocryptfs.conf` of a new folder with `masterKey`, protected by `password` */
export async function newConfig(masterKey: Uint8Array, password: string, logN = NEW_LOG_N): Promise<string> {
	const salt = random(32);
	const config: GocryptfsConfig = {
		encryptedKey: new Uint8Array(),
		scrypt: { salt, n: 2 ** logN, r: 8, p: 1, keyLen: 32 },
		flags: new Set(NEW_FLAGS),
		longNameMax: NAME_MAX
	};
	const gcm = await keyEncrypter(await passwordHash(config, password), true);
	const encryptedKey = await gcm.seal(masterKey, 0n, null);
	const json = {
		Creator: 'in-browser',
		EncryptedKey: toBase64(encryptedKey),
		ScryptObject: { Salt: toBase64(salt), N: 2 ** logN, R: 8, P: 1, KeyLen: 32 },
		Version: 2,
		FeatureFlags: NEW_FLAGS
	};
	return `${JSON.stringify(json, null, '\t')}\n`;
}

/** A new `gocryptfs.diriv` */
export const newDirIV = () => random(DIRIV_LEN);

/** Checks the content of a `gocryptfs.diriv` */
export function parseDirIV(bytes: Uint8Array): Uint8Array {
	if (bytes.length !== DIRIV_LEN || isZero(bytes)) throw new VaultFormatError('invalid', DIRIV_FILE);
	return bytes;
}

/** The master key as gocryptfs prints it (`-masterkey`): eight groups of eight hex digits */
export function formatMasterKey(key: Uint8Array): string {
	const hex = [...key].map((b) => b.toString(16).padStart(2, '0')).join('');
	return hex.match(/.{8}/g)!.join('-');
}

// --- Primitives on WebCrypto ---

async function hkdfDerive(key: Uint8Array, info: string): Promise<Uint8Array<ArrayBuffer>> {
	const base = await crypto.subtle.importKey('raw', key as Uint8Array<ArrayBuffer>, 'HKDF', false, ['deriveBits']);
	// No salt (Go's `nil`): HMAC pads an empty key with zeros, the same as RFC 5869's default of zero bytes
	const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(), info: encoder.encode(info) }, base, 256);
	return new Uint8Array(bits);
}

const gcmKey = (key: Uint8Array) => crypto.subtle.importKey('raw', key as Uint8Array<ArrayBuffer>, 'AES-GCM', false, ['encrypt', 'decrypt']);

/** Block number (big-endian 64 bit) and file id: the associated data of a block */
function blockData(blockNo: bigint, fileId: Uint8Array | null): Uint8Array<ArrayBuffer> {
	const data = new Uint8Array(8 + (fileId?.length ?? 0));
	new DataView(data.buffer).setBigUint64(0, blockNo);
	if (fileId) data.set(fileId, 8);
	return data;
}

/** AES-256-GCM with gocryptfs' nonce in front of every block */
class Gcm {
	constructor(
		private key: CryptoKey,
		readonly nonceLen: number
	) {}

	async seal(plain: Uint8Array, blockNo: bigint, fileId: Uint8Array | null): Promise<Uint8Array<ArrayBuffer>> {
		const iv = random(this.nonceLen);
		const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: blockData(blockNo, fileId), tagLength: TAG_LEN * 8 }, this.key, plain as Uint8Array<ArrayBuffer>);
		return concat(iv, new Uint8Array(sealed));
	}

	async open(block: Uint8Array, blockNo: bigint, fileId: Uint8Array | null): Promise<Uint8Array<ArrayBuffer>> {
		const iv = block.subarray(0, this.nonceLen);
		if (block.length < this.nonceLen + TAG_LEN || isZero(iv)) throw new VaultFormatError('invalid', 'block');
		const plain = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer>, additionalData: blockData(blockNo, fileId), tagLength: TAG_LEN * 8 },
			this.key,
			block.subarray(this.nonceLen) as Uint8Array<ArrayBuffer>
		);
		return new Uint8Array(plain);
	}
}

/**
 * Single AES blocks, each on its own (as ECB would), for EME. Encrypting: AES-CTR over zeros with the block as the
 * counter gives exactly its encryption. Decrypting: AES-CBC with a zero IV gives each block's decryption XOR the
 * block before, so all of them come out of one call – a last block chosen to decrypt to valid padding is appended.
 */
class AesBlocks {
	private constructor(
		private ctr: CryptoKey,
		private cbc: CryptoKey
	) {}

	static async create(key: Uint8Array): Promise<AesBlocks> {
		const raw = key as Uint8Array<ArrayBuffer>;
		return new AesBlocks(
			await crypto.subtle.importKey('raw', raw, 'AES-CTR', false, ['encrypt']),
			await crypto.subtle.importKey('raw', raw, 'AES-CBC', false, ['decrypt'])
		);
	}

	private async encryptOne(block: Uint8Array): Promise<Uint8Array> {
		const out = await crypto.subtle.encrypt({ name: 'AES-CTR', counter: block as Uint8Array<ArrayBuffer>, length: 128 }, this.ctr, new Uint8Array(16));
		return new Uint8Array(out);
	}

	async encrypt(blocks: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
		const parts: Promise<Uint8Array>[] = [];
		for (let i = 0; i < blocks.length; i += 16) parts.push(this.encryptOne(blocks.subarray(i, i + 16)));
		return concat(...(await Promise.all(parts)));
	}

	async decrypt(blocks: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
		const last = blocks.subarray(blocks.length - 16);
		const padding = await this.encryptOne(xor(new Uint8Array(16).fill(16), last));
		const chained = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, this.cbc, concat(blocks, padding)));
		const out = new Uint8Array(blocks.length);
		for (let i = 0; i < blocks.length; i++) out[i] = chained[i] ^ (i < 16 ? 0 : blocks[i - 16]);
		return out;
	}
}

/** Multiplication by 2 in GF(2^128), little-endian as in EME */
function double(block: Uint8Array): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(16);
	out[0] = ((block[0] << 1) & 0xff) ^ (block[15] & 0x80 ? 135 : 0);
	for (let j = 1; j < 16; j++) out[j] = ((block[j] << 1) & 0xff) | (block[j - 1] >> 7);
	return out;
}

/** EME (ECB-Mix-ECB), the wide-block mode of gocryptfs' names: 1 to 128 blocks, a 16-byte tweak */
class Eme {
	private constructor(
		private aes: AesBlocks,
		/** L·2^j for the blocks of the longest name (L = 2·AES(0)) */
		private table: Uint8Array[]
	) {}

	static async create(key: Uint8Array): Promise<Eme> {
		const aes = await AesBlocks.create(key);
		let l = double(await aes.encrypt(new Uint8Array(16)));
		const table = [l];
		for (let j = 1; j < 128; j++) table.push((l = double(l)));
		return new Eme(aes, table);
	}

	async transform(tweak: Uint8Array, input: Uint8Array, encrypt: boolean): Promise<Uint8Array<ArrayBuffer>> {
		const m = input.length / 16;
		if (!Number.isInteger(m) || m < 1 || m > 128) throw new VaultFormatError('invalid', 'name length');
		const aes = (blocks: Uint8Array) => (encrypt ? this.aes.encrypt(blocks) : this.aes.decrypt(blocks));
		const block = (bytes: Uint8Array, j: number) => bytes.subarray(j * 16, (j + 1) * 16);
		const pp = new Uint8Array(input.length);
		for (let j = 0; j < m; j++) pp.set(xor(block(input, j), this.table[j]), j * 16);
		const c = await aes(pp);
		let mp = xor(block(c, 0), tweak);
		for (let j = 1; j < m; j++) mp = xor(mp, block(c, j));
		const mc = await aes(mp);
		let mask = xor(mp, mc);
		for (let j = 1; j < m; j++) {
			mask = double(mask);
			c.set(xor(block(c, j), mask), j * 16);
		}
		let first = xor(mc, tweak);
		for (let j = 1; j < m; j++) first = xor(first, block(c, j));
		c.set(first, 0);
		const cc = await aes(c);
		for (let j = 0; j < m; j++) cc.set(xor(block(cc, j), this.table[j]), j * 16);
		return cc;
	}
}

// --- Names ---

function pad16(bytes: Uint8Array): Uint8Array {
	const padLen = 16 - (bytes.length % 16);
	return concat(bytes, new Uint8Array(padLen).fill(padLen));
}

function unpad16(bytes: Uint8Array): Uint8Array | null {
	const padLen = bytes[bytes.length - 1];
	if (!padLen || padLen > 16 || padLen >= bytes.length) return null;
	for (let i = bytes.length - padLen; i < bytes.length; i++) if (bytes[i] !== padLen) return null;
	return bytes.subarray(0, bytes.length - padLen);
}

/** A name gocryptfs accepts (it also allows names that other systems don't, which only reading has to take) */
function validName(name: string): boolean {
	return !!name && name !== '.' && name !== '..' && !/[/\0]/.test(name) && encoder.encode(name).length <= NAME_MAX;
}

/** Kinds of entries of an encrypted folder */
export type CipherName =
	/** A file or folder with its name encrypted in it */
	| { kind: 'name' }
	/** A file or folder whose encrypted name is in `<name>.name` */
	| { kind: 'long' }
	/** What belongs to the folder itself (its diriv, the configuration, long names' name files) */
	| { kind: 'internal' };

/** What an entry of an encrypted folder is, by its name */
export function cipherNameKind(name: string): CipherName['kind'] {
	if (name.startsWith(LONGNAME_PREFIX)) return name.endsWith(LONGNAME_SUFFIX) ? 'internal' : 'long';
	if (name.startsWith('gocryptfs.')) return 'internal';
	return 'name';
}

/** File that holds the encrypted name of a long name */
export const longNameFile = (hashed: string) => hashed + LONGNAME_SUFFIX;

// --- Contents ---

/** Plain size of an encrypted file of `cipherSize` bytes */
export function plainSize(cipherSize: number, cipherBS: number): number {
	if (cipherSize <= HEADER_LEN) return 0;
	const overhead = cipherBS - PLAIN_BS;
	const body = cipherSize - HEADER_LEN;
	const blocks = Math.ceil(body / cipherBS);
	return Math.max(0, body - blocks * overhead);
}

/** The keys of one unlocked folder */
export class GocryptfsKeys {
	private constructor(
		private eme: Eme,
		private gcm: Gcm,
		private raw64: boolean,
		private longNameMax: number
	) {}

	static async create(masterKey: Uint8Array, config: GocryptfsConfig): Promise<GocryptfsKeys> {
		const hkdf = config.flags.has('HKDF');
		const emeKey = hkdf ? await hkdfDerive(masterKey, 'EME filename encryption') : masterKey;
		const contentKey = hkdf ? await hkdfDerive(masterKey, 'AES-GCM file content encryption') : masterKey;
		return new GocryptfsKeys(await Eme.create(emeKey), new Gcm(await gcmKey(contentKey), config.flags.has('GCMIV128') ? 16 : 12), config.flags.has('Raw64'), config.longNameMax);
	}

	/** Bytes of an encrypted block of `PLAIN_BS` plain bytes */
	get cipherBS(): number {
		return PLAIN_BS + this.gcm.nonceLen + TAG_LEN;
	}

	/** The encrypted name of `name` in a folder with `dirIV`: `stored` is the entry's name, `long` the content of
	 * its `.name` file when the name is too long for the entry */
	async encryptName(name: string, dirIV: Uint8Array): Promise<{ stored: string; long: string | null }> {
		if (!validName(name)) throw new VaultFormatError('invalid', 'name');
		const encrypted = toBase64Url(await this.eme.transform(dirIV, pad16(encoder.encode(name)), true), this.raw64);
		if (encrypted.length <= this.longNameMax) return { stored: encrypted, long: null };
		const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(encrypted)));
		return { stored: LONGNAME_PREFIX + toBase64Url(hash, this.raw64), long: encrypted };
	}

	/** The plain name of an encrypted one (`null`: not a name of this folder – damaged, or added by something else) */
	async decryptName(encrypted: string, dirIV: Uint8Array): Promise<string | null> {
		const bytes = fromBase64Url(encrypted, this.raw64);
		if (!bytes?.length || bytes.length % 16 !== 0 || bytes.length > 16 * 128) return null;
		const plain = unpad16(await this.eme.transform(dirIV, bytes, false));
		if (!plain) return null;
		try {
			const name = strictDecoder.decode(plain);
			return validName(name) ? name : null;
		} catch {
			return null;
		}
	}

	/** A file's whole encrypted content (an empty file stays empty, as in gocryptfs) */
	async encryptFile(plain: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
		if (!plain.length) return new Uint8Array();
		let fileId = random(FILE_ID_LEN);
		while (isZero(fileId)) fileId = random(FILE_ID_LEN);
		const header = new Uint8Array(HEADER_LEN);
		new DataView(header.buffer).setUint16(0, 2);
		header.set(fileId, 2);
		const blocks: Promise<Uint8Array>[] = [];
		for (let at = 0, no = 0n; at < plain.length; at += PLAIN_BS, no++) blocks.push(this.gcm.seal(plain.subarray(at, at + PLAIN_BS), no, fileId));
		return concat(header, ...(await Promise.all(blocks)));
	}

	/** The file id of a header (`null` for an empty file) */
	fileId(header: Uint8Array, size: number): Uint8Array | null {
		if (size === 0) return null;
		if (header.length < HEADER_LEN) throw new VaultFormatError('invalid', 'header');
		const version = new DataView(header.buffer, header.byteOffset).getUint16(0);
		const id = header.slice(2, HEADER_LEN);
		if (version !== 2 || isZero(id)) throw new VaultFormatError('invalid', 'header');
		return id;
	}

	/** Decrypts blocks `first`… of a file (`cipher`: those blocks' bytes, the last one may be shorter) */
	async decryptBlocks(cipher: Uint8Array, first: number, fileId: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
		const size = this.cipherBS;
		const blocks: Promise<Uint8Array>[] = [];
		for (let at = 0, no = first; at < cipher.length; at += size, no++) {
			const block = cipher.subarray(at, at + size);
			// A hole (written by gocryptfs as zeros): plain zeros
			blocks.push(block.length === size && isZero(block) ? Promise.resolve(new Uint8Array(PLAIN_BS)) : this.gcm.open(block, BigInt(no), fileId));
		}
		return concat(...(await Promise.all(blocks)));
	}

	/** A file's whole plain content */
	async decryptFile(cipher: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
		const id = this.fileId(cipher.subarray(0, HEADER_LEN), cipher.length);
		if (!id) return new Uint8Array();
		return this.decryptBlocks(cipher.subarray(HEADER_LEN), 0, id);
	}
}
