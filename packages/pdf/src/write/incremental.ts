// Changes to a PDF as an incremental update: the original bytes stay as they are and one section is appended with
// the changed and new objects, a cross-reference section of the same kind as the file's last one (table or stream)
// and a trailer pointing back to it (`/Prev`). Signatures over the original bytes stay valid, the file can always go
// back to exactly what it was (drop the section), and saving costs the size of the change, not of the file.
//
// pdf-lib serves as parser and object model only: the original document is parsed once and never changed; every
// update clones what it changes and is built anew from the edits (one section per session, replaced on each save).
// New objects (annotations and their appearances) are written as PDF source text. Files whose end can't be trusted
// (no `startxref`, or it points nowhere) are written completely once when opened – the base is then that repaired file.
// Files protected without a password are read decrypted and the section is encrypted with their key (`load.ts`).

import type { PDFArray, PDFDict, PDFDocument, PDFObject, PDFRef } from 'pdf-lib';
import type { PdfCrypt } from '../crypt.js';
import { encryptObject, loadPdf } from '../load.js';
import { pdfLib } from '../pdf-lib.js';
import { PdfError } from '../pdfjs.js';
import type { ExistingAnnotation, ExistingReply, ExistingState, NewAnnotation, PaintOpacity, ReviewState, Rgb } from './annotations.js';
import { annotationObjects, REPLACED_KEYS, REVIEW_STATES } from './annotations.js';
import { placeholdersOf, UNICODE_FONT, UNICODE_TEXT, unicodeFont, type UnicodeFont } from './unicode.js';

/** What changes, relative to the original file */
export interface PdfEdits {
	/** Page index → rotation in degrees (0, 90, 180, 270; absolute, as `/Rotate`) */
	rotate?: ReadonlyMap<number, number>;
	/** Page index → annotations added to it (after those it has) */
	annotations?: ReadonlyMap<number, readonly NewAnnotation[]>;
	/** Annotations of the file (`ExistingAnnotation.ref`) written anew in their place; what they have besides stays */
	replace?: ReadonlyMap<string, NewAnnotation>;
	/** Annotations of the file taken off their pages, with their popups and replies */
	remove?: ReadonlySet<string>;
	/**
	 * Page index → the order of its annotations (first drawn first), when it isn't the file's with the added ones
	 * after: refs of the file's (`ExistingAnnotation.ref`) and indices into the page's `annotations`. The page's other
	 * entries (links, widgets, popups …) keep their places; the listed ones fill the places of the file's listed
	 * ones in the new order, the rest go after.
	 */
	order?: ReadonlyMap<number, readonly (string | number)[]>;
	/** Annotations of the file (refs, not replaced) with a few entries changed; the rest stays as it is */
	patch?: ReadonlyMap<string, { subject?: string }>;
	/**
	 * The file as PDF.js saves it with the form filled in (`filledForm` of `forms.ts`: the original plus PDF.js's
	 * update): the objects of that update – fields, widgets, their appearances in the form's own font, the form with
	 * `/NeedAppearances` – are taken into this section (new ones renumbered)
	 */
	form?: Uint8Array;
	/**
	 * The pages in their new order, when it isn't the file's: pages of the file by index (each at most once; left out:
	 * deleted) and new blank ones. Every other map of the edits is keyed by the position in this list. The page tree is
	 * then written flat (its inherited entries copied into the pages that move to the root).
	 */
	pages?: readonly PageSlot[];
}

/** A page of the edited PDF: one of the file (its index there), a new blank one (size in points) or one copied from
 * another PDF (its bytes – the same array for pages of the same PDF – and the page's index there) */
export type PageSlot = { base: number } | { blank: { width: number; height: number } } | { copy: { pdf: Uint8Array; index: number } };

/** Subtypes `annotations()` reads (the ones tools draw themselves; notes that answer another – `/IRT` – are left out) */
const READ = new Set(['Text', 'FreeText', 'Ink', 'Line', 'Square', 'Circle', 'Polygon', 'PolyLine', 'Highlight', 'Underline', 'StrikeOut', 'Squiggly']);

/** How the original ends: where its last cross-reference section is and how it looks */
export interface PdfTail {
	/** Offset of the last cross-reference section (`startxref`) */
	startxref: number;
	kind: 'table' | 'stream';
	/** `/Size` of its trailer (or 0 when it can't be read) */
	size: number;
}

const latin1 = new TextDecoder('latin1');
const ascii = new TextEncoder();

/** PDF source as bytes: one byte per character (strings of the file keep their bytes) */
function bytesOfSource(s: string): Uint8Array {
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
	return out;
}

/** Finds the last `startxref` and checks that it points at a cross-reference section; null: not to be trusted */
export function readTail(bytes: Uint8Array): PdfTail | null {
	const from = Math.max(0, bytes.length - 2048);
	const end = latin1.decode(bytes.subarray(from));
	const matches = [...end.matchAll(/startxref\s+(\d+)/g)];
	const last = matches[matches.length - 1];
	if (!last) return null;
	const startxref = Number(last[1]);
	if (!(startxref > 0 && startxref < bytes.length)) return null;
	const head = latin1.decode(bytes.subarray(startxref, Math.min(bytes.length, startxref + 4096)));
	if (/^\s*xref/.test(head)) {
		// The trailer follows the table: look for it after the section
		const at = indexOf(bytes, ascii.encode('trailer'), startxref);
		if (at < 0) return null;
		const trailer = latin1.decode(bytes.subarray(at, Math.min(bytes.length, at + 4096)));
		return { startxref, kind: 'table', size: Number(/\/Size\s+(\d+)/.exec(trailer)?.[1] ?? 0) };
	}
	if (/^\s*\d+\s+\d+\s+obj\b/.test(head) && /\/Type\s*\/XRef\b/.test(head)) {
		return { startxref, kind: 'stream', size: Number(/\/Size\s+(\d+)/.exec(head)?.[1] ?? 0) };
	}
	return null;
}

