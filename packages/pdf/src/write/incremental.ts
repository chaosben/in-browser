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
//
// The one exception: when a page's content changes (`PdfEdits.content`), the file is written anew as a whole with
// only what can still be reached from its catalog – content taken out must not stay in the file (`whole`).

import type { PDFArray, PDFDict, PDFDocument, PDFObject, PDFRawStream, PDFRef } from 'pdf-lib';
import { contentObjects, type ContentFont, type ContentObject, type ContentResources } from '../content/objects.js';
import { pdfNumber, rewriteContent, usedResources, type ContentChange } from '../content/rewrite.js';
import { tokenize, type Op } from '../content/tokens.js';
import { describeEncryption, newEncryption, type EncryptEntries, type NewProtection, type PdfCrypt } from '../crypt.js';
import type { Matrix } from '../geometry.js';
import { encryptObject, loadPdf } from '../load.js';
import { pdfLib } from '../pdf-lib.js';
import { PdfError } from '../pdfjs.js';
import type { AttachedFile, ExistingAnnotation, ExistingReply, ExistingState, NewAnnotation, PaintOpacity, ReviewState, Rgb } from './annotations.js';
import { annotationObjects, parsePdfDate, REPLACED_KEYS, REVIEW_STATES } from './annotations.js';
import { embedForms, formOfStream, type PdfForm, type PdfPicture } from './form.js';
import type { PdfImage } from './image.js';
import { placeholdersOf, UNICODE_FONT, UNICODE_TEXT, unicodeFont, type UnicodeFont } from './unicode.js';
import { pdfProducer } from '../producer.js';

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
	/**
	 * Page index → changes to objects of its content (`contentObjects`: id → moved/scaled or taken out). Only pages of
	 * the file. **With any of these the file is written anew as a whole** instead of appended to, holding only what
	 * is still used – what was taken out is gone from the file, and so are earlier versions kept inside it.
	 * Signatures don't survive that.
	 */
	content?: ReadonlyMap<number, ReadonlyMap<number, ContentChange>>;
	/**
	 * Page index → drawings made part of the page's content (comments flattened, a picture in an image's place), in
	 * the order they are drawn. Like `content` this writes the file anew. Only pages of the file.
	 */
	flatten?: ReadonlyMap<number, readonly Flattened[]>;
	/**
	 * Page index → the color under the page's content (red, green, blue, 0…1), or null for none any more. It is a
	 * content stream of its own before the page's (`q … re f Q` over the page's box), named by the page's
	 * `/InBrowserBackground` – so another color takes its place, and `background(index)` reads it again. Any page.
	 */
	background?: ReadonlyMap<number, Rgb | null>;
	/**
	 * Page index → another size: the page's box becomes `[0 0 width height]` (its other boxes go), its content is
	 * drawn through `matrix` (a scale and a shift from the old user space into the new one; `q matrix cm` before and
	 * `Q` after its streams) and the annotations of the file that aren't written anew or removed move along.
	 */
	resize?: ReadonlyMap<number, { width: number; height: number; matrix: Matrix }>;
	/**
	 * The bookmarks (document outline) as a whole, when they differ from the file's: written anew under the catalog's
	 * `/Outlines` (an empty list takes them away). A target kept from the file whose page is no longer written goes.
	 */
	outline?: readonly NewBookmark[];
	/** The document's properties changed (`/Info`, and the XMP metadata where the file has it); an empty text takes
	 * one away */
	info?: DocumentInfo;
	/** A file made here (extracted, merged): `/Creator` names the suite too, not only `/Producer` (which every
	 * section that changes something sets) */
	created?: boolean;
}

/** The properties a document describes itself with (`/Info`) */
export interface DocumentInfo {
	title?: string;
	author?: string;
	subject?: string;
	keywords?: string;
}

/** What `IncrementalPdf.info()` reads besides */
export interface DocumentFacts extends DocumentInfo {
	creator?: string;
	producer?: string;
	created?: Date | null;
	modified?: Date | null;
	/** `%PDF-x.y` of the file */
	version: string;
}

/** What `IncrementalPdf.inspect()` finds that “Sanitize” can take out */
export interface HiddenData {
	/** Entries of `/Info`, XMP metadata streams, data of other programs (`/PieceInfo`), page thumbnails */
	metadata: number;
	/** Files embedded in the document (not those attached to comments) */
	attachments: number;
	/** Scripts and actions that run by themselves or on a click (document, pages, fields, links): JavaScript,
	 * launching programs, sending or importing form data */
	scripts: number;
	bookmarks: number;
	/** Earlier versions kept in the file (appended updates) */
	versions: number;
}

/** A font a PDF's pages use (`IncrementalPdf.fonts`), with its program where the file embeds one */
export interface PdfFontProgram {
	/** Its name without a subset's prefix (`ABCDEF+`) */
	name: string;
	/** Only the characters the PDF uses are embedded */
	subset: boolean;
	kind: 'truetype' | 'opentype' | 'cff' | 'type1' | 'type3' | 'none';
	/** The embedded program (decoded), if any */
	bytes: Uint8Array | null;
}

/** What “Sanitize” takes out */
export interface Sanitize {
	metadata?: boolean;
	attachments?: boolean;
	scripts?: boolean;
	bookmarks?: boolean;
}

/** The keys of `/Info` and what `DocumentInfo` calls them */
const INFO_KEYS = { title: 'Title', author: 'Author', subject: 'Subject', keywords: 'Keywords' } as const;
/** Action kinds that run something or send data away */
const ACTIONS = new Set(['/JavaScript', '/Launch', '/SubmitForm', '/ImportData', '/ResetForm', '/Rendition', '/RichMediaExecute']);

/** A bookmark of the file (`IncrementalPdf.outline`) */
export interface FileBookmark {
	/** Its object: `PdfEdits.outline` keeps its target by it */
	ref: string;
	title: string;
	bold: boolean;
	italic: boolean;
	color?: Rgb;
	/** Its entries are shown (a positive `/Count`) */
	open: boolean;
	/** The page of the file it leads to (index) and the top edge there (user space; null: where the view is) */
	page: number | null;
	top: number | null;
	/** A web address it opens instead */
	uri?: string;
	items: FileBookmark[];
}

/** A bookmark as written: its target kept from the file (`ref` of a `FileBookmark`), a page by its place in the
 * written pages with the top edge there (user space; null: where the view is), or none */
export interface NewBookmark {
	title: string;
	bold?: boolean;
	italic?: boolean;
	color?: Rgb;
	open?: boolean;
	target: { keep: string } | { page: number; top: number | null } | null;
	items: readonly NewBookmark[];
}

/** Names the color of the stream this package put first into a page's content (`PdfEdits.background`) */
const BACKGROUND = 'InBrowserBackground';

/** A drawing put into a page's content: what an annotation would look like (only its appearance is used) */
export interface Flattened {
	annotation: NewAnnotation;
	/** Moved or scaled afterwards (user space) */
	matrix?: Matrix;
	/** Drawn in the place of this object of the content, which is taken out (not text); else on top of everything */
	at?: number;
}

/** A page's content read for editing */
interface PageContent {
	data: Uint8Array;
	ops: Op[];
	objects: ContentObject[];
}

/** A page's content written anew: the stream (deflated) and what it still uses of the resources */
interface NewContent {
	stream: Uint8Array;
	used: { xobjects: Set<string>; fonts: Set<string> };
	/** Drawings added to it: the XObject name each is drawn by, and the annotation whose appearance it is */
	drawn: { name: string; annotation: NewAnnotation }[];
}

/** A page of the edited PDF: one of the file (its index there), a new blank one (size in points) or one copied from
 * another PDF (its bytes – the same array for pages of the same PDF – and the page's index there; `annotations:
 * false` leaves its annotations behind, e.g. a page of the file itself copied once more, whose drawings the tool
 * writes anew) */
export type PageSlot = { base: number } | { blank: { width: number; height: number } } | { copy: { pdf: Uint8Array; index: number; annotations?: false; password?: string } };

