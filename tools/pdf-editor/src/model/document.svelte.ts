// An open PDF: its pages as the surface sees them, PDF.js's document (outline, text, attachments, layers) and the
// pages' renders (`PdfPages`, using that same document). Annotations of the pages live in their scenes.
// Changes are steps with undo (`edits.ts`); they save themselves shortly after as one incremental update of the
// original bytes (`IncrementalPdf`), so undoing everything writes the original file again. A version saved elsewhere
// meanwhile pauses saving (`conflict`), like the Text Editor.

import { suiteSettings } from '@in-browser/files/suite-settings.svelte.js';
import { reportSaveFailure } from '@in-browser/files/documents.js';
import type { Entry } from '@in-browser/files/entry.js';
import { canWrite, read, stat, write } from '@in-browser/files/fs.js';
import { basename } from '@in-browser/files/path.js';
import { ItemEditor } from '@in-browser/ink/edit/items.js';
import type { Box } from '@in-browser/ink/geometry.js';
import type { SurfacePage } from '@in-browser/ink/render/kit.js';
import { PageScene } from '@in-browser/ink/render/scene.js';
import { pageTransform, toShown, toUserSpace, type Matrix } from '@in-browser/pdf/geometry.js';
import { inverse, mul, type ContentKind, type ContentObject } from '@in-browser/pdf/content/objects.js';
import type { ContentChange } from '@in-browser/pdf/content/rewrite.js';
import { PdfPages } from '@in-browser/pdf/pages.js';
import type { Paper } from '@in-browser/pdf/write/paper-page.js';
import { loadPdf } from '@in-browser/pdf/load.js';
import { openPdf, PdfError, type OptionalContentConfig, type PDFDocumentProxy } from '@in-browser/pdf/pdfjs.js';
import type { PageText } from '@in-browser/pdf/text.js';
import { readPageText } from '@in-browser/pdf/text-layer.js';
import { parsePdfDate, type NewAnnotation, type ReviewState, type Rgb } from '@in-browser/pdf/write/annotations.js';
import type { PdfForm } from '@in-browser/pdf/write/form.js';
import { IncrementalPdf, type DocumentFacts, type DocumentInfo, type FileBookmark, type NewBookmark, type PdfEdits } from '@in-browser/pdf/write/incremental.js';
import { walk, type Bookmark, type BookmarkTarget } from './outline.js';
import { customLabel, registerFamily } from '@in-browser/graphics/fonts.js';
import type { CustomFont } from '@in-browser/graphics/rich-text.js';
import { describeFont } from '@in-browser/graphics/user-fonts.svelte.js';
import { m } from '#lib/i18n/index.js';
import { pieceForm } from '@in-browser/pdf/write/piece.js';
import { filledForm, formFonts, readFields, storageValue, type FieldValue, type FormField, type FormWidget } from '@in-browser/pdf/forms.js';
import { startScripts, type FormScripts, type SandboxEvent, type ScriptChange } from '@in-browser/pdf/scripting.js';
import { sameValue } from './fields.js';
import { isAnnotatable, pdfKit, rotatePdfItem, type Annotatable, type PdfItem } from '#lib/render/markup.js';
import { attachedFiles, isNote } from '#lib/render/note.js';
import { isStamp, registerStampImage, stampEvents } from '#lib/render/stamp.js';
import { isLink, linkView, type LinkItem } from '#lib/render/link.js';
import { isMeasured } from '#lib/render/measure.js';
import type { MeasureUnit } from '@in-browser/ink/items.js';
import { measureDefault, setMeasureDefault } from './tools.svelte.js';
import { annotationOf, partsOf, rgbOf } from './annots.js';
import { resizePlace, type PageResize } from './page-size.js';
import { kindOf } from './comments.js';
import { itemsOf, withData } from './imported.js';
import { isNotesAnnotation, notesAnnotation } from './notes.js';
import { flipsOf, MAX_STEP, stepsMoved, stepsOf, stepsWithOneBefore, stepsWithout, stepView, withSteps, withVisibility } from '#lib/render/steps.js';
import { applyOp, History, invert, movePages, type Op, type Step } from './edits.js';

/** The text of a blank page */
const EMPTY_TEXT: PageText = { str: '', runs: [] };

/** The author written with new comments and replies (the suite settings' name) */
const authorName = () => suiteSettings.values.profile.name;

/** Saving waits this long after a change (larger files longer: each save writes the whole file) */
const SAVE_DELAY_MS = 1500;
const SAVE_DELAY_LARGE_MS = 10_000;
const LARGE = 25 * 1024 * 1024;

/** Whether the PDF can be changed: checked in the background after opening (`readonly`: it lies where it can only
 * be read, e.g. a guest share for viewing) */
export type Editable = 'checking' | 'yes' | 'encrypted' | 'failed' | 'readonly';

/** What tells a version of the file apart */
interface Stamp {
	size: number;
	modified: number;
}

const stampOf = (entry: Pick<Entry, 'size' | 'modified'>): Stamp => ({ size: entry.size ?? 0, modified: entry.modified ?? 0 });
const sameStamp = (a: Stamp | null, b: Stamp | null) => !!a && !!b && a.size === b.size && a.modified === b.modified;

/** The name of the open document for `PdfPages` */
export const MAIN = 'main';

/** Which PDF a page is drawn from: the open one (`MAIN`) or one inserted from */
export const sourceOf = (page: PdfPage) => page.source ?? MAIN;

/** A page of the file itself (not inserted, blank or a duplicate): its content can be edited, its form and links
 * are the file's */
const isOwnPage = (page: PdfPage) => !!page.number && !page.source && !page.copy;

export interface PdfPage extends SurfacePage {
	/** Page of the PDF as opened, from 1 (stays when pages move); 0: a blank page inserted here */
	readonly number: number;
	/** A page inserted from another PDF: that PDF (`PdfDocument.inserted`), `number` is its page there */
	readonly source?: string;
	/** A duplicate of a page (`number` of `source`): shown like it, saved as a copy of it without the annotations it
	 * has in its PDF (its items were copied with it) */
	readonly copy?: true;
	/** Shown rotation in degrees (the page's own, as PDF.js applies it) */
	readonly rotate: number;
	/** Raised whenever the page looks different (its renders are asked for again) */
	readonly rev: number;
	/** The page's box in user space (PDF.js `page.view`): where annotations go */
	readonly view: readonly number[];
	/** The color under the page's content (`#rrggbb`); none: white paper */
	readonly background?: string;
	/** The ruling the page was made with (lined, squared, dotted; `paperPdf`): "Blank page" gives the next one the same */
	readonly paper?: Paper;
}