function indexOf(haystack: Uint8Array, needle: Uint8Array, from: number): number {
	const first = needle[0];
	for (let i = haystack.indexOf(first, from); i >= 0 && i <= haystack.length - needle.length; i = haystack.indexOf(first, i + 1)) {
		let k = 1;
		while (k < needle.length && haystack[i + k] === needle[k]) k++;
		if (k === needle.length) return i;
	}
	return -1;
}

/** An object of the section: a clone of a changed one, or a new one as source text */
type SectionObject = { num: number; gen: number; body: Uint8Array };

/** Objects of PDF.js's update of the form (`IncrementalPdf.formUpdate`) */
interface FormUpdate {
	doc: PDFDocument;
	/** Objects of the file it changed, and new ones */
	kept: number[];
	added: number[];
	/** Generation of each */
	gens: Map<number, number>;
}

/** Pages copied from other PDFs into a document of their own (`IncrementalPdf.copied`) */
interface Copies {
	doc: PDFDocument;
	/** Its objects to bring along */
	numbers: number[];
	/** Its page tree's root (the file's takes its place) */
	root: number;
	/** Slot index → the copied page */
	pages: Map<number, PDFRef>;
}

export class IncrementalPdf {
	private constructor(
		/** What updates are appended to: the file as opened (or repaired) */
		readonly base: Uint8Array,
		private readonly doc: PDFDocument,
		private readonly lib: typeof import('pdf-lib'),
		readonly tail: PdfTail,
		/** The file's end couldn't be trusted: `base` is the file written anew */
		readonly repaired: boolean,
		/** Protection without a password: what we write is encrypted with the file's key */
		private readonly crypt: PdfCrypt | null = null,
		/** `/Encrypt` of the trailer, kept in ours */
		private readonly encrypt: PDFRef | PDFDict | null = null,
		/** Encrypted with a password (or another handler): only shown */
		readonly locked = false
	) {}