/** Subtypes `annotations()` reads (the ones tools draw themselves; notes that answer another – `/IRT` – are left out) */
const READ = new Set(['Text', 'FreeText', 'Ink', 'Line', 'Square', 'Circle', 'Polygon', 'PolyLine', 'Highlight', 'Underline', 'StrikeOut', 'Squiggly', 'Stamp', 'Caret', 'FileAttachment', 'Link']);

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
		readonly locked = false,
		/** The password that opened it (copies of its own pages and PDF.js's form update need it again) */
		private readonly password = '',
		/** Its `/Encrypt` entries, and whether opening it needs a password */
		private readonly entries: EncryptEntries | null = null,
		readonly needsPassword = false,
		/** What the password that opened it is (the user's or the owner's) */
		private readonly role: 'user' | 'owner' | null = null
	) {}

	/** A new `/Info` object of the update being built (the file's was missing or not an object of its own) */
	private infoRef: PDFRef | undefined;

	/** Pages' contents as read (page index → content; null: can't be read) */
	private readonly contents = new Map<number, PageContent | null>();

	/** Parses the original once (yielding now and then, so the page stays responsive); `password` for one that needs it */
	static async open(file: Uint8Array, password = ''): Promise<IncrementalPdf> {
		const lib = await pdfLib();
		const { doc, crypt, encrypt, locked, entries, needsPassword, role } = await loadPdf(file, true, password);
		const tail = readTail(file);
		if (tail) return new IncrementalPdf(file, doc, lib, tail, false, crypt, encrypt, locked, password, entries, needsPassword, role ?? null);
		// An encrypted file isn't written anew (that would drop its protection): only shown
		if (doc.isEncrypted) return new IncrementalPdf(file, doc, lib, { startxref: 0, kind: 'table', size: 0 }, false, null, null, true);
		const repaired = await doc.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false });
		return new IncrementalPdf(repaired, (await loadPdf(repaired, true, password)).doc, lib, readTail(repaired)!, true);
	}

	/** Is the file encrypted (with or without a password)? */
	get encrypted(): boolean {
		return this.doc.isEncrypted;
	}

	/** How it is protected: the method and the permissions other programs keep to without the owner password; null
	 * when it isn't */
	get protection(): (ReturnType<typeof describeEncryption> & { needsPassword: boolean; openedAs: 'user' | 'owner' | null }) | null {
		return this.entries ? { ...describeEncryption(this.entries), needsPassword: this.needsPassword, openedAs: this.role } : null;
	}

	/**
	 * The file with another protection (AES-256), or none (null): written anew as a whole – a key can't change in an
	 * appended section, and no earlier version may stay readable inside it. Signatures don't survive.
	 */
	async protect(protection: NewProtection | null): Promise<Uint8Array> {
		if (this.locked) throw new PdfError('password');
		const made = protection ? await newEncryption(protection) : null;
		return this.whole([], { crypt: made?.crypt ?? null, dict: made?.dict ?? null });
	}

	/** The document's properties (`/Info`) and its PDF version */
	info(): DocumentFacts {
		const { PDFDict, PDFName, PDFString, PDFHexString } = this.lib;
		const info = this.doc.context.lookup(this.doc.context.trailerInfo.Info);
		const text = (key: string) => (info instanceof PDFDict ? info.lookupMaybe(PDFName.of(key), PDFString, PDFHexString)?.decodeText() : undefined) || undefined;
		const date = (key: string) => {
			const raw = info instanceof PDFDict ? info.lookupMaybe(PDFName.of(key), PDFString, PDFHexString) : undefined;
			return raw ? parsePdfDate(raw instanceof PDFString ? raw.asString() : raw.decodeText()) : null;
		};
		return {
			title: text('Title'),
			author: text('Author'),
			subject: text('Subject'),
			keywords: text('Keywords'),
			creator: text('Creator'),
			producer: text('Producer'),
			created: date('CreationDate'),
			modified: date('ModDate'),
			version: /^%PDF-(\d\.\d)/.exec(latin1.decode(this.base.subarray(0, 8)))?.[1] ?? ''
		};
	}

	/** The fonts of the pages' resources and of their annotations' appearances (a text box's embedded font lies only
	 * there) – each once, by name – with their embedded programs */
	fonts(): PdfFontProgram[] {
		const { PDFArray, PDFDict, PDFName, PDFRawStream, decodePDFRawStream } = this.lib;
		const out = new Map<string, PdfFontProgram>();
		const seen = new Set<PDFObject>();
		const fontDicts: PDFDict[] = [];
		for (const page of this.doc.getPages()) {
			const own = page.node.Resources()?.lookupMaybe(PDFName.of('Font'), PDFDict);
			if (own) fontDicts.push(own);
			const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
			for (let i = 0; i < (annots?.size() ?? 0); i++) {
				try {
					const ap = annots!.lookupMaybe(i, PDFDict)?.lookupMaybe(PDFName.of('AP'), PDFDict);
					const normal = ap?.lookup(PDFName.of('N'));
					const dict = normal instanceof PDFRawStream ? normal.dict : undefined;
					const fonts = dict?.lookupMaybe(PDFName.of('Resources'), PDFDict)?.lookupMaybe(PDFName.of('Font'), PDFDict);
					if (fonts) fontDicts.push(fonts);
				} catch {
					// An annotation that isn't what it should be has no fonts for us
				}
			}
		}
		for (const fonts of fontDicts) {
			for (const [, value] of fonts.entries()) {
				const font = this.doc.context.lookup(value);
				if (!(font instanceof PDFDict) || seen.has(font)) continue;
				seen.add(font);
				const base = font.lookupMaybe(PDFName.of('BaseFont'), PDFName)?.decodeText() ?? '';
				const subtype = font.lookupMaybe(PDFName.of('Subtype'), PDFName)?.asString();
				const descendant = subtype === '/Type0' ? font.lookupMaybe(PDFName.of('DescendantFonts'), PDFArray)?.lookupMaybe(0, PDFDict) : font;
				const descriptor = descendant?.lookupMaybe(PDFName.of('FontDescriptor'), PDFDict);
				const ff2 = descriptor?.lookup(PDFName.of('FontFile2'));
				const ff3 = descriptor?.lookup(PDFName.of('FontFile3'));
				const ff1 = descriptor?.lookup(PDFName.of('FontFile'));
				const stream = ff2 ?? ff3 ?? ff1;
				const kind: PdfFontProgram['kind'] =
					subtype === '/Type3' ? 'type3' : ff2 ? 'truetype' : ff3 ? ((ff3 as import('pdf-lib').PDFRawStream).dict?.lookupMaybe(PDFName.of('Subtype'), PDFName)?.asString() === '/OpenType' ? 'opentype' : 'cff') : ff1 ? 'type1' : 'none';
				let bytes: Uint8Array | null = null;
				if (stream instanceof PDFRawStream) {
					try {
						bytes = decodePDFRawStream(stream).decode();
					} catch (e) {
						console.warn('[pdf] font program not read', base, e);
					}
				}
				// A subset as the standard names it (`ABCDEF+Name`); pdf-lib numbers every font it embeds (`Name-1234`)
				const subset = /^[A-Z]{6}\+/.test(base);
				const name = base.replace(/^[A-Z]{6}\+/, '').replace(/-\d{4,}$/, '') || 'Font';
				// One per name: a complete one before a subset of it
				const known = out.get(name);
				if (!known || (known.subset && !subset) || (!known.bytes && bytes)) out.set(name, { name, subset, kind, bytes });
			}
		}
		return [...out.values()];
	}

	/** What the file holds that “Sanitize” can take out (counts; 0: none) */
	inspect(): HiddenData {
		const { PDFArray, PDFDict, PDFName, PDFRawStream } = this.lib;
		const context = this.doc.context;
		const found: HiddenData = { metadata: 0, attachments: 0, scripts: 0, bookmarks: 0, versions: 0 };
		const info = context.lookup(context.trailerInfo.Info);
		if (info instanceof PDFDict) found.metadata += info.entries().length;
		for (const [, object] of context.enumerateIndirectObjects()) {
			const dict = object instanceof PDFRawStream ? object.dict : object instanceof PDFDict ? object : null;
			if (!dict) continue;
			if (dict.get(PDFName.of('Type')) === PDFName.of('Metadata') || dict.has(PDFName.of('PieceInfo')) || dict.has(PDFName.of('Thumb'))) found.metadata++;
			if (dict.has(PDFName.of('AA'))) found.scripts++;
			const s = dict.get(PDFName.of('S'));
			if (s instanceof PDFName && ACTIONS.has(s.asString())) found.scripts++;
		}
		const names = this.doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
		const count = (tree: PDFDict | undefined, depth = 0): number => {
			if (!tree || depth > 32) return 0;
			const list = tree.lookupMaybe(PDFName.of('Names'), PDFArray);
			const kids = tree.lookupMaybe(PDFName.of('Kids'), PDFArray);
			return (list ? Math.floor(list.size() / 2) : 0) + (kids ? kids.asArray().reduce((n: number, _, i) => n + count(kids.lookupMaybe(i, PDFDict), depth + 1), 0) : 0);
		};
		found.attachments = count(names?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict));
		// Document scripts are actions of their own (counted above) – unless they lie in the name tree directly
		found.scripts = Math.max(found.scripts, count(names?.lookupMaybe(PDFName.of('JavaScript'), PDFDict)));
		const walk = (list: FileBookmark[]): number => list.reduce((n, b) => n + 1 + walk(b.items), 0);
		found.bookmarks = walk(this.outline());
		found.versions = Math.max(0, [...latin1.decode(this.base).matchAll(/startxref/g)].length - 1);
		return found;
	}

	/**
	 * The file without what is asked for, written anew as a whole (so earlier versions and objects nothing uses any
	 * more are gone too); its protection stays. Comments, speaker notes and form values stay.
	 */
	async sanitize(what: Sanitize): Promise<Uint8Array> {
		if (this.locked) throw new PdfError('password');
		const { PDFDict, PDFName, PDFRawStream } = this.lib;
		const context = this.doc.context;
		const changed: SectionObject[] = [];
		const drop = (dict: PDFDict, keys: readonly string[]) => {
			let any = false;
			for (const k of keys) if (dict.has(PDFName.of(k))) (dict.delete(PDFName.of(k)), (any = true));
			return any;
		};
		const catalogRef = context.trailerInfo.Root as PDFRef;
		for (const [ref, object] of context.enumerateIndirectObjects()) {
			const isStream = object instanceof PDFRawStream;
			const source = isStream ? object.dict : object instanceof PDFDict ? object : null;
			if (!source) continue;
			const dict = source.clone(context);
			const catalog = ref.objectNumber === catalogRef.objectNumber;
			let any = false;
			if (what.metadata) any = drop(dict, ['Metadata', 'PieceInfo', 'Thumb']) || any;
			if (what.scripts) {
				any = drop(dict, ['AA']) || any;
				const action = dict.lookupMaybe(PDFName.of('A'), PDFDict);
				const s = action?.get(PDFName.of('S'));
				if (s instanceof PDFName && ACTIONS.has(s.asString())) any = drop(dict, ['A']) || any;
				const open = dict.lookupMaybe(PDFName.of('OpenAction'), PDFDict);
				const o = open?.get(PDFName.of('S'));
				if (catalog && o instanceof PDFName && ACTIONS.has(o.asString())) any = drop(dict, ['OpenAction']) || any;
			}
			if (catalog && what.bookmarks) any = drop(dict, ['Outlines']) || any;
			if (catalog && (what.attachments || what.scripts)) {
				const names = dict.lookupMaybe(PDFName.of('Names'), PDFDict);
				if (names) {
					const rest = names.clone(context);
					const gone = drop(rest, [...(what.attachments ? ['EmbeddedFiles'] : []), ...(what.scripts ? ['JavaScript'] : [])]);
					if (gone) {
						dict.set(PDFName.of('Names'), rest);
						any = true;
					}
				}
			}
			if (!any) continue;
			const object2 = isStream ? PDFRawStream.of(dict, (object as import('pdf-lib').PDFRawStream).contents) : dict;
			changed.push({ num: ref.objectNumber, gen: ref.generationNumber, body: bytesOf(object2) });
		}
		return this.whole(changed, undefined, { info: !what.metadata });
	}

	/** Another PDF (unprotected, or protected without a password – e.g. pages taken out of this one) protected as this
	 * one is: the same encryption dictionary and key (and the first `/ID` it depends on) */
	async protectLike(bytes: Uint8Array): Promise<Uint8Array> {
		if (!this.crypt || !this.encrypt) return bytes;
		// PDF.js keeps the protection of what it takes out: opened with this one's password
		const other = await IncrementalPdf.open(bytes, this.password);
		if (other.locked) throw new PdfError('password');
		const { ID } = this.doc.context.trailerInfo;
		const first = ID instanceof this.lib.PDFArray && ID.size() > 0 ? ID.get(0).toString() : null;
		const dict = latin1.decode(bytesOf(this.doc.context.lookup(this.encrypt)!));
		return other.whole([], { crypt: this.crypt, dict, id: first });
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

	/**
	 * The objects of a page's own content (text pieces, images, paths, forms) with their boxes in the page's user
	 * space; null when the content can't be read safely – such a page isn't edited.
	 */
	contentObjects(index: number): readonly ContentObject[] | null {
		return this.pageContent(index)?.objects ?? null;
	}

	private pageContent(index: number): PageContent | null {
		if (this.contents.has(index)) return this.contents.get(index)!;
		let found: PageContent | null = null;
		try {
			const data = this.contentBytes(index);
			const ops = tokenize(data);
			found = { data, ops, objects: contentObjects(ops, this.contentResources(index)) };
		} catch (e) {
			console.warn('[pdf] page content', index, e);
		}
		this.contents.set(index, found);
		return found;
	}

	/** The color put under a page's content (`PdfEdits.background`), or null */
	background(index: number): Rgb | null {
		const { PDFArray, PDFName, PDFNumber } = this.lib;
		const color = this.doc.getPage(index).node.lookupMaybe(PDFName.of(BACKGROUND), PDFArray);
		const values = color?.asArray().map((v) => (v instanceof PDFNumber ? v.asNumber() : NaN)) ?? [];
		return values.length === 3 && values.every((v) => v >= 0 && v <= 1) ? (values as unknown as Rgb) : null;
	}

	/** A page's content streams, decoded and joined – without the background this package put first */
	private contentBytes(index: number): Uint8Array {
		const { PDFArray, PDFName, PDFRawStream, decodePDFRawStream } = this.lib;
		const contents = this.doc.getPage(index).node.lookup(PDFName.of('Contents'));
		const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => this.doc.context.lookup(ref)) : contents ? [contents] : [];
		if (this.background(index) && contents instanceof PDFArray) streams.shift();
		const parts = streams.map((stream) => {
			if (!(stream instanceof PDFRawStream)) throw new Error('content is no stream');
			return decodePDFRawStream(stream).decode();
		});
		const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length + 1, 0));
		let at = 0;
		for (const part of parts) {
			out.set(part, at);
			at += part.length;
			out[at++] = 0x0a;
		}
		return out;
	}

	/** What the content's walk needs of a page's resources: its XObjects' kinds and boxes, its fonts' widths */
	private contentResources(index: number): ContentResources {
		const { PDFArray, PDFDict, PDFName, PDFNumber, PDFStream } = this.lib;
		const context = this.doc.context;
		const resources = this.doc.getPage(index).node.Resources();
		const entry = (kind: string, name: string) => resources?.lookupMaybe(PDFName.of(kind), PDFDict)?.lookup(PDFName.of(name));
		const numbers = (o: unknown): number[] => (o instanceof PDFArray ? o.asArray().map((v) => context.lookup(v)).map((v) => (v instanceof PDFNumber ? v.asNumber() : 0)) : []);
		const fonts = new Map<string, ContentFont | null>();
		const font = (name: string): ContentFont | null => {
			const dict = entry('Font', name);
			if (!(dict instanceof PDFDict)) return null;
			const number = (d: PDFDict, key: string) => d.lookupMaybe(PDFName.of(key), PDFNumber)?.asNumber();
			if (dict.get(PDFName.of('Subtype')) === PDFName.of('Type0')) {
				const descendant = dict.lookupMaybe(PDFName.of('DescendantFonts'), PDFArray)?.lookupMaybe(0, PDFDict);
				const dw = (descendant && number(descendant, 'DW')) ?? 1000;
				// `/W`: `first [w …]` or `first last w`
				const widths = new Map<number, number>();
				const ranges: [number, number, number][] = [];
				const w = descendant?.lookupMaybe(PDFName.of('W'), PDFArray);
				for (let i = 0; w && i < w.size(); ) {
					const first = w.lookupMaybe(i, PDFNumber)?.asNumber() ?? 0;
					const next = w.lookup(i + 1);
					if (next instanceof PDFArray) {
						numbers(next).forEach((v, k) => widths.set(first + k, v));
						i += 2;
					} else {
						ranges.push([first, next instanceof PDFNumber ? next.asNumber() : first, w.lookupMaybe(i + 2, PDFNumber)?.asNumber() ?? dw]);
						i += 3;
					}
				}
				return { bytes: 2, width: (code) => widths.get(code) ?? ranges.find((r) => code >= r[0] && code <= r[1])?.[2] ?? dw };
			}
			const first = number(dict, 'FirstChar') ?? 0;
			const widths = numbers(dict.lookup(PDFName.of('Widths')));
			const descriptor = dict.lookupMaybe(PDFName.of('FontDescriptor'), PDFDict);
			// Without widths (the standard fonts): an average glyph; Courier is 600 wide
			const base = String(dict.get(PDFName.of('BaseFont')) ?? '');
			const missing = (descriptor && number(descriptor, 'MissingWidth')) || (/Courier/.test(base) ? 600 : 500);
			return { bytes: 1, width: (code) => widths[code - first] || missing };
		};
		return {
			xobject: (name) => {
				const stream = entry('XObject', name);
				if (!(stream instanceof PDFStream)) return null;
				const subtype = stream.dict.get(PDFName.of('Subtype'));
				if (subtype === PDFName.of('Image')) return { kind: 'image' };
				if (subtype !== PDFName.of('Form')) return null;
				const bbox = numbers(stream.dict.lookup(PDFName.of('BBox')));
				const matrix = numbers(stream.dict.lookup(PDFName.of('Matrix')));
				if (bbox.length !== 4) return null;
				return { kind: 'form', bbox, matrix: (matrix.length === 6 ? matrix : [1, 0, 0, 1, 0, 0]) as Matrix };
			},
			font: (name) => {
				if (!fonts.has(name)) fonts.set(name, font(name));
				return fonts.get(name)!;
			}
		};
	}

	/** Changed pages' contents as they are written: only those that really differ from the file's */
	private async newContents(edits: PdfEdits): Promise<Map<number, NewContent>> {
		const { PDFDict, PDFName } = this.lib;
		const out = new Map<number, NewContent>();
		const slots = edits.pages;
		const source = (m: Matrix) => m.map(pdfNumber).join(' ');
		for (const index of new Set([...(edits.content?.keys() ?? []), ...(edits.flatten?.keys() ?? [])])) {
			const slot = slots ? slots[index] : { base: index };
			const flattened = edits.flatten?.get(index) ?? [];
			if (!slot || !('base' in slot)) continue;
			const content = this.pageContent(slot.base);
			if (!content) continue;
			// Names for the drawings that the page doesn't use yet
			const taken = new Set((this.doc.getPage(slot.base).node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict)?.keys() ?? []).map((k) => k.asString().slice(1)));
			let n = 0;
			const drawn = flattened.map((f) => {
				while (taken.has(`InB${n}`)) n++;
				const name = `InB${n++}`;
				return { name, annotation: f.annotation, draw: `${f.matrix ? `${source(f.matrix)} cm ` : ''}/${name} Do`, at: f.at };
			});
			const changes = new Map(edits.content?.get(index) ?? []);
			const put = new Map<number, string>();
			const known = new Map(content.objects.map((o) => [o.id, o]));
			const onTop: string[] = [];
			for (const d of drawn) {
				const place = d.at !== undefined ? known.get(d.at) : undefined;
				if (place && place.kind !== 'text') {
					changes.set(place.id, { remove: true });
					put.set(place.id, d.draw);
				} else onTop.push(d.draw);
			}
			let data = rewriteContent(content.data, content.ops, content.objects, changes, put);
			if (data === content.data && !onTop.length) continue;
			if (onTop.length) {
				// Drawn in the page's own space, whatever state the file's content leaves behind
				const tail = ascii.encode(`\nQ\n${onTop.map((d) => `q ${d} Q\n`).join('')}`);
				const joined = new Uint8Array(2 + data.length + tail.length);
				joined.set(ascii.encode('q\n'));
				joined.set(data, 2);
				joined.set(tail, 2 + data.length);
				data = joined;
			}
			const stream = new Uint8Array(await new Response(new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
			out.set(index, { stream, used: usedResources(tokenize(data)), drawn });
		}
		return out;
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

	/** A page's review states (`/State` in the `Review` model; other models, e.g. “Marked”, are left out) */
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
		/** Text marks that say they are a part of another annotation (`/RT /Group`): their ref → that one's */
		const partOf = new Map<string, string>();
		for (let i = 0; i < (annots?.size() ?? 0); i++) {
			const ref = annots!.get(i);
			if (!(ref instanceof PDFRef)) continue;
			try {
				const dict = this.doc.context.lookup(ref);
				if (!(dict instanceof PDFDict)) continue;
				const subtype = dict.lookupMaybe(key('Subtype'), PDFName)?.asString().slice(1);
				const whole = dict.get(key('IRT'));
				if (subtype === 'StrikeOut' && whole instanceof PDFRef && dict.lookupMaybe(key('RT'), PDFName)?.asString() === '/Group') partOf.set(ref.toString(), whole.toString());
				const flags = dict.lookupMaybe(key('F'), PDFNumber)?.asNumber() ?? 0;
				// Hidden (2) or not viewed (32): the file's – unless it is a tool's own data kept on the page (`/InBrowser`)
				const hidden = !!(flags & 34);
				if (!subtype || !READ.has(subtype) || (hidden && !dict.has(key('InBrowser')))) continue;
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
				// A line's two endings; a callout has one, as a name
				const ends = dict.lookup(key('LE'));
				const endings = ends instanceof PDFArray ? ends : undefined;
				const modified = dict.lookupMaybe(key('M'), PDFString, PDFHexString);
				out.push({
					ref: ref.toString(),
					id: ref.generationNumber ? `${ref.objectNumber}R${ref.generationNumber}` : `${ref.objectNumber}R`,
					subtype,
					...(hidden && { hidden }),
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
					cloud: dict.lookupMaybe(key('BE'), PDFDict)?.lookupMaybe(key('S'), PDFName)?.asString() === '/C' || undefined,
					callout: numbers(dict.get(key('CL'))),
					file: subtype === 'FileAttachment' ? this.attachedFile(dict) : undefined,
					...(subtype === 'Link' ? this.linkTarget(dict) : {}),
					quadPoints: numbers(dict.get(key('QuadPoints'))),
					defaultAppearance: text('DA'),
					richContents: text('RC'),
					defaultStyle: text('DS'),
					quadding: dict.lookupMaybe(key('Q'), PDFNumber)?.asNumber(),
					paint: this.paintOpacity(dict),
					image: subtype === 'Stamp' ? this.stampImage(dict) : undefined,
					data: text('InBrowser')
				});
			} catch (e) {
				console.warn('[pdf] annotation not read', e);
			}
		}
		// The struck text of a replacement goes with its insertion mark; with any other partner it stays a mark of its own
		const byRef = new Map(out.map((a) => [a.ref, a]));
		return out.filter((a) => {
			const whole = byRef.get(partOf.get(a.ref) ?? '');
			if (whole?.subtype !== 'Caret' || !a.quadPoints) return true;
			(whole.grouped ??= []).push({ ref: a.ref, quadPoints: a.quadPoints, contents: a.contents });
			return false;
		});
	}

	/** The bookmarks of the file (its outline), as far as their objects can be read */
	outline(): FileBookmark[] {
		const { PDFArray, PDFDict, PDFName, PDFNumber, PDFRef, PDFString, PDFHexString } = this.lib;
		const context = this.doc.context;
		const root = this.doc.catalog.lookupMaybe(PDFName.of('Outlines'), PDFDict);
		if (!root) return [];
		const pages = new Map(this.doc.getPages().map((p, i) => [p.ref.toString(), i]));
		const seen = new Set<string>();
		const number = (o: PDFObject | undefined) => (o instanceof PDFNumber ? o.asNumber() : null);
		const read = (first: PDFObject | undefined, depth: number): FileBookmark[] => {
			const out: FileBookmark[] = [];
			let ref = first;
			// Lists that loop or run on forever end where they repeat
			while (ref instanceof PDFRef && !seen.has(ref.toString()) && seen.size < 100_000) {
				seen.add(ref.toString());
				const dict = context.lookup(ref);
				if (!(dict instanceof PDFDict)) break;
				const flags = number(dict.lookup(PDFName.of('F'))) ?? 0;
				const c = dict.lookupMaybe(PDFName.of('C'), PDFArray);
				const color = rgb(c?.asArray().map((v) => number(context.lookup(v)) ?? 0));
				const target = this.bookmarkTarget(dict, pages);
				out.push({
					ref: ref.toString(),
					title: dict.lookupMaybe(PDFName.of('Title'), PDFString, PDFHexString)?.decodeText() ?? '',
					bold: (flags & 2) !== 0,
					italic: (flags & 1) !== 0,
					...(color && { color }),
					open: (number(dict.lookup(PDFName.of('Count'))) ?? 0) > 0,
					...target,
					items: depth < 64 ? read(dict.get(PDFName.of('First')), depth + 1) : []
				});
				ref = dict.get(PDFName.of('Next'));
			}
			return out;
		};
		return read(root.get(PDFName.of('First')), 0);
	}

	/** Where a bookmark leads: a page of the file and the top there (`/Dest` or `/A` `/GoTo`, explicit or named), or a
	 * web address (`/A` `/URI`) */
	private bookmarkTarget(dict: PDFDict, pages: ReadonlyMap<string, number>): { page: number | null; top: number | null; uri?: string } {
		const { PDFArray, PDFDict, PDFName, PDFNumber, PDFRef, PDFString, PDFHexString } = this.lib;
		const none = { page: null, top: null };
		const action = dict.lookupMaybe(PDFName.of('A'), PDFDict);
		const kind = action?.lookupMaybe(PDFName.of('S'), PDFName)?.asString();
		if (kind === '/URI') return { ...none, uri: action!.lookupMaybe(PDFName.of('URI'), PDFString, PDFHexString)?.decodeText() };
		let dest: PDFObject | undefined = kind === '/GoTo' ? action!.lookup(PDFName.of('D')) : dict.lookup(PDFName.of('Dest'));
		if (dest instanceof PDFName) dest = this.namedDestination(dest.decodeText());
		else if (dest instanceof PDFString || dest instanceof PDFHexString) dest = this.namedDestination(dest.decodeText());
		if (dest instanceof PDFDict) dest = dest.lookup(PDFName.of('D'));
		if (!(dest instanceof PDFArray) || !dest.size()) return none;
		const first = dest.get(0);
		const page = first instanceof PDFRef ? (pages.get(first.toString()) ?? null) : null;
		const fit = dest.lookupMaybe(1, PDFName)?.asString();
		const at = fit === '/XYZ' ? 3 : fit === '/FitH' || fit === '/FitBH' ? 2 : -1;
		const top = at > 0 && at < dest.size() ? dest.lookup(at) : undefined;
		return { page, top: top instanceof PDFNumber ? top.asNumber() : null };
	}

	/** A named destination: in the catalog's `/Dests`, else in the name tree `/Names` `/Dests` */
	private namedDestination(name: string): PDFObject | undefined {
		const { PDFArray, PDFDict, PDFName, PDFString, PDFHexString } = this.lib;
		const old = this.doc.catalog.lookupMaybe(PDFName.of('Dests'), PDFDict);
		const found = old?.lookup(PDFName.of(name));
		if (found) return found;
		const tree = this.doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)?.lookupMaybe(PDFName.of('Dests'), PDFDict);
		const search = (node: PDFDict | undefined, depth: number): PDFObject | undefined => {
			if (!node || depth > 32) return undefined;
			const names = node.lookupMaybe(PDFName.of('Names'), PDFArray);
			if (names)
				for (let i = 0; i + 1 < names.size(); i += 2) {
					const key = names.lookup(i);
					if ((key instanceof PDFString || key instanceof PDFHexString) && key.decodeText() === name) return names.lookup(i + 1);
				}
			const kids = node.lookupMaybe(PDFName.of('Kids'), PDFArray);
			for (let i = 0; kids && i < kids.size(); i++) {
				const hit = search(kids.lookupMaybe(i, PDFDict), depth + 1);
				if (hit) return hit;
			}
			return undefined;
		};
		return search(tree, 0);
	}

	/** Where a `/Link` leads: a web address (`/A` with `/URI`), or a page (`/Dest` or `/A` with `/GoTo`; an explicit
	 * destination – named ones are left to PDF.js) */
	private linkTarget(dict: PDFDict): { uri?: string; destPage?: number } {
		const { PDFArray, PDFDict, PDFName, PDFRef, PDFString, PDFHexString } = this.lib;
		const action = dict.lookupMaybe(PDFName.of('A'), PDFDict);
		const kind = action?.lookupMaybe(PDFName.of('S'), PDFName)?.asString();
		if (kind === '/URI') return { uri: action!.lookupMaybe(PDFName.of('URI'), PDFString, PDFHexString)?.decodeText() };
		const dest = kind === '/GoTo' ? action!.lookup(PDFName.of('D')) : dict.lookup(PDFName.of('Dest'));
		const page = dest instanceof PDFArray ? dest.get(0) : undefined;
		if (!(page instanceof PDFRef)) return {};
		const index = this.doc.getPages().findIndex((p) => p.ref === page);
		return index >= 0 ? { destPage: index } : {};
	}

	/** The file of a `/FileAttachment` (its stream decoded) with its name */
	private attachedFile(dict: PDFDict): AttachedFile | undefined {
		const { PDFDict, PDFName, PDFString, PDFHexString, PDFRawStream: RawStream, decodePDFRawStream } = this.lib;
		const spec = dict.lookupMaybe(PDFName.of('FS'), PDFDict);
		const embedded = spec?.lookupMaybe(PDFName.of('EF'), PDFDict);
		const stream = embedded?.lookup(PDFName.of('UF')) ?? embedded?.lookup(PDFName.of('F'));
		if (!spec || !(stream instanceof RawStream)) return undefined;
		const name = (spec.lookupMaybe(PDFName.of('UF'), PDFString, PDFHexString) ?? spec.lookupMaybe(PDFName.of('F'), PDFString, PDFHexString))?.decodeText();
		try {
			return { name: name || 'file', bytes: decodePDFRawStream(stream).decode() };
		} catch (e) {
			console.warn('[pdf] attached file not read', e);
			return undefined;
		}
	}

	/** The one picture a stamp's appearance draws, when it is stored the way `imageObjects` writes pictures */
	private stampImage(dict: PDFDict): PdfPicture | undefined {
		const { PDFDict, PDFName, PDFNumber, PDFRawStream: RawStream } = this.lib;
		const name = (d: PDFDict, k: string) => d.lookupMaybe(PDFName.of(k), PDFName)?.asString();
		const plain = (s: unknown, space: string): s is PDFRawStream =>
			s instanceof RawStream && name(s.dict, 'ColorSpace') === space && s.dict.lookupMaybe(PDFName.of('BitsPerComponent'), PDFNumber)?.asNumber() === 8 && !s.dict.has(PDFName.of('DecodeParms'));
		const normal = dict.lookupMaybe(PDFName.of('AP'), PDFDict)?.lookup(PDFName.of('N'));
		const xobjects = normal instanceof RawStream ? normal.dict.lookupMaybe(PDFName.of('Resources'), PDFDict)?.lookupMaybe(PDFName.of('XObject'), PDFDict) : undefined;
		const images = (xobjects?.keys() ?? []).map((k) => xobjects!.lookup(k)).filter((x) => x instanceof RawStream && name(x.dict, 'Subtype') === '/Image');
		const [image] = images;
		// Vectors: the one form it draws
		const all = (xobjects?.keys() ?? []).map((k) => xobjects!.lookup(k));
		const [only] = all;
		if (all.length === 1 && only instanceof RawStream && name(only.dict, 'Subtype') === '/Form') return formOfStream(this.lib, only);
		if (images.length !== 1 || !plain(image, '/DeviceRGB')) return undefined;
		const width = image.dict.lookupMaybe(PDFName.of('Width'), PDFNumber)?.asNumber();
		const height = image.dict.lookupMaybe(PDFName.of('Height'), PDFNumber)?.asNumber();
		if (!width || !height) return undefined;
		const filter = name(image.dict, 'Filter');
		if (filter === '/DCTDecode') return { width, height, jpeg: image.contents };
		if (filter !== '/FlateDecode') return undefined;
		const mask = image.dict.lookup(PDFName.of('SMask'));
		if (!mask) return { width, height, rgb: image.contents };
		return plain(mask, '/DeviceGray') && name(mask.dict, 'Filter') === '/FlateDecode' ? { width, height, rgb: image.contents, alpha: mask.contents } : undefined;
	}

	/**
	 * Opacities an annotation's normal appearance paints with: of its first fill outside text (`fill`, by `ca`), its
	 * first stroke (`stroke`, by `CA`) and its first text (`text`, by `ca`) – by the graphics states it sets (`gs`,
	 * kept across `q`/`Q`), into forms it draws (`Do`, times the opacity they are drawn with). How PDF programs
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
		const written = [...(edits.annotations?.values() ?? [])]
			.flat()
			.concat([...(edits.replace?.values() ?? [])])
			.concat([...(edits.flatten?.values() ?? [])].flat().map((f) => f.annotation));
		const placeholders = written.flatMap((a) => [a.appearance.content, ...(a.appearance.groups ?? [])].flatMap(placeholdersOf));
		// One subset per font used (Liberation Sans, a user's fonts)
		const byFont = new Map<string, string[]>();
		for (const p of placeholders) byFont.set(p.font, [...(byFont.get(p.font) ?? []), p.hex]);
		const font = new Map(await Promise.all([...byFont].map(async ([key, hexes]) => [key, await unicodeFont(hexes, key)] as const)));
		const copies = await this.copied(edits.pages ?? []);
		const drawn = written.flatMap((a) => a.appearance.forms ?? []);
		const forms = drawn.length ? await embedForms(this.lib, drawn) : null;
		const form = edits.form ? await this.formUpdate(edits.form) : null;
		const contents = await this.newContents(edits);
		let objects = this.changes(edits, font, copies, form, forms, contents);
		if (!objects.length) return this.base;
		// Content changed: nothing of the old file may stay that isn't used any more
		if (contents.size) return this.whole(objects);
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
				// The file's own pages (a copy) open with its password
				const loaded = await loadPdf(w.pdf, false, w.password ?? this.password);
				if (loaded.locked) throw new PdfError('password');
				sources.set(w.pdf, (source = loaded.doc));
			}
			const [page] = await doc.copyPages(source, [w.index]);
			if (w.annotations === false) page.node.delete(this.lib.PDFName.of('Annots'));
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
	private changes(
		edits: PdfEdits,
		font: ReadonlyMap<string, UnicodeFont> = new Map(),
		copies: Copies | null = null,
		form: FormUpdate | null = null,
		forms: Awaited<ReturnType<typeof embedForms>> | null = null,
		contents: ReadonlyMap<number, NewContent> = new Map()
	): SectionObject[] {
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
		// The subset fonts first
		const fontRefs = new Map<string, string>();
		for (const [key, made] of font) {
			const { renumbered, objects } = adopt(made.doc, made.numbers);
			for (const [num, object] of objects) out.push({ num, gen: 0, body: bytesOf(object) });
			fontRefs.set(key, `${renumbered.get(made.font)} 0 R`);
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
		// Vector pictures: each form once
		const formRefs = new Map<PdfForm, string>();
		if (forms) {
			const { renumbered, objects } = adopt(forms.doc, forms.numbers);
			for (const [num, object] of objects) out.push({ num, gen: 0, body: bytesOf(object) });
			for (const [drawn, ref] of forms.refs) formRefs.set(drawn, `${renumbered.get(ref.objectNumber)} 0 R`);
		}
		/** An annotation as written: the embedded font's glyphs in place of its placeholders, its forms' objects */
		const ready = (a: NewAnnotation): NewAnnotation => {
			if (a.appearance.forms?.length) a = { ...a, appearance: { ...a.appearance, formRefs: a.appearance.forms.map((f) => formRefs.get(f) ?? '') } };
			if (!font.size) return a;
			const fill = (content: string) => content.replace(UNICODE_TEXT, (_, key: string, hex: string) => font.get(key === 'U' ? UNICODE_FONT : key)?.glyphs.get(hex) ?? '<>');
			const fonts = Object.fromEntries(Object.entries(a.appearance.fonts ?? {}).map(([name, base]) => [name, fontRefs.get(base) ?? base]));
			return { ...a, appearance: { ...a.appearance, content: fill(a.appearance.content), groups: a.appearance.groups?.map(fill), fonts } };
		};
		const replace = edits.replace ?? new Map<string, NewAnnotation>();
		const remove = edits.remove ?? new Set<string>();
		const slots: readonly PageSlot[] = edits.pages ?? Array.from({ length: this.pageCount }, (_, i) => ({ base: i }));
		/** The file's pages as they are (no tree to write) */
		const same = slots.length === this.pageCount && slots.every((s, i) => 'base' in s && s.base === i);
		const pages = new Set([
			...(edits.rotate?.keys() ?? []),
			...(edits.annotations?.keys() ?? []),
			...(edits.order?.keys() ?? []),
			...contents.keys(),
			...(edits.background?.keys() ?? []),
			...(edits.resize?.keys() ?? [])
		]);
		/** A stream written as it is (short ones: a background, the frame around a resized page's content) */
		const plain = (text: string) => {
			const ref = PDFRef.of(next++);
			out.push({ num: ref.objectNumber, gen: 0, body: ascii.encode(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`) });
			return ref;
		};
		const numbersOf = (o: PDFObject | undefined): number[] => {
			const array = o instanceof PDFRef ? context.lookup(o) : o;
			return array instanceof PDFArray ? array.asArray().map((v) => (v instanceof PDFNumber ? v.asNumber() : NaN)) : [];
		};
		if (!same) slots.forEach((_, i) => pages.add(i));
		const slotRefs = slots.map((s, i) => ('base' in s ? this.doc.getPage(s.base).ref : (copiedPages.get(i)?.ref ?? PDFRef.of(next++))));
		// Replies find what they answer by its ref, or by the name of one written in this update (replaced ones keep
		// their refs; new ones get theirs below, before their replies)
		const named = new Map<string, string>();
		for (const [ref, annotation] of replace) named.set(annotation.name, ref);
		const replyEntry = (a: NewAnnotation) => {
			if (!a.replyTo) return '';
			const parent = /^\d+ \d+ R$/.test(a.replyTo) ? a.replyTo : named.get(a.replyTo);
			return parent ? `/IRT ${parent}${a.group ? ' /RT /Group' : a.state ? '' : ' /RT /R'}` : '';
		};
		// A link to a page names that page's object
		const destEntry = (a: NewAnnotation) => (a.destPage !== undefined && slotRefs[a.destPage] ? ` /Dest [${slotRefs[a.destPage]} /XYZ null null null]` : '');
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
					const [dict, ...rest] = annotationObjects(ready(annotation), next, pageRef, this.keptEntries(ref as PDFRef, annotation) + destEntry(annotation));
					out.push({ num: (ref as PDFRef).objectNumber, gen: (ref as PDFRef).generationNumber, body: bytesOfSource(dict) });
					for (const body of rest) out.push({ num: next++, gen: 0, body: bytesOfSource(body) });
				}
			}
			const order = edits.order?.get(index);
			// Moving to the root of a flat tree: what it inherited comes along
			const moves = !same && !!page && page.node.get(PDFName.of('Parent'))?.toString() !== root?.toString();
			const content = page ? contents.get(index) : undefined;
			const color = edits.background?.get(index);
			const size = edits.resize?.get(index);
			if (page && !turn && !added.length && !gone.size && !order && !moves && !content && color === undefined && !size) continue;
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
			if (content && page) {
				// The content as one new stream; the old streams aren't named any more and so aren't written (`whole`)
				const ref = PDFRef.of(next++);
				dict.set(PDFName.of('Contents'), ref);
				const head = ascii.encode(`<< /Length ${content.stream.length} /Filter /FlateDecode >>\nstream\n`);
				const foot = ascii.encode('\nendstream');
				const body = new Uint8Array(head.length + content.stream.length + foot.length);
				body.set(head);
				body.set(content.stream, head.length);
				body.set(foot, head.length + content.stream.length);
				out.push({ num: ref.objectNumber, gen: 0, body });
				// Its own resources, without the images, forms and fonts the content no longer draws – so they
				// leave the file when nothing else uses them
				const resources = page.node.Resources();
				const own = resources ? resources.clone(context) : PDFDict.withContext(context);
				for (const [kind, used] of [['XObject', content.used.xobjects], ['Font', content.used.fonts]] as const) {
					const entries = resources?.lookupMaybe(PDFName.of(kind), PDFDict);
					const kept = PDFDict.withContext(context);
					for (const [name, value] of entries?.entries() ?? []) if (used.has(name.asString().slice(1))) kept.set(name, value);
					// Drawings made part of the content: each the appearance an annotation would have (its other
					// objects follow it), without the annotation itself
					if (kind === 'XObject') {
						for (const d of content.drawn) {
							const [, ...objects] = annotationObjects(ready(d.annotation), next, pageRef);
							kept.set(PDFName.of(d.name), PDFRef.of(next));
							for (const body of objects) out.push({ num: next++, gen: 0, body: bytesOfSource(body) });
						}
					}
					if (entries || kept.entries().length) own.set(PDFName.of(kind), kept);
				}
				if (resources || content.drawn.length) dict.set(PDFName.of('Resources'), own);
			}
			const had = numbersOf(dict.get(PDFName.of(BACKGROUND)));
			const colored = had.length === 3;
			if (color !== undefined || size || (content && colored)) {
				// The page's content streams: without the background that was there (a content written anew never
				// held it), in the frame of the new size, the background of now first
				const now = dict.get(PDFName.of('Contents'));
				const resolved = now instanceof PDFRef && page ? context.lookup(now) : now;
				let list: PDFObject[] = resolved instanceof PDFArray ? resolved.asArray().slice() : now ? [now] : [];
				if (colored && !(content && page) && resolved instanceof PDFArray) list.shift();
				if (size) {
					if (list.length) list = [plain(`q ${size.matrix.map(pdfNumber).join(' ')} cm`), ...list, plain('Q')];
					dict.set(PDFName.of('MediaBox'), context.obj([0, 0, size.width, size.height]));
					for (const key of ['CropBox', 'BleedBox', 'TrimBox', 'ArtBox']) dict.delete(PDFName.of(key));
				}
				const fill = color !== undefined ? color : colored ? (had as unknown as Rgb) : null;
				if (fill) {
					const own = numbersOf(dict.get(PDFName.of('MediaBox')) ?? page?.node.getInheritableAttribute(PDFName.of('MediaBox')));
					const [x0, y0, x1, y1] = own.length === 4 && own.every(Number.isFinite) ? own : [0, 0, 612, 792];
					const box = [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)];
					list.unshift(plain(`q ${fill.map(pdfNumber).join(' ')} rg ${box.map(pdfNumber).join(' ')} re f Q`));
					dict.set(PDFName.of(BACKGROUND), context.obj([...fill]));
				} else dict.delete(PDFName.of(BACKGROUND));
				if (list.length) {
					const array = PDFArray.withContext(context);
					for (const entry of list) array.push(entry);
					dict.set(PDFName.of('Contents'), array);
				} else dict.delete(PDFName.of('Contents'));
			}
			if (size && before) {
				// The file's annotations that stay as they are lie in the old space: moved along
				const [k, , , , dx, dy] = size.matrix;
				const moved = (o: PDFObject | undefined): PDFObject | undefined => {
					if (!(o instanceof PDFArray)) return o;
					const array = PDFArray.withContext(context);
					o.asArray().forEach((v, i) => array.push(v instanceof PDFArray ? moved(v)! : v instanceof PDFNumber ? PDFNumber.of(v.asNumber() * k + (i % 2 ? dy : dx)) : v));
					return array;
				};
				for (let i = 0; i < before.size(); i++) {
					const ref = before.get(i);
					if (!(ref instanceof PDFRef) || gone.has(ref.toString()) || replace.has(ref.toString())) continue;
					const found = context.lookup(ref);
					if (!(found instanceof PDFDict)) continue;
					const annotation = found.clone(context);
					for (const key of ['Rect', 'QuadPoints', 'Vertices', 'L', 'CL', 'InkList']) {
						const name = PDFName.of(key);
						const value = annotation.lookup(name);
						if (value instanceof PDFArray) annotation.set(name, moved(value)!);
					}
					out.push({ num: ref.objectNumber, gen: ref.generationNumber, body: bytesOf(annotation) });
				}
			}
			if (added.length || gone.size || order) {
				const refs = added.map((annotation) => {
					const ref = PDFRef.of(next);
					named.set(annotation.name, ref.toString());
					for (const body of annotationObjects(ready(annotation), next + 1, pageRef, replyEntry(annotation) + destEntry(annotation))) out.push({ num: next++, gen: 0, body: bytesOfSource(body) });
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
					// What the order doesn't name (replies, parts of another annotation) comes last
					refs.forEach((ref, i) => !order.includes(i) && annots.push(ref));
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
		if (edits.outline) this.writeOutline(edits.outline, slots, slotRefs, out, () => next++);
		this.infoRef = undefined;
		// Whatever this section changes, the file says who wrote it last (`/Producer`); a file we made also who made it
		if (edits.info || edits.created || out.length) this.writeInfo(edits.info ?? {}, out, () => next++, !!edits.created);
		return out;
	}

	/** `/Info` with the properties changed, `/Producer` (and `/Creator` for a file we made) and `/ModDate` now, and the
	 * XMP metadata alike where the catalog has it */
	private writeInfo(info: DocumentInfo, out: SectionObject[], take: () => number, created = false) {
		const { PDFDict, PDFHexString, PDFName, PDFRef, PDFString, PDFRawStream, decodePDFRawStream } = this.lib;
		const context = this.doc.context;
		const ref = context.trailerInfo.Info;
		const old = context.lookup(ref);
		const dict = old instanceof PDFDict ? old.clone(context) : PDFDict.withContext(context);
		for (const [key, name] of Object.entries(INFO_KEYS) as [keyof DocumentInfo, string][]) {
			const value = info[key];
			if (value === undefined) continue;
			if (value) dict.set(PDFName.of(name), PDFHexString.fromText(value));
			else dict.delete(PDFName.of(name));
		}
		const now = new Date();
		const producer = pdfProducer();
		dict.set(PDFName.of('Producer'), PDFHexString.fromText(producer));
		if (created) {
			dict.set(PDFName.of('Creator'), PDFHexString.fromText(producer));
			if (!dict.has(PDFName.of('CreationDate'))) dict.set(PDFName.of('CreationDate'), PDFString.fromDate(now));
		}
		dict.set(PDFName.of('ModDate'), PDFString.fromDate(now));
		// (an object the form update wrote under the same number gives way)
		const put = (o: SectionObject) => {
			const i = out.findIndex((x) => x.num === o.num);
			if (i >= 0) out.splice(i, 1);
			out.push(o);
		};
		if (ref instanceof PDFRef) put({ num: ref.objectNumber, gen: ref.generationNumber, body: bytesOf(dict) });
		else {
			this.infoRef = PDFRef.of(take(), 0);
			out.push({ num: this.infoRef.objectNumber, gen: 0, body: bytesOf(dict) });
		}
		// XMP: the same values, so programs reading it show the new ones
		const metaRef = this.doc.catalog.get(PDFName.of('Metadata'));
		const meta = metaRef instanceof PDFRef ? context.lookup(metaRef) : undefined;
		if (!(metaRef instanceof PDFRef) || !(meta instanceof PDFRawStream) || typeof DOMParser === 'undefined') return;
		try {
			const xml = new TextDecoder().decode(decodePDFRawStream(meta).decode());
			const changed = withXmp(xml, info, { producer, date: now, created });
			if (changed === null) return;
			const bytes = new TextEncoder().encode(changed);
			const head = ascii.encode(`<< /Type /Metadata /Subtype /XML /Length ${bytes.length} >>\nstream\n`);
			const tail = ascii.encode('\nendstream');
			const body = new Uint8Array(head.length + bytes.length + tail.length);
			body.set(head);
			body.set(bytes, head.length);
			body.set(tail, head.length + bytes.length);
			put({ num: metaRef.objectNumber, gen: metaRef.generationNumber, body });
		} catch (e) {
			console.warn('[pdf] XMP not changed', e);
		}
	}

	/**
	 * The bookmarks anew: an outline dictionary with its entries (`/First`, `/Last`, `/Prev`, `/Next`, `/Parent`,
	 * `/Count` – positive for an open entry: the entries shown below it, negative for a closed one), and the catalog
	 * with its `/Outlines` (written here, or changed where this section already writes it). The file's old entries
	 * stay unused in it (gone when the file is written as a whole).
	 */
	private writeOutline(outline: readonly NewBookmark[], slots: readonly PageSlot[], slotRefs: readonly PDFRef[], out: SectionObject[], take: () => number) {
		const { PDFDict, PDFName, PDFObjectParser, PDFRef, PDFHexString } = this.lib;
		const context = this.doc.context;
		const catalogRef = context.trailerInfo.Root;
		if (!(catalogRef instanceof PDFRef)) return;
		const written = new Set(slots.flatMap((s) => ('base' in s ? [s.base] : [])));
		const file = new Map<string, FileBookmark>();
		const walk = (list: FileBookmark[]) => list.forEach((b) => (file.set(b.ref, b), walk(b.items)));
		walk(this.outline());
		const num = (n: number) => String(Math.round(n * 1000) / 1000);
		/** Entries shown below an open bookmark */
		const shown = (b: NewBookmark): number => (b.open ? b.items.reduce((sum, i) => sum + 1 + shown(i), 0) : 0);
		const target = (b: NewBookmark): string => {
			const t = b.target;
			if (!t) return '';
			if ('page' in t) return slotRefs[t.page] ? ` /Dest [${slotRefs[t.page]} /XYZ null ${t.top === null ? 'null' : num(t.top)} null]` : '';
			const kept = file.get(t.keep);
			// Its page is no longer in the file: it leads nowhere
			if (!kept || (kept.page !== null && !written.has(kept.page))) return '';
			const [n, g] = t.keep.split(' ').map(Number);
			const dict = context.lookup(PDFRef.of(n, g));
			if (!(dict instanceof PDFDict)) return '';
			return ['Dest', 'A', 'SE']
				.map((k) => [k, dict.get(PDFName.of(k))] as const)
				.filter(([, v]) => v !== undefined)
				.map(([k, v]) => ` /${k} ${v!.toString()}`)
				.join('');
		};
		const rootNum = take();
		const write = (list: readonly NewBookmark[], parent: number): { first: number; last: number } | null => {
			if (!list.length) return null;
			const nums = list.map(() => take());
			list.forEach((b, i) => {
				const kids = write(b.items, nums[i]);
				const count = b.items.length ? (b.open ? shown(b) : -b.items.length) : 0;
				const flags = (b.italic ? 1 : 0) | (b.bold ? 2 : 0);
				const body = [
					`<< /Title ${PDFHexString.fromText(b.title).toString()} /Parent ${parent} 0 R`,
					i > 0 ? ` /Prev ${nums[i - 1]} 0 R` : '',
					i < list.length - 1 ? ` /Next ${nums[i + 1]} 0 R` : '',
					kids ? ` /First ${kids.first} 0 R /Last ${kids.last} 0 R /Count ${count}` : '',
					flags ? ` /F ${flags}` : '',
					b.color ? ` /C [${b.color.map(num).join(' ')}]` : '',
					target(b),
					' >>'
				].join('');
				out.push({ num: nums[i], gen: 0, body: bytesOfSource(body) });
			});
			return { first: nums[0], last: nums[nums.length - 1] };
		};
		const top = write(outline, rootNum);
		const visible = outline.reduce((sum, b) => sum + 1 + shown(b), 0);
		out.push({ num: rootNum, gen: 0, body: ascii.encode(top ? `<< /Type /Outlines /First ${top.first} 0 R /Last ${top.last} 0 R /Count ${visible} >>` : '<< /Type /Outlines /Count 0 >>') });
		// The catalog: the one this section writes already (a filled-in form), else the file's
		const at = out.findIndex((o) => o.num === catalogRef.objectNumber);
		const base = at >= 0 ? PDFObjectParser.forBytes(out[at].body, context).parseObject() : context.lookup(catalogRef);
		if (!(base instanceof PDFDict)) return;
		const catalog = base.clone(context);
		if (top) catalog.set(PDFName.of('Outlines'), PDFRef.of(rootNum, 0));
		else catalog.delete(PDFName.of('Outlines'));
		const entry = { num: catalogRef.objectNumber, gen: catalogRef.generationNumber, body: bytesOf(catalog) };
		if (at >= 0) out[at] = entry;
		else out.push(entry);
	}

	/** The objects PDF.js appended to the original (`PdfEdits.form`): those of the file keep their numbers, new ones
	 * (numbered from the original's `/Size`) are renumbered into the section */
	private async formUpdate(bytes: Uint8Array): Promise<FormUpdate | null> {
		if (bytes.length <= this.base.length) return null;
		const appended = new TextDecoder('latin1').decode(bytes.subarray(this.base.length));
		const refs = new Map<number, number>();
		for (const m of appended.matchAll(/(?:^|[\r\n])\s*(\d+)\s+(\d+)\s+obj\b/g)) refs.set(Number(m[1]), Number(m[2]));
		const { doc } = await loadPdf(bytes, false, this.password);
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

	/**
	 * The whole file written anew: the changed and new objects and, of the file's own, only those still reached from
	 * the trailer (catalog, info, encryption). What nothing names any more – a page's old content, an image only a
	 * deleted object drew, earlier versions appended to the file – is not in it.
	 */
	private async whole(changed: SectionObject[], protection?: { crypt: PdfCrypt | null; dict: string | null; id?: string | null }, keep: { info: boolean } = { info: true }): Promise<Uint8Array> {
		const { PDFArray, PDFDict, PDFObjectParser, PDFRef, PDFStream } = this.lib;
		// Another protection (or none): the old encryption dictionary isn't written, a new one is
		const crypt = protection ? protection.crypt : this.crypt;
		const context = this.doc.context;
		const own = new Map<number, { gen: number; object: PDFObject }>();
		for (const [ref, object] of context.enumerateIndirectObjects()) own.set(ref.objectNumber, { gen: ref.generationNumber, object });
		const fresh = new Map(changed.map((o) => [o.num, o]));
		const parsed = new Map<number, PDFObject>();
		const objectOf = (num: number): PDFObject | undefined => {
			const o = fresh.get(num);
			if (!o) return own.get(num)?.object;
			if (!parsed.has(num)) parsed.set(num, PDFObjectParser.forBytes(o.body, context).parseObject());
			return parsed.get(num);
		};
		// Everything reached from the trailer (a stack, not recursion: lists of bookmarks run deep)
		const reached = new Set<number>();
		const { Root } = context.trailerInfo;
		const Info = keep.info ? this.infoRef ?? context.trailerInfo.Info : undefined;
		const stack: (PDFObject | undefined)[] = [Root, Info, protection ? undefined : (this.encrypt ?? undefined)];
		while (stack.length) {
			const o = stack.pop();
			if (o instanceof PDFRef) {
				if (reached.has(o.objectNumber)) continue;
				const target = objectOf(o.objectNumber);
				if (!target) continue;
				reached.add(o.objectNumber);
				stack.push(target);
			} else if (o instanceof PDFDict) {
				for (const [, v] of o.entries()) stack.push(v);
			} else if (o instanceof PDFArray) {
				for (const v of o.asArray()) stack.push(v);
			} else if (o instanceof PDFStream) {
				stack.push(o.dict);
			}
		}
		const encryptNum = this.encrypt instanceof PDFRef ? this.encrypt.objectNumber : -1;
		const parts: Uint8Array[] = [];
		let length = 0;
		const push = (bytes: Uint8Array) => {
			parts.push(bytes);
			length += bytes.length;
		};
		const text = (s: string) => push(ascii.encode(s));
		const version = /^%PDF-\d\.\d/.exec(latin1.decode(this.base.subarray(0, 8)))?.[0] ?? '%PDF-1.7';
		text(`${version}\n`);
		push(Uint8Array.of(0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a));
		const entries: { num: number; gen: number; offset: number }[] = [];
		for (const num of [...reached].sort((a, b) => a - b)) {
			const written = fresh.get(num);
			let object: SectionObject = written ?? { num, gen: own.get(num)!.gen, body: bytesOf(own.get(num)!.object) };
			// The encryption dictionary itself is never encrypted
			if (crypt && num !== encryptNum) object = await this.sealed(object, crypt);
			entries.push({ num, gen: object.gen, offset: length });
			text(`${num} ${object.gen} obj\n`);
			push(object.body);
			text('\nendobj\n');
		}
		let encryptRef: string | null | undefined;
		if (protection) {
			encryptRef = null;
			if (protection.dict) {
				const num = Math.max(0, ...entries.map((e) => e.num)) + 1;
				entries.push({ num, gen: 0, offset: length });
				text(`${num} 0 obj\n${protection.dict}\nendobj\n`);
				encryptRef = `${num} 0 R`;
			}
		}
		const xref = length;
		const size = Math.max(...entries.map((e) => e.num)) + 1;
		text('xref\n0 1\n0000000000 65535 f\r\n');
		for (const run of runs(entries)) {
			text(`${run[0].num} ${run.length}\n`);
			for (const e of run) text(`${String(e.offset).padStart(10, '0')} ${String(e.gen).padStart(5, '0')} n\r\n`);
		}
		text(`trailer\n<< /Size ${size} ${this.trailerEntries(encryptRef, protection?.id, keep.info)} >>\nstartxref\n${xref}\n%%EOF\n`);
		const out = new Uint8Array(length);
		let at = 0;
		for (const part of parts) {
			out.set(part, at);
			at += part.length;
		}
		return out;
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

	/** `/Root`, `/Info` and `/ID` (the first part kept, the second new: the file changed); `encryptRef`: another
	 * encryption dictionary (null: none), `firstId` the first ID it needs */
	private trailerEntries(encryptRef?: string | null, firstId?: string | null, withInfo = true): string {
		const { PDFArray } = this.lib;
		const { Root, ID } = this.doc.context.trailerInfo;
		const Info = withInfo ? (this.infoRef ?? this.doc.context.trailerInfo.Info) : undefined;
		const first = firstId ?? (ID instanceof PDFArray && ID.size() > 0 ? ID.get(0).toString() : null);
		const fresh = `<${randomHex(16)}>`;
		const ref = encryptRef === undefined ? this.encrypt?.toString() : encryptRef;
		const encrypt = ref && `/Encrypt ${ref}`;
		// The key of an encrypted file (RC4, AES-128) depends on its first ID: none stays none
		const id = encryptRef === undefined && this.encrypt && !first ? '' : `/ID [${first ?? fresh} ${fresh}]`;
		return [Root && `/Root ${Root.toString()}`, Info && `/Info ${Info.toString()}`, encrypt, id].filter(Boolean).join(' ');
	}
}

/** XMP with the properties set (title, author, subject as `dc:`, keywords as `pdf:Keywords`); null when it can't be read */
function withXmp(xml: string, info: DocumentInfo, stamp: { producer: string; date: Date; created: boolean }): string | null {
	const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
	const DC = 'http://purl.org/dc/elements/1.1/';
	const PDF = 'http://ns.adobe.com/pdf/1.3/';
	const XMP = 'http://ns.adobe.com/xap/1.0/';
	const start = xml.indexOf('<x:xmpmeta') >= 0 ? xml.indexOf('<x:xmpmeta') : xml.indexOf('<rdf:RDF');
	const end = xml.lastIndexOf('</x:xmpmeta>') >= 0 ? xml.lastIndexOf('</x:xmpmeta>') + 12 : xml.lastIndexOf('</rdf:RDF>') + 10;
	if (start < 0 || end <= start) return null;
	const doc = new DOMParser().parseFromString(xml.slice(start, end), 'application/xml');
	if (doc.getElementsByTagName('parsererror').length) return null;
	const description = doc.getElementsByTagNameNS(RDF, 'Description')[0];
	if (!description) return null;
	/** A `dc:` property as a list of one entry (`rdf:Alt` with x-default, or `rdf:Seq`) */
	const list = (name: string, kind: 'Alt' | 'Seq', value: string | undefined) => {
		if (value === undefined) return;
		for (const old of [...doc.getElementsByTagNameNS(DC, name)]) old.remove();
		if (!value) return;
		const el = doc.createElementNS(DC, `dc:${name}`);
		const box = el.appendChild(doc.createElementNS(RDF, `rdf:${kind}`));
		const li = box.appendChild(doc.createElementNS(RDF, 'rdf:li'));
		if (kind === 'Alt') li.setAttribute('xml:lang', 'x-default');
		li.textContent = value;
		description.appendChild(el);
	};
	list('title', 'Alt', info.title);
	list('creator', 'Seq', info.author);
	list('description', 'Alt', info.subject);
	if (info.keywords !== undefined) {
		for (const old of [...doc.getElementsByTagNameNS(PDF, 'Keywords')]) old.remove();
		description.removeAttributeNS(PDF, 'Keywords');
		if (info.keywords) description.appendChild(doc.createElementNS(PDF, 'pdf:Keywords')).textContent = info.keywords;
	}
	/** A simple property (element or attribute of the description) set anew */
	const simple = (ns: string, prefix: string, name: string, value: string) => {
		for (const old of [...doc.getElementsByTagNameNS(ns, name)]) old.remove();
		for (const d of [...doc.getElementsByTagNameNS(RDF, 'Description')]) d.removeAttributeNS(ns, name);
		description.appendChild(doc.createElementNS(ns, `${prefix}:${name}`)).textContent = value;
	};
	simple(PDF, 'pdf', 'Producer', stamp.producer);
	simple(XMP, 'xmp', 'ModifyDate', stamp.date.toISOString());
	simple(XMP, 'xmp', 'MetadataDate', stamp.date.toISOString());
	if (stamp.created) simple(XMP, 'xmp', 'CreatorTool', stamp.producer);
	return xml.slice(0, start) + new XMLSerializer().serializeToString(doc) + xml.slice(end);
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
