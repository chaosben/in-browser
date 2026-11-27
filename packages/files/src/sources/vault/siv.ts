// AES-SIV (RFC 5297) on WebCrypto: deterministic authenticated encryption, used by Cryptomator for names and
// directory ids. CMAC is a CBC-MAC (AES-CBC with a zero IV, the last block masked with a subkey), the encryption
// AES-CTR with the synthetic IV as counter. Keys: `mac` for S2V/CMAC (K1), `ctr` for CTR (K2), 16 or 32 bytes each.

const ZERO = new Uint8Array(16);

/** Doubling in GF(2^128), big-endian (RFC 5297's dbl) */
function dbl(block: Uint8Array): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(16);
	for (let i = 0; i < 16; i++) out[i] = ((block[i] << 1) & 0xff) | (i < 15 ? block[i + 1] >> 7 : 0);
	if (block[0] & 0x80) out[15] ^= 0x87;
	return out;
}

function xor(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(a.length);
	for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
	return out;
}

/** One block padded with 0x80 and zeros (RFC 5297's pad) */
function pad(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(16);
	out.set(bytes);
	out[bytes.length] = 0x80;
	return out;
}

export class Siv {
	private constructor(
		private cbc: CryptoKey,
		private ctr: CryptoKey,
		private k1: Uint8Array,
		private k2: Uint8Array
	) {}

	static async create(ctrKey: Uint8Array, macKey: Uint8Array): Promise<Siv> {
		const cbc = await crypto.subtle.importKey('raw', macKey as Uint8Array<ArrayBuffer>, 'AES-CBC', false, ['encrypt']);
		const ctr = await crypto.subtle.importKey('raw', ctrKey as Uint8Array<ArrayBuffer>, 'AES-CTR', false, ['encrypt']);
		const l = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ZERO }, cbc, ZERO)).subarray(0, 16);
		const k1 = dbl(l);
		return new Siv(cbc, ctr, k1, dbl(k1));
	}

	/** AES-CMAC (RFC 4493) */
	private async cmac(message: Uint8Array): Promise<Uint8Array> {
		const blocks = Math.max(1, Math.ceil(message.length / 16));
		const data = new Uint8Array(blocks * 16);
		data.set(message);
		const lastAt = (blocks - 1) * 16;
		const complete = message.length > 0 && message.length % 16 === 0;
		const last = complete ? xor(message.subarray(lastAt), this.k1) : xor(pad(message.subarray(lastAt)), this.k2);
		data.set(last, lastAt);
		const chained = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ZERO }, this.cbc, data));
		return chained.subarray(lastAt, lastAt + 16);
	}

	/** S2V over the associated data and the plaintext */
	private async s2v(plain: Uint8Array, data: Uint8Array[]): Promise<Uint8Array> {
		let d = await this.cmac(ZERO);
		for (const item of data) d = xor(dbl(d), await this.cmac(item));
		if (plain.length >= 16) {
			const t = new Uint8Array(plain);
			t.set(xor(plain.subarray(plain.length - 16), d), plain.length - 16);
			return this.cmac(t);
		}
		return this.cmac(xor(dbl(d), pad(plain)));
	}

	private async ctrCrypt(iv: Uint8Array, bytes: Uint8Array): Promise<Uint8Array> {
		const counter = new Uint8Array(iv);
		counter[8] &= 0x7f;
		counter[12] &= 0x7f;
		return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CTR', counter, length: 128 }, this.ctr, bytes as Uint8Array<ArrayBuffer>));
	}

	/** The synthetic IV, then the ciphertext */
	async encrypt(plain: Uint8Array, ...data: Uint8Array[]): Promise<Uint8Array<ArrayBuffer>> {
		const iv = await this.s2v(plain, data);
		const out = new Uint8Array(16 + plain.length);
		out.set(iv);
		out.set(await this.ctrCrypt(iv, plain), 16);
		return out;
	}

	/** The plaintext, `null` when the ciphertext or its associated data was changed */
	async decrypt(cipher: Uint8Array, ...data: Uint8Array[]): Promise<Uint8Array | null> {
		if (cipher.length < 16) return null;
		const iv = cipher.subarray(0, 16);
		const plain = await this.ctrCrypt(iv, cipher.subarray(16));
		const check = await this.s2v(plain, data);
		let diff = 0;
		for (let i = 0; i < 16; i++) diff |= check[i] ^ iv[i];
		return diff ? null : plain;
	}
}
