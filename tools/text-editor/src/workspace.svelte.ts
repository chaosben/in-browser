import { redoDepth, undoDepth } from '@codemirror/commands';
import { EditorSelection, EditorState, Text, type StateEffect, type TransactionSpec, type Transaction } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { resolve } from '$app/paths';
import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { chooseFile, chooseFiles } from '@in-browser/files/dialog.svelte.js';
import { move, read, stat, write, type Entry } from '@in-browser/files/fs.js';
import { filesErrorText, formatSize } from '@in-browser/files/i18n/index.svelte.js';
import { TEXT_EXTENSIONS } from '@in-browser/files/kinds.js';
import { basename, isInside, join, parent } from '@in-browser/files/path.js';
import { CHARSET_NAMES, decode, encode, MAX_SIZE, type Charset, type Decoded, type Encoding, type LineEnding } from '#lib/document.js';
import { loadDraft, pruneDrafts, removeDraft, saveDraft, type FileStamp } from '#lib/drafts.js';
import { markdownKeymap } from '#lib/editor/commands.js';
import { isMarkdown, languageOf } from '#lib/editor/languages.js';
import { createState, languageSlot, wrapping, wrapSlot } from '#lib/editor/setup.js';
import { intlLocale, m } from '#lib/i18n/index.js';

// Open files as tabs: one CodeMirror state per tab, shown by the one `EditorView` of the page. Files with a place in
// the file system save themselves shortly after typing (never with a question: conflicts and characters the encoding
// can't hold pause it and show a bar); files without one (untitled, opened from the computer) wait for "Save …".
// Saving keeps the encoding and line ending; changes made elsewhere (other tabs, the sync) are noticed via
// `watch()`. Unsaved changes are kept as drafts, open tabs in `localStorage`.

const TABS_KEY = 'text-editor:tabs';
const RECENT_KEY = 'text-editor:recent';
const WRAP_KEY = 'text-editor:wrap';
const PREVIEW_KEY = 'text-editor:preview';
const FONT_KEY = 'text-editor:font-size';
const MAX_RECENT = 10;
/** Pause after typing before saving automatically */
const SAVE_DELAY = 1000;
export const FONT_SIZES = { min: 10, default: 14, max: 28 };

function load<T>(key: string, fallback: T): T {
	try {
		const value = localStorage.getItem(key);
		return value === null ? fallback : (JSON.parse(value) as T);
	} catch {
		return fallback;
	}
}

function store(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage full or blocked: only a convenience
	}
}

const stampOf = (entry: Entry): FileStamp => ({ size: entry.size ?? 0, modified: entry.modified ?? 0 });
const sameStamp = (a: FileStamp | null, b: FileStamp | null) => !!a && !!b && a.size === b.size && a.modified === b.modified;
const sameEncoding = (a: Encoding, b: Encoding) => a.charset === b.charset && a.bom === b.bom;

export function encodingName(encoding: Encoding) {
	const name = CHARSET_NAMES[encoding.charset];
	return encoding.bom ? m.encoding.withBom(name) : name;
}

function fail(e: unknown) {
	console.error(e);
	toast(m.toasts.failed(filesErrorText(e)), 'error', 8000);
}

export class Tab {
	readonly id: string;
	path = $state<string | null>(null);
	/** Number of an untitled tab ("Untitled 2") */
	readonly untitled: number;
	/** Name of a file opened from the computer (not saved here yet) */
	fileName = $state<string | null>(null);
	get name() {
		return this.path ? basename(this.path) : (this.fileName ?? m.common.untitled(this.untitled));
	}
	/** CodeMirror state; kept current while the tab is shown */
	state: EditorState;
	/** Counts changes of the text (for the preview) */
	version = $state(0);
	/** Text as last loaded or saved */
	saved: Text;
	encoding = $state<Encoding>({ charset: 'utf-8', bom: false });
	eol = $state<LineEnding>('\n');
	savedEncoding: Encoding = { charset: 'utf-8', bom: false };
	savedEol: LineEnding = '\n';
	changedText = $state(false);
	dirty = $derived(this.changedText || !sameEncoding(this.encoding, this.savedEncoding) || this.eol !== this.savedEol);
	/** The file as last read or written (null: untitled or not there) */
	stamp: FileStamp | null = null;
	/** Changed or removed elsewhere while open */
	conflict = $state<'changed' | 'deleted' | null>(null);
	/** Characters the encoding can't hold: automatic saving waits */
	problem = $state<{ unmappable: number } | null>(null);
	/** Automatic save is waiting for the pause after typing */
	pending = $state(false);
	saving = $state(false);
	history = $state({ undo: 0, redo: 0 });
	cursor = $state({ line: 1, column: 1, selected: 0 });
	language = $state<string | null>(null);
	/** Scroll position while another tab is shown */
	scroll: StateEffect<unknown> | null = null;
	/** Saving or renaming: our own change notifications don't count as changes from elsewhere */
	busy = false;

