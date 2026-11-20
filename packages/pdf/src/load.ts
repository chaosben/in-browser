// A PDF parsed by pdf-lib, decrypted when it is protected without a password (`crypt.ts`): every string and stream
// of the parsed objects is plain afterwards. pdf-lib can't read encrypted object streams itself (it would inflate
// the encrypted bytes), so those are decrypted after a first parse and the file is parsed again with them.

import { standardCrypt, type EncryptEntries, type PdfCrypt } from './crypt.js';
import { pdfLib } from './pdf-lib.js';
import type { PDFContext, PDFDict, PDFDocument, PDFObject, PDFRef } from './pdf-lib.js';

export interface LoadedPdf {
	doc: PDFDocument;
	/** The file's encryption, to encrypt what is written into it; null when it has none */
	crypt: PdfCrypt | null;
	/** `/Encrypt` of the trailer (kept in sections appended to the file) */
	encrypt: PDFRef | PDFDict | null;
	/** Encrypted in a way we can't open without a password (or by another handler): its strings and streams are as stored */
	locked: boolean;
}

type Lib = typeof import('pdf-lib');

/** Parses a PDF; protection without a password is taken off (see above) */
export async function loadPdf(bytes: Uint8Array, fast = false): Promise<LoadedPdf> {
	const lib = await pdfLib();
	const options = { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false, ...(fast ? { parseSpeed: lib.ParseSpeeds.Fast } : {}) };
	let doc = await lib.PDFDocument.load(bytes, options);
	if (!doc.isEncrypted) return { doc, crypt: null, encrypt: null, locked: false };
	const encrypt = doc.context.trailerInfo.Encrypt as PDFRef | PDFDict;
	const entries = encryptEntries(lib, doc.context, encrypt);
	const id = doc.context.trailerInfo.ID;
	const id0 = id instanceof lib.PDFArray && id.size() > 0 ? bytesOfString(lib, id.get(0)) : new Uint8Array();
	const crypt = entries && (await standardCrypt(entries, id0));
	if (!crypt) return { doc, crypt: null, encrypt, locked: true };

	// Object streams: pdf-lib kept them as invalid objects; decrypted, the file is parsed again with them
	const streams = new Map<number, ObjStm>();
	for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
		if (!(object instanceof lib.PDFInvalidObject)) continue;
		const data = new Uint8Array(object.sizeInBytes());
		object.copyBytesInto(data, 0);
		const parsed = parseInvalid(lib, doc.context, data);
		if (!(parsed instanceof lib.PDFRawStream) || parsed.dict.get(lib.PDFName.of('Type')) !== lib.PDFName.of('ObjStm')) continue;
		const plain = await crypt.decrypt(parsed.contents, ref.objectNumber, ref.generationNumber, true);
		streams.set(ref.objectNumber, { encrypted: parsed.contents, plain });
	}
	let inStreams = new Set<number>();
	if (streams.size) {
		({ doc, members: inStreams } = await withObjectStreams(lib, streams, () => lib.PDFDocument.load(bytes, options)));
	}
	const encryptNumber = encrypt instanceof lib.PDFRef ? encrypt.objectNumber : -1;
	for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
		if (ref.objectNumber === encryptNumber || inStreams.has(ref.objectNumber)) continue;
		const plain = await transform(lib, crypt, object, ref.objectNumber, ref.generationNumber, false);
		if (plain !== object) doc.context.assign(ref, plain);
	}
	return { doc, crypt, encrypt, locked: false };
}

/** Encrypts the strings and streams of an object to be written as object `num` `gen` (in place: a parsed copy) */
export function encryptObject(lib: Lib, crypt: PdfCrypt, object: PDFObject, num: number, gen: number): Promise<PDFObject> {
	return transform(lib, crypt, object, num, gen, true);
}

