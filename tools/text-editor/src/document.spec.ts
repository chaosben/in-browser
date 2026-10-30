import { describe, expect, it } from 'vitest';
import { decode, detectEncoding, encode, withEol, type Charset } from './document';

const bytes = (...parts: (number[] | Uint8Array)[]) => Uint8Array.from(parts.flatMap((p) => [...p]));
const utf8 = (text: string) => new TextEncoder().encode(text);
const utf16 = (text: string, le: boolean) => {
	const out = new Uint8Array(text.length * 2);
	const view = new DataView(out.buffer);
	for (let i = 0; i < text.length; i++) view.setUint16(i * 2, text.charCodeAt(i), le);
	return out;
};

/** Open and save unchanged: the same bytes must come out */
function roundTrip(input: Uint8Array, charset?: Charset) {
	const doc = decode(input, charset)!;
	return encode(withEol(doc.text, doc.eol), doc.encoding).bytes;
}

const sample = 'Grüße aus Köln – 5 €\r\nZweite Zeile\r\n';

describe('detectEncoding', () => {
	it('recognizes byte order marks', () => {
		expect(detectEncoding(bytes([0xef, 0xbb, 0xbf], utf8('a')))).toEqual({ charset: 'utf-8', bom: true });
		expect(detectEncoding(bytes([0xff, 0xfe], utf16('a', true)))).toEqual({ charset: 'utf-16le', bom: true });
		expect(detectEncoding(bytes([0xfe, 0xff], utf16('a', false)))).toEqual({ charset: 'utf-16be', bom: true });
	});
	it('recognizes UTF-16 without BOM by its zero bytes', () => {
		expect(detectEncoding(utf16('Hello world', true))).toEqual({ charset: 'utf-16le', bom: false });
		expect(detectEncoding(utf16('Hello world', false))).toEqual({ charset: 'utf-16be', bom: false });
	});
	it('falls back from UTF-8 to Windows-1252', () => {
		expect(detectEncoding(utf8('Grüße'))).toEqual({ charset: 'utf-8', bom: false });
		expect(detectEncoding(new Uint8Array())).toEqual({ charset: 'utf-8', bom: false });
		// "Grüße" in Windows-1252: ü = FC, ß = DF – not valid UTF-8
		expect(detectEncoding(bytes([0x47, 0x72, 0xfc, 0xdf, 0x65]))).toEqual({ charset: 'windows-1252', bom: false });
	});
	it('rejects binary files', () => {
		expect(detectEncoding(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]))).toBeNull();
		expect(decode(bytes(utf8('abc'), [0x00, 0x01, 0x02, 0x03, 0x04]))).toBeNull();
	});
});

describe('decode', () => {
	it('strips the BOM and keeps the line ending', () => {
		const doc = decode(bytes([0xef, 0xbb, 0xbf], utf8(sample)))!;
		expect(doc.text).toBe(sample);
		expect(doc.eol).toBe('\r\n');
		expect(decode(utf8('a\nb'))!.eol).toBe('\n');
	});
	it('decodes with a chosen charset and only strips its own BOM', () => {
		expect(decode(bytes([0xfc]), 'iso-8859-1')!.text).toBe('ü');
		// 0x80 is € in Windows-1252 but a control character in real Latin-1
		expect(decode(bytes([0x80]), 'windows-1252')!.text).toBe('€');
		expect(decode(bytes([0x80]), 'iso-8859-1')!.text).toBe('\u0080');
		expect(decode(bytes([0xff, 0xfe], utf16('a', true)), 'utf-16le')!.encoding).toEqual({ charset: 'utf-16le', bom: true });
		expect(decode(utf16('a', true), 'utf-16le')!.encoding.bom).toBe(false);
	});
});

describe('round trip (open and save unchanged)', () => {
	const cases: [string, Uint8Array][] = [
		['UTF-8', utf8(sample)],
		['UTF-8 with BOM', bytes([0xef, 0xbb, 0xbf], utf8(sample))],
		['UTF-16 LE', utf16(sample, true)],
		['UTF-16 LE with BOM', bytes([0xff, 0xfe], utf16(sample, true))],
		['UTF-16 BE', utf16(sample, false)],
		['UTF-16 BE with BOM', bytes([0xfe, 0xff], utf16(sample, false))],
		['Windows-1252', encode(sample, { charset: 'windows-1252', bom: false }).bytes]
	];
	for (const [name, input] of cases) {
		it(name, () => expect(roundTrip(input)).toEqual(input));
	}
	it('ISO-8859-1 when chosen', () => {
		const input = Uint8Array.from({ length: 256 }, (_, i) => i).subarray(0x20);
		expect(roundTrip(input, 'iso-8859-1')).toEqual(input);
	});
	it('LF stays LF', () => {
		const input = utf8('a\nb\n');
		expect(roundTrip(input)).toEqual(input);
	});
});

describe('encode', () => {
	it('counts characters the charset cannot represent', () => {
		const result = encode('a😀b€', { charset: 'windows-1252', bom: false });
		expect(result.unmappable).toBe(1);
		expect([...result.bytes]).toEqual([0x61, 0x3f, 0x62, 0x80]);
		expect(encode('€', { charset: 'iso-8859-1', bom: false }).unmappable).toBe(1);
		expect(encode('😀', { charset: 'utf-16le', bom: false }).unmappable).toBe(0);
	});
	it('writes the BOM only when asked', () => {
		expect([...encode('a', { charset: 'utf-8', bom: true }).bytes]).toEqual([0xef, 0xbb, 0xbf, 0x61]);
		expect([...encode('a', { charset: 'utf-16be', bom: false }).bytes]).toEqual([0x00, 0x61]);
	});
});
