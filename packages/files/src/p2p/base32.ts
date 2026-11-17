// Crockford Base32 for keys people read and type: no I, L, O, U; input tolerates case, spaces, dashes and the
// look-alikes O→0, I/L→1.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function encodeBase32(bytes: Uint8Array, bits = bytes.length * 8): string {
	let out = '';
	let buffer = 0;
	let filled = 0;
	let used = 0;
	for (const byte of bytes) {
		buffer = (buffer << 8) | byte;
		filled += 8;
		while (filled >= 5 && used < bits) {
			out += ALPHABET[(buffer >> (filled - 5)) & 31];
			filled -= 5;
			used += 5;
		}
	}
	if (filled > 0 && used < bits) out += ALPHABET[(buffer << (5 - filled)) & 31];
	return out;
}

/** Normalized form of a typed key (upper case, look-alikes replaced, separators removed); `null` if invalid */
export function normalizeBase32(text: string): string | null {
	const clean = text
		.toUpperCase()
		.replace(/[\s\-_.]/g, '')
		.replace(/O/g, '0')
		.replace(/[IL]/g, '1');
	return /^[0-9A-HJKMNP-TV-Z]+$/.test(clean) ? clean : null;
}

export function decodeBase32(text: string): Uint8Array {
	const clean = normalizeBase32(text);
	if (!clean) throw new Error('Invalid Base32');
	const out: number[] = [];
	let buffer = 0;
	let filled = 0;
	for (const char of clean) {
		buffer = (buffer << 5) | ALPHABET.indexOf(char);
		filled += 5;
		if (filled >= 8) {
			out.push((buffer >> (filled - 8)) & 255);
			filled -= 8;
		}
		buffer &= 0xff;
	}
	return new Uint8Array(out);
}

/** `K7QF29XM…` → `K7QF-29XM-…` */
export function groupBase32(text: string, size = 4): string {
	return text.match(new RegExp(`.{1,${size}}`, 'g'))?.join('-') ?? '';
}