	constructor(init: {
		id?: string;
		path: string | null;
		untitled: number;
		fileName?: string | null;
		text: string;
		saved: string;
		wrap: boolean;
	}) {
		this.id = init.id ?? crypto.randomUUID();
		this.path = init.path;
		this.untitled = init.untitled;
		this.fileName = init.fileName ?? null;
		this.state = createState(init.text, init.wrap);
		this.saved = init.text === init.saved ? this.state.doc : Text.of(init.saved.split(/\r\n|\r|\n/));
		this.changedText = !this.state.doc.eq(this.saved);
	}

	/** Takes over loaded or saved content as the new clean state */
	setSaved(decoded: Pick<Decoded, 'encoding' | 'eol'>, stamp: FileStamp | null) {
		this.saved = this.state.doc;
		this.changedText = false;
		this.encoding = this.savedEncoding = decoded.encoding;
		this.eol = this.savedEol = decoded.eol;
		this.stamp = stamp;
		this.conflict = null;
		this.problem = null;
	}

	/** Name suggested when saving or downloading */
	get suggestedName() {
		return this.path ? this.name : (this.fileName ?? `${this.name}.txt`);
	}
}

interface StoredTabs {
	tabs: { id: string; path: string | null; untitled: number; fileName?: string | null }[];
	active: string | null;
}

export class Workspace {
	tabs = $state<Tab[]>([]);
	activeId = $state<string | null>(null);
	active = $derived(this.tabs.find((t) => t.id === this.activeId) ?? null);
	wrap = $state(load(WRAP_KEY, false));
	preview = $state(load(PREVIEW_KEY, true));
	recent = $state<string[]>(load(RECENT_KEY, []));
	fontSize = $state(load(FONT_KEY, FONT_SIZES.default));
	/** Folder of the last open/save dialog */
	folder = '/';

	#view: EditorView | null = null;
	#draftTimers = new Map<string, ReturnType<typeof setTimeout>>();
	#saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

	// --- The editor view ---

	/** Called by the editor component once its view exists; returns the cleanup */
	attach(view: EditorView) {
		this.#view = view;
		if (this.active) this.#show(this.active);
		return () => {
			if (this.active) this.active.scroll = view.scrollSnapshot();
			this.#view = null;
			view.destroy();
		};
	}

	/** Every transaction of the view (the active tab) */
	update(view: EditorView, transactions: readonly Transaction[]) {
		const tab = this.active;
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
		const line = view.state.doc.lineAt(main.head);
		tab.cursor = {
			line: line.number,
			column: main.head - line.from + 1,
			selected: view.state.selection.ranges.reduce((sum, r) => sum + r.to - r.from, 0)
		};
	}

	/** Applies a change to a tab, whether it is shown or not */
	#apply(tab: Tab, spec: TransactionSpec) {
		if (tab === this.active && this.#view) this.#view.dispatch(spec);
		else {
			tab.state = tab.state.update(spec).state;
			tab.version++;
		}
	}

