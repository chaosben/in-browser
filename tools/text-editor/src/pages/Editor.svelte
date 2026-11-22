<script lang="ts">
	// One file (`?path=` of a file with a place, `?draft=` of one without – new or from the computer): the ribbon on
	// top, the text and its view (table, tree, preview) below, position and encoding in the footer. Every action is a
	// `Command` (ribbon, keys). Another file replaces this one in the same browser tab (saved first); one browser tab
	// at a time edits a file (Web Lock).
	import { onDestroy, tick, untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { indentLess, indentMore, moveLineDown, moveLineUp, redo, selectAll, toggleComment, undo } from '@codemirror/commands';
	import { gotoLine, openSearchPanel } from '@codemirror/search';
	import type { EditorView } from '@codemirror/view';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { setBrandBar } from '@in-browser/brand/brand-bar.svelte.js';
	import { saveStateOf, setBrandFooter, type SaveState } from '@in-browser/brand/brand-footer.svelte.js';
	import { installCommandKeys, shortcutLabel, type Command } from '@in-browser/brand/commands.js';
	import DropOverlay from '@in-browser/brand/DropOverlay.svelte';
	import { brandMessages, toolName } from '@in-browser/brand/i18n/index.svelte.js';
	import Ribbon from '@in-browser/brand/Ribbon.svelte';
	import type { RibbonTab } from '@in-browser/brand/ribbon.js';
	import { type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { flushWhenHidden, lockDocument } from '@in-browser/files/documents.js';
	import { supported, watch } from '@in-browser/files/fs.js';
	import { filesErrorText, filesMessages } from '@in-browser/files/i18n/index.svelte.js';
	import { EDITABLE_EXTENSIONS } from '@in-browser/files/kinds.js';
	import { normalize } from '@in-browser/files/path.js';
	import { accessAction } from '@in-browser/files/sources/connections.svelte.js';
	import { draftUrl, editorUrl } from '#lib/brand.js';
	import Editor from '#lib/components/Editor.svelte';
	import StatusBar from '#lib/components/StatusBar.svelte';
	import { removeDraft, isDraftId } from '#lib/drafts.js';
	import { droppedFile, hasFiles } from '#lib/drop.js';
	import {
		bold,
		codeBlock,
		copySelection,
		inlineCode,
		insertLink,
		italic,
		openReplace,
		pasteClipboard,
		toggleLinePrefix,
		type LineKind
	} from '#lib/editor/commands.js';
	import { isMarkdown } from '#lib/editor/languages.js';
	import { SHORTCUTS as S } from '#lib/editor/shortcuts.js';
	import { m } from '#lib/i18n/index.js';
	import type { Target } from '#lib/session.js';
	import type { Tab } from '#lib/tab.svelte.js';
	import { TABLE, TREE, viewCommand } from '#lib/views/commands.js';
	import DataView from '#lib/views/DataView.svelte';
	import { viewsOf, type ViewId } from '#lib/views/registry.js';
	import SplitView from '#lib/views/SplitView.svelte';
	import type { ViewHost } from '#lib/views/types.js';
	import { chooseFileToOpen, draftFromComputer, encodingName, FONT_SIZES, Workspace, type Layout } from '#lib/workspace.svelte.js';

	const workspace = new Workspace();
	const file = $derived(workspace.file);
	const markdown = $derived(!!file && isMarkdown(file.name));
	/** Why the file isn't shown (gone, not text, open in another tab …) */
	let error = $state<string | null>(null);
	/** Opening failed because the browser doesn't allow access to the connected folder right now */
	let access = $state<ReturnType<typeof accessAction>>(undefined);
	let dropping = $state(false);
	let fileInput = $state<HTMLInputElement>();
	/** Below `md` there is no room for text and view side by side: one of them fills the page */
	const narrow = new MediaQuery('max-width: 47.99rem', false);
	/** Phones: the view instead of the text */
	let viewOnPhone = $state(false);

	// The views of the file (table, tree, preview …) and the one chosen for its type
	const fileViews = $derived(file ? viewsOf(file.name, () => file.state.doc.toString()) : null);
	const spec = $derived(fileViews && (fileViews.views.find((v) => v.id === workspace.views[fileViews.type]) ?? fileViews.views[0]));
	const layout = $derived<Layout>(!spec ? 'text' : narrow.current ? (viewOnPhone ? 'view' : 'text') : workspace.layout);
	const textShown = $derived(layout !== 'view');
	const viewShown = $derived(layout !== 'text');

	const VIEW_ICONS: Record<ViewId, string> = {
		markdown: 'icon-[material-symbols-light--preview]',
		html: 'icon-[material-symbols-light--preview]',
		svg: 'icon-[material-symbols-light--image-outline]',
		table: 'icon-[material-symbols-light--table-outline]',
		tree: 'icon-[material-symbols-light--account-tree-outline]'
	};

	function setLayout(next: Layout) {
		if (narrow.current) viewOnPhone = next === 'view';
		else workspace.setLayout(next);
	}

	/** What a view may do with the text */
	function hostFor(tab: Tab): ViewHost {
		return {
			edit: (changes) => workspace.edit(tab, changes),
			reveal: (from, to) => workspace.reveal(tab, from, to, textShown),
			undo: () => workspace.run(undo, { focus: false }),
			redo: () => workspace.run(redo, { focus: false }),
			register(ui) {
				workspace.viewUi = ui;
				return () => {
					if (workspace.viewUi === ui) workspace.viewUi = null;
				};
			},
			async showText(pos) {
				if (narrow.current) viewOnPhone = false;
				else if (workspace.layout === 'view') workspace.setLayout('split');
				await tick();
				workspace.reveal(tab, pos);
				workspace.focus();
			},
			focusText() {
				if (textShown) workspace.focus();
			},
			get textVisible() {
				return textShown;
			},
			get tableHeader() {
				return workspace.tableHeader;
			},
			set tableHeader(on) {
				workspace.setTableHeader(on);
			}
		};
	}
	const host = $derived(file ? hostFor(file) : null);

	// --- The file of the address: locked, read, shown; another address replaces it ---

	/** The lock of the shown file (`lockDocument`) */
	let lock: { key: string; release: () => void } | null = null;
	/** Counts addresses: an older one that finishes loading late is dropped */
	let generation = 0;

	function targetOf(params: { get(name: string): string | null }): Target | null {
		const path = params.get('path');
		if (path) return { path: normalize(path) };
		const draft = params.get('draft');
		return draft && isDraftId(draft) ? { draft } : null;
	}

	const lockKey = (t: Target) => ('path' in t ? `text-editor:file:${t.path}` : `text-editor:draft:${t.draft}`);

	/** The file of `t` is the one shown (e.g. after it got a place with “Save as …”) */
	function shows(t: Target) {
		const f = workspace.file;
		return !!f && ('path' in t ? f.path === t.path : !f.path && f.id === t.draft);
	}

	/** Takes the lock of the file's new place; the old one goes only once the new one is held */
	async function relock(key: string) {
		if (lock?.key === key) return;
		const release = await lockDocument(key);
		if (!release) return;
		lock?.release();
		lock = { key, release };
	}

	/** Lets the shown file go: pending saves and drafts first, then its lock */
	function letGo() {
		const done = workspace.dispose();
		const held = lock;
		lock = null;
		void done.finally(() => held?.release());
	}

	async function show(t: Target | null) {
		const current = ++generation;
		if (!t) return void goto(resolve('/text-editor'), { replace: true });
		if (shows(t)) return void relock(lockKey(t));
		letGo();
		error = null;
		access = undefined;
		viewOnPhone = false;
		try {
			const key = lockKey(t);
			const release = await lockDocument(key);
			if (current !== generation) return release?.();
			if (!release) return void (error = m.editor.openElsewhere);
			lock = { key, release };
			const loaded = 'path' in t ? await workspace.load(t.path) : await workspace.loadDraft(t.draft);
			if (current !== generation) return;
			if (typeof loaded === 'string') error = loaded;
			else workspace.open(loaded);
		} catch (e) {
			if (current !== generation) return;
			console.error(e);
			error = m.editor.loadFailed(filesErrorText(e));
			access = accessAction(e, () => location.reload());
		}
	}

	$effect(() => {
		if (!supported()) return;
		const t = targetOf(page.url.searchParams);
		untrack(() => void show(t));
	});

	// A file without a place got one: its address becomes the file's
	workspace.onplaced = (path) => void goto(editorUrl(path), { replace: true });

	$effect(() => {
		if (!supported()) return;
		const stop = watch((paths) => workspace.changed(paths));
		// Pending saves and drafts go out before the page is hidden or closed
		const stopFlush = flushWhenHidden(() => void workspace.flush());
		return () => {
			stop();
			stopFlush();
		};
	});

	onDestroy(() => {
		generation++;
		letGo();
	});

	/** Another file (or the start page) in this browser tab: this one is saved first, or asks before its changes go */
	async function go(url: string) {
		if (await workspace.leave()) await goto(url);
	}

	async function openFromComputer(picked: File | null) {
		const id = picked && (await draftFromComputer(picked));
		if (!id) return;
		if (!(await workspace.leave())) return void removeDraft(id);
		await goto(draftUrl(id));
	}

	// --- Commands: every action once, placed in the ribbon and the keyboard handling from here ---

	const keys = (s: Command['shortcut']) => (s ? shortcutLabel(s, brandMessages().keys) : undefined);

	/** Runs an editor command on the text; only while the text is shown */
	const run = (command: (view: EditorView) => boolean) => () => workspace.run(command);
	const textOn = () => !!file && textShown;
	const markdownOn = () => markdown && textShown;
	const hasSelection = () => textOn() && !!file?.cursor.selected;

	/** Clipboard through the browser's API (the keys Ctrl+X/C/V work as everywhere) */
	const clipboard = (action: (view: EditorView) => Promise<void>) => () =>
		workspace.run((view) => {
			action(view).catch((e) => {
				console.error(e);
				toast(m.edit.clipboardFailed, 'error', 8000);
			});
			return true;
		});

	const lineCommand = (id: LineKind, label: string, icon: string): Command => ({ id, label, icon, enabled: markdownOn, run: run(toggleLinePrefix(id)) });

	const replace: Command = {
		id: 'replace',
		label: m.edit.replace,
		icon: 'icon-[material-symbols-light--find-replace]',
		shortcut: S.replace,
		enabled: textOn,
		run: run(openReplace)
	};
	const gotoLineCommand: Command = {
		id: 'gotoLine',
		label: m.edit.gotoLine,
		icon: 'icon-[material-symbols-light--move-down]',
		shortcut: S.gotoLine,
		enabled: textOn,
		run: run(gotoLine)
	};
	const asEntry = (c: Command): MenuEntry => ({ label: c.label, icon: c.icon, keys: keys(c.shortcut), disabled: c.enabled?.() === false, run: c.run! });

	/** Text only, side by side, the view only (radio buttons; side by side needs room) */
	const layoutCommand = (id: Layout, label: string, icon: string): Command => ({
		id: `layout.${id}`,
		label,
		icon,
		enabled: () => !!spec && (id !== 'split' || !narrow.current),
		active: () => !!spec && layout === id,
		run: () => setLayout(id)
	});

	const openFromFiles = async () => {
		const path = await chooseFileToOpen(file?.path);
		if (path && path !== file?.path) await go(editorUrl(path));
	};

	const commands = {
		undo: {
			id: 'undo',
			label: m.edit.undo,
			icon: 'icon-[material-symbols-light--undo]',
			shortcut: S.undo,
			enabled: () => !!file?.history.undo,
			// The focus stays in a view that is shown
			run: () => workspace.run(undo, { focus: !viewShown })
		},
		redo: {
			id: 'redo',
			label: m.edit.redo,
			icon: 'icon-[material-symbols-light--redo]',
			shortcut: S.redo,
			enabled: () => !!file?.history.redo,
			run: () => workspace.run(redo, { focus: !viewShown })
		},
		cut: { id: 'cut', label: m.edit.cut, icon: 'icon-[material-symbols-light--content-cut]', enabled: hasSelection, run: clipboard((v) => copySelection(v, true)) },
		copy: { id: 'copy', label: m.edit.copy, icon: 'icon-[material-symbols-light--content-copy-outline]', enabled: hasSelection, run: clipboard((v) => copySelection(v)) },
		paste: { id: 'paste', label: m.edit.paste, icon: 'icon-[material-symbols-light--content-paste]', enabled: textOn, run: clipboard(pasteClipboard) },
		find: {
			id: 'find',
			label: m.edit.find,
			icon: 'icon-[material-symbols-light--search]',
			shortcut: S.find,
			enabled: textOn,
			run: run(openSearchPanel),
			menu: () => [asEntry(replace), asEntry(gotoLineCommand)]
		},
		replace,
		gotoLine: gotoLineCommand,
		selectAll: { id: 'selectAll', label: m.edit.selectAll, icon: 'icon-[material-symbols-light--select-all]', shortcut: S.selectAll, enabled: textOn, run: run(selectAll) },
		toggleComment: {
			id: 'toggleComment',
			label: m.edit.toggleComment,
			tip: m.edit.toggleCommentTip,
			icon: 'icon-[material-symbols-light--comment-outline]',
			shortcut: S.toggleComment,
			enabled: textOn,
			run: run(toggleComment)
		},
		indent: { id: 'indent', label: m.edit.indent, icon: 'icon-[material-symbols-light--format-indent-increase]', shortcut: S.indent, enabled: textOn, run: run(indentMore) },
		outdent: { id: 'outdent', label: m.edit.outdent, icon: 'icon-[material-symbols-light--format-indent-decrease]', shortcut: S.outdent, enabled: textOn, run: run(indentLess) },
		lineUp: { id: 'lineUp', label: m.edit.lineUp, icon: 'icon-[material-symbols-light--arrow-upward]', shortcut: S.lineUp, enabled: textOn, run: run(moveLineUp) },
		lineDown: { id: 'lineDown', label: m.edit.lineDown, icon: 'icon-[material-symbols-light--arrow-downward]', shortcut: S.lineDown, enabled: textOn, run: run(moveLineDown) },

		bold: { id: 'bold', label: m.format.bold, icon: 'icon-[material-symbols-light--format-bold]', shortcut: S.bold, enabled: markdownOn, run: run(bold) },
		italic: { id: 'italic', label: m.format.italic, icon: 'icon-[material-symbols-light--format-italic]', shortcut: S.italic, enabled: markdownOn, run: run(italic) },
		inlineCode: { id: 'inlineCode', label: m.format.inlineCode, icon: 'icon-[material-symbols-light--code]', enabled: markdownOn, run: run(inlineCode) },
		link: { id: 'link', label: m.format.link, icon: 'icon-[material-symbols-light--link]', shortcut: S.link, enabled: markdownOn, run: run(insertLink) },
		h1: lineCommand('h1', m.format.heading(1), 'icon-[material-symbols-light--format-h1]'),
		h2: lineCommand('h2', m.format.heading(2), 'icon-[material-symbols-light--format-h2]'),
		h3: lineCommand('h3', m.format.heading(3), 'icon-[material-symbols-light--format-h3]'),
		quote: lineCommand('quote', m.format.quote, 'icon-[material-symbols-light--format-quote-outline]'),
		codeBlock: { id: 'codeBlock', label: m.format.codeBlock, icon: 'icon-[material-symbols-light--code-blocks-outline]', enabled: markdownOn, run: run(codeBlock) },
		bullet: lineCommand('bullet', m.format.bulletList, 'icon-[material-symbols-light--format-list-bulleted]'),
		number: lineCommand('number', m.format.numberedList, 'icon-[material-symbols-light--format-list-numbered]'),
		task: lineCommand('task', m.format.taskList, 'icon-[material-symbols-light--checklist]'),

		textOnly: layoutCommand('text', m.view.textOnly, 'icon-[material-symbols-light--article-outline]'),
		split: layoutCommand('split', m.view.split, 'icon-[material-symbols-light--view-column-2-outline]'),
		viewOnly: layoutCommand('view', m.view.viewOnly, 'icon-[material-symbols-light--preview]'),
		viewType: {
			id: 'viewType',
			label: m.view.viewType,
			icon: 'icon-[material-symbols-light--table-outline]',
			enabled: () => (fileViews?.views.length ?? 0) > 1,
			menu: () =>
				(fileViews?.views ?? []).map((v) => ({
					label: m.views[v.id],
					icon: VIEW_ICONS[v.id],
					checked: v === spec,
					run: () => {
						workspace.setView(fileViews!.type, v.id);
						if (!viewShown) setLayout(narrow.current ? 'view' : 'split');
					}
				}))
		},
		wrap: {
			id: 'wrap',
			label: m.view.wrap,
			icon: 'icon-[material-symbols-light--wrap-text]',
			enabled: () => !!file,
			active: () => workspace.wrap,
			run: () => workspace.setWrap(!workspace.wrap)
		},
		fontLarger: {
			id: 'fontLarger',
			label: m.view.fontLarger,
			icon: 'icon-[material-symbols-light--text-increase]',
			enabled: () => workspace.fontSize < FONT_SIZES.max,
			run: () => workspace.setFontSize(workspace.fontSize + 1)
		},
		fontSmaller: {
			id: 'fontSmaller',
			label: m.view.fontSmaller,
			icon: 'icon-[material-symbols-light--text-decrease]',
			enabled: () => workspace.fontSize > FONT_SIZES.min,
			run: () => workspace.setFontSize(workspace.fontSize - 1)
		},
		fontReset: {
			id: 'fontReset',
			label: m.view.fontReset,
			icon: 'icon-[material-symbols-light--format-size]',
			enabled: () => workspace.fontSize !== FONT_SIZES.default,
			run: () => workspace.setFontSize(null)
		},

		new: { id: 'new', label: m.actions.new, icon: 'icon-[material-symbols-light--note-add-outline]', shortcut: S.new, run: () => void go(draftUrl()) },
		openFromFiles: {
			id: 'openFromFiles',
			label: m.actions.openFromFiles,
			icon: 'icon-[material-symbols-light--folder-open-outline]',
			shortcut: S.open,
			run: () => void openFromFiles()
		},
		openFromComputer: { id: 'openFromComputer', label: m.actions.openFromComputer, icon: 'icon-[material-symbols-light--upload-file-outline]', run: () => fileInput?.click() },
		// The ribbon's “Open”: from the files, its arrow also from the computer
		open: {
			id: 'open',
			label: m.actions.open,
			icon: 'icon-[material-symbols-light--folder-open-outline]',
			run: () => void openFromFiles(),
			menu: (): MenuEntry[] => [asEntry(commands.openFromFiles), asEntry(commands.openFromComputer)]
		},
		save: {
			id: 'save',
			label: m.actions.save,
			icon: 'icon-[material-symbols-light--save-outline]',
			shortcut: S.save,
			enabled: () => !!file,
			run: () => file && void workspace.save(file)
		},
		saveAs: {
			id: 'saveAs',
			label: m.actions.saveAs,
			icon: 'icon-[material-symbols-light--save-as-outline]',
			shortcut: S.saveAs,
			enabled: () => !!file,
			run: () => file && void workspace.save(file, { as: true })
		},
		download: {
			id: 'download',
			label: m.actions.download,
			icon: 'icon-[material-symbols-light--download]',
			enabled: () => !!file,
			run: () => file && workspace.download(file)
		},
		showInFiles: {
			id: 'showInFiles',
			label: m.actions.showInFiles,
			icon: 'icon-[material-symbols-light--open-in-new]',
			enabled: () => !!file?.path,
			run: () => file && workspace.showInFiles(file)
		},
		// Back to the start page
		close: { id: 'close', label: m.actions.close, icon: 'icon-[material-symbols-light--close]', shortcut: S.close, run: () => void go(resolve('/text-editor')) }
	} satisfies Record<string, Command>;

	// Ctrl+Y redoes too
	const redoAlt: Command = { ...commands.redo, id: 'redoAlt', shortcut: S.redoAlt };
	$effect(() => installCommandKeys(() => (supported() ? [...Object.values(commands), redoAlt] : [])));

	// --- The ribbon: tabs and groups (fixed; what can't be done now is disabled) ---

	const viewUi = () => (viewShown ? workspace.viewUi : null);
	const tableCmd = Object.fromEntries(Object.values(TABLE).map((s) => [s.id, viewCommand(s, viewUi)]));
	const treeCmd = Object.fromEntries(Object.values(TREE).map((s) => [s.id, viewCommand(s, viewUi)]));
	const g = m.ribbon.groups;

	const tabs: RibbonTab[] = [
		// The file itself (a file is named after itself – renamed in Files)
		{
			id: 'file',
			label: brandMessages().ribbon.file,
			groups: [
				{ id: 'new', label: g.new, items: [commands.new, commands.open] },
				{ id: 'file', label: g.file, items: [commands.save, commands.saveAs, commands.download, commands.showInFiles, commands.close] }
			]
		},
		{
			id: 'home',
			label: m.ribbon.tabs.home,
			groups: [
				{ id: 'clipboard', label: g.clipboard, items: [commands.paste, commands.cut, commands.copy] },
				{ id: 'find', label: g.find, items: [commands.find] },
				{
					id: 'edit',
					label: g.edit,
					items: [commands.selectAll, commands.toggleComment, commands.indent, commands.outdent, commands.lineUp, commands.lineDown]
				}
			]
		},
		{
			// Fixed like “Form” in the PDF Editor: its commands work in Markdown files only
			id: 'format',
			label: m.ribbon.tabs.format,
			groups: [
				{ id: 'text', label: g.text, items: [commands.bold, commands.italic, commands.inlineCode, commands.link] },
				{ id: 'paragraph', label: g.paragraph, items: [commands.h1, commands.h2, commands.h3, commands.quote, commands.codeBlock] },
				{ id: 'lists', label: g.lists, items: [commands.bullet, commands.number, commands.task] }
			]
		},
		{
			id: 'view',
			label: m.ribbon.tabs.view,
			groups: [
				{ id: 'layout', label: g.layout, items: [commands.textOnly, commands.split, commands.viewOnly, commands.viewType] },
				{ id: 'text', label: g.text, items: [commands.wrap, commands.fontLarger, commands.fontSmaller, commands.fontReset] }
			]
		},
		{
			id: 'table',
			label: m.ribbon.tabs.table,
			contextual: true,
			visible: () => viewUi()?.kind === 'table',
			follow: () => (viewUi()?.picked() ?? 0) > 0,
			groups: [
				{ id: 'cell', label: g.cell, items: [tableCmd[TABLE.editCell.id], tableCmd[TABLE.clearCells.id]] },
				{
					id: 'rows',
					label: g.rows,
					items: [TABLE.insertAbove, TABLE.insertBelow, TABLE.moveUp, TABLE.moveDown, TABLE.removeRows].map((s) => tableCmd[s.id])
				},
				{
					id: 'columns',
					label: g.columns,
					items: [TABLE.insertLeft, TABLE.insertRight, TABLE.renameColumn, TABLE.moveLeft, TABLE.moveRight, TABLE.removeColumn].map((s) => tableCmd[s.id])
				},
				{ id: 'sortFilter', label: g.sortFilter, items: [TABLE.sortUp, TABLE.sortDown, TABLE.filter, TABLE.removeFilters].map((s) => tableCmd[s.id]) },
				{ id: 'options', label: g.options, items: [tableCmd[TABLE.header.id], tableCmd[TABLE.delimiter.id]] },
				{ id: 'selection', label: g.selection, items: [tableCmd[TABLE.selectAll.id], tableCmd[TABLE.clearSelection.id]] }
			]
		},
		{
			id: 'tree',
			label: m.ribbon.tabs.tree,
			contextual: true,
			visible: () => viewUi()?.kind === 'tree',
			follow: () => (viewUi()?.picked() ?? 0) > 0,
			groups: [
				{ id: 'edit', label: g.edit, items: [TREE.editValue, TREE.rename, TREE.duplicate, TREE.remove].map((s) => treeCmd[s.id]) },
				{ id: 'insert', label: g.insert, items: [treeCmd[TREE.insert.id]] },
				{ id: 'arrange', label: g.arrange, items: [treeCmd[TREE.moveUp.id], treeCmd[TREE.moveDown.id], treeCmd[TREE.type.id]] },
				{ id: 'show', label: g.show, items: [TREE.expandAll, TREE.collapseAll, TREE.filter].map((s) => treeCmd[s.id]) },
				{ id: 'selection', label: g.selection, items: [treeCmd[TREE.selectAll.id], treeCmd[TREE.clearSelection.id]] }
			]
		}
	];

	// --- BrandBar and footer ---

	/** Files with a place save themselves: how far that is; without a place only "not saved" (and "Save") */
	function saveOf(tab: Tab): SaveState | null {
		if (tab.conflict === 'deleted') return { state: 'error', text: m.status.deleted };
		if (!tab.path) return tab.dirty ? { state: 'unsaved', text: brandMessages().save.notSaved } : null;
		return saveStateOf({ saving: tab.pending || tab.saving, saveError: tab.saveError, dirty: tab.dirty });
	}

	// Where you are: the file's name – its actions are in the ribbon's tab “File”
	$effect(() => {
		const name = file?.name;
		return setBrandBar({ crumbs: name ? [{ label: name }] : [] });
	});

	// Save state, position, language, line ending and encoding on the left of the BrandFooter
	$effect(() => setBrandFooter({ status: footerStatus, save: file ? saveOf(file) : null }));

	function dragOver(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault();
		e.stopPropagation();
		e.dataTransfer!.dropEffect = 'copy';
		dropping = true;
	}

	function drop(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault();
		e.stopPropagation();
		dropping = false;
		void openFromComputer(droppedFile(e));
	}
</script>

<svelte:head>
	{#if file}<title>{file.name} · {toolName('text-editor')}</title>{/if}
</svelte:head>

{#snippet footerStatus()}
	{#if file}<StatusBar {workspace} tab={file} />{/if}
{/snippet}

<input
	bind:this={fileInput}
	type="file"
	hidden
	accept={EDITABLE_EXTENSIONS.join(',')}
	onchange={(e) => {
		void openFromComputer(e.currentTarget.files?.[0] ?? null);
		e.currentTarget.value = '';
	}}
/>

{#if !supported()}
	<div role="alert" class="alert alert-warning m-6">{filesMessages().start.unsupported}</div>
{:else if error}
	<div class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
		<p class="max-w-md">{error}</p>
		<div class="flex gap-2">
			{#if access}<button class="btn btn-primary" onclick={access.run}>{access.label}</button>{/if}
			<a class="btn" href={resolve('/text-editor')}>{m.editor.back}</a>
		</div>
	</div>
{:else}
	<div
		class="relative flex h-full flex-col"
		role="presentation"
		ondragovercapture={dragOver}
		ondragleave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && (dropping = false)}
		ondropcapture={drop}
	>
		<Ribbon {tabs} quick={[commands.undo, commands.redo]} storage="text-editor" initial="home" />
		{#if file?.conflict}
			<div role="alert" class="alert alert-warning rounded-none py-2 text-sm">
				<span class="icon-[material-symbols-light--warning-outline] size-5" aria-hidden="true"></span>
				<span>{file.conflict === 'changed' ? m.conflict.changed(file.name) : m.conflict.deleted(file.name)}</span>
				<div class="flex gap-2">
					{#if file.conflict === 'changed'}
						<button class="btn btn-sm" onclick={() => workspace.reload(file)}>{m.conflict.reload}</button>
					{/if}
					<button class="btn btn-ghost btn-sm" onclick={() => workspace.keepMine(file)}>{m.conflict.keepMine}</button>
				</div>
			</div>
		{:else if file?.problem}
			<div role="alert" class="alert alert-warning rounded-none py-2 text-sm">
				<span class="icon-[material-symbols-light--warning-outline] size-5" aria-hidden="true"></span>
				<span>{m.problem.unmappable(file.problem.unmappable, encodingName(file.encoding))}</span>
				<button class="btn btn-sm" onclick={() => workspace.saveAsUtf8(file)}>{m.problem.asUtf8}</button>
			</div>
		{/if}
		<!-- The editor stays mounted while only the view is shown, and while another file loads -->
		<SplitView share={workspace.split} onshare={(share) => workspace.setSplit(share)} showText={textShown} showView={viewShown}>
			{#snippet text()}
				<div class={['size-full', !file && 'invisible']} style:--editor-font-size="{workspace.fontSize}px">
					<Editor {workspace} />
				</div>
			{/snippet}
			{#snippet view()}
				{#if file && spec && host && viewShown}
					<DataView tab={file} {spec} {host} />
				{/if}
			{/snippet}
		</SplitView>
		{#if dropping}
			<DropOverlay label={m.drop.release} />
		{/if}
	</div>
{/if}