const hexOf = (rgb: readonly number[]) => `#${rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;

/** An object of a page's own content as the page shows it now (`PdfDocument.contentItems`) */
export interface ContentItem {
	id: number;
	kind: ContentKind;
	/** Its box on the page as shown (points, y down), with the changes made to it */
	box: Box;
}

/** A drawing made part of a page's content in this session (a comment flattened, a picture in an image's place) */
interface ContentAdd {
	key: number;
	annotation: NewAnnotation;
	matrix?: Matrix;
	/** The object of the file's content it stands for */
	at?: number;
}

/** Ids of `ContentItem`s that were added in this session start here (the file's objects count from 0) */
const ADDED = 1_000_000;

/** What the surface hears about changed items (set by `Surface.svelte`) */
export interface ItemListener {
	stroke(pageId: string, scene: PageScene<PdfItem>, item: PdfItem): void;
	region(pageId: string, box: Box | null): void;
	/** A page's items were replaced (e.g. turned with the page) */
	content(pageId: string): void;
	/** A page's PDF looks different (a form field filled in): drawn anew without dropping what is shown */
	backdrop?(pageId: string): void;
}

/** An entry of the outline as PDF.js reads it */
interface PdfJsOutline {
	title: string;
	bold?: boolean;
	italic?: boolean;
	color?: Uint8ClampedArray | number[] | null;
	count?: number;
	url?: string | null;
	dest: string | unknown[] | null;
	items: PdfJsOutline[];
}

/** A reply to a comment (a `/Text` note answering it in the file) */
export interface Reply {
	id: string;
	author: string;
	text: string;
	modified: Date | null;
	/** Its annotation, when it is the file's */
	ref?: string;
}

/** A review state set on a comment or a reply (the newest one counts) */
export interface StateEntry {
	id: string;
	state: ReviewState;
	author: string;
	modified: Date | null;
	/** Its annotation, when it is the file's */
	ref?: string;
}

/** Who wrote a comment and when it was last changed */
export interface CommentInfo {
	author: string;
	modified: Date | null;
}

/** A file embedded in the PDF (its content is read when asked for) */
export interface Attachment {
	/** Key for `attachmentContent` */
	id: string;
	name: string;
	description: string;
}

/** Fields that can be filled in (push buttons and signatures can't) */
export const FILLABLE: ReadonlySet<FormField['kind']> = new Set(['text', 'checkbox', 'radio', 'combo', 'list']);

export class PdfDocument {
	readonly path: string;
	pages = $state.raw<PdfPage[]>([]);
	readonly renders: PdfPages;
	/** A piece of a page arrived (the surface draws again) */
	onrender: (() => void) | null = null;
	/** Counts arrived pieces: thumbnails look again for their picture */
	rendered = $state(0);
	/** Counts changes of what lies on the pages (thumbnails draw again) */
	changes = $state(0);
	private layerConfig: Promise<OptionalContentConfig> | undefined;
	/** Text of the PDF's pages by number and rotation (`${number}|${rotate}`), and as soon as it is read (marking text
	 * needs it while the pointer moves) */
	private readonly text = new Map<string, Promise<PageText>>();
	private readonly textNow = new Map<string, PageText>();
	/** The bookmarks (`model/outline.ts`): as PDF.js read them until the file is parsed for writing, then as the file
	 * has them (`fileBookmarks`, kept to see what changed); which are open (by id; `fileOpen` as the file says) */
	bookmarks = $state.raw<readonly Bookmark[]>([]);
	bookmarksOpen = $state.raw<ReadonlySet<string>>(new Set());
	private fileBookmarks: readonly Bookmark[] = [];
	private fileOpen: ReadonlySet<string> = new Set();
	/** The bookmarks are the file's (it is parsed for writing) */
	private bookmarksRead = $state(false);
	/** What the PDF brings along (read once when opened) */
	attachments: Attachment[] = [];
	hasLayers = false;
	private readonly scenes = new Map<string, PageScene<PdfItem>>();
	/** Strokes and shapes drawn on the pages (each becomes an annotation); one undo step per action */
	readonly items: ItemEditor<PdfItem>;
	listener: ItemListener | null = null;
	/** When each drawn item was first saved (`/M` of its annotation stays the same across saves) */
	private readonly dates = new Map<string, Date>();
	/** Items made of annotations of the file: item id → the annotation's ref, and the item as read (changed when
	 * it is another object – only then is the annotation written anew) */
	private readonly origin = new Map<string, string>();
	private readonly loaded = new Map<string, PdfItem>();
	/** Annotation of the file → its items' ids */
	private readonly fromFile = new Map<string, string[]>();
	/** Annotations of the file that are a part of another one (the struck text of a replacement): that one's ref →
	 * theirs. Written anew with it, never on their own */
	private readonly parts = new Map<string, string[]>();
	/** Author and date of comments: read from the file, or the author's name when a new one is first saved */
	private readonly meta = new Map<string, CommentInfo>();
	/** Replies per comment (item id); those of the file keep their refs (`fileReplies`: all read) */
	replies = $state.raw<ReadonlyMap<string, readonly Reply[]>>(new Map());
	private readonly fileReplies = new Set<string>();
	/** Speaker notes per page (page id → text; `notes.ts`), and those read from the file with their annotations */
	notes = $state.raw<ReadonlyMap<string, string>>(new Map());
	private readonly fileNotes = new Map<string, { ref: string; text: string }>();
	/** The file as last written (or as opened) */
	private latest: Uint8Array;
	/** PDFs pages were inserted from (by key): their bytes (copied into the file when it is saved) and PDF.js's document */
	private readonly inserted = new Map<string, { bytes: Uint8Array; pdf: PDFDocumentProxy; password?: string }>();
	/** Subjects of comments and replies (their ids); as read from the file (`fileSubjects`), to see what changed */
	subjects = $state.raw<ReadonlyMap<string, string>>(new Map());
	private readonly fileSubjects = new Map<string, string>();
	/** Review states per comment or reply (their ids), oldest first; those of the file keep their refs */
	states = $state.raw<ReadonlyMap<string, readonly StateEntry[]>>(new Map());
	private readonly fileStates = new Set<string>();
	/** The form's fields (the file's own; read after opening) and their values now; as read (`fileValues`), to see
	 * what changed */
	fields = $state.raw<readonly FormField[]>([]);
	values = $state.raw<ReadonlyMap<string, FieldValue>>(new Map());
	private readonly fileValues = new Map<string, FieldValue>();
	/** The form's fonts (`/DR` name → font name), for typing in a like font */
	fieldFonts = $state.raw<ReadonlyMap<string, string>>(new Map());
	/** The text the form's scripts show for a value (a number format), by field name; none: the value itself */
	private formatted = new Map<string, string | null>();
	/** The form's own scripts (only for PDFs with scripts), and edits waiting for them, one after the other */
	private scripts: FormScripts | null = null;
	private scripting: Promise<unknown> = Promise.resolve();
	private destroyed = false;
	/** A message of a form script (`app.alert`): shown as a toast */
	onScriptMessage: ((text: string) => void) | null = null;
	/** PDF.js's save of the filled-in form for the values it was made with */
	private filled: { key: string; bytes: Promise<Uint8Array> } | null = null;

	// --- Changes and saving ---
	editable = $state<Editable>('checking');
	/** The file carries signatures (changes are appended after them) */
	signed = $state(false);
	canUndo = $state(false);
	canRedo = $state(false);
	saving = $state(false);
	dirty = $state(false);
	saveError = $state<string | null>(null);
	/** Another version was saved elsewhere (saving paused) or the file is gone (saving creates it again) */
	conflict = $state<'changed' | 'deleted' | null>(null);
	private readonly history = new History();
	private writer: Promise<IncrementalPdf> | null = null;
	/** Backgrounds the file's pages have in the file (page number → color); the pages are shown from a version
	 * without them once one changes (`contentBytes`), so the color of now shows */
	private readonly fileBackgrounds = new Map<number, string>();
	private backgroundsShown = true;
	/** New sizes of pages for the next save (place → box and content matrix; `resizePages`) */
	private resizes = new Map<number, { width: number; height: number; matrix: Matrix }>();
	private stamp: Stamp | null;
	private version = 0;
	/** Tells this version of the file from any other (of its bytes as opened or last saved; `''` until known) –
	 * a presentation's display and its controls compare it */
	fingerprint = $state('');
	private saveTimer: ReturnType<typeof setTimeout> | undefined;
	private saveAgain = false;
	/** Ends with the running save */
	private saved: Promise<void> = Promise.resolve();
	/** The page is letting the document go (`leave`) */
	private leaving = false;

	private constructor(
		path: string,
		readonly pdf: PDFDocumentProxy,
		pages: PdfPage[],
		/** The file as opened (never changed: updates are appended to it) */
		private readonly base: Uint8Array,
		stamp: Stamp,
		/** The password that opened it ('' for none): everything that reads the file again needs it */
		readonly password = ''
	) {
		this.path = path;
		this.pages = pages;
		this.latest = base;
		this.stamp = stamp;
		this.shown = pdf;
		const doc = this;
		this.items = new ItemEditor<PdfItem>(
			{
				get pages() {
					return doc.pages;
				},
				scene: (id) => doc.scene(id),
				push: (step) => doc.pushStep(step),
				touch: () => doc.markChanged(),
				committed: (id, scene, item) => doc.listener?.stroke(id, scene, item),
				region: (id, box) => doc.listener?.region(id, box)
			},
			pdfKit
		);
		this.renders = new PdfPages(
			async () => {
				throw new Error('the open document is used');
			},
			() => {
				this.rendered++;
				this.onrender?.();
			},
			{
				label: '[pdf-editor]',
				open: (doc) => (doc === MAIN ? Promise.resolve(pdf) : this.inserted.has(doc) ? Promise.resolve(this.inserted.get(doc)!.pdf) : null),
				layers: () => this.layerConfig,
				rotation: (doc, n) => this.pages.find((p) => sourceOf(p) === doc && p.number === n)?.rotate
			}
		);
		// A stamp's picture is decoded: the pages showing it are drawn again (thumbnails too)
		stampEvents.ready = (key) => {
			for (const page of this.pages)
				if (this.scenes.get(page.id)?.items.some((item) => isStamp(item) && item.image === key)) this.listener?.content(page.id);
			this.changes++;
		};
	}

	get name(): string {
		return basename(this.path);
	}

	/** Bytes of the file as last written (or opened) */
	get size(): number {
		return this.latest.length;
	}

	/** Reads and opens a PDF; throws `PdfError` when the file can't be read as one (`password` for one that needs it) */
	static async open(path: string, password = ''): Promise<PdfDocument> {
		const file = await read(path);
		const base = new Uint8Array(await file.arrayBuffer());
		// PDF.js may take the buffer to its worker: it gets a copy
		const pdf = await openPdf(base.slice(), password);
		if (!pdf.numPages) throw new PdfError('invalid');
		const pages: PdfPage[] = [];
		for (let n = 1; n <= pdf.numPages; n++) {
			const page = await pdf.getPage(n);
			const viewport = page.getViewport({ scale: 1 });
			pages.push({ id: `p${n}`, w: viewport.width, h: viewport.height, number: n, rotate: viewport.rotation, rev: 0, view: page.view });
		}
		const doc = new PdfDocument(path, pdf, pages, base, { size: file.size, modified: file.lastModified }, password);
		doc.fingerprint = await fingerprintOf(base);
		doc.check(await canWrite(path).catch(() => true));
		void doc.loadFields();
		const [outline, attachments, layers] = await Promise.all([pdf.getOutline().catch(() => null), pdf.getAttachments().catch(() => null), doc.layers().catch(() => null)]);
		// Shown as PDF.js reads them until the file is parsed for writing
		if (!doc.bookmarksRead) doc.showOutline((outline ?? []) as PdfJsOutline[]);
		doc.attachments = [...(attachments?.entries() ?? [])].map(([id, a]) => ({ id, name: a.filename, description: a.description }));
		doc.hasLayers = !!layers && [...layers].length > 0;
		return doc;
	}

	/** Parses the file for writing (in the background): encrypted or unreadable files are only shown */
	private check(writable: boolean) {
		this.writer = IncrementalPdf.open(this.base, this.password);
		this.writer.then(
			(writer) => {
				this.signed = writer.signed;
				const fine = !writer.locked && writer.pageCount === this.pages.length;
				// Only for reading where it lies: shown like an editable one (comments, steps, notes), never changed
				if (fine) this.takeAnnotations(writer);
				if (fine) this.takeBackgrounds(writer);
				if (fine) this.takePapers(writer);
				if (fine) this.takeBookmarks(writer);
				if (fine) void this.takeFonts(writer).catch((e) => console.warn('[pdf-editor] fonts of the PDF', e));
				this.protection = writer.protection;
				if (fine) {
					try {
						const facts = writer.info();
						this.facts = facts;
						this.fileInfo = this.info = { title: facts.title, author: facts.author, subject: facts.subject, keywords: facts.keywords };
					} catch (e) {
						console.warn('[pdf-editor] properties', e);
					}
				}
				this.editable = writer.locked ? 'encrypted' : !fine ? 'failed' : writable ? 'yes' : 'readonly';
			},
			(e) => {
				console.warn('[pdf-editor] not editable', e);
				this.editable = 'failed';
			}
		);
	}

	/** The bookmarks as PDF.js reads them: only shown (`dest`), with their style */
	private showOutline(outline: readonly PdfJsOutline[]) {
		let n = 0;
		const open = new Set<string>();
		const convert = (list: readonly PdfJsOutline[]): Bookmark[] =>
			list.map((o) => {
				const id = `o${++n}`;
				if ((o.count ?? 0) > 0) open.add(id);
				const color = o.color && o.color.length === 3 && [...o.color].some((c) => c > 0) ? hexOf([...o.color].map((c) => c / 255) as Rgb) : undefined;
				return {
					id,
					title: o.title,
					...(o.bold && { bold: true }),
					...(o.italic && { italic: true }),
					...(color && { color }),
					target: o.url ? { kind: 'file', ref: '', number: null, top: null, uri: o.url } : o.dest ? { kind: 'dest', dest: o.dest } : null,
					items: convert(o.items ?? [])
				};
			});
		this.bookmarks = convert(outline);
		this.bookmarksOpen = open;
	}

	/** The bookmarks as the file has them (once it is parsed for writing): changed from here on */
	private takeBookmarks(writer: IncrementalPdf) {
		let n = 0;
		const open = new Set<string>();
		const convert = (list: readonly FileBookmark[]): Bookmark[] =>
			list.map((b) => {
				const id = `b${++n}`;
				if (b.open) open.add(id);
				return {
					id,
					title: b.title,
					...(b.bold && { bold: true }),
					...(b.italic && { italic: true }),
					...(b.color && { color: hexOf(b.color) }),
					target: { kind: 'file', ref: b.ref, number: b.page === null ? null : b.page + 1, top: b.top, ...(b.uri && { uri: b.uri }) },
					items: convert(b.items)
				};
			});
		try {
			this.fileBookmarks = convert(writer.outline());
		} catch (e) {
			console.warn('[pdf-editor] bookmarks', e);
			return;
		}
		this.fileOpen = open;
		this.bookmarksRead = true;
		this.bookmarks = this.fileBookmarks;
		this.bookmarksOpen = open;
	}

	/** The document's properties (`info`, as changed; `fileInfo` as the file has them) and what it says about itself
	 * (`facts`), once the file is parsed for writing */
	info = $state.raw<DocumentInfo>({});
	private fileInfo: DocumentInfo = {};
	facts = $state.raw<DocumentFacts | null>(null);
	/** How the file is protected (once parsed): method, permissions, whether it needs a password to open */
	protection = $state.raw<IncrementalPdf['protection']>(null);

	/** Changes the properties (one undo step) */
	setInfo(next: DocumentInfo) {
		const before = this.info;
		const keys = ['title', 'author', 'subject', 'keywords'] as const;
		if (this.editable !== 'yes' || keys.every((k) => (next[k] ?? '') === (before[k] ?? ''))) return;
		const set = (info: DocumentInfo) => (this.info = info);
		set(next);
		this.pushStep({ undo: () => set(before), redo: () => set(next) });
	}

	/** The properties to write, when they differ from the file's (each changed one; '' takes it away) */
	private infoEdit(): DocumentInfo | undefined {
		const keys = ['title', 'author', 'subject', 'keywords'] as const;
		const changed = keys.filter((k) => (this.info[k] ?? '') !== (this.fileInfo[k] ?? ''));
		return changed.length ? Object.fromEntries(changed.map((k) => [k, this.info[k] ?? ''])) : undefined;
	}

	/**
	 * The file written anew by `make` from the PDF as it is now (saved first): protected, unprotected, sanitized. It is
	 * no step to undo – the editor reads the file again and offers to put back the bytes from before (returned).
	 */
	async rewrite(make: (writer: IncrementalPdf) => Promise<Uint8Array>): Promise<Uint8Array> {
		const before = await this.current();
		const writer = await IncrementalPdf.open(before, this.password);
		await this.restore(await make(writer));
		return before;
	}

	/** What the PDF as it is now holds that “Sanitize” can take out */
	async hiddenData() {
		return (await IncrementalPdf.open(await this.current(), this.password)).inspect();
	}

	/** The fonts the PDF brings that text boxes can use (registered as `pdf:<name>`; a subset says so in menus), and
	 * those that can't be, with the reason */
	documentFonts = $state.raw<(CustomFont | { label: string; reason: string })[]>([]);

	private async takeFonts(writer: IncrementalPdf) {
		const out: (CustomFont | { label: string; reason: string })[] = [];
		for (const p of writer.fonts()) {
			// The standard fonts are ours already; Type 1, Type 3 and bare CFF programs aren't fonts a browser takes
			if (p.kind === 'none') continue;
			const usable = p.bytes && (p.kind === 'truetype' || p.kind === 'opentype') ? await describeFont(p.bytes, p.name, 0) : null;
			const font = usable?.font;
			// fontkit throws on programs without a character map (common in subsets): such a font can't be used, the
			// others still can
			let characters = 0;
			try {
				characters = font ? ((font as { characterSet?: number[] }).characterSet?.length ?? 0) : 0;
			} catch {
				characters = 0;
			}
			if (!p.bytes || !font || !characters) {
				out.push({ label: p.name, reason: m.fonts.cannotUse });
				continue;
			}
			const id: CustomFont = `pdf:${p.name}`;
			const bytes = p.bytes;
			registerFamily(id, {
				label: p.name,
				faces: { regular: async () => bytes.slice().buffer },
				has: (_, codePoint) => {
					try {
						return font.hasGlyphForCodePoint(codePoint);
					} catch {
						return false;
					}
				},
				// A subset by its name, or by holding few characters (programs like pdf-lib don't mark theirs)
				...((p.subset || characters < 120) && { note: m.fonts.subset })
			});
			out.push(id);
		}
		this.documentFonts = out.sort((a, b) => (typeof a === 'string' ? customLabel(a) : a.label).localeCompare(typeof b === 'string' ? customLabel(b) : b.label));
	}

	/** The bookmarks can be changed: the file is parsed for writing and can be written */
	get canEditBookmarks(): boolean {
		return this.editable === 'yes' && this.bookmarksRead;
	}

	/** The last step that changed the bookmarks (a new one's name typed right after belongs to it) */
	private bookmarkStep: (Step & { after: readonly Bookmark[] }) | null = null;

	/** The bookmarks changed as one step to undo; `amend`: part of the step just before, if it changed them */
	changeBookmarks(next: readonly Bookmark[] | null, amend = false) {
		const before = this.bookmarks;
		if (this.editable !== 'yes' || !next || next === before) return;
		const set = (tree: readonly Bookmark[]) => (this.bookmarks = tree);
		set(next);
		const last = this.bookmarkStep;
		if (amend && last && this.history.last === last) {
			last.after = next;
			return this.markChanged();
		}
		const step = { after: next, undo: () => set(before), redo: () => set(step.after) };
		this.bookmarkStep = step;
		this.pushStep(step);
	}

	/** Opens or closes bookmarks (no step to undo – it is how they are shown; saved with the file where it can be) */
	setBookmarksOpen(open: ReadonlySet<string>) {
		this.bookmarksOpen = open;
		if (this.editable !== 'yes') return;
		this.version++;
		this.dirty = true;
		this.scheduleSave();
	}

	/** Where a bookmark leads now: the page's place and its height there (page points from the top); null: nowhere
	 * in this document */
	async bookmarkPlace(target: BookmarkTarget | null): Promise<{ index: number; y: number } | null> {
		if (!target) return null;
		if (target.kind === 'dest') return this.destination(target.dest);
		if (target.kind === 'page') {
			const index = this.pages.findIndex((p) => p.id === target.page);
			return index < 0 ? null : { index, y: target.y };
		}
		if (target.number === null) return null;
		const index = this.pages.findIndex((p) => isOwnPage(p) && p.number === target.number);
		if (index < 0) return null;
		const page = this.pages[index];
		if (target.top === null) return { index, y: 0 };
		const [, y] = toShown(pageTransform(page.view, page.rotate))(page.view[0], target.top);
		return { index, y: Math.max(0, y) };
	}

	/** Does a bookmark lead somewhere in this document as it is now (a web address counts too)? */
	leadsSomewhere(target: BookmarkTarget | null): boolean {
		if (!target) return false;
		if (target.kind === 'dest') return true;
		if (target.kind === 'page') return this.pages.some((p) => p.id === target.page);
		return !!target.uri || (target.number !== null && this.pages.some((p) => isOwnPage(p) && p.number === target.number));
	}

	/** The bookmarks to write, when they differ from the file's: as changed, or the file's left without targets on
	 * deleted pages; open ones as shown */
	private outlineEdit(): NewBookmark[] | undefined {
		const sameOpen = this.bookmarksOpen.size === this.fileOpen.size && [...this.fileOpen].every((id) => this.bookmarksOpen.has(id));
		const deleted = this.fileBookmarks.length > 0 && [...walk(this.fileBookmarks)].some(({ bookmark: b }) => b.target?.kind === 'file' && b.target.number !== null && !this.leadsSomewhere(b.target));
		if (this.bookmarks === this.fileBookmarks && sameOpen && !deleted) return undefined;
		const convert = (list: readonly Bookmark[]): NewBookmark[] =>
			list.map((b) => {
				const t = b.target;
				let target: NewBookmark['target'] = null;
				if (t?.kind === 'file' && t.ref) target = { keep: t.ref };
				else if (t?.kind === 'page') {
					const index = this.pages.findIndex((p) => p.id === t.page);
					const page = this.pages[index];
					if (page) target = { page: index, top: Math.round(toUserSpace(pageTransform(page.view, page.rotate))(0, t.y)[1] * 100) / 100 };
				}
				return {
					title: b.title,
					...(b.bold && { bold: true }),
					...(b.italic && { italic: true }),
					...(b.color && { color: rgbOf(b.color) }),
					open: this.bookmarksOpen.has(b.id),
					target,
					items: convert(b.items)
				};
			});
		return convert(this.bookmarks);
	}

	/** The colors the file's pages lie on (written by us, `PdfEdits.background`) */
	/** The papers the file's pages were made with (a duplicate has its original's) */
	private takePapers(writer: IncrementalPdf) {
		const paperOf = (page: PdfPage) => (page.number && !page.source ? writer.paper(page.number - 1) : null);
		if (!this.pages.some(paperOf)) return;
		this.pages = this.pages.map((page) => {
			const paper = paperOf(page);
			return paper ? { ...page, paper } : page;
		});
	}

	private takeBackgrounds(writer: IncrementalPdf) {
		this.pages.forEach((page, i) => {
			const color = writer.background(i);
			if (color) this.fileBackgrounds.set(page.number, hexOf(color));
		});
		if (!this.fileBackgrounds.size) return;
		this.pages = this.pages.map((page) => (this.fileBackgrounds.has(page.number) && isOwnPage(page) ? { ...page, background: this.fileBackgrounds.get(page.number) } : page));
		this.changes++;
	}

	/**
	 * Makes the file's annotations items of the pages (those the editor draws itself): PDF.js stops drawing them,
	 * the pages' scenes show them, and saving writes them anew only when they changed.
	 */
	private takeAnnotations(writer: IncrementalPdf) {
		const used = new Set<string>();
		const unique = (wanted: string | undefined) => {
			let id = wanted && !used.has(wanted) ? wanted : crypto.randomUUID();
			while (used.has(id)) id = crypto.randomUUID();
			used.add(id);
			return id;
		};
		this.pages.forEach((page, i) => {
			const found = writer.annotations(i);
			if (!found.length) return;
			const toPage = toShown(pageTransform(page.view, page.rotate));
			const items: PdfItem[] = [];
			for (const a of found) {
				// The page's speaker notes: no item
				if (isNotesAnnotation(a)) {
					this.fileNotes.set(page.id, { ref: a.ref, text: a.contents ?? '' });
					continue;
				}
				// Other hidden data of a tool stays the file's
				if (a.hidden) continue;
				// A link names its page by its place in the file: here by the page's id
				const made = itemsOf(a, toPage, page.rotate, unique).map((item) => (isLink(item) && item.page !== undefined ? { ...item, page: this.pages[Number(item.page)]?.id } : item));
				if (!made.length) continue;
				this.fromFile.set(
					a.ref,
					made.map((item) => item.id)
				);
				for (const item of made) {
					if (isStamp(item) && item.image && a.image) registerStampImage(item.image, a.image);
					if (isNote(item) && item.file && a.file) attachedFiles.set(item.file.key, a.file.bytes);
					this.origin.set(item.id, a.ref);
					if (a.grouped) this.parts.set(a.ref, a.grouped.map((part) => part.ref));
					this.loaded.set(item.id, item);
					this.meta.set(item.id, { author: a.author ?? '', modified: parsePdfDate(a.modified) });
					if (a.subject) this.fileSubjects.set(item.id, a.subject);
					items.push(item);
				}
				this.store(a.id, { noView: true });
			}
			if (!items.length) return;
			this.scenes.set(page.id, new PageScene(pdfKit, [...items, ...(this.scenes.get(page.id)?.items ?? [])]));
			this.renders.forget(MAIN, page.number);
			this.listener?.content(page.id);
		});
		this.pages = this.pages.map((p) => (this.scenes.get(p.id)?.items.length ? { ...p, rev: p.rev + 1 } : p));
		// Replies to what became items (to others they stay the file's)
		const replies = new Map<string, Reply[]>();
		/** Reply refs → their ids (states may be set on them) */
		const replyIds = new Map<string, string>();
		this.pages.forEach((_, i) => {
			for (const r of writer.replies(i)) {
				const parent = this.fromFile.get(r.parent)?.[0];
				if (!parent) continue;
				this.fileReplies.add(r.ref);
				const id = r.name || r.ref;
				replyIds.set(r.ref, id);
				if (r.subject) this.fileSubjects.set(id, r.subject);
				const list = replies.get(parent) ?? [];
				list.push({ id, author: r.author ?? '', text: r.contents ?? '', modified: parsePdfDate(r.modified), ref: r.ref });
				replies.set(parent, list);
			}
		});
		const byDate = (a: { modified: Date | null }, b: { modified: Date | null }) => (a.modified?.getTime() ?? 0) - (b.modified?.getTime() ?? 0);
		for (const list of replies.values()) list.sort(byDate);
		this.replies = replies;
		// Review states of what is shown (states of others stay the file's)
		const states = new Map<string, StateEntry[]>();
		this.pages.forEach((_, i) => {
			for (const s of writer.states(i)) {
				const target = this.fromFile.get(s.parent)?.[0] ?? replyIds.get(s.parent);
				if (!target) continue;
				this.fileStates.add(s.ref);
				const list = states.get(target) ?? [];
				list.push({ id: s.name || s.ref, state: s.state, author: s.author ?? '', modified: parsePdfDate(s.modified), ref: s.ref });
				states.set(target, list);
			}
		});
		for (const list of states.values()) list.sort(byDate);
		this.states = states;
		this.subjects = new Map(this.fileSubjects);
		this.notes = new Map([...this.fileNotes].map(([id, n]) => [id, n.text]));
		this.changes++;
	}

	/** Reads the form's fields (none without a form) */
	private async loadFields() {
		const fields = await readFields(this.pdf).catch((e: unknown) => {
			console.warn('[pdf-editor] form fields', e);
			return [];
		});
		for (const f of fields) this.fileValues.set(f.name, f.value);
		if (fields.length) this.fieldFonts = await formFonts(this.base, this.password).catch(() => new Map());
		this.fields = fields;
		this.values = new Map(this.fileValues);
		if (fields.length) {
			// Calculations, formats and checks of the form run in a sandbox of their own (PDFs with scripts only)
			this.scripts = await startScripts(this.pdf, {
				language: navigator.language,
				onAlert: (text) => this.onScriptMessage?.(text),
				onChange: (changes) => this.takeScripted(changes)
			}).catch((e: unknown) => {
				console.warn('[pdf-editor] form scripts', e);
				return null;
			});
			if (this.destroyed) this.scripts?.destroy();
			else this.scripts?.pageOpen(1);
		}
	}

	/** Does the page show a widget's value now (not the page as it was before a field changed)? */
	shows(widget: FormWidget): boolean {
		return !this.renders.refreshing(MAIN, widget.page + 1);
	}

	/** Where a field's widget is now (page index; -1: its page was deleted) */
	placeOf(widget: FormWidget): number {
		return this.pages.findIndex((p) => isOwnPage(p) && p.number === widget.page + 1);
	}

	/**
	 * Fills in a field (one step to undo). With form scripts, what they calculate and format belongs to the same step;
	 * `how`: the widget typed into and how the input was left (1 leaving it, 2 Enter, 3 Tab – `commitKey`).
	 */
	setField(name: string, value: FieldValue, how?: { widget: string; commitKey: number }) {
		const field = this.fields.find((f) => f.name === name);
		const before = this.values.get(name);
		if (!field || before === undefined || sameValue(before, value) || this.editable !== 'yes' || field.readOnly) return;
		if (this.scripts) return void this.fillScripted(new Map([[name, value]]), how);
		this.applyFields(new Map([[name, value]]));
		this.pushStep({ undo: () => this.applyFields(new Map([[name, before]])), redo: () => this.applyFields(new Map([[name, value]])) });
	}

	/** Empties every field that can be filled in (one step to undo) */
	clearForm() {
		if (this.editable !== 'yes') return;
		const empty = (f: FormField): FieldValue => (f.kind === 'list' ? [] : f.kind === 'checkbox' || f.kind === 'radio' ? 'Off' : '');
		const before = new Map<string, FieldValue>();
		const after = new Map<string, FieldValue>();
		for (const f of this.fields) {
			const now = this.values.get(f.name);
			if (f.readOnly || !FILLABLE.has(f.kind) || now === undefined || sameValue(now, empty(f))) continue;
			before.set(f.name, now);
			after.set(f.name, empty(f));
		}
		if (!after.size) return;
		if (this.scripts) return void this.fillScripted(after);
		this.applyFields(after);
		this.pushStep({ undo: () => this.applyFields(before), redo: () => this.applyFields(after) });
	}

	/**
	 * Fills in fields of a form with scripts: shown at once, then each input goes to the scripts (their checks may
	 * turn it down – it goes back –, calculated fields and formats follow); all of it is one step to undo. Undoing and
	 * redoing tell the scripts the inputs again, so they calculate from what the fields hold.
	 */
	private fillScripted(inputs: ReadonlyMap<string, FieldValue>, how?: { widget: string; commitKey: number }) {
		const run = async () => {
			const before = new Map([...inputs.keys()].map((n) => [n, this.values.get(n)!]));
			const beforeShown = new Map([...inputs.keys()].map((n) => [n, this.formatted.get(n) ?? null]));
			this.applyFields(inputs, new Map([...inputs.keys()].map((n) => [n, null])));
			const changes: ScriptChange[] = [];
			for (const [name, value] of inputs) changes.push(...(await this.tellScripts(name, value, how)));
			const after = new Map(inputs);
			const shown = new Map<string, string | null>();
			for (const c of changes) {
				const field = this.fields.find((f) => f.name === c.field);
				if (!field) continue;
				if (!before.has(c.field)) {
					before.set(c.field, this.values.get(c.field)!);
					beforeShown.set(c.field, this.formatted.get(c.field) ?? null);
				}
				if ('value' in c) {
					const value = valueOf(field, c, after.get(c.field) ?? this.values.get(c.field)!);
					// An input the scripts turned down (they empty it): what was there before stays
					const input = inputs.get(c.field);
					if (input !== undefined && value === '' && input !== '') {
						after.set(c.field, before.get(c.field)!);
						shown.set(c.field, beforeShown.get(c.field) ?? null);
						continue;
					}
					after.set(c.field, value);
				}
				if ('formattedValue' in c) shown.set(c.field, c.formattedValue ?? null);
			}
			this.applyFields(after, shown);
			const afterShown = new Map([...after.keys()].map((n) => [n, this.formatted.get(n) ?? null]));
			if ([...after].every(([n, v]) => sameValue(v, before.get(n)!))) return;
			const retell = async () => {
				for (const name of inputs.keys()) this.takeScripted(await this.tellScripts(name, this.values.get(name)!));
			};
			this.pushStep({
				undo: () => {
					this.applyFields(before, beforeShown);
					this.scripting = this.scripting.then(retell);
				},
				redo: () => {
					this.applyFields(after, afterShown);
					this.scripting = this.scripting.then(retell);
				}
			});
		};
		this.scripting = this.scripting.then(run).catch((e: unknown) => console.warn('[pdf-editor] form scripts', e));
	}

	/** Tells the scripts a field's new value, as PDF.js's form layer does; gives what they changed */
	private async tellScripts(name: string, value: FieldValue, how?: { widget: string; commitKey: number }): Promise<ScriptChange[]> {
		const field = this.fields.find((f) => f.name === name);
		if (!this.scripts || !field?.widgets.length) return [];
		const widget = how?.widget ?? field.widgets[0].id;
		const events: SandboxEvent[] = [];
		if (field.kind === 'checkbox' || field.kind === 'radio') {
			const on = field.widgets.find((w) => w.on === value);
			const id = on?.id ?? widget;
			events.push({ id, name: 'Validate', value: !!on }, { id, name: 'Action', value: !!on });
		} else {
			const text = typeof value === 'string' ? value : (value[0] ?? '');
			events.push({ id: widget, name: 'Keystroke', value: text, change: '', changeEx: text, willCommit: true, commitKey: how?.commitKey ?? 1, selStart: -1, selEnd: -1 });
		}
		const changes: ScriptChange[] = [];
		for (const event of events) changes.push(...((await this.scripts.dispatch(event)) ?? []));
		return changes;
	}

	/** What the scripts changed by themselves (timers, retelling after undo): shown, not a step of its own */
	private takeScripted(changes: readonly ScriptChange[]) {
		const values = new Map<string, FieldValue>();
		const shown = new Map<string, string | null>();
		for (const c of changes) {
			const field = this.fields.find((f) => f.name === c.field);
			if (!field) continue;
			if ('value' in c) values.set(c.field, valueOf(field, c, values.get(c.field) ?? this.values.get(c.field)!));
			if ('formattedValue' in c) shown.set(c.field, c.formattedValue ?? null);
		}
		for (const name of shown.keys()) if (!values.has(name)) values.set(name, this.values.get(name)!);
		if (values.size) this.applyFields(values, shown);
	}

	/** Takes values (and the text form scripts show for them): PDF.js draws the widgets with them (its storage), their
	 * pages are drawn again */
	private applyFields(values: ReadonlyMap<string, FieldValue>, shown: ReadonlyMap<string, string | null> = new Map()) {
		const next = new Map(this.values);
		const numbers = new Set<number>();
		for (const [name, s] of shown) this.formatted.set(name, s);
		for (const [name, value] of values) {
			const field = this.fields.find((f) => f.name === name);
			if (!field) continue;
			next.set(name, value);
			for (const w of field.widgets) {
				this.store(w.id, storageValue(field, w, value, this.formatted.get(name)));
				numbers.add(w.page + 1);
			}
		}
		this.values = next;
		for (const n of numbers) this.renders.refresh(MAIN, n);
		for (const p of this.pages) if (!p.source && numbers.has(p.number)) this.listener?.backdrop?.(p.id);
		this.changes++;
	}

	/**
	 * The file as PDF.js saves it with the fields that differ from the file's (`PdfEdits.form`: written in the form's
	 * own font, as the pages show them); none when every field is as in the file. Kept while the values stay.
	 */
	private async form(): Promise<Uint8Array | undefined> {
		const values = new Map<string, ReturnType<typeof storageValue>>();
		for (const field of this.fields) {
			const value = this.values.get(field.name);
			const was = this.fileValues.get(field.name);
			if (value === undefined || was === undefined || sameValue(value, was)) continue;
			for (const w of field.widgets) values.set(w.id, storageValue(field, w, value, this.formatted.get(field.name)));
		}
		if (!values.size) return undefined;
		const key = JSON.stringify([...values]);
		if (this.filled?.key !== key) {
			const filled = { key, bytes: filledForm(this.base, values, this.password) };
			// A failed save is tried anew next time
			filled.bytes.catch(() => this.filled === filled && (this.filled = null));
			this.filled = filled;
		}
		return this.filled.bytes;
	}

	/** Who wrote a comment and when (a new one: the author's name, the time it was first saved) */
	infoOf(id: string): CommentInfo {
		return this.meta.get(id) ?? { author: authorName(), modified: this.dates.get(id) ?? null };
	}

	/** Answers a comment (one step to undo) */
	addReply(parent: string, text: string) {
		const body = text.trim();
		if (!body || this.editable !== 'yes') return;
		const reply: Reply = { id: crypto.randomUUID(), author: authorName(), text: body, modified: new Date() };
		const add = () => this.setReplies(parent, [...(this.replies.get(parent) ?? []), reply]);
		const take = () => this.setReplies(parent, (this.replies.get(parent) ?? []).filter((r) => r !== reply));
		add();
		this.pushStep({ undo: take, redo: add });
	}

	/** Deletes a reply (one step to undo) */
	removeReply(parent: string, id: string) {
		const before = this.replies.get(parent) ?? [];
		const after = before.filter((r) => r.id !== id);
		if (after.length === before.length) return;
		this.setReplies(parent, after);
		this.pushStep({ undo: () => this.setReplies(parent, before), redo: () => this.setReplies(parent, after) });
	}

	/** The subject of a comment or reply (one step to undo; empty: none – a comment then shows its kind) */
	setSubject(id: string, text: string) {
		const subject = text.trim();
		const before = this.subjects.get(id) ?? '';
		if (subject === before || this.editable !== 'yes') return;
		const set = (value: string) => {
			const next = new Map(this.subjects);
			if (value) next.set(id, value);
			else next.delete(id);
			this.subjects = next;
		};
		set(subject);
		this.pushStep({ undo: () => set(before), redo: () => set(subject) });
	}

	/** The review state of a comment or reply (the newest set) */
	stateOf(id: string): StateEntry | null {
		return this.states.get(id)?.at(-1) ?? null;
	}

	/** Sets the review state of a comment or reply (one step to undo; kept as a history) */
	setState(id: string, state: ReviewState) {
		if (this.editable !== 'yes' || (this.stateOf(id)?.state ?? 'None') === state) return;
		const entry: StateEntry = { id: crypto.randomUUID(), state, author: authorName(), modified: new Date() };
		const set = (list: readonly StateEntry[]) => {
			const next = new Map(this.states);
			if (list.length) next.set(id, list);
			else next.delete(id);
			this.states = next;
		};
		const before = this.states.get(id) ?? [];
		const after = [...before, entry];
		set(after);
		this.pushStep({ undo: () => set(before), redo: () => set(after) });
	}

	private setReplies(parent: string, list: readonly Reply[]) {
		const next = new Map(this.replies);
		if (list.length) next.set(parent, list);
		else next.delete(parent);
		this.replies = next;
	}

	/** Turns pages (ids) by `by` degrees clockwise – one step to undo; what is drawn on them turns along */
	rotate(pages: string[], by: number) {
		if (this.editable !== 'yes' || !pages.length) return;
		// A page and its duplicates are one render: they turn together
		const chosen = this.pages.filter((p) => pages.includes(p.id));
		pages = this.pages.filter((p) => pages.includes(p.id) || (!!p.number && chosen.some((c) => c.number === p.number && sourceOf(c) === sourceOf(p)))).map((p) => p.id);
		const op: Op = { kind: 'rotate', pages, by };
		this.turn(op);
		this.pushStep({ undo: () => this.turn(invert(op)), redo: () => this.turn(op) });
	}

	/** Puts a color under the content of pages (ids; null: none, white paper) – one step to undo */
	setBackground(pages: readonly string[], color: string | null) {
		if (this.editable !== 'yes') return;
		const background = color ? color.slice(0, 7).toLowerCase() : undefined;
		this.arrange(this.pages.map((p) => (pages.includes(p.id) && p.background !== background ? { ...p, background, rev: p.rev + 1 } : p)));
		// The file's own backgrounds would lie over the new color: shown without them from now on
		if (this.fileBackgrounds.size && this.backgroundsShown) {
			this.backgroundsShown = false;
			void this.showContent([...this.fileBackgrounds.keys()]);
		}
	}

	/**
	 * Gives pages (ids) another size, for the next save: their content and comments are scaled and placed as `to`
	 * says. Not a step to undo – it changes where everything of the file lies, so the caller saves and opens the
	 * file anew (and keeps the file as it was for taking it back). Only on a document whose pages are all the
	 * file's own or blank, and once. False when nothing was changed.
	 */
	resizePages(pages: readonly string[], to: PageResize): boolean {
		if (this.editable !== 'yes' || this.resizes.size || this.pages.some((p) => p.source || p.copy)) return false;
		let any = false;
		this.pages = this.pages.map((page, i) => {
			if (!pages.includes(page.id) || (Math.abs(page.w - to.w) < 0.01 && Math.abs(page.h - to.h) < 0.01)) return page;
			any = true;
			const { scale, dx, dy } = resizePlace(page.w, page.h, to);
			const quarter = page.rotate % 180 !== 0;
			const view = [0, 0, quarter ? to.h : to.w, quarter ? to.w : to.h];
			if (page.number) {
				// Where the old user space's origin lands in the new one (the same turn: a scale and a shift)
				const [sx, sy] = toShown(pageTransform(page.view, page.rotate))(0, 0);
				const [e, f] = toUserSpace(pageTransform(view, page.rotate))(sx * scale + dx, sy * scale + dy);
				this.resizes.set(i, { width: view[2], height: view[3], matrix: [scale, 0, 0, scale, e, f] });
			}
			const scene = this.scenes.get(page.id);
			if (scene?.items.length) {
				this.scenes.set(page.id, new PageScene(pdfKit, scene.items.map((item) => pdfKit.transform(item, { dx, dy, scale, ox: 0, oy: 0, scaleText: true }))));
				this.listener?.content(page.id);
			}
			return { ...page, w: to.w, h: to.h, view, rev: page.rev + 1 };
		});
		if (any) this.markChanged();
		return any;
	}

	/** Puts the file back as it was (`bytes`, e.g. before pages were resized); the caller opens it anew */
	async restore(bytes: Uint8Array) {
		clearTimeout(this.saveTimer);
		this.dirty = false;
		// Our own write, like a save: `filesChanged` must not take it for a version saved elsewhere before the stamp
		// is the new one (it asked “changed elsewhere” – that happened)
		this.saving = true;
		try {
			await write(this.path, new Blob([bytes as Uint8Array<ArrayBuffer>]));
			this.latest = bytes;
			this.fingerprint = await fingerprintOf(bytes);
			const after = await stat(this.path);
			this.stamp = after && stampOf(after);
		} finally {
			this.saving = false;
		}
	}

	/** Moves pages (ids, in their order) before the page now at `to` (`pages.length`: to the end) – one step to undo */
	movePages(ids: ReadonlySet<string>, to: number) {
		this.arrange(movePages(this.pages, ids, to));
	}

	/** Deletes pages (ids) with what is drawn on them – one step to undo; the last page stays */
	deletePages(ids: ReadonlySet<string>) {
		const left = this.pages.filter((p) => !ids.has(p.id));
		if (left.length) this.arrange(left);
	}

	/**
	 * Duplicates pages (ids): each copy right after its page, with what is drawn on it (new ids, same steps) and
	 * its speaker notes – one step to undo; the copies' ids. A page of a PDF is a copy of it (`PdfPage.copy`), a
	 * blank one another blank one.
	 */
	duplicatePages(ids: ReadonlySet<string>): string[] {
		if (this.editable !== 'yes') return [];
		const next: PdfPage[] = [];
		const made: string[] = [];
		for (const page of this.pages) {
			next.push(page);
			if (!ids.has(page.id)) continue;
			const copy: PdfPage = { ...page, id: crypto.randomUUID(), ...(page.number ? { copy: true as const } : {}) };
			const items = this.scenes.get(page.id)?.items.map((item) => ({ ...item, id: crypto.randomUUID() }));
			if (items?.length) this.scenes.set(copy.id, new PageScene(pdfKit, items));
			const notes = this.notes.get(page.id);
			if (notes) this.notes = new Map(this.notes).set(copy.id, notes);
			next.push(copy);
			made.push(copy.id);
		}
		this.arrange(next);
		return made;
	}

	/** Sets a page's speaker notes (one step to undo; empty: none) */
	setNotes(pageId: string, text: string) {
		const before = this.notes.get(pageId) ?? '';
		const after = text.replace(/\s+$/, '');
		if (after === before || this.editable !== 'yes') return;
		const set = (value: string) => {
			const next = new Map(this.notes);
			if (value) next.set(pageId, value);
			else next.delete(pageId);
			this.notes = next;
		};
		set(after);
		this.pushStep({ undo: () => set(before), redo: () => set(after) });
	}

	/** Shows or hides items from a step of their page on, each until its next change (one step to undo;
	 * `render/steps.ts`) */
	setVisibility(index: number, ids: ReadonlySet<string>, step: number, visible: boolean) {
		if (this.editable !== 'yes') return;
		this.items.change(index, ids, (item) => {
			const next = withVisibility(item, step, visible);
			return next === item ? null : next;
		});
	}

	/** Puts the steps of a page in another order (`withSteps`) for all of its items – one step to undo */
	private reorderSteps(index: number, order: readonly number[]) {
		if (this.editable !== 'yes') return;
		const items = this.scenes.get(this.pages[index]?.id ?? '')?.items ?? [];
		this.items.change(index, new Set(items.map((item) => item.id)), (item) => {
			const next = withSteps(item, order);
			return next === item ? null : next;
		});
	}

	/** Deletes step `step` (1 …) of a page of `steps` steps: what came or went there does so a step earlier, the later
	 * steps move up. `steps` may count steps after the last change (the editor's, `EditorState.stepsOf`) */
	removeStep(index: number, step: number, steps = this.stepsOf(this.pages[index]?.id ?? '')) {
		this.reorderSteps(index, stepsWithout(steps, step));
	}

	/** A step before step `step` (1 …) of a page, showing the same as the one before it; the later ones move on */
	insertStep(index: number, step: number, steps = this.stepsOf(this.pages[index]?.id ?? '')) {
		if (steps < MAX_STEP) this.reorderSteps(index, stepsWithOneBefore(steps, step));
	}

	/** Step `from` of a page at the place `to` (both 1 …) */
	moveStep(index: number, from: number, to: number, steps = this.stepsOf(this.pages[index]?.id ?? '')) {
		this.reorderSteps(index, stepsMoved(steps, from, to));
	}

	/** How many “Next” each page takes when presented (the last step at which one of its items comes or goes) */
	stepsOf(pageId: string): number {
		return stepsOf(this.scenes.get(pageId)?.items ?? []);
	}

	/** Shows or hides the marks of the steps on the pages (the pages holding steps are drawn again) */
	showSteps(shown: boolean) {
		if (stepView.shown === shown) return;
		stepView.shown = shown;
		for (const page of this.pages) if (this.scenes.get(page.id)?.items.some((item) => flipsOf(item).length > 0)) this.listener?.content(page.id);
		this.changes++;
	}

	/** Inserts a blank page at `at` in the size of the page before it (or after it, at the start) – one step to undo;
	 * its id */
	insertBlank(at: number): string | null {
		const like = this.pages[at - 1] ?? this.pages[at];
		if (!like) return null;
		// Upright, as big as the neighbour looks
		const page: PdfPage = { id: crypto.randomUUID(), number: 0, w: like.w, h: like.h, rotate: 0, rev: 0, view: [0, 0, like.w, like.h] };
		const next = [...this.pages];
		next.splice(at, 0, page);
		this.arrange(next);
		return page.id;
	}

	/**
	 * Inserts all pages of another PDF at `at` (`paper`: they are pages of `paperPdf` with that paper) – one step to
	 * undo; throws `PdfError` when it can't be read (or is
	 * protected: its pages couldn't be copied)
	 */
	async insertPdf(at: number, bytes: Uint8Array, password = '', paper?: Paper): Promise<void> {
		if (this.editable !== 'yes') return;
		// Protection without a password is taken off (`loadPdf`); one with a password needs it
		const check = await loadPdf(bytes, false, password).catch((e: unknown) => {
			throw new PdfError('invalid', e);
		});
		if (check.locked) throw new PdfError('password', undefined, !!password);
		const pdf = await openPdf(bytes.slice(), password);
		if (!pdf.numPages) throw new PdfError('invalid');
		const key = crypto.randomUUID();
		this.inserted.set(key, { bytes, pdf, password });
		const pages: PdfPage[] = [];
		for (let n = 1; n <= pdf.numPages; n++) {
			const page = await pdf.getPage(n);
			const viewport = page.getViewport({ scale: 1 });
			pages.push({ id: crypto.randomUUID(), source: key, w: viewport.width, h: viewport.height, number: n, rotate: viewport.rotation, rev: 0, view: page.view, ...(paper ? { paper } : {}) });
		}
		const next = [...this.pages];
		next.splice(at, 0, ...pages);
		this.arrange(next);
	}

	/** The PDF as it is now, saved first; throws when it can't be saved (saving paused, failed) */
	async current(): Promise<Uint8Array> {
		if (this.dirty) await this.save();
		if (this.dirty) throw new Error(this.saveError ?? 'not saved');
		return this.latest;
	}

	/** A new PDF of some of its pages (places, in this order) – with everything drawn on them, outline and form kept as
	 * far as they concern these pages (PDF.js's `extractPages`) */
	async extract(places: number[]): Promise<Uint8Array> {
		const current = await this.current();
		const pdf = await openPdf(current.slice(), this.password);
		try {
			return await this.protectedLikeThis(current, await pdf.extractPages([{ document: null, includePages: places }]));
		} finally {
			await pdf.loadingTask.destroy();
		}
	}

	/** A new PDF made of this one: made by the suite, by this file's author (else the user's name from the settings),
	 * and protected as this one is (a protected file must not give its pages away unprotected) */
	private async protectedLikeThis(current: Uint8Array, made: Uint8Array): Promise<Uint8Array> {
		const author = this.info?.author || authorName() || undefined;
		const stamped = await (await IncrementalPdf.open(made)).update({ created: true, info: { author } });
		if (!this.protection) return stamped;
		return (await IncrementalPdf.open(current, this.password)).protectLike(stamped);
	}

	/** Another PDF's bytes as PDF.js can merge them: one protected by a password opened with it (`password`) and
	 * written without the protection – the merged file gets this one's */
	static async unlocked(bytes: Uint8Array, password: string): Promise<Uint8Array> {
		const opened = await IncrementalPdf.open(bytes, password);
		if (opened.locked) throw new PdfError('password', undefined, !!password);
		return opened.needsPassword ? opened.protect(null) : bytes;
	}

	/** A new PDF of this one followed by others (bytes) */
	async merged(others: Uint8Array[]): Promise<Uint8Array> {
		const current = await this.current();
		const pdf = await openPdf(current.slice(), this.password);
		try {
			return await this.protectedLikeThis(current, await pdf.extractPages([{ document: null }, ...others.map((document) => ({ document: document.slice() }))]));
		} finally {
			await pdf.loadingTask.destroy();
		}
	}

	/** The PDF.js document a page is shown from (null: a blank page): for the file's pages the one with the changes
	 * to their content (`shown`) */
	proxyOf(page: PdfPage): PDFDocumentProxy | null {
		if (!page.number) return null;
		return page.source ? (this.inserted.get(page.source)?.pdf ?? null) : this.shown;
	}

	// --- The pages' own content (objects: text pieces, images, paths, forms) ---

	/** Changes to objects of the file's pages: page number → object id → moved/scaled or taken out */
	private contentEdits: ReadonlyMap<number, ReadonlyMap<number, ContentChange>> = new Map();
	/** Drawings made part of the pages' content: page number → in drawing order */
	private contentAdds: ReadonlyMap<number, readonly ContentAdd[]> = new Map();
	private addKey = 0;
	/** The objects of the file's pages as the writer reads them (page number → objects; null: not readable) */
	private readonly contentRead = new Map<number, Promise<readonly ContentObject[] | null>>();
	private readonly contentKnown = new Map<number, readonly ContentObject[] | null>();
	/** The document the file's pages are shown from: the open one, or the file with the content changes */
	private shown: PDFDocumentProxy;
	private shownRun = 0;
	/** Raised when a page's content looks different (its text is read anew); per page number */
	private readonly contentRevs = new Map<number, number>();
	/** Raised with every change to the content (selections read their boxes anew) */
	contentChanges = $state(0);
	/** Raised when the pages show a change to their content (a picture dragged along can go) */
	contentShown = $state(0);

	/** Revision of a page's content (part of what its text layer and text are keyed by) */
	contentRev(page: PdfPage): number {
		return page.source || !page.number ? 0 : (this.contentRevs.get(page.number) ?? 0);
	}

	/** Reads the objects of a page's content (once); false: this page's content can't be edited */
	async loadContent(index: number): Promise<boolean> {
		const page = this.pages[index];
		if (!page || !isOwnPage(page) || this.editable !== 'yes' || !this.writer) return false;
		let read = this.contentRead.get(page.number);
		if (!read) {
			read = this.writer.then((writer) => writer.contentObjects(page.number - 1)).catch(() => null);
			this.contentRead.set(page.number, read);
			void read.then((objects) => {
				this.contentKnown.set(page.number, objects);
				this.contentChanges++;
			});
		}
		return !!(await read);
	}

	/** Can a page's content be edited? `unknown` until it was read, `none` for a page that isn't the file's or
	 * whose content can't be read safely */
	contentState(index: number): 'unknown' | 'ok' | 'none' {
		const page = this.pages[index];
		if (!page || !isOwnPage(page) || this.editable !== 'yes') return 'none';
		if (!this.contentKnown.has(page.number)) return 'unknown';
		return this.contentKnown.get(page.number) ? 'ok' : 'none';
	}

	/** The objects of a page's content as shown now, in drawing order (null: not read yet or not readable) */
	contentItems(index: number): ContentItem[] | null {
		const page = this.pages[index];
		const objects = page && isOwnPage(page) ? this.contentKnown.get(page.number) : null;
		if (!page || !objects) return null;
		const edits = this.contentEdits.get(page.number);
		const adds = this.contentAdds.get(page.number) ?? [];
		const shown = pageTransform(page.view, page.rotate);
		const out: ContentItem[] = [];
		const push = (id: number, kind: ContentKind, box: { x0: number; y0: number; x1: number; y1: number }, matrix: Matrix | undefined) => {
			const m = matrix ? mul(matrix, shown) : shown;
			const xs: number[] = [];
			const ys: number[] = [];
			for (const [x, y] of [[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1]]) {
				xs.push(x * m[0] + y * m[2] + m[4]);
				ys.push(x * m[1] + y * m[3] + m[5]);
			}
			out.push({ id, kind, box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } });
		};
		const added = (a: ContentAdd) => push(ADDED + a.key, a.at === undefined ? 'form' : 'image', { x0: a.annotation.rect[0], y0: a.annotation.rect[1], x1: a.annotation.rect[2], y1: a.annotation.rect[3] }, a.matrix);
		for (const object of objects) {
			// Something else stands in its place
			const instead = adds.find((a) => a.at === object.id);
			if (instead) {
				added(instead);
				continue;
			}
			const change = edits?.get(object.id);
			if (change && 'remove' in change) continue;
			push(object.id, object.kind, object.box, change?.matrix);
		}
		for (const a of adds) if (a.at === undefined) added(a);
		return out;
	}

	/** Moves or scales objects of a page's content by a transformation of the page as shown (one undo step) */
	transformContent(index: number, ids: Iterable<number>, shownChange: Matrix) {
		const page = this.pages[index];
		if (!page || !isOwnPage(page)) return;
		const shown = pageTransform(page.view, page.rotate);
		const back = inverse(shown);
		if (!back) return;
		// The same change in the page's own space
		const own = mul(mul(shown, shownChange), back);
		const picked = new Set(ids);
		const edits = new Map(this.contentEdits.get(page.number) ?? []);
		for (const id of picked) {
			if (id >= ADDED) continue;
			const old = edits.get(id);
			if (old && 'remove' in old) continue;
			edits.set(id, { matrix: old ? mul(old.matrix, own) : own });
		}
		const adds = (this.contentAdds.get(page.number) ?? []).map((a) => (picked.has(ADDED + a.key) ? { ...a, matrix: a.matrix ? mul(a.matrix, own) : own } : a));
		this.changeContent(page.number, edits, adds);
	}

	/** Takes objects out of a page's content (one undo step) */
	removeContent(index: number, ids: Iterable<number>) {
		const page = this.pages[index];
		if (!page || !isOwnPage(page)) return;
		const picked = new Set(ids);
		const edits = new Map(this.contentEdits.get(page.number) ?? []);
		for (const id of picked) if (id < ADDED) edits.set(id, { remove: true });
		const adds: ContentAdd[] = [];
		for (const a of this.contentAdds.get(page.number) ?? []) {
			if (!picked.has(ADDED + a.key)) adds.push(a);
			// What it stood for stays out
			else if (a.at !== undefined) edits.set(a.at, { remove: true });
		}
		this.changeContent(page.number, edits, adds);
	}

	/**
	 * A picture of some objects of a page's content alone, as they are now, on a see-through page (`scale`: pixels
	 * per point): shown moving while they are dragged. Null when it can't be made.
	 */
	async liftedContent(index: number, ids: ReadonlySet<number>, scale: number): Promise<HTMLCanvasElement | null> {
		const page = this.pages[index];
		const objects = page && isOwnPage(page) ? this.contentKnown.get(page.number) : null;
		const writer = await this.writer;
		if (!page || !objects || !writer) return null;
		try {
			// The page with nothing but these: every other object out, of the added ones only the picked
			const edits = new Map(this.contentEdits.get(page.number) ?? []);
			for (const object of objects) if (!ids.has(object.id)) edits.set(object.id, { remove: true });
			const adds = (this.contentAdds.get(page.number) ?? []).filter((a) => ids.has(ADDED + a.key)).map(({ annotation, matrix, at }) => ({ annotation, matrix, at }));
			const bytes = await writer.update({ content: new Map([[page.number - 1, edits]]), flatten: new Map([[page.number - 1, adds]]) });
			const pdf = await openPdf(bytes.slice(), this.password);
			try {
				const proxy = await pdf.getPage(page.number);
				// At most about 8 megapixels
				const fit = Math.min(scale, Math.sqrt(8_000_000 / Math.max(1, page.w * page.h)));
				const viewport = proxy.getViewport({ scale: fit, rotation: page.rotate });
				const canvas = document.createElement('canvas');
				canvas.width = Math.ceil(viewport.width);
				canvas.height = Math.ceil(viewport.height);
				// A see-through picture: PDF.js makes an opaque context for a canvas it is given, so it gets ours
				const context = canvas.getContext('2d');
				if (!context) return null;
				await proxy.render({ canvas: null, canvasContext: context, viewport, background: 'rgba(0,0,0,0)', annotationMode: 0 }).promise;
				return canvas;
			} finally {
				void pdf.loadingTask.destroy();
			}
		} catch (e) {
			console.warn('[pdf-editor] content preview', e);
			return null;
		}
	}

	/** Can a comment become part of the page (`flatten`)? Not what only works as a comment: links, attached files */
	flattens(item: PdfItem): boolean {
		return !isLink(item) && !(isNote(item) && !!item.file);
	}

	/**
	 * Makes comments part of their page's content ("flatten"): each is drawn into the page as it looks and is no
	 * comment any more – its text, replies and state go. One undo step. `ids`: the items of that page; without:
	 * every comment of the page.
	 */
	flatten(index: number, ids?: ReadonlySet<string>) {
		this.asOne(() => this.flattenPage(index, ids));
	}

	/** Flattens every comment of the PDF (one undo step) */
	flattenAll() {
		this.asOne(() => this.pages.forEach((_, i) => this.flattenPage(i)));
	}

	/** Are there comments that `flatten` would take (on a page, or anywhere)? */
	canFlatten(index?: number): boolean {
		return this.pages.some((page, i) => (index === undefined || i === index) && isOwnPage(page) && !!this.scenes.get(page.id)?.items.some((item) => this.flattens(item)));
	}

	private flattenPage(index: number, ids?: ReadonlySet<string>) {
		const page = this.pages[index];
		if (!page || !isOwnPage(page) || this.editable !== 'yes') return;
		const items = (this.scenes.get(page.id)?.items ?? []).filter((item) => (!ids || ids.has(item.id)) && this.flattens(item));
		if (!items.length) return;
		const toUser = toUserSpace(pageTransform(page.view, page.rotate));
		const date = new Date();
		const drawn = items.flatMap((item) => [annotationOf(item, toUser, undefined, date), ...partsOf(item, toUser, undefined, date)]);
		this.items.deleteItems(index, new Set(items.map((item) => item.id)));
		const adds = [...(this.contentAdds.get(page.number) ?? []), ...drawn.map((annotation) => ({ key: this.addKey++, annotation }))];
		this.changeContent(page.number, this.contentEdits.get(page.number) ?? new Map(), adds);
	}

	/**
	 * Puts a picture in the place of an image of a page's content: fitted into the image's box in proportion,
	 * drawn where the image was drawn (what lies over it stays over it). One undo step; the picture's object id.
	 */
	replaceImage(index: number, id: number, picture: { key: string; width: number; height: number }): number | null {
		const page = this.pages[index];
		const old = this.contentItems(index)?.find((item) => item.id === id);
		if (!page || !isOwnPage(page) || !old || !(picture.width > 0 && picture.height > 0)) return null;
		const { x0, y0, x1, y1 } = old.box;
		const scale = Math.min((x1 - x0) / picture.width, (y1 - y0) / picture.height);
		const w = picture.width * scale;
		const h = picture.height * scale;
		const stamp: PdfItem = { id: crypto.randomUUID(), type: 'stamp', x: (x0 + x1 - w) / 2, y: (y0 + y1 - h) / 2, w, h, name: 'Image', color: '#000000', image: picture.key };
		const annotation = annotationOf(stamp, toUserSpace(pageTransform(page.view, page.rotate)), undefined, new Date());
		const before = this.contentAdds.get(page.number) ?? [];
		// In the place of the file's image – also when that was replaced before
		const at = id >= ADDED ? before.find((a) => ADDED + a.key === id)?.at : id;
		const key = this.addKey++;
		const adds = [...before.filter((a) => ADDED + a.key !== id), { key, annotation, ...(at !== undefined && { at }) }];
		const edits = new Map(this.contentEdits.get(page.number) ?? []);
		if (at !== undefined) edits.delete(at);
		this.changeContent(page.number, edits, adds);
		return ADDED + key;
	}

	private changeContent(number: number, edits: ReadonlyMap<number, ContentChange>, adds: readonly ContentAdd[]) {
		const before = { edits: this.contentEdits.get(number) ?? new Map<number, ContentChange>(), adds: this.contentAdds.get(number) ?? [] };
		const after = { edits, adds };
		const set = (state: typeof after) => {
			const nextEdits = new Map(this.contentEdits);
			if (state.edits.size) nextEdits.set(number, state.edits);
			else nextEdits.delete(number);
			this.contentEdits = nextEdits;
			const nextAdds = new Map(this.contentAdds);
			if (state.adds.length) nextAdds.set(number, state.adds);
			else nextAdds.delete(number);
			this.contentAdds = nextAdds;
			this.contentChanges++;
			void this.showContent([number]);
		};
		set(after);
		this.pushStep({ undo: () => set(before), redo: () => set(after) });
	}

	/** Several steps as one to undo */
	private asOne(run: () => void) {
		const steps: Step[] = (this.grouped = []);
		try {
			run();
		} finally {
			this.grouped = null;
		}
		if (steps.length) this.pushStep({ undo: () => [...steps].reverse().forEach((step) => step.undo()), redo: () => steps.forEach((step) => step.redo()) });
	}
	private grouped: Step[] | null = null;

	/** The content edits as the writer takes them, keyed by `key(page number)` (left out: pages not there) */
	private contentFor(key: (number: number) => number | undefined) {
		const content = new Map<number, ReadonlyMap<number, ContentChange>>();
		const flatten = new Map<number, { annotation: NewAnnotation; matrix?: Matrix; at?: number }[]>();
		for (const [number, edits] of this.contentEdits) {
			const k = key(number);
			if (k !== undefined) content.set(k, edits);
		}
		for (const [number, adds] of this.contentAdds) {
			const k = key(number);
			if (k !== undefined) flatten.set(k, adds.map(({ annotation, matrix, at }) => ({ annotation, matrix, at })));
		}
		return { content, flatten };
	}

	/** Has the content of any page been changed (the file is then written anew as a whole)? */
	get contentChanged(): boolean {
		return this.contentEdits.size > 0 || this.contentAdds.size > 0;
	}

	/** The file with only the changes to its pages' content (the file as opened when there are none) */
	private async contentBytes(): Promise<Uint8Array> {
		const writer = await this.writer;
		const edits = this.contentFor((number) => number - 1);
		// Without the backgrounds of the file once one changed: each page's color of now is drawn under it instead
		const background = new Map(this.backgroundsShown ? [] : [...this.fileBackgrounds.keys()].map((number) => [number - 1, null] as const));
		return writer && (edits.content.size || edits.flatten.size || background.size) ? await writer.update({ ...edits, background }) : this.base;
	}

	/** Shows the file's pages with the content changes: the changed pages are rendered anew from a file that has
	 * them (what is shown stays until then) */
	private async showContent(numbers: number[]) {
		const run = ++this.shownRun;
		try {
			const writer = await this.writer;
			if (!writer) return;
			const bytes = await this.contentBytes();
			if (run !== this.shownRun) return;
			const proxy = bytes === this.base ? this.pdf : await openPdf(bytes.slice(), this.password);
			if (run !== this.shownRun) {
				if (proxy !== this.pdf) void proxy.loadingTask.destroy();
				return;
			}
			// What is hidden or filled in on the open document is so on this one too
			if (proxy !== this.pdf) for (const [id, value] of this.pdf.annotationStorage.serializable.map ?? []) proxy.annotationStorage.setValue(id, value as object);
			const old = this.shown;
			this.shown = proxy;
			this.renders.swap(MAIN, proxy, numbers);
			for (const number of numbers) {
				this.contentRevs.set(number, (this.contentRevs.get(number) ?? 0) + 1);
				for (const key of [...this.text.keys()]) if (key.startsWith(`${MAIN}|${number}|`)) this.text.delete(key);
			}
			for (const p of this.pages) if (!p.source && numbers.includes(p.number)) this.listener?.backdrop?.(p.id);
			this.changes++;
			// Told once the pages are drawn anew (or after a while, when they aren't in view)
			const since = performance.now();
			const before = this.rendered;
			let seen = before;
			const settled = () => {
				if (run !== this.shownRun) return;
				// Something was rendered since, and nothing more for a moment
				const done = this.rendered > before && this.rendered === seen;
				seen = this.rendered;
				if (!done && performance.now() - since < 3000) setTimeout(settled, 120);
				else this.contentShown++;
			};
			setTimeout(settled, 120);
			// Renders still running read from the old one: closed a little later
			if (old !== this.pdf && old !== proxy) setTimeout(() => void old.loadingTask.destroy(), 10_000);
		} catch (e) {
			console.warn('[pdf-editor] content', e);
		}
	}

	/** Writes a value into the documents' annotation storage (hidden annotations, filled-in fields): the open
	 * document's and the one shown */
	private store(id: string, value: Record<string, unknown>) {
		this.pdf.annotationStorage.setValue(id, value);
		if (this.shown !== this.pdf) this.shown.annotationStorage.setValue(id, value);
	}

	/** A new page list (moved, deleted, inserted pages) – one step to undo; pages keep their items */
	private arrange(next: PdfPage[]) {
		const before = this.pages;
		if (this.editable !== 'yes' || (next.length === before.length && next.every((p, i) => p === before[i]))) return;
		const set = (pages: PdfPage[]) => {
			this.pages = pages;
			this.changes++;
		};
		set(next);
		this.pushStep({ undo: () => set(before), redo: () => set(next) });
	}

	undo() {
		if (this.history.undo()) this.markChanged();
	}

	redo() {
		if (this.history.redo()) this.markChanged();
	}

	/** Records a step that was just done */
	private pushStep(step: Step) {
		if (this.grouped) {
			this.grouped.push(step);
			return;
		}
		this.history.push(step);
		this.markChanged();
	}

	private turn(op: Op) {
		const rotations = applyOp(this.pages, op);
		const turned: string[] = [];
		this.pages = this.pages.map((page, i) => {
			const rotate = rotations[i];
			if (rotate === page.rotate) return page;
			if (page.number) this.renders.forget(sourceOf(page), page.number);
			const scene = this.scenes.get(page.id);
			if (scene?.items.length) {
				const quarters = (rotate - page.rotate) / 90;
				const items = scene.items.map((item) => {
					const turned = rotatePdfItem(item, quarters, page.w, page.h);
					// Turning the page doesn't change an annotation of the file (it lies in the page's own space)
					if (this.loaded.get(item.id) === item) this.loaded.set(item.id, turned);
					return turned;
				});
				this.scenes.set(page.id, new PageScene(pdfKit, items));
				turned.push(page.id);
			}
			const quarter = (rotate - page.rotate) % 180 !== 0;
			return { ...page, rotate, w: quarter ? page.h : page.w, h: quarter ? page.w : page.h, rev: page.rev + 1 };
		});
		for (const id of turned) this.listener?.content(id);
	}

	/** Something changed: undo state, saving */
	private markChanged() {
		this.changes++;
		this.canUndo = this.history.canUndo;
		this.canRedo = this.history.canRedo;
		this.version++;
		this.dirty = true;
		this.scheduleSave();
	}

	/**
	 * A piece of a page as a vector picture, e.g. for a stamp: the comments `ids` alone (their box), or everything
	 * in `box` (as shown) – the page's own content as it is now (with the changes to it) and all comments on it. Null when there is nothing to take.
	 */
	async piece(index: number, what: { ids: ReadonlySet<string> } | { box: Box }): Promise<PdfForm | null> {
		const page = this.pages[index];
		if (!page) return null;
		const toUser = toUserSpace(pageTransform(page.view, page.rotate));
		const all = this.scenes.get(page.id)?.items.filter(isAnnotatable) ?? [];
		const items = 'ids' in what ? all.filter((item) => what.ids.has(item.id)) : all;
		const annotations = items.flatMap((item) => [annotationOf(item, toUser, undefined, new Date()), ...partsOf(item, toUser, undefined, new Date())]);
		let box: [number, number, number, number];
		if ('ids' in what) {
			if (!annotations.length) return null;
			const rects = annotations.map((a) => a.rect);
			box = [Math.min(...rects.map((r) => r[0])), Math.min(...rects.map((r) => r[1])), Math.max(...rects.map((r) => r[2])), Math.max(...rects.map((r) => r[3]))];
		} else {
			const corners = [toUser(what.box.x0, what.box.y0), toUser(what.box.x1, what.box.y1)];
			box = [Math.min(corners[0][0], corners[1][0]), Math.min(corners[0][1], corners[1][1]), Math.max(corners[0][0], corners[1][0]), Math.max(corners[0][1], corners[1][1])];
		}
		if (!(box[2] - box[0] >= 1 && box[3] - box[1] >= 1)) return null;
		// The page's own content only for a box; a blank page has none
		const inserted = page.source ? this.inserted.get(page.source) : undefined;
		const source = 'ids' in what || !page.number ? undefined : { pdf: inserted ? inserted.bytes : await this.contentBytes(), index: page.number - 1, password: inserted ? inserted.password : this.password };
		return pieceForm({ page: source, annotations, box, rotate: page.rotate });
	}

	/**
	 * What is drawn on the pages, as annotations in user space: new ones added, changed ones of the file written anew
	 * in their place, deleted ones taken off
	 */
	private annotations(): Pick<PdfEdits, 'annotations' | 'replace' | 'remove' | 'order' | 'patch'> {
		const added = new Map<number, NewAnnotation[]>();
		const replace = new Map<string, NewAnnotation>();
		const remove = new Set<string>();
		const order = new Map<number, (string | number)[]>();
		const now = new Date();
		const annotation = (item: Annotatable, index: number) => {
			const page = this.pages[index];
			let date = this.dates.get(item.id);
			if (!date) this.dates.set(item.id, (date = now));
			const toUser = toUserSpace(pageTransform(page.view, page.rotate));
			// Ours carry the author's name of when they were first saved; the file's keep theirs
			let author: string | undefined;
			if (!this.origin.has(item.id)) {
				if (!this.meta.has(item.id)) this.meta.set(item.id, { author: authorName(), modified: date });
				author = this.meta.get(item.id)!.author || undefined;
			}
			// The subject as set; new ones get their kind's name
			const subject = this.subjects.get(item.id) ?? (this.origin.has(item.id) ? undefined : kindOf(item).label);
			const placeOf = (id: string) => this.pages.findIndex((p) => p.id === id);
			return withData({ ...annotationOf(item, toUser, author, date, placeOf), ...(!isLink(item) && { subject }) }, item, date, page.rotate, page.w, page.h);
		};
		const itemsOfPage = this.pages.map((page) => this.scenes.get(page.id)?.items.filter(isAnnotatable) ?? []);
		/** Items read from the file that are still there, with their page's index */
		const present = new Map<string, { item: Annotatable; index: number }>();
		itemsOfPage.forEach((items, index) => items.forEach((item) => this.origin.has(item.id) && present.set(item.id, { item, index })));
		// Annotations of the file: untouched, gone, or written anew in their place (the first item; others added).
		// `stands`: the item standing for its annotation in the draw order; `extra`: items written as new ones
		const stands = new Map<string, string>();
		const extra = new Set<string>();
		for (const [ref, ids] of this.fromFile) {
			const items = ids.map((id) => present.get(id)).filter((p) => p !== undefined);
			if (!items.length) {
				remove.add(ref);
				continue;
			}
			const [first, ...rest] = items;
			stands.set(first.item.id, ref);
			if (items.length < ids.length || items.some((p) => this.loaded.get(p.item.id) !== p.item)) {
				replace.set(ref, annotation(first.item, first.index));
				for (const p of rest) extra.add(p.item.id);
			}
		}
		// New annotations in the items' order; the page's order written when it isn't the file's (moved to the front …)
		const rank = new Map([...this.fromFile.keys()].map((ref, i) => [ref, i]));
		itemsOfPage.forEach((items, index) => {
			const list: NewAnnotation[] = [];
			const sequence: (string | number)[] = [];
			for (const item of items) {
				const ref = stands.get(item.id);
				if (ref) sequence.push(ref);
				else if (!this.origin.has(item.id) || extra.has(item.id)) sequence.push(list.push(annotation(item, index)) - 1);
			}
			// What belongs to an item besides its own annotation (the struck text of a replacement): with a new one,
			// and anew – instead of the file's – with one written anew in its place
			for (const item of items) {
				const ref = stands.get(item.id);
				if (ref && !replace.has(ref)) continue;
				if (this.origin.has(item.id) && !ref && !extra.has(item.id)) continue;
				const page = this.pages[index];
				const date = this.dates.get(item.id) ?? now;
				const made = partsOf(item, toUserSpace(pageTransform(page.view, page.rotate)), this.meta.get(item.id)?.author || undefined, date, ref ?? item.id);
				if (ref) for (const part of this.parts.get(ref) ?? []) remove.add(part);
				list.push(...made);
			}
			// New replies after what they answer (as `/Text` notes drawing nothing: viewers list them with it), then
			// new review states (hidden), each after what it is set on
			for (const item of items) {
				const page = this.pages[index];
				const box = pdfKit.bounds(item);
				const toUser = toUserSpace(pageTransform(page.view, page.rotate));
				const [ax, ay] = toUser(box.x0, box.y0);
				const [bx, by] = toUser(box.x1, box.y1);
				const rect = [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)].map((v) => Math.round(v * 100) / 100) as NewAnnotation['rect'];
				const answers = this.replies.get(item.id) ?? [];
				for (const reply of answers) {
					if (reply.ref) continue;
					list.push({
						subtype: 'Text',
						name: reply.id,
						rect,
						author: reply.author || undefined,
						subject: this.subjects.get(reply.id),
						contents: reply.text,
						modified: reply.modified ?? now,
						icon: 'Comment',
						replyTo: this.origin.get(item.id) ?? item.id,
						appearance: { content: '' }
					});
				}
				const targets = [{ id: item.id, ref: this.origin.get(item.id) }, ...answers.map((r) => ({ id: r.id, ref: r.ref }))];
				for (const target of targets) {
					for (const s of this.states.get(target.id) ?? []) {
						if (s.ref) continue;
						list.push({
							subtype: 'Text',
							name: s.id,
							rect,
							author: s.author || undefined,
							contents: `${s.author ? `${s.author}: ` : ''}${s.state}`,
							modified: s.modified ?? now,
							state: s.state,
							replyTo: target.ref ?? target.id,
							appearance: { content: '' }
						});
					}
				}
			}
			// The page's speaker notes: kept, written anew in place of the file's, added or taken off
			const page = this.pages[index];
			const notes = this.notes.get(page.id) ?? '';
			const file = isOwnPage(page) ? this.fileNotes.get(page.id) : undefined;
			if (file && notes !== file.text) {
				if (notes) replace.set(file.ref, notesAnnotation(notes, page.view, now));
				else remove.add(file.ref);
			} else if (!file && notes) list.push(notesAnnotation(notes, page.view, now));
			if (list.length) added.set(index, list);
			// The file's order: its annotations in their order, the new ones after them
			const natural = sequence.every((e, i) => {
				const prev = sequence[i - 1];
				if (i === 0) return true;
				if (typeof e === 'string') return typeof prev === 'string' && rank.get(prev)! < rank.get(e)!;
				return true;
			});
			if (!natural) order.set(index, sequence);
		});
		// Replies of the file deleted here (those of deleted comments go with them)
		const kept = new Set([...this.replies.values(), ...this.states.values()].flatMap((list) => list.flatMap((r) => (r.ref ? [r.ref] : []))));
		for (const ref of [...this.fileReplies, ...this.fileStates]) if (!kept.has(ref)) remove.add(ref);
		// Subjects changed on what is otherwise kept as it is in the file
		const patch = new Map<string, { subject: string }>();
		const refOf = (id: string) => this.origin.get(id) ?? [...this.replies.values()].flat().find((r) => r.id === id)?.ref;
		for (const id of new Set([...this.subjects.keys(), ...this.fileSubjects.keys()])) {
			const subject = this.subjects.get(id) ?? '';
			const ref = refOf(id);
			if (ref && subject !== (this.fileSubjects.get(id) ?? '') && !replace.has(ref) && !remove.has(ref)) patch.set(ref, { subject });
		}
		return { annotations: added, replace, remove, order, patch };
	}

	private scheduleSave() {
		clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => void this.save(), this.base.length > LARGE ? SAVE_DELAY_LARGE_MS : SAVE_DELAY_MS);
	}

	/** Writes the file with the changes (the original plus one update; the original itself when nothing differs) */
	async save() {
		clearTimeout(this.saveTimer);
		if (this.saving) {
			this.saveAgain = true;
			return;
		}
		if (!this.dirty || this.conflict === 'changed' || !this.writer) return;
		this.saving = true;
		let done!: () => void;
		this.saved = new Promise<void>((resolve) => (done = resolve));
		const version = this.version;
		try {
			const writer = await this.writer;
			// The pages in their order: the file's by their number, inserted blank ones by their size; duplicates of the
			// file's pages copied from it with the changes to their content, without its annotations (theirs are items)
			const own = this.pages.some((p) => p.copy && !p.source) ? await this.contentBytes() : null;
			const pages = this.pages.map((p) =>
				!p.number
					? { blank: { width: p.view[2], height: p.view[3] } }
					: p.source
						? { copy: { pdf: this.inserted.get(p.source)!.bytes, index: p.number - 1, password: this.inserted.get(p.source)!.password, ...(p.copy && { annotations: false as const }) } }
						: p.copy
							? { copy: { pdf: own!, index: p.number - 1, annotations: false as const } }
							: { base: p.number - 1 }
			);
			// Changes to the content of the file's pages, by where each page stands now
			const places = new Map(this.pages.flatMap((p, i) => (isOwnPage(p) ? [[p.number, i] as const] : [])));
			// Each page's color where it differs from what the file gives it (copies come without one)
			const background = new Map<number, Rgb | null>();
			this.pages.forEach((p, i) => {
				const file = isOwnPage(p) || (p.copy && !p.source && this.backgroundsShown) ? this.fileBackgrounds.get(p.number) : undefined;
				if (p.background !== file) background.set(i, p.background ? rgbOf(p.background) : null);
			});
			const bytes = await writer.update({
				pages,
				rotate: new Map(this.pages.map((p, i) => [i, p.rotate])),
				...this.annotations(),
				form: await this.form(),
				...this.contentFor((number) => places.get(number)),
				background,
				resize: this.resizes,
				outline: this.outlineEdit(),
				info: this.infoEdit()
			});
			// Never replace a version saved elsewhere meanwhile without being told
			const now = await stat(this.path);
			if (this.conflict !== 'deleted' && now && !sameStamp(stampOf(now), this.stamp)) {
				this.conflict = 'changed';
				return;
			}
			await write(this.path, new Blob([bytes as Uint8Array<ArrayBuffer>]));
			this.latest = bytes;
			this.fingerprint = await fingerprintOf(bytes);
			const after = await stat(this.path);
			this.stamp = after && stampOf(after);
			this.conflict = null;
			this.saveError = null;
			this.dirty = this.version !== version;
		} catch (e) {
			console.error('[pdf-editor] save', e);
			reportSaveFailure(this, e, () => void this.save());
		} finally {
			this.saving = false;
			done();
			// A document that is being left saves what came meanwhile itself (`flush`)
			if (!this.leaving && (this.saveAgain || (this.dirty && !this.conflict && this.version !== version))) {
				this.saveAgain = false;
				this.scheduleSave();
			}
		}
	}

	/**
	 * Saves waiting changes now (page hidden or left); resolves when nothing is left to write – also what came while a
	 * save was running. A save that fails or meets a version saved elsewhere ends it (the state says so).
	 */
	async flush(): Promise<void> {
		clearTimeout(this.saveTimer);
		for (let attempt = 0; attempt < 3; attempt++) {
			if (this.saving) await this.saved;
			if (!this.dirty || this.conflict === 'changed' || !this.writer) return;
			await this.save();
			if (this.saveError) return;
		}
	}

	/** The page lets the document go: its last save (`flush`), after which nothing is scheduled any more */
	async leave(): Promise<void> {
		this.leaving = true;
		this.saveAgain = false;
		await this.flush();
	}

	/**
	 * Paths changed somewhere (`watch()`): our own writes match the stamp; another version reloads (`reload`) when
	 * nothing is waiting to be saved, otherwise saving pauses.
	 */
	async filesChanged(paths: readonly string[], reload: (version: string) => void) {
		if (!paths.includes(this.path) || this.saving) return;
		const entry = await stat(this.path).catch(() => null);
		if (this.saving) return;
		if (!entry || entry.kind !== 'file') {
			this.conflict = 'deleted';
			return;
		}
		if (sameStamp(stampOf(entry), this.stamp)) {
			if (this.conflict === 'deleted') this.conflict = null;
			return;
		}
		const stamp = stampOf(entry);
		if (this.dirty) this.conflict = 'changed';
		else reload(`${stamp.size}:${stamp.modified}`);
	}

	/** Keeps the own changes: the next save replaces the other version */
	async keepMine() {
		const entry = await stat(this.path);
		this.stamp = entry && stampOf(entry);
		this.conflict = null;
		if (this.dirty) this.scheduleSave();
	}

	/** Content of an embedded file */
	/** The files attached to comments, by page (`index`: its place) */
	attached(): { index: number; id: string; name: string; size: number; key: string }[] {
		void this.changes;
		return this.pages.flatMap((page, index) =>
			(this.scenes.get(page.id)?.items ?? []).flatMap((item) => (isNote(item) && item.file ? [{ index, id: item.id, ...item.file }] : []))
		);
	}
	/** How many there are (follows the items) */
	get attachedCount(): number {
		return this.attached().length;
	}

	async attachmentContent(attachment: Attachment): Promise<Blob> {
		const content = await this.pdf.getAttachmentContent(attachment.id);
		if (!content) throw new Error('the attachment has no content');
		return new Blob([content as BlobPart]);
	}

	/** The text of all pages in their order, for searching (each page read once per rotation, one after the other) */
	async texts(): Promise<PageText[]> {
		const pages = this.pages;
		const out: PageText[] = [];
		for (const page of pages) out.push(await this.textOf(page));
		return out;
	}

	private textOf(page: PdfPage): Promise<PageText> {
		const key = `${sourceOf(page)}|${page.number}|${page.rotate}|${this.contentRev(page)}`;
		let text = this.text.get(key);
		if (!text) {
			const proxy = this.proxyOf(page);
			text = proxy ? proxy.getPage(page.number).then((p) => readPageText(p, page.rotate)) : Promise.resolve(EMPTY_TEXT);
			this.text.set(key, text);
			text.then(
				(t) => this.textNow.set(key, t),
				() => this.text.delete(key)
			);
		}
		return text;
	}

	/** The text of a page if it was read already (`texts()` reads it) */
	pageText(index: number): PageText | null {
		const page = this.pages[index];
		return page ? (this.textNow.get(`${sourceOf(page)}|${page.number}|${page.rotate}|${this.contentRev(page)}`) ?? null) : null;
	}

	/** Which layers are shown (loaded on first use; the view only, the file stays as it is) */
	layers(): Promise<OptionalContentConfig> {
		this.layerConfig ??= this.pdf.getOptionalContentConfig();
		return this.layerConfig;
	}

	/** Layers were switched: every page is drawn again */
	layersChanged() {
		this.renders.forget(MAIN);
		this.pages = this.pages.map((p) => ({ ...p, rev: p.rev + 1 }));
	}

	/** Links of the file's pages that aren't items here (other programs'), by page id: their boxes as shown */
	private readonly fileLinks = new Map<string, Promise<{ box: Box; url?: string; dest?: string | unknown[] }[]>>();

	/**
	 * The link at a point of a page (page points as shown): one made here, else one of the file. `url`: a web
	 * address; `place`: where in this PDF it leads.
	 */
	async linkAt(index: number, x: number, y: number): Promise<{ url?: string; place?: { index: number; y: number } } | null> {
		const page = this.pages[index];
		if (!page) return null;
		const own = this.scenes.get(page.id)?.items.findLast((item): item is LinkItem => isLink(item) && x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h);
		if (own) {
			if (own.url) return { url: own.url };
			const at = this.pages.findIndex((p) => p.id === own.page);
			return at >= 0 ? { place: { index: at, y: 0 } } : null;
		}
		if (!isOwnPage(page)) return null;
		let links = this.fileLinks.get(page.id);
		if (!links) {
			links = (async () => {
				const proxy = await this.pdf.getPage(page.number);
				const found = (await proxy.getAnnotations()) as { subtype: string; id: string; rect: number[]; url?: string; dest?: string | unknown[] }[];
				const toPage = toShown(pageTransform(page.view, page.rotate));
				const ours = new Set([...this.fromFile.keys()].map((ref) => ref.replace(/ 0 R$/, 'R').replace(/ (\d+) R$/, 'R$1')));
				return found
					.filter((a) => a.subtype === 'Link' && !ours.has(a.id) && (a.url || a.dest))
					.map((a) => {
						const [ax, ay] = toPage(a.rect[0], a.rect[1]);
						const [bx, by] = toPage(a.rect[2], a.rect[3]);
						return { box: { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) }, url: a.url, dest: a.dest };
					});
			})().catch(() => []);
			this.fileLinks.set(page.id, links);
		}
		const hit = (await links).findLast((l) => x >= l.box.x0 && x <= l.box.x1 && y >= l.box.y0 && y <= l.box.y1);
		if (!hit) return null;
		if (hit.url) return { url: hit.url };
		const place = await this.destination(hit.dest ?? null);
		return place ? { place } : null;
	}

	/** The scale and unit this PDF is measured with: those of its measurements (one for the whole PDF), else the
	 * ones used last */
	measureScale(): { scale: number; unit: MeasureUnit } {
		for (const page of this.pages) {
			const found = this.scenes.get(page.id)?.items.find(isMeasured);
			if (found) return { scale: found.measure.scale, unit: found.measure.unit };
		}
		return { ...measureDefault };
	}

	/** Gives the PDF another scale: every measurement measures anew (one undo step) */
	setMeasureScale(scale: number, unit: MeasureUnit) {
		setMeasureDefault(scale, unit);
		this.items.changeAll((item) => (isMeasured(item) && (item.measure.scale !== scale || item.measure.unit !== unit) ? { ...item, measure: { ...item.measure, scale, unit } } : null));
	}

	/** Shows or hides the boxes of the links made here (the pages holding some are drawn again) */
	showLinks(shown: boolean) {
		if (linkView.shown === shown) return;
		linkView.shown = shown;
		for (const page of this.pages) if (this.scenes.get(page.id)?.items.some(isLink)) this.listener?.content(page.id);
		this.changes++;
	}

	/** Index of the page a destination of the outline or a link points to, with its height on the page (points from the top) */
	async destination(dest: string | unknown[] | null): Promise<{ index: number; y: number } | null> {
		const explicit = typeof dest === 'string' ? await this.pdf.getDestination(dest) : dest;
		if (!Array.isArray(explicit) || !explicit.length) return null;
		const target = explicit[0];
		const index = typeof target === 'number' ? target : await this.pdf.getPageIndex(target as Parameters<PDFDocumentProxy['getPageIndex']>[0]).catch(() => -1);
		// The page of the file → where it is now (gone: nowhere)
		const at = this.pages.findIndex((p) => isOwnPage(p) && p.number === index + 1);
		if (index < 0 || at < 0) return null;
		// [page, /XYZ left top zoom] or [page, /FitH top] …: the top edge in PDF space, turned into page points
		const kind = (explicit[1] as { name?: string } | undefined)?.name;
		const top = kind === 'XYZ' ? explicit[3] : kind === 'FitH' || kind === 'FitBH' ? explicit[2] : null;
		if (typeof top !== 'number') return { index: at, y: 0 };
		const viewport = (await this.pdf.getPage(index + 1)).getViewport({ scale: 1, rotation: this.pages[at].rotate });
		const [, y] = viewport.convertToViewportPoint(typeof explicit[2] === 'number' && kind === 'XYZ' ? explicit[2] : 0, top);
		return { index: at, y: Math.max(0, y) };
	}

	/** Annotations of a page (created when first asked) */
	scene(id: string): PageScene<PdfItem> | null {
		let scene = this.scenes.get(id);
		if (!scene && this.pages.some((p) => p.id === id)) this.scenes.set(id, (scene = new PageScene(pdfKit)));
		return scene ?? null;
	}

	destroy() {
		this.destroyed = true;
		stampEvents.ready = null;
		this.scripts?.destroy();
		clearTimeout(this.saveTimer);
		this.renders.destroy();
		void this.pdf.loadingTask.destroy();
	}
}

/** A field's value as a form script set it (`now`: its value until then) */
function valueOf(field: FormField, change: ScriptChange, now: FieldValue): FieldValue {
	const v = change.value;
	if (field.kind === 'checkbox' || field.kind === 'radio') {
		if (typeof v === 'string') return v;
		const on = field.widgets.find((w) => w.id === change.widget)?.on;
		if (v) return on ?? now;
		return now === on ? 'Off' : now;
	}
	if (field.kind === 'list') return Array.isArray(v) ? v.map(String) : v == null || v === '' ? [] : [String(v)];
	return v == null ? '' : String(v);
}

/** A short fingerprint of a file's bytes (SHA-256, the first 16 hex digits) */
async function fingerprintOf(bytes: Uint8Array): Promise<string> {
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>));
	return Array.from(digest.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}