	#show(tab: Tab) {
		const view = this.#view;
		if (!view) return;
		view.setState(tab.state);
		if (tab.scroll) view.dispatch({ effects: tab.scroll });
		this.update(view, []);
		view.focus();
	}

	focus() {
		this.#view?.focus();
	}

	/** Runs an editor command (toolbar, menus) on the active tab */
	run(command: (view: EditorView) => boolean) {
		const view = this.#view;
		if (!view || !this.active) return;
		command(view);
		view.focus();
	}

	// --- Tabs ---

	activate(tab: Tab) {
		if (tab === this.active) return this.focus();
		if (this.active) this.#saveNow(this.active);
		if (this.active && this.#view) this.active.scroll = this.#view.scrollSnapshot();
		this.activeId = tab.id;
		this.#show(tab);
		this.#persist();
	}

	#add(tab: Tab) {
		// A fresh empty "Untitled" gives way to the first file opened
		const blank = this.tabs.length === 1 && !this.tabs[0].path && !this.tabs[0].dirty && this.tabs[0].state.doc.length === 0;
		if (blank) this.tabs = [tab];
		else this.tabs.push(tab);
		this.activate(tab);
		this.#loadLanguage(tab);
	}

	newTab() {
		const used = new Set(this.tabs.filter((t) => !t.path).map((t) => t.untitled));
		let untitled = 1;
		while (used.has(untitled)) untitled++;
		const tab = new Tab({ path: null, untitled, text: '', saved: '', wrap: this.wrap });
		this.tabs.push(tab);
		this.activate(tab);
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

	/** Reads a file: its bytes and stamp, or `null` (and a message) if it can't be opened */
	async #readFile(path: string): Promise<{ bytes: Uint8Array; stamp: FileStamp } | null> {
		const entry = await stat(path);
		if (!entry || entry.kind !== 'file') {
			toast(m.toasts.notFound(basename(path)), 'error');
			this.recent = this.recent.filter((p) => p !== path);
			store(RECENT_KEY, this.recent);
			return null;
		}
		if ((entry.size ?? 0) > MAX_SIZE) {
			toast(m.toasts.tooLarge(entry.name, formatSize(MAX_SIZE, intlLocale)), 'error', 8000);
			return null;
		}
		const file = await read(path);
		return { bytes: new Uint8Array(await file.arrayBuffer()), stamp: { size: file.size, modified: file.lastModified } };
	}

	async open(path: string) {
		const existing = this.tabs.find((t) => t.path === path);
		if (existing) return this.activate(existing);
		try {
			const file = await this.#readFile(path);
			if (!file) return;
			const decoded = decode(file.bytes);
			if (!decoded) return toast(m.toasts.binary(basename(path)), 'error');
			const tab = new Tab({ path, untitled: 0, text: decoded.text, saved: decoded.text, wrap: this.wrap });
			tab.setSaved(decoded, file.stamp);
			this.#add(tab);
			this.#remember(path);
		} catch (e) {
			fail(e);
		}
	}

	async openDialog() {
		const paths = await chooseFiles({
			mode: 'open',
			multiple: true,
			folder: this.#dialogFolder(),
			accept: TEXT_EXTENSIONS,
			title: m.dialogs.open
		});
		if (!paths?.length) return;
		this.folder = parent(paths[0]);
		for (const path of paths) await this.open(path);
	}

	#dialogFolder() {
		return this.active?.path ? parent(this.active.path) : this.folder;
	}

	async close(tab: Tab) {
		// A file with a place saves first; only what can't be saved that way needs a question
		if (tab.dirty && tab.path && !tab.conflict && !tab.problem) await this.save(tab, { auto: true });
		if (tab.dirty) {
			const ok = await ask({ ...m.questions.discard, message: m.questions.discard.message(tab.name), danger: true });
			if (!ok) return false;
		}
		this.#cancelSave(tab);
		this.#cancelDraft(tab.id);
		removeDraft(tab.id);
		const index = this.tabs.indexOf(tab);
		const wasActive = tab === this.active;
		this.tabs.splice(index, 1);
		if (wasActive) {
			const next = this.tabs[Math.min(index, this.tabs.length - 1)];
			this.activeId = null;
			if (next) this.activate(next);
		}
		this.#persist();
		return true;
	}

	async closeOthers(keep: Tab) {
		for (const tab of [...this.tabs]) {
			if (tab !== keep && !(await this.close(tab))) return;
		}
		this.activate(keep);
	}

	// --- Saving ---

	/**
	 * Saves the tab. Manually (Ctrl+S, "Save …"): asks for a place if needed and asks before replacing a newer
	 * version or losing characters. Automatically: never asks – a conflict or unmappable characters pause it instead.
	 */
	async save(tab: Tab, { as = false, auto = false } = {}): Promise<boolean> {
		let path = tab.path;
		if (!path || as) {
			if (auto) return false;
			path = await chooseFile({
				mode: 'save',
				folder: tab.path ? parent(tab.path) : this.folder,
				accept: TEXT_EXTENSIONS,
				name: tab.suggestedName,
				title: m.dialogs.saveAs,
				overwrite: true
			});
			if (!path) return false;
			this.folder = parent(path);
		}
		if (auto && tab.conflict === 'changed') return false;
		this.#cancelSave(tab);

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
			const renamed = path !== tab.path;
			tab.path = path;
			tab.fileName = null;
			// Typing goes on while saving: what counts as saved is what was written
			tab.setSaved({ encoding, eol }, entry && stampOf(entry));
			tab.saved = doc;
			tab.changedText = !tab.state.doc.eq(doc);
			if (tab.dirty) this.#changed(tab);
			else {
				this.#cancelDraft(tab.id);
				removeDraft(tab.id);
			}
			if (renamed) this.#loadLanguage(tab);
			this.#remember(path);
			this.#persist();
			if (!located || as) toast(m.toasts.saved(tab.name), 'success', 2000);
			return true;
		} catch (e) {
			fail(e);
			return false;
		} finally {
			tab.busy = tab.saving = false;
		}
	}

	/** After every change of a tab: keep a draft and, for files with a place, save after a pause */
	#changed(tab: Tab) {
		this.#scheduleDraft(tab);
		if (!tab.path) return;
		this.#cancelSave(tab);
		tab.pending = true;
		this.#saveTimers.set(
			tab.id,
			setTimeout(() => this.#saveNow(tab), SAVE_DELAY)
		);
	}

	#cancelSave(tab: Tab) {
		clearTimeout(this.#saveTimers.get(tab.id));
		this.#saveTimers.delete(tab.id);
		tab.pending = false;
	}

	/** Runs a pending automatic save right away */
	async #saveNow(tab: Tab) {
		if (!tab.pending) return;
		this.#cancelSave(tab);
		if (!this.tabs.includes(tab) || !tab.dirty) return;
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

	async rename(tab: Tab, name: string) {
		name = name.trim();
		if (!tab.path || !name || name === tab.name) return;
		const to = join(parent(tab.path), name);
		tab.busy = true;
		try {
			await move(tab.path, to);
			const entry = await stat(to);
			tab.path = to;
			if (entry) tab.stamp = stampOf(entry);
			this.#loadLanguage(tab);
			this.#remember(to);
			this.#persist();
		} catch (e) {
			fail(e);
		} finally {
			tab.busy = false;
		}
	}

	download(tab: Tab) {
		const { bytes } = encode(tab.state.doc.sliceString(0, tab.state.doc.length, tab.eol), tab.encoding);
		const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = tab.suggestedName;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
	}

	showInFiles(tab: Tab) {
		if (tab.path) window.open(`${resolve('/files')}?path=${encodeURIComponent(parent(tab.path))}`, '_blank', 'noopener');
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

	/** Reads the file again, in `charset` or the tab's current one */
	async reload(tab: Tab, charset: Charset = tab.encoding.charset) {
		if (!tab.path) return;
		tab.busy = true;
		try {
			const file = await this.#readFile(tab.path);
			if (!file) return;
			const decoded = decode(file.bytes, charset);
			if (!decoded) return;
			const head = Math.min(tab.state.selection.main.head, decoded.text.length);
			this.#apply(tab, {
				changes: { from: 0, to: tab.state.doc.length, insert: decoded.text },
				selection: EditorSelection.cursor(head)
			});
			tab.setSaved(decoded, file.stamp);
			this.#cancelSave(tab);
			this.#cancelDraft(tab.id);
			removeDraft(tab.id);
		} catch (e) {
			fail(e);
		} finally {
			tab.busy = false;
		}
	}

	async reopenWith(tab: Tab, charset: Charset) {
		if (tab.dirty) {
			const ok = await ask({ ...m.questions.discard, message: m.questions.discard.message(tab.name), danger: true });
			if (!ok) return;
		}
		await this.reload(tab, charset);
	}

	// --- Changes made elsewhere ---

	/** Paths changed somewhere (`watch()` of the file system) */
	changed(paths: string[]) {
		for (const tab of this.tabs) {
			const path = tab.path;
			if (path && !tab.busy && paths.some((p) => isInside(path, p))) this.#check(tab);
		}
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
			await this.reload(tab);
			toast(m.toasts.reloaded(tab.name));
		}
	}

	/** Keeps the own text; the next save replaces the other version without asking again */
	async keepMine(tab: Tab) {
		const entry = tab.path ? await stat(tab.path) : null;
		tab.stamp = entry && stampOf(entry);
		tab.conflict = null;
		if (tab.dirty) this.#changed(tab);
	}

	// --- Persistence: open tabs, drafts, recent files, settings ---

	#persist() {
		const stored: StoredTabs = {
			tabs: this.tabs.map((t) => ({ id: t.id, path: t.path, untitled: t.untitled, fileName: t.fileName })),
			active: this.activeId
		};
		store(TABS_KEY, stored);
	}

	#remember(path: string) {
		this.recent = [path, ...this.recent.filter((p) => p !== path)].slice(0, MAX_RECENT);
		store(RECENT_KEY, this.recent);
	}

	forget(path: string) {
		this.recent = this.recent.filter((p) => p !== path);
		store(RECENT_KEY, this.recent);
	}

	#scheduleDraft(tab: Tab) {
		this.#cancelDraft(tab.id);
		this.#draftTimers.set(
			tab.id,
			setTimeout(() => {
				this.#draftTimers.delete(tab.id);
				this.#writeDraft(tab);
			}, 800)
		);
	}

	#cancelDraft(id: string) {
		clearTimeout(this.#draftTimers.get(id));
		this.#draftTimers.delete(id);
	}

	#writeDraft(tab: Tab) {
		if (!this.tabs.includes(tab)) return;
		if (!tab.dirty) return removeDraft(tab.id);
		return saveDraft(tab.id, {
			path: tab.path,
			text: tab.state.doc.toString(),
			encoding: tab.encoding,
			eol: tab.eol,
			stamp: tab.stamp
		}).catch((e) => console.error(e));
	}

	/** Writes pending saves and drafts right away (page is being hidden or closed) */
	flush() {
		for (const tab of this.tabs) this.#saveNow(tab);
		for (const id of [...this.#draftTimers.keys()]) {
			const tab = this.tabs.find((t) => t.id === id);
			this.#cancelDraft(id);
			if (tab) this.#writeDraft(tab);
		}
	}

	/** Brings back the tabs of the last visit, with their unsaved changes */
	async restore() {
		const stored = load<StoredTabs>(TABS_KEY, { tabs: [], active: null });
		for (const entry of stored.tabs) {
			try {
				const tab = await this.#restoreTab(entry);
				if (tab) this.tabs.push(tab);
			} catch (e) {
				console.error(e);
			}
		}
		await pruneDrafts(new Set(this.tabs.map((t) => t.id)));
		const active = this.tabs.find((t) => t.id === stored.active) ?? this.tabs.at(-1);
		if (active) this.activate(active);
		for (const tab of this.tabs) {
			this.#loadLanguage(tab);
			// Changes from the last visit that could be saved here go out now
			if (tab.dirty && tab.path && !tab.conflict) this.#changed(tab);
		}
		this.#persist();
	}

	async #restoreTab({ id, path, untitled, fileName }: StoredTabs['tabs'][number]): Promise<Tab | null> {
		const draft = await loadDraft(id);
		const entry = path ? await stat(path) : null;
		const exists = entry?.kind === 'file' && (entry.size ?? 0) <= MAX_SIZE;
		const decoded = exists ? decode(new Uint8Array(await (await read(path!)).arrayBuffer())) : null;
		// Without changes a tab only comes back with its file
		if (!draft && !decoded) return null;
		const text = draft?.text ?? decoded!.text;
		const tab = new Tab({ id, path, untitled, fileName, text, saved: decoded?.text ?? '', wrap: this.wrap });
		const now = exists ? stampOf(entry!) : null;
		tab.encoding = tab.savedEncoding = decoded?.encoding ?? { charset: 'utf-8', bom: false };
		tab.eol = tab.savedEol = decoded?.eol ?? '\n';
		tab.stamp = draft ? draft.stamp : now;
		if (draft) {
			tab.encoding = draft.encoding;
			tab.eol = draft.eol;
			if (path && !exists) tab.conflict = 'deleted';
			else if (path && !sameStamp(now, draft.stamp)) tab.conflict = 'changed';
		}
		return tab;
	}

	setWrap(wrap: boolean) {
		this.wrap = wrap;
		store(WRAP_KEY, wrap);
		for (const tab of this.tabs) this.#apply(tab, { effects: wrapSlot.reconfigure(wrapping(wrap)) });
	}

	setPreview(preview: boolean) {
		this.preview = preview;
		store(PREVIEW_KEY, preview);
	}

	/** Text size in px (`null`: default) */
	setFontSize(size: number | null) {
		this.fontSize = Math.min(FONT_SIZES.max, Math.max(FONT_SIZES.min, size ?? FONT_SIZES.default));
		store(FONT_KEY, this.fontSize);
		this.#view?.requestMeasure();
	}

	// --- Files from the computer ---

	/** Opens files from the computer as tabs without a place; they land in the file system only when saved */
	async openLocal(files: File[]) {
		for (const file of files) {
			try {
				if (file.size > MAX_SIZE) {
					toast(m.toasts.tooLarge(file.name, formatSize(MAX_SIZE, intlLocale)), 'error', 8000);
					continue;
				}
				const decoded = decode(new Uint8Array(await file.arrayBuffer()));
				if (!decoded) {
					toast(m.toasts.binary(file.name), 'error');
					continue;
				}
				const tab = new Tab({ path: null, untitled: 0, fileName: file.name, text: decoded.text, saved: '', wrap: this.wrap });
				tab.encoding = tab.savedEncoding = decoded.encoding;
				tab.eol = tab.savedEol = decoded.eol;
				this.#add(tab);
				this.#scheduleDraft(tab);
				this.#persist();
			} catch (e) {
				fail(e);
			}
		}
	}
}
