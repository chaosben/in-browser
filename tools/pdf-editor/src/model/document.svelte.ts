// An open PDF: its pages as the surface sees them, PDF.js's document (outline, text, attachments, layers) and the
// pages' renders (`PdfPages`, using that same document). Annotations of the pages live in their scenes.
// Changes are steps with undo (`edits.ts`); they save themselves shortly after as one incremental update of the
// original bytes (`IncrementalPdf`), so undoing everything writes the original file again. A version saved elsewhere
// meanwhile pauses saving (`conflict`), like the Text Editor.

import { suiteSettings } from '@in-browser/files/suite-settings.svelte.js';
import { reportSaveFailure } from '@in-browser/files/documents.js';
import type { Entry } from '@in-browser/files/entry.js';
import { read, stat, write } from '@in-browser/files/fs.js';
import { basename } from '@in-browser/files/path.js';
import { ItemEditor } from '@in-browser/ink/edit/items.js';
import type { Box } from '@in-browser/ink/geometry.js';
import type { SurfacePage } from '@in-browser/ink/render/kit.js';
import { PageScene } from '@in-browser/ink/render/scene.js';
import { pageTransform, toShown, toUserSpace } from '@in-browser/pdf/geometry.js';
import { PdfPages } from '@in-browser/pdf/pages.js';
import { loadPdf } from '@in-browser/pdf/load.js';
import { openPdf, PdfError, type OptionalContentConfig, type PDFDocumentProxy } from '@in-browser/pdf/pdfjs.js';
import type { PageText } from '@in-browser/pdf/text.js';
import { readPageText } from '@in-browser/pdf/text-layer.js';
import { parsePdfDate, type NewAnnotation, type ReviewState } from '@in-browser/pdf/write/annotations.js';
import { IncrementalPdf, type PdfEdits } from '@in-browser/pdf/write/incremental.js';
import { filledForm, formFonts, readFields, storageValue, type FieldValue, type FormField, type FormWidget } from '@in-browser/pdf/forms.js';
import { startScripts, type FormScripts, type SandboxEvent, type ScriptChange } from '@in-browser/pdf/scripting.js';
import { sameValue } from './fields.js';
import { isAnnotatable, pdfKit, rotatePdfItem, type Annotatable, type PdfItem } from '#lib/render/markup.js';
import { annotationOf } from './annots.js';
import { kindOf } from './comments.js';
import { itemsOf, withData } from './imported.js';
import { applyOp, History, invert, movePages, type Op, type Step } from './edits.js';

/** The text of a blank page */
const EMPTY_TEXT: PageText = { str: '', runs: [] };

/** The author written with new comments and replies (the suite settings' name) */
const authorName = () => suiteSettings.values.profile.name;

/** Saving waits this long after a change (larger files longer: each save writes the whole file) */
const SAVE_DELAY_MS = 1500;
const SAVE_DELAY_LARGE_MS = 10_000;
const LARGE = 25 * 1024 * 1024;

/** Whether the PDF can be changed: checked in the background after opening */
export type Editable = 'checking' | 'yes' | 'encrypted' | 'failed';

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

export interface PdfPage extends SurfacePage {
	/** Page of the PDF as opened, from 1 (stays when pages move); 0: a blank page inserted here */
	readonly number: number;
	/** A page inserted from another PDF: that PDF (`PdfDocument.inserted`), `number` is its page there */
	readonly source?: string;
	/** Shown rotation in degrees (the page's own, as PDF.js applies it) */
	readonly rotate: number;
	/** Raised whenever the page looks different (its renders are asked for again) */
	readonly rev: number;
	/** The page's box in user space (PDF.js `page.view`): where annotations go */
	readonly view: readonly number[];
}

/** What the surface hears about changed items (set by `Surface.svelte`) */
export interface ItemListener {
	stroke(pageId: string, scene: PageScene<PdfItem>, item: PdfItem): void;
	region(pageId: string, box: Box | null): void;
	/** A page's items were replaced (e.g. turned with the page) */
	content(pageId: string): void;
	/** A page's PDF looks different (a form field filled in): drawn anew without dropping what is shown */
	backdrop?(pageId: string): void;
}

/** An entry of the PDF's bookmarks (outline) */
export interface OutlineEntry {
	title: string;
	/** Named destination or explicit one (PDF.js format); null: no place in this document */
	dest: string | unknown[] | null;
	items: OutlineEntry[];
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
	/** What the PDF brings along (read once when opened) */
	outline: OutlineEntry[] = [];
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
	/** Author and date of comments: read from the file, or the author's name when a new one is first saved */
	private readonly meta = new Map<string, CommentInfo>();
	/** Replies per comment (item id); those of the file keep their refs (`fileReplies`: all read) */
	replies = $state.raw<ReadonlyMap<string, readonly Reply[]>>(new Map());
	private readonly fileReplies = new Set<string>();
	/** The file as last written (or as opened) */
	private latest: Uint8Array;
	/** PDFs pages were inserted from (by key): their bytes (copied into the file when it is saved) and PDF.js's document */
	private readonly inserted = new Map<string, { bytes: Uint8Array; pdf: PDFDocumentProxy }>();
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
	private stamp: Stamp | null;
	private version = 0;
	private saveTimer: ReturnType<typeof setTimeout> | undefined;
	private saveAgain = false;

