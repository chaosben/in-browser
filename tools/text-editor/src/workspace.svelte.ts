import { showError } from '@in-browser/files/errors.js';
import { filesUrl } from '@in-browser/files/formats.js';
import { isolateHistory, redoDepth, undoDepth } from '@codemirror/commands';
import { EditorSelection, type ChangeSpec, type TransactionSpec, type Transaction } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { loadJson, storeJson } from '@in-browser/brand/storage.js';
import { resolve } from '$app/paths';
import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { chooseFile } from '@in-browser/files/dialog.svelte.js';
import { read, stat, write } from '@in-browser/files/fs.js';
import { filesErrorText, formatSize } from '@in-browser/files/i18n/index.svelte.js';
import { EDITABLE_EXTENSIONS } from '@in-browser/files/kinds.js';
import { basename, isInside, parent } from '@in-browser/files/path.js';
import { accessAction } from '@in-browser/files/sources/connections.svelte.js';
import { recentDocuments } from '@in-browser/files/sources/recent.js';
import { CHARSET_NAMES, decode, encode, MAX_SIZE, type Charset, type Encoding, type LineEnding } from '#lib/document.js';
import { loadDraft, newDraftId, pathDraftId, removeDraft, saveDraft, type FileStamp } from '#lib/drafts.js';
import { markdownKeymap } from '#lib/editor/commands.js';
import { isMarkdown, languageOf } from '#lib/editor/languages.js';
import { languageSlot, wrapping, wrapSlot } from '#lib/editor/setup.js';
import { sameStamp, stampOf, Tab } from '#lib/tab.svelte.js';
import type { ViewId } from '#lib/views/registry.js';
import type { ViewUi } from '#lib/views/types.js';
import { intlLocale, m } from '#lib/i18n/index.js';
import { downloadBlob } from '@in-browser/brand/download.js';

// One file per page (`ui.md` “One document per page”), shown by the one `EditorView` of the editor page. Files with a
// place in the file system save themselves shortly after typing (never with a question: conflicts and characters the
// encoding can't hold pause it and show a bar); files without one (new, opened from the computer) wait for "Save …".
// Saving keeps the encoding and line ending; changes made elsewhere (other browser tabs, the sync) are noticed via
// `watch()`. Unsaved changes are kept as drafts (`drafts.ts`) and come back with the file's address.

const WRAP_KEY = 'text-editor:wrap';
/** Until layouts existed: whether the Markdown preview was shown */
const OLD_PREVIEW_KEY = 'text-editor:preview';
const LAYOUT_KEY = 'text-editor:layout';
const SPLIT_KEY = 'text-editor:split';
const VIEWS_KEY = 'text-editor:views';
const HEADER_KEY = 'text-editor:table-header';
const FONT_KEY = 'text-editor:font-size';
/** Folder of the last open/save dialog (kept across the pages of this browser tab) */
/** “Recently opened” and the folder dialogs start in – the suite's list (`text-editor:recent`, `text-editor:folder`) */
const recent = recentDocuments('text-editor');
/** Pause after typing before saving automatically */
const SAVE_DELAY = 1000;
export const FONT_SIZES = { min: 10, default: 14, max: 28 };
/** Text only, text and view side by side, or the view only (files that have a view) */
export type Layout = 'text' | 'split' | 'view';
/** Share of the width the text gets side by side */
export const SPLIT = { min: 0.2, default: 0.5, max: 0.8 };

export function encodingName(encoding: Encoding) {
	const name = CHARSET_NAMES[encoding.charset];
	return encoding.bom ? m.encoding.withBom(name) : name;
}

/** An error as a toast (and in the console); `retry` runs again once the browser allows access to a connected folder */
function fail(e: unknown, retry?: () => void) {
	showError(e, { text: m.toasts.failed(filesErrorText(e)), retry });
}