/**
 * Strings and streams of an object through the cipher, changed in place (pdf-lib's catalog and page tree are
 * subclasses of `PDFDict` – they must stay those objects); a string at the top is returned anew. Untouched:
 * signatures' `/Contents`, cross-reference streams, metadata when it stays plain, streams with a crypt filter of
 * their own.
 */
async function transform(lib: Lib, crypt: PdfCrypt, object: PDFObject, num: number, gen: number, encrypt: boolean): Promise<PDFObject> {
	const { PDFArray, PDFDict, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFString } = lib;
	const run = (data: Uint8Array, stream: boolean) => (encrypt ? crypt.encrypt(data, num, gen, stream) : crypt.decrypt(data, num, gen, stream));
	const isString = (o: PDFObject) => o instanceof PDFString || o instanceof PDFHexString;
	const string = async (o: PDFObject) => PDFHexString.of(hex(await run((o as import('pdf-lib').PDFString).asBytes(), false)));
	const walk = async (o: PDFObject): Promise<void> => {
		if (o instanceof PDFArray) {
			for (let i = 0; i < o.size(); i++) {
				const v = o.get(i);
				if (isString(v)) o.set(i, await string(v));
				else await walk(v);
			}
		} else if (o instanceof PDFDict) {
			const sig = o.get(PDFName.of('Type')) === PDFName.of('Sig') || o.has(PDFName.of('ByteRange'));
			for (const [k, v] of o.entries()) {
				if (sig && k === PDFName.of('Contents')) continue;
				if (isString(v)) o.set(k, await string(v));
				else await walk(v);
			}
		} else if (o instanceof PDFRawStream) {
			await walk(o.dict);
			const type = o.dict.get(PDFName.of('Type'));
			const filter = o.dict.get(PDFName.of('Filter'));
			const own = filter === PDFName.of('Crypt') || (filter instanceof PDFArray && filter.asArray().includes(PDFName.of('Crypt')));
			if (type === PDFName.of('XRef') || (type === PDFName.of('Metadata') && !crypt.metadata) || own) return;
			const contents = await run(o.contents, true);
			(o as { contents: Uint8Array }).contents = contents;
			o.dict.set(PDFName.of('Length'), PDFNumber.of(contents.length));
		}
	};
	if (isString(object)) return string(object);
	await walk(object);
	return object;
}

function hex(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += b.toString(16).padStart(2, '0');
	return s;
}

function bytesOfString(lib: Lib, o: PDFObject): Uint8Array {
	return o instanceof lib.PDFString || o instanceof lib.PDFHexString ? o.asBytes() : new Uint8Array();
}

function encryptEntries(lib: Lib, context: PDFContext, encrypt: PDFRef | PDFDict): EncryptEntries | null {
	const { PDFDict, PDFName, PDFNumber, PDFBool } = lib;
	const dict = context.lookup(encrypt);
	if (!(dict instanceof PDFDict)) return null;
	const num = (key: string) => {
		const v = dict.lookup(PDFName.of(key));
		return v instanceof PDFNumber ? v.asNumber() : undefined;
	};
	const name = (d: PDFDict, key: string) => {
		const v = d.lookup(PDFName.of(key));
		return v instanceof PDFName ? v.decodeText() : undefined;
	};
	const str = (key: string) => {
		const v = dict.lookup(PDFName.of(key));
		return v ? bytesOfString(lib, v) : undefined;
	};
	const cf: Record<string, string> = {};
	const filters = dict.lookup(PDFName.of('CF'));
	if (filters instanceof PDFDict) {
		for (const [k, v] of filters.entries()) {
			const f = context.lookup(v);
			if (f instanceof PDFDict) cf[k.decodeText()] = name(f, 'CFM') ?? 'None';
		}
	}
	const meta = dict.lookup(PDFName.of('EncryptMetadata'));
	return {
		filter: name(dict, 'Filter') ?? '',
		v: num('V') ?? 0,
		r: num('R') ?? 2,
		length: num('Length'),
		o: str('O') ?? new Uint8Array(),
		u: str('U') ?? new Uint8Array(),
		oe: str('OE'),
		ue: str('UE'),
		p: num('P') ?? 0,
		encryptMetadata: !(meta instanceof PDFBool) || meta.asBoolean(),
		cf,
		stmF: name(dict, 'StmF'),
		strF: name(dict, 'StrF')
	};
}