	private constructor(
		path: string,
		readonly pdf: PDFDocumentProxy,
		pages: PdfPage[],
		/** The file as opened (never changed: updates are appended to it) */
		private readonly base: Uint8Array,
		stamp: Stamp
	) {
		this.path = path;
		this.pages = pages;
		this.latest = base;
		this.stamp = stamp;
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
	}

	get name(): string {
		return basename(this.path);
	}

	/** Reads and opens a PDF; throws `PdfError` when the file can't be read as one */
	static async open(path: string): Promise<PdfDocument> {
		const file = await read(path);
		const base = new Uint8Array(await file.arrayBuffer());
		// PDF.js may take the buffer to its worker: it gets a copy
		const pdf = await openPdf(base.slice());
		if (!pdf.numPages) throw new PdfError('invalid');
		const pages: PdfPage[] = [];
		for (let n = 1; n <= pdf.numPages; n++) {
			const page = await pdf.getPage(n);
			const viewport = page.getViewport({ scale: 1 });
			pages.push({ id: `p${n}`, w: viewport.width, h: viewport.height, number: n, rotate: viewport.rotation, rev: 0, view: page.view });
		}
		const doc = new PdfDocument(path, pdf, pages, base, { size: file.size, modified: file.lastModified });
		doc.check();
		void doc.loadFields();
		const [outline, attachments, layers] = await Promise.all([pdf.getOutline().catch(() => null), pdf.getAttachments().catch(() => null), doc.layers().catch(() => null)]);
		doc.outline = (outline ?? []) as OutlineEntry[];
		doc.attachments = [...(attachments?.entries() ?? [])].map(([id, a]) => ({ id, name: a.filename, description: a.description }));
		doc.hasLayers = !!layers && [...layers].length > 0;
		return doc;
	}

	/** Parses the file for writing (in the background): encrypted or unreadable files are only shown */
	private check() {
		this.writer = IncrementalPdf.open(this.base);
		this.writer.then(
			(writer) => {
				this.signed = writer.signed;
				this.editable = writer.locked ? 'encrypted' : writer.pageCount === this.pages.length ? 'yes' : 'failed';
				if (this.editable === 'yes') this.takeAnnotations(writer);
			},
			(e) => {
				console.warn('[pdf-editor] not editable', e);
				this.editable = 'failed';
			}
		);
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
				const made = itemsOf(a, toPage, page.rotate, unique);
				if (!made.length) continue;
				this.fromFile.set(
					a.ref,
					made.map((item) => item.id)
				);
				for (const item of made) {
					this.origin.set(item.id, a.ref);
					this.loaded.set(item.id, item);
					this.meta.set(item.id, { author: a.author ?? '', modified: parsePdfDate(a.modified) });
					if (a.subject) this.fileSubjects.set(item.id, a.subject);
					items.push(item);
				}
				this.pdf.annotationStorage.setValue(a.id, { noView: true });
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
		this.changes++;
	}