export class Workspace {
	/** The shown file (null while it loads, or when it couldn't be opened) */
	file = $state.raw<Tab | null>(null);
	/** Wrapped by default on phones and narrow windows (no horizontal scrolling there) */
	wrap = $state(loadJson(WRAP_KEY, typeof matchMedia === 'function' && matchMedia('(pointer: coarse), (max-width: 47.99rem)').matches));
	layout = $state<Layout>(loadJson<Layout | null>(LAYOUT_KEY, null) ?? (loadJson(OLD_PREVIEW_KEY, true) ? 'split' : 'text'));
	split = $state(loadJson(SPLIT_KEY, SPLIT.default));
	/** View chosen per file type, where there are several (e.g. JSON Lines: table or tree) */
	views = $state<Record<string, ViewId>>(loadJson(VIEWS_KEY, {}));
	/** The first row of CSV files holds the column names */
	tableHeader = $state(loadJson(HEADER_KEY, true));
	/** Menus and status of the view that is shown */
	viewUi = $state.raw<ViewUi | null>(null);
	fontSize = $state(loadJson(FONT_KEY, FONT_SIZES.default));
	/** A file without a place got one (“Save”, “Save as …”): the page takes over its address */
	onplaced: ((path: string) => void) | null = null;

	#view: EditorView | null = null;
	#draftTimer: ReturnType<typeof setTimeout> | undefined;
	#saveTimer: ReturnType<typeof setTimeout> | undefined;

	// --- The editor view ---

	/** Called by the editor component once its view exists; returns the cleanup */
	attach(view: EditorView) {
		this.#view = view;
		if (this.file) this.#show(this.file);
		return () => {
			this.#view = null;
			view.destroy();
		};
	}

	/** Every transaction of the view */
	update(view: EditorView, transactions: readonly Transaction[]) {
		const tab = this.file;
		if (!tab) return;
		tab.state = view.state;
		if (transactions.some((tr) => tr.docChanged)) {
			const doc = view.state.doc;
			tab.changedText = doc.length !== tab.saved.length || !doc.eq(tab.saved);
			tab.version++;
			this.#changed(tab);
		}
		tab.history = { undo: undoDepth(view.state), redo: redoDepth(view.state) };
		const main = view.state.selection.main;
		tab.head = main.head;
		const line = view.state.doc.lineAt(main.head);
		tab.cursor = {
			line: line.number,
			column: main.head - line.from + 1,
			selected: view.state.selection.ranges.reduce((sum, r) => sum + r.to - r.from, 0)
		};
	}

	/** Applies a change to the file, whether the view shows it yet or not */
	#apply(tab: Tab, spec: TransactionSpec) {
		if (tab === this.file && this.#view) this.#view.dispatch(spec);
		else {
			tab.state = tab.state.update(spec).state;
			tab.version++;
		}
	}

