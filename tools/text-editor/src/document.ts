// Bytes of a text file ⇄ text: detects and keeps the encoding (with or without BOM) and the line ending, so an
// unchanged file is saved byte for byte as it was.

export type Charset = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252' | 'iso-8859-1';

export interface Encoding {
	charset: Charset;
	/** Byte order mark at the start (only UTF-8/UTF-16 have one) */
	bom: boolean;
}

export type LineEnding = '\n' | '\r\n';

export interface Decoded {
	/** Text with its line breaks as in the file */
	text: string;
	encoding: Encoding;
	eol: LineEnding;
}

/** Larger files are not opened (the editor keeps everything in memory) */
export const MAX_SIZE = 20 * 1024 * 1024;

/** Name of the charset as shown (not translated) */
export const CHARSET_NAMES: Record<Charset, string> = {
	'utf-8': 'UTF-8',
	'utf-16le': 'UTF-16 LE',
	'utf-16be': 'UTF-16 BE',
	'windows-1252': 'Windows-1252',
	'iso-8859-1': 'ISO-8859-1'
};

export const CHARSETS = Object.keys(CHARSET_NAMES) as Charset[];

export function hasBom(charset: Charset) {
	return charset === 'utf-8' || charset === 'utf-16le' || charset === 'utf-16be';
}

const BOMS: Partial<Record<Charset, number[]>> = {
	'utf-8': [0xef, 0xbb, 0xbf],
	'utf-16le': [0xff, 0xfe],
	'utf-16be': [0xfe, 0xff]
};

function startsWith(bytes: Uint8Array, prefix: number[]) {
	return prefix.every((b, i) => bytes[i] === b);
}

/** How many bytes the heuristics look at */
const SAMPLE = 64 * 1024;

/** UTF-16 without BOM: in mostly Latin text every other byte is 0 */
function utf16Guess(bytes: Uint8Array): Charset | null {
	const n = Math.min(bytes.length, SAMPLE) & ~1;
	if (n < 4) return null;
	let even = 0;
	let odd = 0;
	for (let i = 0; i < n; i += 2) {
		if (bytes[i] === 0) even++;
		if (bytes[i + 1] === 0) odd++;
	}
	const pairs = n / 2;
	if (odd > pairs * 0.3 && even < pairs * 0.05) return 'utf-16le';
	if (even > pairs * 0.3 && odd < pairs * 0.05) return 'utf-16be';
	return null;
}

/** Control characters other than tab, line breaks, form feed and escape point to a binary file */
function looksBinary(bytes: Uint8Array) {
	const n = Math.min(bytes.length, SAMPLE);
	let control = 0;
	for (let i = 0; i < n; i++) {
		const b = bytes[i];
		if (b === 0) return true;
		if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d && b !== 0x0c && b !== 0x1b) control++;
	}
	return control > n * 0.1;
}

/** Encoding of the bytes; `null` for a binary file */
export function detectEncoding(bytes: Uint8Array): Encoding | null {
	// UTF-8's BOM first: UTF-16 LE's (FF FE) can't be mistaken for it
	for (const charset of ['utf-8', 'utf-16le', 'utf-16be'] as const) {
		if (startsWith(bytes, BOMS[charset]!)) return { charset, bom: true };
	}
	const utf16 = utf16Guess(bytes);
	if (utf16) return { charset: utf16, bom: false };
	if (looksBinary(bytes)) return null;
	try {
		new TextDecoder('utf-8', { fatal: true }).decode(bytes);
		return { charset: 'utf-8', bom: false };
	} catch {
		// Not valid UTF-8: most likely an old Windows/Latin-1 file
		return { charset: 'windows-1252', bom: false };
	}
}

/** Line ending of the first line break (LF if there is none) */
export function detectEol(text: string): LineEnding {
	const i = text.indexOf('\n');
	return i > 0 && text[i - 1] === '\r' ? '\r\n' : '\n';
}

/** Bytes → text; with `charset` given (“Reopen with encoding”) instead of detecting it. `null`: binary file. */
export function decode(bytes: Uint8Array, charset?: Charset): Decoded | null {
	let encoding: Encoding | null;
	if (charset) {
		const bom = BOMS[charset];
		encoding = { charset, bom: !!bom && startsWith(bytes, bom) };
	} else encoding = detectEncoding(bytes);
	if (!encoding) return null;
	const body = encoding.bom ? bytes.subarray(BOMS[encoding.charset]!.length) : bytes;
	const text =
		// The browsers' "iso-8859-1" is Windows-1252; real Latin-1 maps every byte to the same code point
		encoding.charset === 'iso-8859-1'
			? latin1Decode(body)
			: new TextDecoder(encoding.charset, { ignoreBOM: true }).decode(body);
	return { text, encoding, eol: detectEol(text) };
}

function latin1Decode(bytes: Uint8Array) {
	let text = '';
	for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return text;
}

/** Brings every line break to `eol` */
export function withEol(text: string, eol: LineEnding) {
	return text.replace(/\r\n|\r|\n/g, eol);
}

/** Code point → byte of Windows-1252, built from the browser's decoder */
let cp1252: Map<number, number> | null = null;

function singleByteTable(charset: 'windows-1252' | 'iso-8859-1'): (code: number) => number | undefined {
	if (charset === 'iso-8859-1') return (code) => (code < 0x100 ? code : undefined);
	if (!cp1252) {
		cp1252 = new Map();
		const all = new TextDecoder('windows-1252').decode(Uint8Array.from({ length: 256 }, (_, i) => i));
		for (let i = 0; i < 256; i++) cp1252.set(all.charCodeAt(i), i);
	}
	const table = cp1252;
	return (code) => table.get(code);
}

export interface Encoded {
	bytes: Uint8Array<ArrayBuffer>;
	/** Characters the charset can't represent (written as `?`) */
	unmappable: number;
}

/** Text → bytes in `encoding` (BOM only if `bom`) */
export function encode(text: string, encoding: Encoding): Encoded {
	const bom = encoding.bom ? (BOMS[encoding.charset] ?? []) : [];
	const { charset } = encoding;
	if (charset === 'utf-8') {
		const body = new TextEncoder().encode(text);
		const bytes = new Uint8Array(bom.length + body.length);
		bytes.set(bom);
		bytes.set(body, bom.length);
		return { bytes, unmappable: 0 };
	}
	if (charset === 'utf-16le' || charset === 'utf-16be') {
		const bytes = new Uint8Array(bom.length + text.length * 2);
		bytes.set(bom);
		const view = new DataView(bytes.buffer);
		for (let i = 0; i < text.length; i++) view.setUint16(bom.length + i * 2, text.charCodeAt(i), charset === 'utf-16le');
		return { bytes, unmappable: 0 };
	}
	const byteOf = singleByteTable(charset);
	const out: number[] = [];
	let unmappable = 0;
	for (const char of text) {
		const byte = byteOf(char.codePointAt(0)!);
		if (byte === undefined) {
			unmappable++;
			out.push(0x3f);
		} else out.push(byte);
	}
	return { bytes: Uint8Array.from(out), unmappable };
}
