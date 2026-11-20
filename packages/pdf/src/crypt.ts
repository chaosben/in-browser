// The PDF standard security handler for files that open without a password (an owner password only: “protected”
// against printing, copying, changing …). Such protection isn't enforced by a key the user lacks – every viewer opens
// the file – so we ignore it like PDF.js does: the file key is derived from the empty user password (revisions 2–4:
// RC4 or AES-128, 5–6: AES-256), strings and streams are decrypted when read and objects we write are encrypted with
// the same key (the file stays protected as it was). A file that needs a user password yields no key.
// MD5 and RC4 are here (WebCrypto has neither); AES and SHA-2 come from WebCrypto.

/** How strings or streams of a file are encrypted */
type Method = 'rc4' | 'aes128' | 'aes256' | 'none';

export interface PdfCrypt {
	/** Decrypts a string or stream of object `num` `gen` (bytes as stored) */
	decrypt(data: Uint8Array, num: number, gen: number, stream: boolean): Promise<Uint8Array>;
	/** Encrypts a string or stream of object `num` `gen` for writing */
	encrypt(data: Uint8Array, num: number, gen: number, stream: boolean): Promise<Uint8Array>;
	/** Metadata streams are encrypted too (`/EncryptMetadata`, default true) */
	readonly metadata: boolean;
}

/** The entries of an `/Encrypt` dictionary this handler needs (strings as bytes) */
export interface EncryptEntries {
	filter: string;
	v: number;
	r: number;
	length?: number;
	o: Uint8Array;
	u: Uint8Array;
	oe?: Uint8Array;
	ue?: Uint8Array;
	p: number;
	encryptMetadata: boolean;
	/** Crypt filters (V4/V5): name → `/CFM` */
	cf: Record<string, string>;
	stmF?: string;
	strF?: string;
}

const PAD = new Uint8Array([
	0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c,
	0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a
]);

/** The handler for a file opening without a password; null when it needs one or uses another handler */
export async function standardCrypt(e: EncryptEntries, id0: Uint8Array): Promise<PdfCrypt | null> {
	if (e.filter !== 'Standard') return null;
	const method = (name: string | undefined): Method => {
		if (e.v < 4) return 'rc4';
		if (!name || name === 'Identity') return 'none';
		const cfm = e.cf[name];
		return cfm === 'V2' ? 'rc4' : cfm === 'AESV2' ? 'aes128' : cfm === 'AESV3' ? 'aes256' : 'none';
	};
	const strings = method(e.strF);
	const streams = method(e.stmF);
	const key = e.r >= 5 ? await keyR6(e) : keyR4(e, id0);
	if (!key) return null;
	const objectKey = (num: number, gen: number, aes: boolean) => {
		const salt = aes ? [0x73, 0x41, 0x6c, 0x54] : [];
		const k = md5(concat(key, new Uint8Array([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, gen & 0xff, (gen >> 8) & 0xff, ...salt])));
		return k.subarray(0, Math.min(key.length + 5, 16));
	};
	const run = async (data: Uint8Array, num: number, gen: number, stream: boolean, encrypt: boolean) => {
		const m = stream ? streams : strings;
		if (m === 'none') return data;
		if (m === 'rc4') return rc4(objectKey(num, gen, false), data);
		const k = m === 'aes256' ? key : objectKey(num, gen, true);
		return encrypt ? aesEncrypt(k, data) : aesDecrypt(k, data);
	};
	return {
		decrypt: (data, num, gen, stream) => run(data, num, gen, stream, false),
		encrypt: (data, num, gen, stream) => run(data, num, gen, stream, true),
		metadata: e.encryptMetadata
	};
}

/** Revisions 2–4 (algorithms 2 and 6): the key from the empty password, null when it doesn't open the file */
function keyR4(e: EncryptEntries, id0: Uint8Array): Uint8Array | null {
	const n = e.r === 2 ? 5 : (e.length ?? 40) / 8;
	const p = e.p >>> 0;
	let h = md5(
		concat(PAD, e.o.subarray(0, 32), new Uint8Array([p & 0xff, (p >> 8) & 0xff, (p >> 16) & 0xff, (p >>> 24) & 0xff]), id0, e.r >= 4 && !e.encryptMetadata ? new Uint8Array([255, 255, 255, 255]) : new Uint8Array())
	);
	if (e.r >= 3) for (let i = 0; i < 50; i++) h = md5(h.subarray(0, n));
	const key = h.slice(0, n);
	if (e.r === 2) return equal(rc4(key, PAD), e.u.subarray(0, 32)) ? key : null;
	let x = rc4(key, md5(concat(PAD, id0)));
	for (let i = 1; i <= 19; i++) x = rc4(key.map((b) => b ^ i), x);
	return equal(x, e.u.subarray(0, 16)) ? key : null;
}

/** Revisions 5 and 6 (AES-256): the key from the empty password via `/U` and `/UE`, null when it doesn't open the file */
async function keyR6(e: EncryptEntries): Promise<Uint8Array | null> {
	if (!e.ue || e.u.length < 48) return null;
	const validation = e.u.subarray(32, 40);
	const keySalt = e.u.subarray(40, 48);
	const hash = (salt: Uint8Array) => (e.r === 5 ? sha('SHA-256', salt) : hash2B(salt));
	if (!equal(await hash(validation), e.u.subarray(0, 32))) return null;
	return aesRaw(await hash(keySalt), e.ue.subarray(0, 32));
}