	/** Parses the original once (yielding now and then, so the page stays responsive) */
	static async open(file: Uint8Array): Promise<IncrementalPdf> {
		const lib = await pdfLib();
		const { doc, crypt, encrypt, locked } = await loadPdf(file, true);
		const tail = readTail(file);
		if (tail) return new IncrementalPdf(file, doc, lib, tail, false, crypt, encrypt, locked);
		// An encrypted file isn't written anew (that would drop its protection): only shown
		if (doc.isEncrypted) return new IncrementalPdf(file, doc, lib, { startxref: 0, kind: 'table', size: 0 }, false, null, null, true);
		const repaired = await doc.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false });
		return new IncrementalPdf(repaired, (await loadPdf(repaired, true)).doc, lib, readTail(repaired)!, true);
	}

	/** Is the file encrypted (with or without a password)? */
	get encrypted(): boolean {
		return this.doc.isEncrypted;
	}

	/** The file carries signatures (`/SigFlags` of its form): changes are appended, so they stay valid */
	get signed(): boolean {
		const { PDFDict, PDFName, PDFNumber } = this.lib;
		const form = this.doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
		const flags = form?.lookupMaybe(PDFName.of('SigFlags'), PDFNumber)?.asNumber() ?? 0;
		return (flags & 1) === 1;
	}

	get pageCount(): number {
		return this.doc.getPageCount();
	}

	/** Rotation of a page in the original (inherited from the page tree when the page has none) */
	rotation(index: number): number {
		return normalize(this.doc.getPage(index).getRotation().angle);
	}

	/**
	 * Annotations of a page that tools draw themselves (notes, text boxes, ink, lines, shapes, text markup), in the order of
	 * `/Annots`.
	 * Hidden ones and ones that can't be read are left out (they stay as they are).
	 */
	/** A page's replies (`/Text` with `/IRT`, `/RT` missing or `/R`; groups – `/Group` – aren't replies to show) */
	replies(index: number): ExistingReply[] {
		const { PDFArray, PDFDict, PDFName, PDFRef, PDFString, PDFHexString } = this.lib;
		const annots = this.doc.getPage(index).node.lookupMaybe(PDFName.of('Annots'), PDFArray);
		const out: ExistingReply[] = [];
		for (let i = 0; i < (annots?.size() ?? 0); i++) {
			const ref = annots!.get(i);
			if (!(ref instanceof PDFRef)) continue;
			try {
				const dict = this.doc.context.lookup(ref);
				if (!(dict instanceof PDFDict) || dict.lookupMaybe(PDFName.of('Subtype'), PDFName)?.asString() !== '/Text') continue;
				const parent = dict.get(PDFName.of('IRT'));
				const kind = dict.lookupMaybe(PDFName.of('RT'), PDFName)?.asString();
				if (!(parent instanceof PDFRef) || (kind && kind !== '/R') || dict.has(PDFName.of('State'))) continue;
				const text = (k: string) => dict.lookupMaybe(PDFName.of(k), PDFString, PDFHexString)?.decodeText();
				const modified = dict.lookupMaybe(PDFName.of('M'), PDFString, PDFHexString);
				out.push({
					ref: ref.toString(),
					parent: parent.toString(),
					name: text('NM'),
					author: text('T'),
					subject: text('Subj'),
					contents: text('Contents'),
					modified: modified && (modified instanceof PDFString ? modified.asString() : modified.decodeText())
				});
			} catch (e) {
				console.warn('[pdf] reply not read', e);
			}
		}
		return out;
	}

	/** A page's review states (`/State` in the `Review` model; other models – Acrobat's private “Marked” – are left out) */
	states(index: number): ExistingState[] {
		const { PDFArray, PDFDict, PDFName, PDFRef, PDFString, PDFHexString } = this.lib;
		const annots = this.doc.getPage(index).node.lookupMaybe(PDFName.of('Annots'), PDFArray);
		const out: ExistingState[] = [];
		for (let i = 0; i < (annots?.size() ?? 0); i++) {
			const ref = annots!.get(i);
			if (!(ref instanceof PDFRef)) continue;
			try {
				const dict = this.doc.context.lookup(ref);
				if (!(dict instanceof PDFDict)) continue;
				const parent = dict.get(PDFName.of('IRT'));
				const text = (k: string) => dict.lookupMaybe(PDFName.of(k), PDFString, PDFHexString)?.decodeText();
				const state = text('State');
				// Without a model: Review, unless it is one of Marked's states
				const model = text('StateModel') ?? (state === 'Marked' || state === 'Unmarked' ? 'Marked' : 'Review');
				if (!(parent instanceof PDFRef) || model !== 'Review' || !REVIEW_STATES.includes(state as ReviewState)) continue;
				const modified = dict.lookupMaybe(PDFName.of('M'), PDFString, PDFHexString);
				out.push({
					ref: ref.toString(),
					parent: parent.toString(),
					name: text('NM'),
					author: text('T'),
					state: state as ReviewState,
					modified: modified && (modified instanceof PDFString ? modified.asString() : modified.decodeText())
				});
			} catch (e) {
				console.warn('[pdf] state not read', e);
			}
		}
		return out;
	}

	annotations(index: number): ExistingAnnotation[] {
		const { PDFArray, PDFDict, PDFName, PDFNumber, PDFRef, PDFString, PDFHexString } = this.lib;
		const annots = this.doc.getPage(index).node.lookupMaybe(PDFName.of('Annots'), PDFArray);
		const out: ExistingAnnotation[] = [];
		const key = (k: string) => PDFName.of(k);
		const numbers = (o: PDFObject | undefined): number[] | undefined => {
			const array = o instanceof PDFRef ? this.doc.context.lookup(o) : o;
			if (!(array instanceof PDFArray)) return undefined;
			const values: number[] = [];
			for (let i = 0; i < array.size(); i++) {
				const v = array.lookup(i);
				if (!(v instanceof PDFNumber)) return undefined;
				values.push(v.asNumber());
			}
			return values;
		};
		for (let i = 0; i < (annots?.size() ?? 0); i++) {
			const ref = annots!.get(i);
			if (!(ref instanceof PDFRef)) continue;
			try {
				const dict = this.doc.context.lookup(ref);
				if (!(dict instanceof PDFDict)) continue;
				const subtype = dict.lookupMaybe(key('Subtype'), PDFName)?.asString().slice(1);
				const flags = dict.lookupMaybe(key('F'), PDFNumber)?.asNumber() ?? 0;
				// Hidden (2) or not viewed (32)
				if (!subtype || !READ.has(subtype) || flags & 34) continue;
				if (subtype === 'Text' && dict.has(key('IRT'))) continue;
				const rect = numbers(dict.get(key('Rect')));
				if (rect?.length !== 4) continue;
				const text = (k: string) => dict.lookupMaybe(key(k), PDFString, PDFHexString)?.decodeText();
				const bs = dict.lookupMaybe(key('BS'), PDFDict);
				const border = numbers(dict.get(key('Border')));
				const borderDash = border && dict.lookupMaybe(key('Border'), PDFArray)?.lookup(3);
				const style = bs?.lookupMaybe(key('S'), PDFName)?.asString();
				const dash = style === '/D' ? (numbers(bs?.get(key('D'))) ?? [3]) : borderDash ? numbers(borderDash) : undefined;
				const inset = numbers(dict.get(key('RD')));
				const inkList = dict.lookupMaybe(key('InkList'), PDFArray);
				const line = numbers(dict.get(key('L')));
				const endings = dict.lookupMaybe(key('LE'), PDFArray);
				const modified = dict.lookupMaybe(key('M'), PDFString, PDFHexString);
				out.push({
					ref: ref.toString(),
					id: ref.generationNumber ? `${ref.objectNumber}R${ref.generationNumber}` : `${ref.objectNumber}R`,
					subtype,
					rect: [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])],
					inset: inset?.length === 4 ? (inset as [number, number, number, number]) : undefined,
					color: rgb(numbers(dict.get(key('C')))),
					interior: rgb(numbers(dict.get(key('IC')))),
					opacity: dict.lookupMaybe(key('CA'), PDFNumber)?.asNumber() ?? 1,
					width: bs?.lookupMaybe(key('W'), PDFNumber)?.asNumber() ?? border?.[2] ?? 1,
					dash: dash?.length ? dash : undefined,
					name: text('NM'),
					author: text('T'),
					subject: text('Subj'),
					contents: text('Contents'),
					modified: modified && (modified instanceof PDFString ? modified.asString() : modified.decodeText()),
					icon: dict.lookupMaybe(key('Name'), PDFName)?.asString().slice(1),
					inkList: inkList?.asArray().map((_, k) => numbers(inkList.get(k)) ?? []),
					line: line?.length === 4 ? (line as [number, number, number, number]) : undefined,
					lineEndings: endings?.asArray().map((_, k) => endings.lookupMaybe(k, PDFName)?.asString().slice(1) ?? 'None'),
					vertices: numbers(dict.get(key('Vertices'))),
					quadPoints: numbers(dict.get(key('QuadPoints'))),
					defaultAppearance: text('DA'),
					paint: this.paintOpacity(dict),
					data: text('InBrowser')
				});
			} catch (e) {
				console.warn('[pdf] annotation not read', e);
			}
		}
		return out;
	}

	/**
	 * Opacities an annotation's normal appearance paints with: of its first fill outside text (`fill`, by `ca`), its
	 * first stroke (`stroke`, by `CA`) and its first text (`text`, by `ca`) – by the graphics states it sets (`gs`,
	 * kept across `q`/`Q`), into forms it draws (`Do`, times the opacity they are drawn with). How PDF-XChange & co.
	 * keep a see-through background apart from text and border; undefined where there is none or it can't be read.
	 */
	private paintOpacity(dict: PDFDict): PaintOpacity | undefined {
		const { PDFDict, PDFName, PDFNumber, PDFRawStream, decodePDFRawStream } = this.lib;
		const out: PaintOpacity = {};
		const walk = (stream: unknown, fill: number, stroke: number, depth: number) => {
			if (!(stream instanceof PDFRawStream) || depth > 3) return;
			const resources = stream.dict.lookupMaybe(PDFName.of('Resources'), PDFDict);
			const states = resources?.lookupMaybe(PDFName.of('ExtGState'), PDFDict);
			const forms = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict);
			const content = latin1.decode(decodePDFRawStream(stream).decode());
			let state = { fill: 1, stroke: 1 };
			const stack: (typeof state)[] = [];
			let inText = false;
			let last = '';
			for (const token of content.match(/\/[^\s/[\]()<>{}%]+|\((?:\\.|[^\\)])*\)|[^\s/[\]()<>{}%]+/g) ?? []) {
				if (token === 'q') stack.push(state);
				else if (token === 'Q') state = stack.pop() ?? { fill: 1, stroke: 1 };
				else if (token === 'gs' && last.startsWith('/')) {
					const gs = states?.lookupMaybe(PDFName.of(last.slice(1)), PDFDict);
					state = {
						fill: gs?.lookupMaybe(PDFName.of('ca'), PDFNumber)?.asNumber() ?? state.fill,
						stroke: gs?.lookupMaybe(PDFName.of('CA'), PDFNumber)?.asNumber() ?? state.stroke
					};
				} else if (token === 'BT') inText = true;
				else if (token === 'ET') inText = false;
				else if (inText && ['Tj', 'TJ', "'", '"'].includes(token)) out.text ??= fill * state.fill;
				else if (!inText) {
					if (['f', 'F', 'f*', 'B', 'B*', 'b', 'b*'].includes(token)) out.fill ??= fill * state.fill;
					if (['S', 's', 'B', 'B*', 'b', 'b*'].includes(token)) out.stroke ??= stroke * state.stroke;
					if (token === 'Do' && last.startsWith('/'))
						walk(forms?.lookup(PDFName.of(last.slice(1))), fill * state.fill, stroke * state.fill, depth + 1);
				}
				last = token;
			}
		};
		try {
			walk(dict.lookupMaybe(PDFName.of('AP'), PDFDict)?.lookup(PDFName.of('N')), 1, 1, 0);
		} catch {
			// Not readable: as far as it was read
		}
		return out.fill === undefined && out.stroke === undefined && out.text === undefined ? undefined : out;
	}

	/**
	 * The file with these edits: the base plus one appended section, or the base itself when nothing differs from it.
	 * One update at a time.
	 */
	async update(edits: PdfEdits): Promise<Uint8Array> {
		if (this.locked) throw new PdfError('password');
		// Text beyond WinAnsi: one subset font for all of this update's appearances
		const written = [...(edits.annotations?.values() ?? [])].flat().concat([...(edits.replace?.values() ?? [])]);
		const placeholders = written
			.flatMap((a) => [a.appearance.content, ...(a.appearance.groups ?? [])].flatMap(placeholdersOf));
		const font = placeholders.length ? await unicodeFont(placeholders) : null;
		const copies = await this.copied(edits.pages ?? []);
		const form = edits.form ? await this.formUpdate(edits.form) : null;
		let objects = this.changes(edits, font, copies, form);
		if (!objects.length) return this.base;
		if (this.crypt) objects = await Promise.all(objects.map((o) => this.sealed(o, this.crypt!)));
		const section = this.section(objects, this.tail);
		const out = new Uint8Array(this.base.length + section.length);
		out.set(this.base);
		out.set(section, this.base.length);
		return out;
	}

	/**
	 * Pages copied from other PDFs, in a document of their own (pdf-lib's `copyPages`: the page with everything it
	 * uses); its pages by slot index. Their objects are renumbered into the section by `changes`.
	 */
	private async copied(slots: readonly PageSlot[]): Promise<Copies | null> {
		const wanted = slots.flatMap((s, i) => ('copy' in s ? [{ slot: i, ...s.copy }] : []));
		if (!wanted.length) return null;
		const { PDFDocument } = this.lib;
		const doc = await PDFDocument.create();
		const before = doc.context.largestObjectNumber;
		const root = doc.catalog.get(this.lib.PDFName.of('Pages')) as PDFRef;
		const sources = new Map<Uint8Array, PDFDocument>();
		const pages = new Map<number, PDFRef>();
		for (const w of wanted) {
			let source = sources.get(w.pdf);
			if (!source) {
				const loaded = await loadPdf(w.pdf);
				if (loaded.locked) throw new PdfError('password');
				sources.set(w.pdf, (source = loaded.doc));
			}
			const [page] = await doc.copyPages(source, [w.index]);
			doc.addPage(page);
			pages.set(w.slot, page.ref);
		}
		const numbers = doc.context
			.enumerateIndirectObjects()
			.map(([ref]) => ref.objectNumber)
			.filter((n) => n > before);
		return { doc, numbers, root: root.objectNumber, pages };
	}

	/** Objects that differ from the original (clones, never the parsed objects themselves) and new ones */
	private changes(edits: PdfEdits, font: UnicodeFont | null = null, copies: Copies | null = null, form: FormUpdate | null = null): SectionObject[] {
		const { PDFArray, PDFDict, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFRef } = this.lib;
		const context = this.doc.context;
		const out: SectionObject[] = [];
		let next = Math.max(this.tail.size, context.largestObjectNumber + 1);
		const root = this.doc.catalog.get(PDFName.of('Pages'));
		/** Objects made in a document of its own (a subset font, copied pages), renumbered into this section; `to`:
		 * refs given beforehand (another object's ref in place of one of them) */
		const adopt = (from: PDFDocument, numbers: readonly number[], to = new Map<number, PDFObject>(), keep: readonly number[] = []) => {
			const renumbered = new Map(numbers.map((n) => [n, next++]));
			const remap = (o: PDFObject): PDFObject => {
				if (o instanceof PDFRef) return to.get(o.objectNumber) ?? PDFRef.of(renumbered.get(o.objectNumber) ?? o.objectNumber, 0);
				if (o instanceof PDFDict) {
					const d = PDFDict.withContext(context);
					for (const [k, v] of o.entries()) d.set(k, remap(v));
					return d;
				}
				if (o instanceof PDFArray) {
					const a = PDFArray.withContext(context);
					for (const v of o.asArray()) a.push(remap(v));
					return a;
				}
				if (o instanceof PDFRawStream) return PDFRawStream.of(remap(o.dict) as PDFDict, o.contents);
				return o;
			};
			const objects = new Map<number, PDFObject>();
			for (const [old, num] of renumbered) {
				const object = from.context.lookup(PDFRef.of(old, 0));
				if (object) objects.set(num, remap(object));
			}
			// Objects that keep their numbers (they replace the file's), pointing to the renumbered ones
			for (const num of keep) {
				const object = from.context.lookup(PDFRef.of(num, 0));
				if (object) objects.set(num, remap(object));
			}
			return { renumbered, objects };
		};
		// The subset font first
		let fontRef = '';
		if (font) {
			const { renumbered, objects } = adopt(font.doc, font.numbers);
			for (const [num, object] of objects) out.push({ num, gen: 0, body: bytesOf(object) });
			fontRef = `${renumbered.get(font.font)} 0 R`;
		}
		// Copied pages: everything they use; the pages themselves are written below (with their place in the tree)
		const copiedPages = new Map<number, { ref: PDFRef; dict: PDFDict; annots: PDFObject[] }>();
		if (copies && root) {
			const { renumbered, objects } = adopt(copies.doc, copies.numbers, new Map([[copies.root, root]]));
			const pageNumbers = new Map([...copies.pages].map(([slot, ref]) => [slot, renumbered.get(ref.objectNumber)!]));
			const own = new Set(pageNumbers.values());
			for (const [num, object] of objects) if (!own.has(num)) out.push({ num, gen: 0, body: bytesOf(object) });
			for (const [slot, num] of pageNumbers) {
				const dict = objects.get(num) as PDFDict;
				const list = dict.get(PDFName.of('Annots'));
				const array = list instanceof PDFRef ? objects.get(list.objectNumber) : list;
				copiedPages.set(slot, { ref: PDFRef.of(num, 0), dict, annots: array instanceof PDFArray ? array.asArray() : [] });
			}
		}
		/** An annotation as written: the embedded font's glyphs in place of its placeholders */
		const ready = (a: NewAnnotation): NewAnnotation => {
			if (!font) return a;
			const fill = (content: string) => content.replace(UNICODE_TEXT, (_, hex: string) => font.glyphs.get(hex) ?? '<>');
			const fonts = Object.fromEntries(Object.entries(a.appearance.fonts ?? {}).map(([name, base]) => [name, base === UNICODE_FONT ? fontRef : base]));
			return { ...a, appearance: { ...a.appearance, content: fill(a.appearance.content), groups: a.appearance.groups?.map(fill), fonts } };
		};
		const replace = edits.replace ?? new Map<string, NewAnnotation>();
		const remove = edits.remove ?? new Set<string>();
		const slots: readonly PageSlot[] = edits.pages ?? Array.from({ length: this.pageCount }, (_, i) => ({ base: i }));
		/** The file's pages as they are (no tree to write) */
		const same = slots.length === this.pageCount && slots.every((s, i) => 'base' in s && s.base === i);
		const pages = new Set([...(edits.rotate?.keys() ?? []), ...(edits.annotations?.keys() ?? []), ...(edits.order?.keys() ?? [])]);
		if (!same) slots.forEach((_, i) => pages.add(i));
		const slotRefs = slots.map((s, i) => ('base' in s ? this.doc.getPage(s.base).ref : (copiedPages.get(i)?.ref ?? PDFRef.of(next++))));
		// Replies find what they answer by its ref, or by the name of one written in this update (replaced ones keep
		// their refs; new ones get theirs below, before their replies)
		const named = new Map<string, string>();
		for (const [ref, annotation] of replace) named.set(annotation.name, ref);
		const replyEntry = (a: NewAnnotation) => {
			if (!a.replyTo) return '';
			const parent = /^\d+ \d+ R$/.test(a.replyTo) ? a.replyTo : named.get(a.replyTo);
			return parent ? `/IRT ${parent}${a.state ? '' : ' /RT /R'}` : '';
		};
		// Entries changed in annotations of the file that are otherwise kept
		for (const [ref, change] of edits.patch ?? []) {
			if (replace.has(ref) || remove.has(ref)) continue;
			const [num, gen] = ref.split(' ').map(Number);
			const found = context.lookup(PDFRef.of(num, gen));
			if (!(found instanceof PDFDict)) continue;
			const dict = found.clone(context);
			if (change.subject !== undefined) {
				if (change.subject) dict.set(PDFName.of('Subj'), PDFHexString.fromText(change.subject));
				else dict.delete(PDFName.of('Subj'));
			}
			out.push({ num, gen, body: bytesOf(dict) });
		}
		// Annotations of the file to change: every page may hold them
		if (replace.size || remove.size) slots.forEach((_, i) => pages.add(i));
		for (const index of [...pages].sort((a, b) => a - b)) {
			const slot = slots[index];
			if (!slot) continue;
			const base = 'base' in slot ? slot.base : -1;
			const page = base >= 0 ? this.doc.getPage(base) : null;
			const pageRef = slotRefs[index].toString();
			const angle = edits.rotate?.get(index);
			const copyRotation = (copiedPages.get(index)?.dict.get(PDFName.of('Rotate')) as { asNumber?: () => number } | undefined)?.asNumber?.() ?? 0;
			const turn = angle !== undefined && normalize(angle) !== (page ? this.rotation(base) : normalize(copyRotation));
			const added = edits.annotations?.get(index) ?? [];
			const before = page?.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
			const gone = before && remove.size ? this.removed(before, remove) : new Set<string>();
			if (before && replace.size) {
				for (let i = 0; i < before.size(); i++) {
					const ref = before.get(i);
					const annotation = ref instanceof PDFRef && !gone.has(ref.toString()) ? replace.get(ref.toString()) : undefined;
					if (!annotation) continue;
					const [dict, ...rest] = annotationObjects(ready(annotation), next, pageRef, this.keptEntries(ref as PDFRef, annotation));
					out.push({ num: (ref as PDFRef).objectNumber, gen: (ref as PDFRef).generationNumber, body: bytesOfSource(dict) });
					for (const body of rest) out.push({ num: next++, gen: 0, body: bytesOfSource(body) });
				}
			}
			const order = edits.order?.get(index);
			// Moving to the root of a flat tree: what it inherited comes along
			const moves = !same && !!page && page.node.get(PDFName.of('Parent'))?.toString() !== root?.toString();
			if (page && !turn && !added.length && !gone.size && !order && !moves) continue;
			let dict: PDFDict;
			const copy = copiedPages.get(index);
			if (copy) {
				// Its annotations stay the other PDF's (kept as they are); ours come after them
				dict = copy.dict;
			} else if (page) {
				dict = page.node.clone(context);
				if (moves && root) {
					for (const key of ['Resources', 'MediaBox', 'CropBox', 'Rotate']) {
						const name = PDFName.of(key);
						const inherited = page.node.getInheritableAttribute(name);
						if (!dict.has(name) && inherited) dict.set(name, inherited);
					}
					dict.set(PDFName.of('Parent'), root);
				}
			} else {
				const { width, height } = (slot as { blank: { width: number; height: number } }).blank;
				dict = PDFDict.withContext(context);
				dict.set(PDFName.of('Type'), PDFName.of('Page'));
				if (root) dict.set(PDFName.of('Parent'), root);
				dict.set(PDFName.of('MediaBox'), context.obj([0, 0, width, height]));
				dict.set(PDFName.of('Resources'), PDFDict.withContext(context));
				// Its own, never the tree's
				dict.set(PDFName.of('Rotate'), PDFNumber.of(0));
			}
			if (turn) dict.set(PDFName.of('Rotate'), PDFNumber.of(normalize(angle)));
			if (added.length || gone.size || order) {
				const refs = added.map((annotation) => {
					const ref = PDFRef.of(next);
					named.set(annotation.name, ref.toString());
					for (const body of annotationObjects(ready(annotation), next + 1, pageRef, replyEntry(annotation))) out.push({ num: next++, gen: 0, body: bytesOfSource(body) });
					return ref;
				});
				const kept: PDFObject[] = [...(copy?.annots ?? [])];
				for (let i = 0; i < (before?.size() ?? 0); i++) {
					const entry = before!.get(i);
					if (!(entry instanceof PDFRef && gone.has(entry.toString()))) kept.push(entry);
				}
				const annots = PDFArray.withContext(context);
				if (!order) [...kept, ...refs].forEach((entry) => annots.push(entry));
				else {
					const listed = new Map(kept.filter((e) => e instanceof PDFRef && order.includes(e.toString())).map((e) => [e.toString(), e]));
					const queue = order.flatMap((e) => (typeof e === 'number' ? (refs[e] ? [refs[e]] : []) : listed.has(e) ? [listed.get(e)!] : []));
					for (const entry of kept) annots.push(listed.has(entry.toString()) ? queue.shift()! : entry);
					for (const entry of queue) annots.push(entry);
				}
				dict.set(PDFName.of('Annots'), annots);
			}
			if (copy && root) dict.set(PDFName.of('Parent'), root);
			out.push({ num: slotRefs[index].objectNumber, gen: slotRefs[index].generationNumber, body: bytesOf(dict) });
		}
		// Filled-in form fields as PDF.js wrote them (what this section writes itself comes first)
		if (form) {
			const { objects } = adopt(form.doc, form.added, new Map(), form.kept);
			const taken = new Set(out.map((o) => o.num));
			for (const [num, object] of objects) if (!taken.has(num)) out.push({ num, gen: form.gens.get(num) ?? 0, body: bytesOf(object) });
		}
		// The page tree, flat: the root lists the pages in their new order
		if (!same && root instanceof PDFRef) {
			const tree = (context.lookup(root) as PDFDict).clone(context);
			tree.set(PDFName.of('Kids'), context.obj(slotRefs));
			tree.set(PDFName.of('Count'), PDFNumber.of(slots.length));
			out.push({ num: root.objectNumber, gen: root.generationNumber, body: bytesOf(tree) });
		}
		return out;
	}

	/** The objects PDF.js appended to the original (`PdfEdits.form`): those of the file keep their numbers, new ones
	 * (numbered from the original's `/Size`) are renumbered into the section */
	private async formUpdate(bytes: Uint8Array): Promise<FormUpdate | null> {
		if (bytes.length <= this.base.length) return null;
		const appended = new TextDecoder('latin1').decode(bytes.subarray(this.base.length));
		const refs = new Map<number, number>();
		for (const m of appended.matchAll(/(?:^|[\r\n])\s*(\d+)\s+(\d+)\s+obj\b/g)) refs.set(Number(m[1]), Number(m[2]));
		const { doc } = await loadPdf(bytes);
		const size = Math.max(this.tail.size, this.doc.context.largestObjectNumber + 1);
		const kept: number[] = [];
		const added: number[] = [];
		for (const num of refs.keys()) {
			const object = doc.context.lookup(this.lib.PDFRef.of(num, refs.get(num)!));
			if (!object) continue; // its cross-reference stream
			(num < size ? kept : added).push(num);
		}
		return { doc, kept, added, gens: refs };
	}

	/** Refs of a page's annotations to take off: those asked for, their popups and replies (`/IRT`, `/Parent`) */
	private removed(annots: PDFArray, remove: ReadonlySet<string>): Set<string> {
		const { PDFDict, PDFName, PDFRef } = this.lib;
		const gone = new Set<string>();
		let grew = true;
		while (grew) {
			grew = false;
			for (let i = 0; i < annots.size(); i++) {
				const ref = annots.get(i);
				if (!(ref instanceof PDFRef) || gone.has(ref.toString())) continue;
				const dict = this.doc.context.lookup(ref);
				const link = (k: string) => (dict instanceof PDFDict ? dict.get(PDFName.of(k)) : undefined)?.toString();
				const popupOf = (r: string) => {
					const owner = this.doc.context.lookup(PDFRef.of(Number(r.split(' ')[0]), Number(r.split(' ')[1])));
					return owner instanceof PDFDict ? owner.get(PDFName.of('Popup'))?.toString() : undefined;
				};
				const s = ref.toString();
				const parent = link('IRT') ?? link('Parent');
				if (remove.has(s) || (parent && gone.has(parent)) || [...gone].some((g) => popupOf(g) === s)) {
					gone.add(s);
					grew = true;
				}
			}
		}
		return gone;
	}

	/** Entries of an annotation of the file that stay when it is written anew (PDF source) */
	private keptEntries(ref: PDFRef, annotation: NewAnnotation): string {
		const { PDFDict } = this.lib;
		const dict = this.doc.context.lookup(ref);
		if (!(dict instanceof PDFDict)) return '';
		const drop = new Set(REPLACED_KEYS);
		if (annotation.author) drop.add('T');
		if (annotation.subject) drop.add('Subj');
		if (annotation.contents) drop.add('Contents');
		return dict
			.entries()
			.filter(([k]) => !drop.has(k.asString().slice(1)))
			.map(([k, v]) => `${k.toString()} ${v.toString()}`)
			.join(' ');
	}

	/** An object of the section with its strings and streams encrypted (parsed from its source again) */
	private async sealed(object: SectionObject, crypt: PdfCrypt): Promise<SectionObject> {
		const parsed = this.lib.PDFObjectParser.forBytes(object.body, this.doc.context).parseObject();
		return { ...object, body: bytesOf(await encryptObject(this.lib, crypt, parsed, object.num, object.gen)) };
	}

	/** The appended section: objects, cross-references, trailer */
	private section(objects: SectionObject[], tail: PdfTail): Uint8Array {
		const context = this.doc.context;
		const parts: Uint8Array[] = [];
		let length = 0;
		const push = (bytes: Uint8Array) => {
			parts.push(bytes);
			length += bytes.length;
		};
		const text = (s: string) => push(ascii.encode(s));
		// The original may end without a line break
		const lastByte = this.base[this.base.length - 1];
		if (lastByte !== 0x0a && lastByte !== 0x0d) text('\n');

		const entries: { num: number; gen: number; offset: number }[] = [];
		const sorted = [...objects].sort((a, b) => a.num - b.num);
		for (const object of sorted) {
			entries.push({ num: object.num, gen: object.gen, offset: this.base.length + length });
			text(`${object.num} ${object.gen} obj\n`);
			push(object.body);
			text('\nendobj\n');
		}

		const size = Math.max(tail.size, context.largestObjectNumber + 1, sorted[sorted.length - 1].num + 1);
		const trailer = this.trailerEntries();
		if (tail.kind === 'table') {
			const xref = this.base.length + length;
			text('xref\n');
			for (const run of runs(entries)) {
				text(`${run[0].num} ${run.length}\n`);
				for (const e of run) text(`${String(e.offset).padStart(10, '0')} ${String(e.gen).padStart(5, '0')} n\r\n`);
			}
			text(`trailer\n<< /Size ${size} ${trailer} /Prev ${tail.startxref} >>\nstartxref\n${xref}\n%%EOF\n`);
		} else {
			// The cross-reference stream is an object itself (the next free number), listed in its own index
			const self = size;
			const xref = this.base.length + length;
			const all = [...entries, { num: self, gen: 0, offset: xref }];
			const data = new Uint8Array(all.length * 7);
			all.forEach((e, i) => {
				const o = i * 7;
				data[o] = 1;
				data[o + 1] = (e.offset >>> 24) & 0xff;
				data[o + 2] = (e.offset >>> 16) & 0xff;
				data[o + 3] = (e.offset >>> 8) & 0xff;
				data[o + 4] = e.offset & 0xff;
				data[o + 5] = (e.gen >>> 8) & 0xff;
				data[o + 6] = e.gen & 0xff;
			});
			const index = runs(all)
				.map((run) => `${run[0].num} ${run.length}`)
				.join(' ');
			text(`${self} 0 obj\n<< /Type /XRef /Size ${self + 1} /W [1 4 2] /Index [${index}] ${trailer} /Prev ${tail.startxref} /Length ${data.length} >>\nstream\n`);
			push(data);
			text(`\nendstream\nendobj\nstartxref\n${xref}\n%%EOF\n`);
		}

		const out = new Uint8Array(length);
		let at = 0;
		for (const part of parts) {
			out.set(part, at);
			at += part.length;
		}
		return out;
	}

	/** `/Root`, `/Info` and `/ID` (the first part kept, the second new: the file changed) */
	private trailerEntries(): string {
		const { PDFArray } = this.lib;
		const { Root, Info, ID } = this.doc.context.trailerInfo;
		const first = ID instanceof PDFArray && ID.size() > 0 ? ID.get(0).toString() : null;
		const fresh = `<${randomHex(16)}>`;
		const encrypt = this.encrypt && `/Encrypt ${this.encrypt.toString()}`;
		// The key of an encrypted file depends on its first ID: none stays none
		const id = this.encrypt && !first ? '' : `/ID [${first ?? fresh} ${fresh}]`;
		return [Root && `/Root ${Root.toString()}`, Info && `/Info ${Info.toString()}`, encrypt, id].filter(Boolean).join(' ');
	}
}

function bytesOf(object: PDFObject | PDFRef): Uint8Array {
	const bytes = new Uint8Array(object.sizeInBytes());
	object.copyBytesInto(bytes, 0);
	return bytes;
}

/** Entries in runs of consecutive object numbers (sorted) */
function runs<T extends { num: number }>(entries: T[]): T[][] {
	const out: T[][] = [];
	for (const e of [...entries].sort((a, b) => a.num - b.num)) {
		const run = out[out.length - 1];
		if (run && run[run.length - 1].num + 1 === e.num) run.push(e);
		else out.push([e]);
	}
	return out;
}

/** A color of 1 (gray), 3 (RGB) or 4 (CMYK) components as RGB; none for an empty or other array */
function rgb(c: number[] | undefined): Rgb | undefined {
	if (c?.length === 1) return [c[0], c[0], c[0]];
	if (c?.length === 3) return [c[0], c[1], c[2]];
	if (c?.length === 4) return [(1 - c[0]) * (1 - c[3]), (1 - c[1]) * (1 - c[3]), (1 - c[2]) * (1 - c[3])];
	return undefined;
}

const normalize = (angle: number) => (((Math.round(angle / 90) * 90) % 360) + 360) % 360;

function randomHex(bytes: number): string {
	return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