	/** Reads the form's fields (none without a form) */
	private async loadFields() {
		const fields = await readFields(this.pdf).catch((e: unknown) => {
			console.warn('[pdf-editor] form fields', e);
			return [];
		});
		for (const f of fields) this.fileValues.set(f.name, f.value);
		if (fields.length) this.fieldFonts = await formFonts(this.base).catch(() => new Map());
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
		return this.pages.findIndex((p) => !p.source && p.number === widget.page + 1);
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
				this.pdf.annotationStorage.setValue(w.id, storageValue(field, w, value, this.formatted.get(name)));
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
			const filled = { key, bytes: filledForm(this.base, values) };
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

	/** Sets the review state of a comment or reply (one step to undo; kept as a history like Acrobat does) */
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
		const op: Op = { kind: 'rotate', pages, by };
		this.turn(op);
		this.pushStep({ undo: () => this.turn(invert(op)), redo: () => this.turn(op) });
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

	/** Inserts a blank page at `at` in the size of the page shown there (or before it) – one step to undo; its id */
	insertBlank(at: number): string | null {
		const like = this.pages[Math.min(at, this.pages.length - 1)] ?? this.pages[at - 1];
		if (!like) return null;
		// Upright, as big as the neighbour looks
		const page: PdfPage = { id: crypto.randomUUID(), number: 0, w: like.w, h: like.h, rotate: 0, rev: 0, view: [0, 0, like.w, like.h] };
		const next = [...this.pages];
		next.splice(at, 0, page);
		this.arrange(next);
		return page.id;
	}

	/**
	 * Inserts all pages of another PDF at `at` – one step to undo; throws `PdfError` when it can't be read (or is
	 * protected: its pages couldn't be copied)
	 */
	async insertPdf(at: number, bytes: Uint8Array): Promise<void> {
		if (this.editable !== 'yes') return;
		// Protection without a password is taken off (`loadPdf`); one with a password can't be copied from
		const check = await loadPdf(bytes).catch((e: unknown) => {
			throw new PdfError('invalid', e);
		});
		if (check.locked) throw new PdfError('password');
		const pdf = await openPdf(bytes.slice());
		if (!pdf.numPages) throw new PdfError('invalid');
		const key = crypto.randomUUID();
		this.inserted.set(key, { bytes, pdf });
		const pages: PdfPage[] = [];
		for (let n = 1; n <= pdf.numPages; n++) {
			const page = await pdf.getPage(n);
			const viewport = page.getViewport({ scale: 1 });
			pages.push({ id: crypto.randomUUID(), source: key, w: viewport.width, h: viewport.height, number: n, rotate: viewport.rotation, rev: 0, view: page.view });
		}
		const next = [...this.pages];
		next.splice(at, 0, ...pages);
		this.arrange(next);
	}

	/** The PDF as it is now, saved first; throws when it can't be saved (saving paused, failed) */
	private async current(): Promise<Uint8Array> {
		if (this.dirty) await this.save();
		if (this.dirty) throw new Error(this.saveError ?? 'not saved');
		return this.latest;
	}

	/** A new PDF of some of its pages (places, in this order) – with everything drawn on them, outline and form kept as
	 * far as they concern these pages (PDF.js's `extractPages`) */
	async extract(places: number[]): Promise<Uint8Array> {
		const pdf = await openPdf((await this.current()).slice());
		try {
			return await pdf.extractPages([{ document: null, includePages: places }]);
		} finally {
			await pdf.loadingTask.destroy();
		}
	}

	/** A new PDF of this one followed by others (bytes) */
	async merged(others: Uint8Array[]): Promise<Uint8Array> {
		const pdf = await openPdf((await this.current()).slice());
		try {
			return await pdf.extractPages([{ document: null }, ...others.map((document) => ({ document: document.slice() }))]);
		} finally {
			await pdf.loadingTask.destroy();
		}
	}

	/** The PDF.js document a page comes from (null: a blank page) */
	proxyOf(page: PdfPage): PDFDocumentProxy | null {
		if (!page.number) return null;
		return page.source ? (this.inserted.get(page.source)?.pdf ?? null) : this.pdf;
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
			return withData({ ...annotationOf(item, toUser, author, date), subject }, item, date, page.rotate, page.w, page.h);
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
		const version = this.version;
		try {
			const writer = await this.writer;
			// The pages in their order: the file's by their number, inserted blank ones by their size
			const pages = this.pages.map((p) =>
				!p.number ? { blank: { width: p.view[2], height: p.view[3] } } : p.source ? { copy: { pdf: this.inserted.get(p.source)!.bytes, index: p.number - 1 } } : { base: p.number - 1 }
			);
			const bytes = await writer.update({ pages, rotate: new Map(this.pages.map((p, i) => [i, p.rotate])), ...this.annotations(), form: await this.form() });
			// Never replace a version saved elsewhere meanwhile without being told
			const now = await stat(this.path);
			if (this.conflict !== 'deleted' && now && !sameStamp(stampOf(now), this.stamp)) {
				this.conflict = 'changed';
				return;
			}
			await write(this.path, new Blob([bytes as Uint8Array<ArrayBuffer>]));
			this.latest = bytes;
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
			if (this.saveAgain || (this.dirty && !this.conflict && this.version !== version)) {
				this.saveAgain = false;
				this.scheduleSave();
			}
		}
	}

	/** Saves waiting changes now (page hidden or left) */
	flush() {
		if (this.dirty) void this.save();
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
		const key = `${sourceOf(page)}|${page.number}|${page.rotate}`;
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
		return page ? (this.textNow.get(`${sourceOf(page)}|${page.number}|${page.rotate}`) ?? null) : null;
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

	/** Index of the page a destination of the outline or a link points to, with its height on the page (points from the top) */
	async destination(dest: string | unknown[] | null): Promise<{ index: number; y: number } | null> {
		const explicit = typeof dest === 'string' ? await this.pdf.getDestination(dest) : dest;
		if (!Array.isArray(explicit) || !explicit.length) return null;
		const target = explicit[0];
		const index = typeof target === 'number' ? target : await this.pdf.getPageIndex(target as Parameters<PDFDocumentProxy['getPageIndex']>[0]).catch(() => -1);
		// The page of the file → where it is now (gone: nowhere)
		const at = this.pages.findIndex((p) => !p.source && p.number === index + 1);
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