/** Algorithm 2.B (revision 6) for the empty password and no user data */
async function hash2B(salt: Uint8Array): Promise<Uint8Array> {
	let k = await sha('SHA-256', salt);
	for (let round = 0; ; round++) {
		const k1 = new Uint8Array(k.length * 64);
		for (let i = 0; i < 64; i++) k1.set(k, i * k.length);
		const aes = await crypto.subtle.importKey('raw', buf(k.slice(0, 16)), 'AES-CBC', false, ['encrypt']);
		// WebCrypto pads: the input is a multiple of 16, so the last block is the padding's
		const e = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: buf(k.slice(16, 32)) }, aes, k1)).subarray(0, k1.length);
		let sum = 0;
		for (let i = 0; i < 16; i++) sum += e[i];
		k = await sha(['SHA-256', 'SHA-384', 'SHA-512'][sum % 3], e);
		if (round >= 63 && e[e.length - 1] <= round - 31) return k.subarray(0, 32);
	}
}

async function sha(name: string, data: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest(name, buf(data)));
}

/** AES-CBC as PDFs store it: 16 bytes IV, then the data with PKCS#7 padding */
async function aesDecrypt(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
	if (data.length < 32 || data.length % 16) return new Uint8Array();
	const k = await crypto.subtle.importKey('raw', buf(key), 'AES-CBC', false, ['decrypt']);
	try {
		return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: buf(data.slice(0, 16)) }, k, buf(data.slice(16))));
	} catch {
		// A broken padding: keep what is there
		return data;
	}
}

async function aesEncrypt(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
	const k = await crypto.subtle.importKey('raw', buf(key), 'AES-CBC', false, ['encrypt']);
	const iv = crypto.getRandomValues(new Uint8Array(16));
	return concat(iv, new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, k, buf(data))));
}

/** AES-256-CBC decryption without padding and a zero IV (`/UE`): a padding block is made up so WebCrypto accepts it */
async function aesRaw(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
	const k = await crypto.subtle.importKey('raw', buf(key), 'AES-CBC', false, ['encrypt', 'decrypt']);
	const last = data.slice(data.length - 16);
	const pad = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: buf(last) }, k, new Uint8Array(16).fill(16))).subarray(0, 16);
	return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, k, buf(concat(data, pad))));
}

export function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
	const s = new Uint8Array(256);
	for (let i = 0; i < 256; i++) s[i] = i;
	for (let i = 0, j = 0; i < 256; i++) {
		j = (j + s[i] + key[i % key.length]) & 0xff;
		[s[i], s[j]] = [s[j], s[i]];
	}
	const out = new Uint8Array(data.length);
	for (let n = 0, i = 0, j = 0; n < data.length; n++) {
		i = (i + 1) & 0xff;
		j = (j + s[i]) & 0xff;
		[s[i], s[j]] = [s[j], s[i]];
		out[n] = data[n] ^ s[(s[i] + s[j]) & 0xff];
	}
	return out;
}

const SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

export function md5(data: Uint8Array): Uint8Array {
	const length = ((data.length + 8) >>> 6) * 64 + 64;
	const m = new Uint8Array(length);
	m.set(data);
	m[data.length] = 0x80;
	const bits = data.length * 8;
	const view = new DataView(m.buffer);
	view.setUint32(length - 8, bits >>> 0, true);
	view.setUint32(length - 4, Math.floor(bits / 2 ** 32), true);
	let [a0, b0, c0, d0] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
	const w = new Uint32Array(16);
	for (let off = 0; off < length; off += 64) {
		for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, true);
		let [a, b, c, d] = [a0, b0, c0, d0];
		for (let i = 0; i < 64; i++) {
			let f: number;
			let g: number;
			if (i < 16) [f, g] = [(b & c) | (~b & d), i];
			else if (i < 32) [f, g] = [(d & b) | (~d & c), (5 * i + 1) % 16];
			else if (i < 48) [f, g] = [b ^ c ^ d, (3 * i + 5) % 16];
			else [f, g] = [c ^ (b | ~d), (7 * i) % 16];
			const s = SHIFTS[(i >> 4) * 4 + (i % 4)];
			const sum = (a + f + K[i] + w[g]) >>> 0;
			[a, d, c] = [d, c, b];
			b = (b + ((sum << s) | (sum >>> (32 - s)))) >>> 0;
		}
		a0 = (a0 + a) >>> 0;
		b0 = (b0 + b) >>> 0;
		c0 = (c0 + c) >>> 0;
		d0 = (d0 + d) >>> 0;
	}
	const out = new Uint8Array(16);
	const o = new DataView(out.buffer);
	[a0, b0, c0, d0].forEach((v, i) => o.setUint32(i * 4, v, true));
	return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const p of parts) {
		out.set(p, at);
		at += p.length;
	}
	return out;
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
	return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** WebCrypto takes views of plain `ArrayBuffer`s */
const buf = (u: Uint8Array) => u as Uint8Array<ArrayBuffer>;