/** The object of an invalid object's bytes (`n g obj … endobj`), or null */
function parseInvalid(lib: Lib, context: PDFContext, data: Uint8Array): PDFObject | null {
	try {
		const parser = lib.PDFObjectParser.forBytes(data, context);
		return parser.parseObject();
	} catch {
		return null;
	}
}

interface ObjStm {
	encrypted: Uint8Array;
	plain: Uint8Array;
}

// --- Parsing object streams of decrypted contents ---

/** While a decrypting parse runs: object number of an object stream → its contents; one such parse at a time */
let active: Map<number, ObjStm> | null = null;
/** The header last parsed (the object stream's own number when pdf-lib reaches its contents) */
let lastRef: PDFRef | null = null;
/** The running parse's context (known from its first object stream) and whether its object stream is being read */
let activeContext: PDFContext | null = null;
let inStream = false;
/** Objects whose last version came from an object stream (not encrypted on their own) */
let members = new Set<number>();
let queue: Promise<unknown> = Promise.resolve();
let patched = false;

async function withObjectStreams(lib: Lib, streams: Map<number, ObjStm>, parse: () => Promise<PDFDocument>) {
	patch(lib);
	const run = queue.then(async () => {
		active = streams;
		members = new Set();
		try {
			return { doc: await parse(), members };
		} finally {
			active = null;
			activeContext = null;
			lastRef = null;
		}
	});
	queue = run.catch(() => undefined);
	return run;
}

/**
 * pdf-lib's parser hands an object stream's raw contents to `PDFObjectStreamParser.forStream` right after reading
 * its header: there the decrypted contents are put in (only for the parse running). Objects assigned while it is read
 * are members; one assigned later again (a newer version in a later section) is not.
 */
function patch(lib: Lib) {
	if (patched) return;
	patched = true;
	type Parser = { parseIndirectObjectHeader(): PDFRef };
	const parser = lib.PDFParser.prototype as unknown as Parser;
	const header = parser.parseIndirectObjectHeader;
	parser.parseIndirectObjectHeader = function (this: Parser) {
		const ref = header.call(this);
		lastRef = ref;
		return ref;
	};
	type Context = { assign(ref: PDFRef, object: PDFObject): void };
	const context = lib.PDFContext.prototype as unknown as Context;
	const assign = context.assign;
	context.assign = function (this: Context, ref: PDFRef, object: PDFObject) {
		if (activeContext && (this as unknown) === activeContext) {
			if (inStream) members.add(ref.objectNumber);
			else members.delete(ref.objectNumber);
		}
		return assign.call(this, ref, object);
	};
	type StreamParser = { forStream(stream: import('pdf-lib').PDFRawStream, wait?: () => boolean): { parseIntoContext(): Promise<void> } };
	const streamParser = lib.PDFObjectStreamParser as unknown as StreamParser;
	const forStream = streamParser.forStream;
	streamParser.forStream = (stream, wait) => {
		const own = active && lastRef ? active.get(lastRef.objectNumber) : undefined;
		// Only the stream it was made for (another parse may run meanwhile, unencrypted)
		if (!own || own.encrypted.length !== stream.contents.length || !own.encrypted.every((b, i) => b === stream.contents[i])) return forStream(stream, wait);
		activeContext = stream.dict.context;
		const parser = forStream(lib.PDFRawStream.of(stream.dict, own.plain), wait);
		return {
			async parseIntoContext() {
				inStream = true;
				try {
					await parser.parseIntoContext();
				} finally {
					inStream = false;
				}
			}
		};
	};
}