	#show(tab: Tab) {
		const view = this.#view;
		if (!view) return;
		view.setState(tab.state);
		this.update(view, []);
		view.focus();
	}

	focus() {
		this.#view?.focus();
	}

	/** Runs an editor command (ribbon, menus) on the text; `focus: false` leaves the focus where it is (views) */
	run(command: (view: EditorView) => boolean, { focus = true } = {}) {
		const view = this.#view;
		if (!view || !this.file) return;
		command(view);
		if (focus) view.focus();
	}

	/** A change from a view (table, tree): one undo step like typing, the focus stays in the view */
	edit(tab: Tab, changes: ChangeSpec) {
		this.#apply(tab, { changes, userEvent: 'input.view', annotations: isolateHistory.of('full') });
	}

	/** Puts the cursor of the text on a place chosen in a view; `scroll` brings it into sight */
	reveal(tab: Tab, from: number, to = from, scroll = true) {
		const length = tab.state.doc.length;
		const selection = EditorSelection.single(Math.min(from, length), Math.min(to, length));
		this.#apply(tab, { selection, scrollIntoView: scroll });
	}

	// --- Opening and leaving ---

	/** Shows a file read by `load` or `loadDraft` */
	open(tab: Tab) {
		this.file = tab;
		this.#show(tab);
		this.#loadLanguage(tab);
		if (tab.path) this.#remember(tab.path);
		// Changes from the last visit that can be saved go out now
		if (tab.dirty && tab.path && !tab.conflict) this.#changed(tab);
	}

	async #loadLanguage(tab: Tab) {
		const language = languageOf(tab.name);
		tab.language = language?.name ?? null;
		try {
			const extension = language ? await language.load() : [];
			const keys = isMarkdown(tab.name) ? markdownKeymap : [];
			this.#apply(tab, { effects: languageSlot.reconfigure([extension, keys]) });
		} catch (e) {
			// Highlighting is optional (e.g. offline before the language was ever loaded)
			console.error(e);
		}
	}

	/** Reads a file: its bytes and stamp, `null` if it isn't there, or why it can't be opened */
	async #readFile(path: string): Promise<{ bytes: Uint8Array; stamp: FileStamp } | string | null> {
		const entry = await stat(path);
		if (!entry || entry.kind !== 'file') return null;
		if ((entry.size ?? 0) > MAX_SIZE) return m.toasts.tooLarge(entry.name, formatSize(MAX_SIZE, intlLocale));
		const file = await read(path);
		return { bytes: new Uint8Array(await file.arrayBuffer()), stamp: { size: file.size, modified: file.lastModified } };
	}

	/**
	 * Reads the file at `path` with the unsaved changes of the last visit (its draft), or why it can't be opened; errors
	 * of the file system (e.g. no access to a connected folder) are thrown.
	 */
	async load(path: string): Promise<Tab | string> {
		const id = await pathDraftId(path);
		const [file, draft] = await Promise.all([this.#readFile(path), loadDraft(id)]);
		if (typeof file === 'string') return file;
		if (!file && !draft) {
			forgetRecent(path);
			return m.toasts.notFound(basename(path));
		}
		const decoded = file && decode(file.bytes);
		if (file && !decoded) return m.toasts.binary(basename(path));
		const tab = new Tab({ id, path, text: draft?.text ?? decoded!.text, saved: decoded?.text ?? '', wrap: this.wrap });
		tab.encoding = tab.savedEncoding = decoded?.encoding ?? { charset: 'utf-8', bom: false };
		tab.eol = tab.savedEol = decoded?.eol ?? '\n';
		tab.stamp = draft ? draft.stamp : file!.stamp;
		if (draft) {
			tab.encoding = draft.encoding;
			tab.eol = draft.eol;
			// Changed or gone elsewhere since the changes started: the conflict bar decides
			if (!file) tab.conflict = 'deleted';
			else if (!sameStamp(file.stamp, draft.stamp)) tab.conflict = 'changed';
		}
		if (!tab.dirty && draft) void removeDraft(id);
		return tab;
	}

	/** Reads a file without a place (`?draft=`): new, or opened from the computer, with what was typed so far */
	async loadDraft(id: string): Promise<Tab> {
		const draft = await loadDraft(id);
		const tab = new Tab({ id, path: null, fileName: draft?.fileName, text: draft?.text ?? '', saved: '', wrap: this.wrap });
		if (draft) {
			tab.encoding = tab.savedEncoding = draft.encoding;
			tab.eol = tab.savedEol = draft.eol;
		}
		return tab;
	}

	/**
	 * Before another file replaces this one (or the start page does): a file with a place saves first; only what can't
	 * be saved that way asks before its changes are thrown away. `false`: stay.
	 */
	async leave(): Promise<boolean> {
		const tab = this.file;
		if (!tab) return true;
		if (tab.dirty && tab.path && !tab.conflict && !tab.problem) await this.save(tab, { auto: true });
		if (tab.dirty && !(await this.#confirmDiscard(tab))) return false;
		this.#cancelSave();
		this.#dropDraft(tab.id);
		return true;
	}

	/** The page shows another file or goes: pending saves and drafts go out (done when settled), the file goes */
	dispose(): Promise<unknown> {
		const done = this.flush();
		clearTimeout(this.#saveTimer);
		this.file = null;
		this.viewUi = null;
		return done;
	}

	// --- Saving ---

	/**
	 * Saves the file. Manually (Ctrl+S, "Save …"): asks for a place if needed and asks before replacing a newer
	 * version or losing characters. Automatically: never asks – a conflict or unmappable characters pause it instead.
	 */
	async save(tab: Tab, { as = false, auto = false } = {}): Promise<boolean> {
		let path = tab.path;
		if (!path || as) {
			if (auto) return false;
			path = await chooseFile({
				mode: 'save',
				folder: tab.path ? parent(tab.path) : recent.lastFolder(),
				accept: EDITABLE_EXTENSIONS,
				name: tab.suggestedName,
				title: m.dialogs.saveAs,
				overwrite: true
			});
			if (!path) return false;
			recent.usedFolderOf(path);
		}
		if (auto && tab.conflict === 'changed') return false;
		this.#cancelSave();

		let encoding = tab.encoding;
		const text = () => tab.state.doc.sliceString(0, tab.state.doc.length, tab.eol);
		let encoded = encode(text(), encoding);
		if (encoded.unmappable) {
			if (auto) {
				tab.problem = { unmappable: encoded.unmappable };
				return false;
			}
			const question = m.questions.unmappable;
			const ok = await ask({ ...question, message: question.message(encoded.unmappable, encodingName(encoding)) });
			if (!ok) return false;
			encoding = { charset: 'utf-8', bom: false };
			encoded = encode(text(), encoding);
		}
		tab.problem = null;

		const located = !!tab.path;
		tab.busy = tab.saving = true;
		try {
			// Same file: don't silently replace a version saved elsewhere meanwhile
			if (path === tab.path && tab.stamp && tab.conflict !== 'deleted') {
				const now = await stat(path);
				if (now && !sameStamp(stampOf(now), tab.stamp)) {
					if (auto) {
						tab.conflict = 'changed';
						return false;
					}
					const ok = await ask({ ...m.questions.overwrite, message: m.questions.overwrite.message(tab.name), danger: true });
					if (!ok) return false;
				}
			}
			const doc = tab.state.doc;
			const eol = tab.eol;
			await write(path, encoded.bytes);
			const entry = await stat(path);
			const moved = path !== tab.path;
			if (moved) {
				// Its drafts follow the place
				this.#dropDraft(tab.id);
				tab.id = await pathDraftId(path);
			}
			tab.path = path;
			tab.fileName = null;
			// Typing goes on while saving: what counts as saved is what was written
			tab.setSaved({ encoding, eol }, entry && stampOf(entry));
			tab.saved = doc;
			tab.changedText = !tab.state.doc.eq(doc);
			if (tab.dirty) this.#changed(tab);
			else this.#dropDraft(tab.id);
			if (moved) {
				this.#loadLanguage(tab);
				this.onplaced?.(path);
			}
			this.#remember(path);
			// A new place: where it is now
			if (!located || as) toast(m.toasts.saved(tab.name), 'success', 6000, { label: m.actions.showInFiles, run: () => this.showInFiles(tab) });
			tab.saveError = null;
			return true;
		} catch (e) {
			// Automatic saving reports a failure once; the save state in the footer keeps showing it
			const reported = auto && tab.saveError !== null;
			tab.saveError = filesErrorText(e);
			const allow = accessAction(e, () => void this.save(tab));
			if (reported) console.error(e);
			else if (allow) {
				console.error(e);
				toast(m.toasts.failed(tab.saveError), 'error', 10000, allow);
			} else fail(e);
			return false;
		} finally {
			tab.busy = tab.saving = false;
		}
	}

	/** After every change: keep a draft and, for files with a place, save after a pause */
	#changed(tab: Tab) {
		this.#scheduleDraft(tab);
		if (!tab.path) return;
		this.#cancelSave();
		tab.pending = true;
		this.#saveTimer = setTimeout(() => this.#saveNow(tab), SAVE_DELAY);
	}

	#cancelSave() {
		clearTimeout(this.#saveTimer);
		if (this.file) this.file.pending = false;
	}

	/** Runs a pending automatic save right away */
	async #saveNow(tab: Tab) {
		if (!tab.pending) return;
		clearTimeout(this.#saveTimer);
		tab.pending = false;
		if (!tab.dirty) return;
		// Still writing the previous version: try again afterwards
		if (tab.saving) return this.#changed(tab);
		await this.save(tab, { auto: true });
	}

	/** Bar "Save as UTF-8": characters the encoding couldn't hold */
	async saveAsUtf8(tab: Tab) {
		tab.encoding = { charset: 'utf-8', bom: false };
		tab.problem = null;
		if (tab.path) await this.save(tab, { auto: true });
		else this.#scheduleDraft(tab);
	}

	/** The text as it is now (also unsaved), in its encoding and line endings – what a download or “Send …” gives */
	blob(tab: Tab): Blob {
		const { bytes } = encode(tab.state.doc.sliceString(0, tab.state.doc.length, tab.eol), tab.encoding);
		return new Blob([bytes], { type: 'application/octet-stream' });
	}

	download(tab: Tab) {
		downloadBlob(this.blob(tab), tab.suggestedName);
	}

	showInFiles(tab: Tab) {
		if (tab.path) showFolderOf(tab.path);
	}

	// --- Encoding and line ending ---

	/** Next save in this encoding */
	setEncoding(tab: Tab, encoding: Encoding) {
		tab.encoding = encoding;
		this.#changed(tab);
	}

	setEol(tab: Tab, eol: LineEnding) {
		tab.eol = eol;
		this.#changed(tab);
	}

	/** Reads the file again, in `charset` or the current one */
	async reload(tab: Tab, charset: Charset = tab.encoding.charset) {
		if (!tab.path) return;
		tab.busy = true;
		try {
			const file = await this.#readFile(tab.path);
			if (!file || typeof file === 'string') return void toast(file ?? m.toasts.notFound(tab.name), 'error', 8000);
			const decoded = decode(file.bytes, charset);
			if (!decoded) return;
			const head = Math.min(tab.state.selection.main.head, decoded.text.length);
			this.#apply(tab, {
				changes: { from: 0, to: tab.state.doc.length, insert: decoded.text },
				selection: EditorSelection.cursor(head)
			});
			tab.setSaved(decoded, file.stamp);
			this.#cancelSave();
			this.#dropDraft(tab.id);
		} catch (e) {
			fail(e, () => void this.reload(tab, charset));
		} finally {
			tab.busy = false;
		}
	}

	/** Asks before throwing away the unsaved changes */
	#confirmDiscard(tab: Tab) {
		return ask({ ...m.questions.discard, message: m.questions.discard.message(tab.name), danger: true });
	}

	async reopenWith(tab: Tab, charset: Charset) {
		if (tab.dirty && !(await this.#confirmDiscard(tab))) return;
		await this.reload(tab, charset);
	}

	// --- Changes made elsewhere ---

	/** Paths changed somewhere (`watch()` of the file system) */
	changed(paths: string[]) {
		const tab = this.file;
		const path = tab?.path;
		if (tab && path && !tab.busy && paths.some((p) => isInside(path, p))) void this.#check(tab);
	}

	async #check(tab: Tab) {
		const path = tab.path!;
		const entry = await stat(path);
		if (tab.busy || tab.path !== path) return;
		if (!entry || entry.kind !== 'file') {
			tab.conflict = 'deleted';
			return;
		}
		const stamp = stampOf(entry);
		if (sameStamp(stamp, tab.stamp)) {
			if (tab.conflict === 'deleted') tab.conflict = null;
			return;
		}
		if (tab.dirty) tab.conflict = 'changed';
		else {
			// Asked first (once per version, the answer may be kept while the file is open)
			const silent = tab.external.silent;
			if (!(await tab.external.shouldReload(tab.name, `${stamp.size}:${stamp.modified}`))) return;
			if (tab.busy || tab.path !== path) return;
			// Typed into meanwhile: a conflict after all
			if (tab.dirty) return void (tab.conflict = 'changed');
			await this.reload(tab);
			if (silent) toast(m.toasts.reloaded(tab.name));
		}
	}

	/** Keeps the own text; the next save replaces the other version without asking again */
	async keepMine(tab: Tab) {
		const entry = tab.path ? await stat(tab.path) : null;
		tab.stamp = entry && stampOf(entry);
		tab.conflict = null;
		if (tab.dirty) this.#changed(tab);
	}

	// --- Drafts, recently opened, settings ---

	#remember(path: string) {
		recent.remember(path);
	}

	#scheduleDraft(tab: Tab) {
		clearTimeout(this.#draftTimer);
		this.#draftTimer = setTimeout(() => {
			this.#draftTimer = undefined;
			this.#writeDraft(tab);
		}, 800);
	}

	/** No unsaved changes left: no draft either */
	#dropDraft(id: string) {
		clearTimeout(this.#draftTimer);
		this.#draftTimer = undefined;
		void removeDraft(id);
	}

	#writeDraft(tab: Tab) {
		if (!tab.dirty) return removeDraft(tab.id);
		return saveDraft(tab.id, {
			path: tab.path,
			fileName: tab.fileName,
			text: tab.state.doc.toString(),
			encoding: tab.encoding,
			eol: tab.eol,
			stamp: tab.stamp
		}).catch((e) => console.error(e));
	}

	/** Writes a pending save and draft right away (the page is being hidden, closed or left) */
	flush(): Promise<unknown> {
		const tab = this.file;
		if (!tab) return Promise.resolve();
		const jobs: Promise<unknown>[] = [this.#saveNow(tab)];
		if (this.#draftTimer !== undefined) {
			clearTimeout(this.#draftTimer);
			this.#draftTimer = undefined;
			jobs.push(this.#writeDraft(tab));
		}
		return Promise.allSettled(jobs);
	}

	setWrap(wrap: boolean) {
		this.wrap = wrap;
		storeJson(WRAP_KEY, wrap);
		if (this.file) this.#apply(this.file, { effects: wrapSlot.reconfigure(wrapping(wrap)) });
	}

	setLayout(layout: Layout) {
		this.layout = layout;
		storeJson(LAYOUT_KEY, layout);
		this.#view?.requestMeasure();
	}

	setSplit(share: number) {
		this.split = Math.min(SPLIT.max, Math.max(SPLIT.min, share));
		storeJson(SPLIT_KEY, this.split);
	}

	setView(type: string, id: ViewId) {
		this.views = { ...this.views, [type]: id };
		storeJson(VIEWS_KEY, this.views);
	}

	setTableHeader(on: boolean) {
		this.tableHeader = on;
		storeJson(HEADER_KEY, on);
	}

	/** Text size in px (`null`: default) */
	setFontSize(size: number | null) {
		this.fontSize = Math.min(FONT_SIZES.max, Math.max(FONT_SIZES.min, size ?? FONT_SIZES.default));
		storeJson(FONT_KEY, this.fontSize);
		this.#view?.requestMeasure();
	}
}

/** Files in a new browser tab, in the folder of `path` */
export function showFolderOf(path: string) {
	window.open(filesUrl(path), '_blank', 'noopener');
}

/** The paths of “Recently opened” (start page), newest first */
export const recentFiles = () => recent.list();

/** Forgets a file of “Recently opened” */
export function forgetRecent(path: string) {
	recent.forget(path);
}

/** “Open from Files …”: the chosen file's path; the dialog starts next to `near` (the shown file), else where it was last */
export async function chooseFileToOpen(near?: string | null): Promise<string | null> {
	const folder = near ? parent(near) : recent.lastFolder();
	const path = await chooseFile({ mode: 'open', folder, accept: EDITABLE_EXTENSIONS, title: m.dialogs.open });
	if (path) recent.usedFolderOf(path);
	return path;
}

/**
 * A file from the computer becomes a draft without a place (never uploaded on its own); returns its id for the
 * address, or `null` (and a message) when it can't be opened.
 */
export async function draftFromComputer(file: File): Promise<string | null> {
	try {
		if (file.size > MAX_SIZE) {
			toast(m.toasts.tooLarge(file.name, formatSize(MAX_SIZE, intlLocale)), 'error', 8000);
			return null;
		}
		const decoded = decode(new Uint8Array(await file.arrayBuffer()));
		if (!decoded) {
			toast(m.toasts.binary(file.name), 'error');
			return null;
		}
		const id = newDraftId();
		await saveDraft(id, { path: null, fileName: file.name, text: decoded.text, encoding: decoded.encoding, eol: decoded.eol, stamp: null });
		return id;
	} catch (e) {
		fail(e);
		return null;
	}
}
