<script lang="ts">
	import { filesUrl } from '@in-browser/files/formats.js';
	// Editor page of a PDF (`?path=`): ribbon on top, side panels on the left, the pages on the
	// shared ink core; page navigation and zoom in the footer (like PDF-XChange's status bar). Changes save themselves
	// (`PdfDocument`); the save state sits in the footer, conflicts and notices in a bar above the pages. One tab per PDF.
	import { installNudgeKeys } from '@in-browser/ink/input/keys.js';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { setBrandBar } from '@in-browser/brand/brand-bar.svelte.js';
	import { saveStateOf, setBrandFooter } from '@in-browser/brand/brand-footer.svelte.js';
	import { installCommandKeys, shortcutLabel, type Command } from '@in-browser/brand/commands.js';
	import { downloadBlob } from '@in-browser/brand/download.js';
	import { brandMessages, toolName } from '@in-browser/brand/i18n/index.svelte.js';
	import PanelRail from '@in-browser/brand/PanelRail.svelte';
	import { panelCommand as sharedPanelCommand, type PanelSpec } from '@in-browser/brand/panels.js';
	import Ribbon from '@in-browser/brand/Ribbon.svelte';
	import type { GroupSize, RibbonGroup, RibbonItem, RibbonTab } from '@in-browser/brand/ribbon.js';
	import RibbonPopover from '@in-browser/brand/RibbonPopover.svelte';
	import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
	import { openMenuAbove, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { inTextField } from '@in-browser/brand/ui/typing.js';
	import { accessAction } from '@in-browser/files/sources/connections.svelte.js';
	import { ExternalVersions, flushWhenHidden, lockDocument } from '@in-browser/files/documents.js';
	import { read, watch, write } from '@in-browser/files/fs.js';
	import { FilesError } from '@in-browser/files/entry.js';
	import { chooseFile, chooseFiles } from '@in-browser/files/dialog.svelte.js';
	import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
	import { basename, normalize, parent } from '@in-browser/files/path.js';
	import { imagePdf } from '@in-browser/pdf/write/image-page.js';
	import { editorUrl } from '#lib/brand.js';
	import ColorField from '@in-browser/graphics/ColorField.svelte';
	import { inkMessages } from '@in-browser/ink/i18n/index.svelte.js';
	import type { Tool } from '@in-browser/ink/input/controller.js';
	import { SHAPE_KINDS, shapeGlyph } from '@in-browser/ink/shapes.js';
	import { ERASER_SIZES } from '@in-browser/ink/sizes.js';
	import SelectionMenu from '@in-browser/ink/ui/SelectionMenu.svelte';
	import InkColorButton from '@in-browser/ink/ui/InkColorButton.svelte';
	import InkStyleButton from '@in-browser/ink/ui/InkStyleButton.svelte';
	import { arrangeGroups } from '@in-browser/ink/ui/selection-commands.js';
	import ShapeSuggestionButton from '@in-browser/ink/ui/ShapeSuggestion.svelte';
	import NoteEditor from '#lib/components/NoteEditor.svelte';
	import TextEditor from '#lib/components/TextEditor.svelte';
	import { PdfError } from '@in-browser/pdf/pdfjs.js';
	import Surface from '#lib/components/Surface.svelte';
	import { m } from '#lib/i18n/index.js';
	import { FILLABLE, PdfDocument } from '#lib/model/document.svelte.js';
	import { formView, toggleHighlight } from '#lib/model/forms.svelte.js';
	import { EditorState } from '#lib/model/editor.svelte.js';
	import { recent } from '#lib/model/recent.js';
	import { kindOf, selectionCommands, toolKind, type FormatKind } from '#lib/model/selection-commands.js';
	import { isNote } from '#lib/render/note.js';
	import { choose, inkColor, setInkColor, tools, type EditorTool } from '#lib/model/tools.svelte.js';
	import type { PdfSelection, PdfStage, PdfSuggestion } from '#lib/render/surface.js';

	const ed = new EditorState();
	let error = $state<string | null>(null);
	/** Opening failed because the browser doesn't allow access to the connected folder right now */
	let access = $state<ReturnType<typeof accessAction>>(undefined);
	let pageInput = $state('');
	/** Opens the file again (another version arrived); null while nothing is open */
	let reload: ((quiet: boolean) => Promise<void>) | null = null;
	/** The notice about signatures was closed */
	let signedSeen = $state(false);
	/** Asked once whether pages of a signed PDF may change */
	let signedPagesOk = false;

	function loadError(e: unknown): string {
		if (e instanceof PdfError) return e.reason === 'password' ? m.editor.password : m.editor.invalid;
		if (e instanceof FilesError && e.code === 'notFound') return m.editor.missing;
		return m.editor.loadFailed(filesErrorText(e));
	}

	$effect(() => {
		const param = page.url.searchParams.get('path');
		if (!param) return;
		const path = normalize(param);
		let disposed = false;
		let release: (() => void) | null = null;
		let opened: PdfDocument | null = null;
		let stopWatch: (() => void) | null = null;
		error = null;

		/** Replaces the open document by the file as it is now (the lock stays held) */
		const reopen = async (quiet: boolean) => {
			const next = await PdfDocument.open(path);
			if (disposed) return next.destroy();
			const old = opened;
			ed.stage = null;
			opened = ed.doc = next;
			// Messages of the form's scripts (`app.alert`) – never a browser dialog
			next.onScriptMessage = (text) => toast(text, 'info', 8000);
			old?.destroy();
			if (!quiet) toast(m.conflict.reloaded(next.name));
		};

		(async () => {
			try {
				release = await lockDocument(`pdf-editor:pdf:${path}`);
				if (disposed) return release?.();
				if (!release) {
					error = m.editor.openElsewhere;
					return;
				}
				const next = await PdfDocument.open(path);
				if (disposed) return next.destroy();
				opened = ed.doc = next;
				// Messages of the form's scripts (`app.alert`) – never a browser dialog
				next.onScriptMessage = (text) => toast(text, 'info', 8000);
				recent.remember(path);
				reload = reopen;
				// A version saved elsewhere: asked first (once per version; the answer may be kept while it is open)
				const external = new ExternalVersions();
				stopWatch = watch(
					(paths) =>
						void opened?.filesChanged(paths, async (version) => {
							const silent = external.silent;
							if (!(await external.shouldReload(next.name, version)) || disposed || opened?.dirty) return;
							await reopen(!silent).catch((e) => console.error('[pdf-editor] reload', e));
						})
				);
			} catch (e) {
				console.error('[pdf-editor] open', e);
				error = loadError(e);
				access = accessAction(e, () => location.reload());
			}
		})();

		const stopFlush = flushWhenHidden(() => opened?.flush());
		return () => {
			disposed = true;
			reload = null;
			stopWatch?.();
			stopFlush();
			opened?.flush();
			ed.doc = null;
			ed.stage = null;
			opened?.destroy();
			release?.();
		};
	});

	// --- Commands ---

	const has = () => !!ed.stage;
	// A tool's language is fixed when it loads
	const tm = inkMessages().tools;

	/** A tool of the ink core: picked by its command (and a letter), only while the PDF can be changed */
	function drawingTool(tool: Tool | EditorTool, label: string, icon: string, key: string): Command {
		return { id: tool, label, icon, shortcut: { key }, enabled: () => editable(), active: () => tools.tool === tool, run: () => choose(tool) };
	}
	const editable = () => ed.doc?.editable === 'yes';

	/** After undo, redo or turning pages: the suggestion goes, the selection follows, search hits may lie elsewhere */
	function changed(run: () => void) {
		ed.suggestion?.clear();
		run();
		ed.selection?.refresh();
		void ed.refind();
	}

	/** Changes pages (the picked ones, else the current one); pages of a signed PDF only after asking once */
	async function changePages(run: (doc: PdfDocument, ids: string[]) => void) {
		const doc = ed.doc;
		const ids = ed.pagesToChange();
		if (!doc || doc.editable !== 'yes' || !ids.length) return;
		if (doc.signed && !signedPagesOk) {
			if (!(await ask(m.questions.signedPages))) return;
			signedPagesOk = true;
		}
		// A selection names its page by place: it goes when pages change
		ed.selection?.clear();
		changed(() => run(doc, ids));
	}

	/** Moves the pages to change: one up or down, to the start or the end */
	function movePages(where: 'up' | 'down' | 'first' | 'last') {
		void changePages((doc, ids) => {
			const at = ids.map((id) => doc.pages.findIndex((p) => p.id === id));
			const to = where === 'first' ? 0 : where === 'last' ? doc.pages.length : where === 'up' ? Math.max(0, Math.min(...at) - 1) : Math.min(doc.pages.length, Math.max(...at) + 2);
			doc.movePages(new Set(ids), to);
			// The view follows the first of them
			const first = doc.pages.findIndex((p) => p.id === ids[0]);
			if (first >= 0) ed.goTo(first);
		});
	}
	const failed = (e: unknown) => {
		console.warn('[pdf-editor] pages', e);
		toast(e instanceof PdfError ? (e.reason === 'password' ? m.commands.protected : m.editor.invalid) : m.commands.failed(filesErrorText(e)), 'error', 8000);
	};

	/** Inserts the pages of a PDF (or an image as a page) after the current page */
	async function insertFrom(kind: 'pdf' | 'image') {
		const doc = ed.doc;
		if (!doc) return;
		const path = await chooseFile(
			kind === 'pdf'
				? { mode: 'open', folder: parent(doc.path), accept: ['.pdf'], title: m.commands.insertPdfTitle }
				: { mode: 'open', folder: parent(doc.path), accept: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'], title: m.commands.insertImageTitle }
		);
		if (!path) return;
		try {
			const file = await read(path);
			const bytes = kind === 'pdf' ? new Uint8Array(await file.arrayBuffer()) : await imagePdf(file);
			const at = ed.current + 1;
			ed.selection?.clear();
			await doc.insertPdf(at, bytes);
			ed.goTo(at);
		} catch (e) {
			failed(e);
		}
	}

	/** Saves a new PDF (pages of this one, or this one merged with others) and offers to open it */
	async function saveNew(make: (doc: PdfDocument) => Promise<Uint8Array>, name: string, title: string) {
		const doc = ed.doc;
		if (!doc) return;
		try {
			const bytes = await make(doc);
			const path = await chooseFile({ mode: 'save', folder: parent(doc.path), accept: ['.pdf'], name, title });
			if (!path) return;
			await write(path, new Blob([bytes as Uint8Array<ArrayBuffer>]));
			toast(m.commands.saved(basename(path)), 'success', 8000, { label: m.commands.openNew, run: () => location.assign(editorUrl(path)) });
		} catch (e) {
			failed(e);
		}
	}
	const stem = () => (ed.doc?.name ?? 'PDF').replace(/\.pdf$/i, '');

	async function mergeWith() {
		const doc = ed.doc;
		if (!doc) return;
		const paths = await chooseFiles({ mode: 'open', folder: parent(doc.path), accept: ['.pdf'], multiple: true, title: m.commands.mergeTitle });
		if (!paths?.length) return;
		await saveNew(
			async (d) => d.merged(await Promise.all(paths.map(async (p) => new Uint8Array(await (await read(p)).arrayBuffer())))),
			m.commands.mergeName(stem()),
			m.commands.mergeSaveTitle
		);
	}

	const canMove = (where: 'up' | 'down') => {
		const doc = ed.doc;
		if (!doc || !editable()) return false;
		const at = ed.pagesToChange().map((id) => doc.pages.findIndex((p) => p.id === id));
		return where === 'up' ? at.some((i, k) => i !== k) : at.some((i, k) => i !== doc.pages.length - at.length + k);
	};

	// The selection's commands (the shared ones of the ink core plus the PDF's own kinds)
	const sc = selectionCommands(ed, edit);

	const commands = {
		// The PDF itself (tab “File”); it is named after its file – renamed in Files
		download: { id: 'download', label: m.editor.download, icon: 'icon-[material-symbols-light--download]', enabled: () => !!ed.doc, run: () => void download() },
		showInFiles: { id: 'showInFiles', label: m.editor.showInFiles, icon: 'icon-[material-symbols-light--folder-open-outline]', enabled: () => !!ed.doc, run: () => showInFiles() },
		undo: { id: 'undo', label: m.commands.undo, icon: 'icon-[material-symbols-light--undo]', shortcut: { key: 'z', ctrl: true }, enabled: () => !!ed.doc?.canUndo, run: () => changed(() => ed.doc?.undo()) },
		redo: {
			id: 'redo',
			label: m.commands.redo,
			icon: 'icon-[material-symbols-light--redo]',
			shortcut: { key: 'z', ctrl: true, shift: true },
			enabled: () => !!ed.doc?.canRedo,
			run: () => changed(() => ed.doc?.redo())
		},
		rotateLeft: {
			id: 'rotateLeft',
			label: m.commands.rotateLeft,
			tip: m.commands.rotateTip,
			icon: 'icon-[material-symbols-light--rotate-90-degrees-ccw-outline]',
			enabled: editable,
			run: () => void changePages((doc, ids) => doc.rotate(ids, -90))
		},
		rotateRight: {
			id: 'rotateRight',
			label: m.commands.rotateRight,
			tip: m.commands.rotateTip,
			icon: 'icon-[material-symbols-light--rotate-90-degrees-cw-outline]',
			enabled: editable,
			run: () => void changePages((doc, ids) => doc.rotate(ids, 90))
		},
		deletePages: {
			id: 'deletePages',
			label: m.commands.deletePages,
			tip: m.commands.deletePagesTip,
			icon: 'icon-[material-symbols-light--delete-outline]',
			// The last page stays
			enabled: () => editable() && ed.pagesToChange().length < (ed.doc?.pages.length ?? 0),
			run: () =>
				void changePages((doc, ids) => {
					doc.deletePages(new Set(ids));
					ed.clearPagePick();
					ed.current = Math.min(ed.current, doc.pages.length - 1);
				})
		},
		moveUp: { id: 'moveUp', label: m.commands.moveUp, tip: m.commands.moveTip, icon: 'icon-[material-symbols-light--arrow-upward]', enabled: () => canMove('up'), run: () => movePages('up') },
		moveDown: {
			id: 'moveDown',
			label: m.commands.moveDown,
			tip: m.commands.moveTip,
			icon: 'icon-[material-symbols-light--arrow-downward]',
			enabled: () => canMove('down'),
			run: () => movePages('down')
		},
		moveFirst: { id: 'moveFirst', label: m.commands.moveFirst, icon: 'icon-[material-symbols-light--vertical-align-top]', enabled: () => canMove('up'), run: () => movePages('first') },
		moveLast: { id: 'moveLast', label: m.commands.moveLast, icon: 'icon-[material-symbols-light--vertical-align-bottom]', enabled: () => canMove('down'), run: () => movePages('last') },
		insertBlank: {
			id: 'insertBlank',
			label: m.commands.insertBlank,
			tip: m.commands.insertBlankTip,
			icon: 'icon-[material-symbols-light--note-add-outline]',
			enabled: editable,
			run: () =>
				void changePages((doc) => {
					const at = ed.current + 1;
					if (doc.insertBlank(at)) ed.goTo(at);
				})
		},
		insertPdf: {
			id: 'insertPdf',
			label: m.commands.insertPdf,
			tip: m.commands.insertPdfTip,
			icon: 'icon-[material-symbols-light--picture-as-pdf-outline]',
			enabled: editable,
			run: () => void changePages(() => void insertFrom('pdf'))
		},
		insertImage: {
			id: 'insertImage',
			label: m.commands.insertImage,
			tip: m.commands.insertImageTip,
			icon: 'icon-[material-symbols-light--add-photo-alternate-outline]',
			enabled: editable,
			run: () => void changePages(() => void insertFrom('image'))
		},
		extract: {
			id: 'extract',
			label: m.commands.extract,
			tip: m.commands.extractTip,
			icon: 'icon-[material-symbols-light--file-export-outline]',
			enabled: () => !!ed.doc,
			run: () => {
				const doc = ed.doc;
				if (!doc) return;
				const places = ed.pagesToChange().map((id) => doc.pages.findIndex((p) => p.id === id));
				void saveNew((d) => d.extract(places), m.commands.extractName(stem()), m.commands.extractTitle);
			}
		},
		merge: {
			id: 'merge',
			label: m.commands.merge,
			tip: m.commands.mergeTip,
			icon: 'icon-[material-symbols-light--merge]',
			enabled: () => !!ed.doc,
			run: () => void mergeWith()
		},
		hand: { id: 'hand', label: m.commands.hand, tip: m.commands.handTip, icon: 'icon-[material-symbols-light--pan-tool-outline]', shortcut: { key: 'h' }, active: () => tools.tool === 'hand', run: () => choose('hand') },
		text: {
			id: 'text',
			label: m.commands.selectText,
			tip: m.commands.selectTextTip,
			icon: 'icon-[material-symbols-light--text-select-start]',
			shortcut: { key: 'v' },
			active: () => tools.tool === 'text',
			run: () => choose('text')
		},
		pen: drawingTool('pen', tm.pen, 'icon-[material-symbols-light--ink-pen-outline]', 'p'),
		highlight: { ...drawingTool('highlight', m.commands.highlight, 'icon-[material-symbols-light--ink-highlighter]', 'm'), tip: m.commands.markTip },
		underline: { ...drawingTool('underline', m.commands.underline, 'icon-[material-symbols-light--format-underlined]', 'u'), tip: m.commands.markTip },
		strikeout: { ...drawingTool('strikeout', m.commands.strikeout, 'icon-[material-symbols-light--strikethrough-s]', 'x'), tip: m.commands.markTip },
		textbox: { ...drawingTool('textbox', m.commands.textbox, 'icon-[material-symbols-light--text-fields]', 't'), tip: m.commands.textboxTip },
		note: { ...drawingTool('note', m.commands.note, 'icon-[material-symbols-light--sticky-note-2-outline]', 'n'), tip: m.commands.noteTip },
		shape: {
			...drawingTool('shape', tm.shape, 'icon-[material-symbols-light--shapes-outline]', 's'),
			menu: () =>
				SHAPE_KINDS.map((kind) => ({
					label: tm.shapes[kind],
					glyph: shapeGlyph(kind),
					checked: kind === tools.shape,
					run: () => {
						tools.shape = kind;
						choose('shape');
					}
				}))
		},
		eraser: {
			...drawingTool('eraser', tm.eraser, 'icon-[material-symbols-light--ink-eraser-outline]', 'e'),
			menu: () => [
				...(['stroke', 'pixel'] as const).map((mode) => ({
					label: tm.eraserModes[mode],
					checked: mode === tools.eraserMode,
					run: () => {
						tools.eraserMode = mode;
						choose('eraser');
					}
				})),
				{ separator: true as const },
				...ERASER_SIZES.map((size) => ({
					label: tm.sizeValue(size),
					checked: size === tools.eraser,
					run: () => {
						tools.eraser = size;
						choose('eraser');
					}
				}))
			]
		},
		lasso: { ...drawingTool('lasso', tm.lasso, 'icon-[material-symbols-light--arrow-selector-tool-outline]', 'l'), tip: tm.lassoHint },
		deleteSelection: sc.delete,
		selectAll: {
			id: 'selectAll',
			label: m.commands.selectAll,
			tip: m.commands.selectAllTip,
			icon: 'icon-[material-symbols-light--select-all]',
			shortcut: { key: 'a', ctrl: true },
			enabled: () => editable() && has(),
			run: () => {
				choose('lasso');
				ed.selection?.selectAll(ed.current);
			}
		},
		snap: {
			id: 'snap',
			label: tm.snap,
			tip: tm.snapHint,
			icon: 'icon-[material-symbols-light--grid-guides-outline]',
			active: () => tools.snap,
			run: () => {
				tools.snap = !tools.snap;
				tools.store();
			}
		},
		zoomIn: { id: 'zoomIn', label: m.commands.zoomIn, icon: 'icon-[material-symbols-light--zoom-in]', shortcut: { key: '+', ctrl: true }, enabled: has, run: () => ed.zoomIn() },
		zoomOut: { id: 'zoomOut', label: m.commands.zoomOut, icon: 'icon-[material-symbols-light--zoom-out]', shortcut: { key: '-', ctrl: true }, enabled: has, run: () => ed.zoomOut() },
		fitWidth: { id: 'fitWidth', label: m.commands.fitWidth, icon: 'icon-[material-symbols-light--fit-page-width]', enabled: has, run: () => ed.fitWidth() },
		fitPage: { id: 'fitPage', label: m.commands.fitPage, icon: 'icon-[material-symbols-light--fit-page]', enabled: has, run: () => ed.fitPage() },
		actualSize: { id: 'actualSize', label: m.commands.actualSize, icon: 'icon-[material-symbols-light--crop-free]', shortcut: { key: '0', ctrl: true }, enabled: has, run: () => ed.actualSize() },
		first: { id: 'first', label: m.commands.firstPage, icon: 'icon-[material-symbols-light--first-page]', shortcut: { key: 'Home' }, enabled: () => ed.current > 0, run: () => ed.goTo(0) },
		previous: {
			id: 'previous',
			label: m.commands.previousPage,
			icon: 'icon-[material-symbols-light--keyboard-arrow-left]',
			shortcut: { key: 'PageUp' },
			enabled: () => ed.current > 0,
			run: () => ed.goTo(ed.current - 1)
		},
		next: {
			id: 'next',
			label: m.commands.nextPage,
			icon: 'icon-[material-symbols-light--keyboard-arrow-right]',
			shortcut: { key: 'PageDown' },
			enabled: () => ed.current < ed.pageCount - 1,
			run: () => ed.goTo(ed.current + 1)
		},
		last: { id: 'last', label: m.commands.lastPage, icon: 'icon-[material-symbols-light--last-page]', shortcut: { key: 'End' }, enabled: () => ed.current < ed.pageCount - 1, run: () => ed.goTo(ed.pageCount - 1) }
	} satisfies Record<string, Command>;

	/** Ctrl+F: the search panel (its field takes the focus) */
	const find: Command = {
		id: 'find',
		label: m.commands.find,
		icon: 'icon-[material-symbols-light--search]',
		shortcut: { key: 'f', ctrl: true },
		active: () => ed.panel === 'search',
		run: () => {
			ed.panel = null;
			queueMicrotask(() => (ed.panel = 'search'));
		}
	};
	// The page commands in the panel "Pages" (right click or long press on a page)
	const asEntry = (c: Command) => ({ label: c.label, icon: c.icon, disabled: c.enabled ? !c.enabled() : false, run: c.run! });
	ed.pageMenu = () => [
		asEntry(commands.rotateLeft),
		asEntry(commands.rotateRight),
		{ separator: true },
		asEntry(commands.moveFirst),
		asEntry(commands.moveUp),
		asEntry(commands.moveDown),
		asEntry(commands.moveLast),
		{ separator: true },
		asEntry(commands.insertBlank),
		asEntry(commands.insertPdf),
		asEntry(commands.insertImage),
		{ separator: true },
		asEntry(commands.extract),
		asEntry(commands.deletePages)
	];


	// `=` is `+` without Shift on many layouts
	const zoomInAlt: Command = { ...commands.zoomIn, id: 'zoomInAlt', shortcut: { key: '=', ctrl: true } };

	const panels: PanelSpec<EditorState>[] = [
		{ id: 'pages', icon: 'icon-[material-symbols-light--auto-stories-outline]', label: m.panels.pages, load: async () => (await import('#lib/panels/PagesPanel.svelte')).default },
		{
			id: 'search',
			icon: 'icon-[material-symbols-light--search]',
			label: m.panels.search,
			load: async () => (await import('#lib/panels/SearchPanel.svelte')).default
		},
		{
			id: 'comments',
			icon: 'icon-[material-symbols-light--comment-outline]',
			label: m.panels.comments,
			load: async () => (await import('#lib/panels/CommentsPanel.svelte')).default
		},
		{
			id: 'fields',
			icon: 'icon-[material-symbols-light--fact-check-outline]',
			label: m.panels.fields,
			available: () => hasFields(),
			load: async () => (await import('#lib/panels/FieldsPanel.svelte')).default
		},
		{
			id: 'outline',
			icon: 'icon-[material-symbols-light--bookmarks-outline]',
			label: m.panels.outline,
			available: () => !!ed.doc?.outline.length,
			load: async () => (await import('#lib/panels/OutlinePanel.svelte')).default
		},
		{
			id: 'attachments',
			icon: 'icon-[material-symbols-light--attach-file]',
			label: m.panels.attachments,
			available: () => !!ed.doc?.attachments.length,
			load: async () => (await import('#lib/panels/AttachmentsPanel.svelte')).default
		},
		{
			id: 'layers',
			icon: 'icon-[material-symbols-light--layers-outline]',
			label: m.panels.layers,
			available: () => !!ed.doc?.hasLayers,
			load: async () => (await import('#lib/panels/LayersPanel.svelte')).default
		}
	];

	/** Opens or closes a side panel (commands of the "View" tab; on phones the only way to them) */
	const openPanel = { get: () => ed.panel, set: (id: string | null) => (ed.panel = id) };
	const panelCommand = (spec: PanelSpec<EditorState>): Command => sharedPanelCommand(spec, openPanel);

	// --- Contextual tabs: format by kind (of the selection, else of what the chosen tool draws) and arrange ---

	/** Writing into a text box or a note's comment (it is selected) */
	function edit(id: string) {
		const item = ed.selection?.items.find((i) => i.id === id);
		if (item && isNote(item)) ed.noteEdit = id;
		else ed.textEdit = id;
	}
	const kind = $derived(ed.selection?.count ? kindOf(ed.selection.items) : editable() ? toolKind(tools.tool) : null);
	const objectGroup: RibbonGroup = { id: 'object', label: m.ribbon.groups.object, items: [sc.duplicate, commands.deleteSelection] };
	/** A format tab for one kind: its format group, then duplicate and delete (phones open it for a selection only) */
	const formatTab = (id: FormatKind, label: string, groups: RibbonGroup[]): RibbonTab => ({
		id,
		label,
		contextual: true,
		visible: () => kind === id,
		follow: () => !!sc.sel(),
		groups: [...groups, objectGroup]
	});
	const color: RibbonItem = { id: 'color', label: inkMessages().selection.color, custom: formatColor };
	/** Colors of the selection while they are dragged (opacity, picker) – `fill`, `border`: shown at once,
	 * applied as one step at the end; gone with another selection */
	let drafts = $derived.by((): Partial<Record<'fill' | 'border', string | null>> => {
		void ed.selection?.items;
		return {};
	});
	/** Background or border of text boxes: the selection's applied once at the end (shown meanwhile), the new ones' at once */
	function draftOr<T extends string | null>(key: 'fill' | 'border', value: T): T {
		return key in drafts ? (drafts[key] as T) : value;
	}
	function colorChange(key: 'fill' | 'border', v: string | null, final: boolean, apply: (v: string | null) => void) {
		if (!sc.sel()) return apply(v);
		const { [key]: _, ...rest } = drafts;
		drafts = final ? rest : { ...rest, [key]: v };
		if (final) apply(v);
	}

	/** The PDF has fields to fill in */
	function hasFields() {
		return !!ed.doc?.fields.some((f) => FILLABLE.has(f.kind));
	}
	const formCommands: Record<'highlightFields' | 'clearForm', Command> = {
		highlightFields: {
			id: 'highlightFields',
			label: m.commands.highlightFields,
			tip: m.commands.highlightFieldsTip,
			icon: 'icon-[material-symbols-light--highlight-mouse-cursor]',
			enabled: hasFields,
			active: () => formView.highlight,
			run: toggleHighlight
		},
		clearForm: {
			id: 'clearForm',
			label: m.commands.clearForm,
			tip: m.commands.clearFormTip,
			icon: 'icon-[material-symbols-light--format-clear]',
			enabled: () => editable() && hasFields(),
			run: () => ed.doc?.clearForm()
		}
	};

	const tabs: RibbonTab[] = [
		{
			id: 'file',
			label: brandMessages().ribbon.file,
			groups: [{ id: 'pdf', label: m.ribbon.groups.pdf, items: [commands.download, commands.showInFiles] }]
		},
		{
			id: 'home',
			label: m.ribbon.tabs.home,
			groups: [
				{ id: 'tools', label: m.ribbon.groups.tools, items: [commands.hand, commands.text] },
				{ id: 'find', label: m.ribbon.groups.find, items: [find] }
			]
		},
		{
			id: 'comment',
			label: m.ribbon.tabs.comment,
			groups: [
				{ id: 'select', label: m.ribbon.groups.select, items: [commands.lasso, commands.selectAll, commands.snap] },
				{ id: 'markup', label: m.ribbon.groups.markup, items: [commands.highlight, commands.underline, commands.strikeout] },
				{ id: 'notes', label: m.ribbon.groups.notes, items: [commands.note, commands.textbox] },
				{ id: 'draw', label: m.ribbon.groups.draw, items: [commands.pen, commands.shape, commands.eraser] }
			]
		},
		{
			id: 'pages',
			label: m.ribbon.tabs.pages,
			groups: [
				{ id: 'rotate', label: m.ribbon.groups.rotate, items: [commands.rotateLeft, commands.rotateRight] },
				{ id: 'organize', label: m.ribbon.groups.organize, items: [commands.deletePages, commands.moveUp, commands.moveDown] },
				{ id: 'insert', label: m.ribbon.groups.insert, items: [commands.insertBlank, commands.insertPdf, commands.insertImage] },
				{ id: 'newFile', label: m.ribbon.groups.newFile, items: [commands.extract, commands.merge] }
			]
		},
		{
			id: 'form',
			label: m.ribbon.tabs.form,
			groups: [
				{
					id: 'fields',
					label: m.ribbon.groups.fields,
					items: [panelCommand(panels.find((p) => p.id === 'fields')!), formCommands.highlightFields, formCommands.clearForm]
				}
			]
		},
		{
			id: 'view',
			label: m.ribbon.tabs.view,
			groups: [{ id: 'panels', label: m.ribbon.groups.panels, items: panels.map(panelCommand) }]
		},
		// The format of what is selected or what the chosen tool draws, and how a selection is arranged (like PDF-XChange)
		formatTab('text', m.ribbon.tabs.textbox, [
			{ id: 'text', label: m.ribbon.groups.text, items: [sc.editText, { id: 'textColor', label: m.textbox.textColor, custom: formatColor }, sc.fontSize] },
			{ id: 'paragraph', label: m.ribbon.groups.paragraph, items: [sc.alignLeft, sc.alignCenter, sc.alignRight, sc.justify] },
			{
				id: 'box',
				label: m.ribbon.groups.box,
				items: [{ id: 'fill', label: m.textbox.fill, custom: fillButton }, { id: 'border', label: m.textbox.border, custom: borderButton }, sc.borderWidth]
			},
			{ id: 'sizing', label: m.ribbon.groups.sizing, items: [sc.autoWidth, sc.autoHeight, sc.fixedSize] }
		]),
		formatTab('note', m.ribbon.tabs.note, [{ id: 'format', label: m.ribbon.groups.format, items: [sc.editComment, sc.noteIcon, color] }]),
		formatTab('markup', m.ribbon.tabs.markup, [{ id: 'format', label: m.ribbon.groups.format, items: [color] }]),
		formatTab('drawing', m.ribbon.tabs.drawing, [
			{ id: 'format', label: m.ribbon.groups.format, items: [color, sc.thickness, { id: 'style', label: inkMessages().selection.style, custom: formatStyle }] }
		]),
		formatTab('mixed', m.ribbon.tabs.selection, [{ id: 'format', label: m.ribbon.groups.format, items: [color] }]),
		{
			id: 'arrange',
			label: m.ribbon.tabs.arrange,
			contextual: true,
			// Only for a selection (its commands work on one), like Notes
			visible: () => !!sc.sel(),
			follow: () => false,
			groups: arrangeGroups(sc)
		}
	];

	// Ctrl+Y redoes too (like Notes and Office)
	const redoAlt: Command = { ...commands.redo, id: 'redoAlt', shortcut: { key: 'y', ctrl: true } };
	// Backspace deletes too (like Notes)
	const deleteAlt: Command = { ...commands.deleteSelection, id: 'deleteAlt', shortcut: { key: 'Backspace' } };

	$effect(() => installCommandKeys(() => [...Object.values(commands), zoomInAlt, redoAlt, deleteAlt, find]));
	// Arrow keys move the selection (one undo step per key sequence)
	$effect(() => installNudgeKeys(() => ed.selection));

	// Esc ends a selection; without one it goes back from any tool to "Select" (not while typing or while a menu,
	// popover or dialog takes the Esc)
	$effect(() => {
		const key = (e: KeyboardEvent) => {
			if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector(':popover-open, dialog[open], .modal-open')) return;
			if (ed.selection?.active) ed.selection.clear();
			else if (tools.tool !== 'lasso' && editable() && !inTextField(e.target)) choose('lasso');
		};
		addEventListener('keydown', key);
		return () => removeEventListener('keydown', key);
	});

	// Another tool ends the selection and the shape suggestion
	$effect(() => {
		const tool = tools.tool;
		untrack(() => {
			ed.suggestion?.clear();
			if (tool !== 'lasso') ed.selection?.clear();
		});
	});

	/** A stroke became a shape: select it, so its points can be moved right away */
	function shapeAccepted(shape: { page: number; id: string }) {
		choose('lasso');
		ed.selection?.select(shape.page, new Set([shape.id]));
	}

	// --- Bars ---

	function ready(s: PdfStage, selection: PdfSelection, suggestion: PdfSuggestion, showField: (widget: string) => void) {
		ed.showField = showField;
		ed.stage = s;
		ed.selection = selection;
		ed.suggestion = suggestion;
		ed.updateView();
	}

	async function download() {
		const doc = ed.doc;
		if (!doc) return;
		try {
			downloadBlob(await read(doc.path), doc.name);
		} catch (e) {
			error = m.editor.loadFailed(filesErrorText(e));
		}
	}

	function showInFiles() {
		const doc = ed.doc;
		if (doc) location.assign(filesUrl(doc.path));
	}

	$effect(() => {
		const doc = ed.doc;
		if (!doc) return setBrandBar({ crumbs: [{ label: m.editor.back, href: resolve('/pdf-editor') }] });
		return setBrandBar({
			crumbs: [
				{ label: doc.name }
			]
		});
	});

	function zoomMenu(): MenuEntry[] {
		return [commands.fitWidth, commands.fitPage, commands.actualSize].map((c) => ({ label: c.label, icon: c.icon, run: c.run }));
	}

	function goToTyped(e: SubmitEvent) {
		e.preventDefault();
		const n = Number.parseInt(pageInput, 10);
		if (Number.isFinite(n)) ed.goTo(Math.min(Math.max(1, n), ed.pageCount) - 1);
		pageInput = '';
		(document.activeElement as HTMLElement | null)?.blur();
	}

	$effect(() => setBrandFooter({ status: footerStatus, save: ed.doc ? saveStateOf(ed.doc) : null }));
</script>

<svelte:head>
	{#if ed.doc}<title>{ed.doc.name} · {toolName('pdf-editor')}</title>{/if}
</svelte:head>

<!-- Format tabs: the color of the selection, else of what the chosen tool draws next – every one with its opacity -->
{#snippet formatColor(size: GroupSize)}
	{@const s = sc.sel()}
	<InkColorButton
		id="formatColor"
		selection={s}
		value={inkColor()}
		onpick={setInkColor}
		label={kind === 'text' ? m.textbox.textColor : inkMessages().selection.color}
		{size}
		disabled={s ? !s.colorable : !kind}
	/>
{/snippet}

<!-- Format tab "Text box": background and border (with their opacity; "None") -->
{#snippet fillButton(size: GroupSize)}
	{@const fill = draftOr('fill', sc.boxStyle().fill)}
	<RibbonPopover id="fill" label={m.textbox.fill} icon="icon-[material-symbols-light--format-paint-outline]" {size} swatch={fill} disabled={kind !== 'text'}>
		{#snippet children()}
			<ColorField value={fill} allowNone onchange={(v, final) => colorChange('fill', v, final, (c) => sc.styleTexts({ fill: c }))} />
		{/snippet}
	</RibbonPopover>
{/snippet}

{#snippet borderButton(size: GroupSize)}
	{@const border = draftOr('border', sc.boxStyle().border)}
	<RibbonPopover id="border" label={m.textbox.border} icon="icon-[material-symbols-light--border-outer]" {size} swatch={border} disabled={kind !== 'text'}>
		{#snippet children()}
			<ColorField value={border} allowNone onchange={(v, final) => colorChange('border', v, final, (c) => sc.styleTexts({ border: c }))} />
		{/snippet}
	</RibbonPopover>
{/snippet}

<!-- Format tab "Drawing": style of the selected shapes, else of the next shape -->
{#snippet formatStyle(size: GroupSize)}
	<InkStyleButton id="formatStyle" selection={sc.sel()} {tools} {size} />
{/snippet}

<!-- A command as a small footer button (name and shortcut as tooltip) -->
{#snippet footerButton(c: Command, cls = '')}
	<button
		class={['btn btn-ghost btn-xs btn-square', cls]}
		disabled={c.enabled?.() === false}
		onclick={() => c.run?.()}
		title={c.shortcut ? `${c.label} (${shortcutLabel(c.shortcut, brandMessages().keys)})` : c.label}
		aria-label={c.label}
		data-command={c.id}
	>
		<span class={[c.icon, 'size-4']} aria-hidden="true"></span>
	</button>
{/snippet}

{#snippet footerStatus()}
	{#if ed.doc}
		<div class="flex items-center">
			{@render footerButton(commands.first, 'max-sm:hidden')}
			{@render footerButton(commands.previous)}
			<form class="flex items-center gap-1 px-0.5" onsubmit={goToTyped}>
				<input
					class="input input-xs w-12 text-center tabular-nums"
					inputmode="numeric"
					aria-label={m.editor.pageField}
					placeholder={String(ed.current + 1)}
					bind:value={pageInput}
				/>
				<span class="tabular-nums">/ {ed.pageCount}</span>
			</form>
			{@render footerButton(commands.next)}
			{@render footerButton(commands.last, 'max-sm:hidden')}
		</div>
		<div class="flex items-center">
			{@render footerButton(commands.zoomOut)}
			<button class="btn btn-ghost btn-xs min-w-14 font-normal tabular-nums" onclick={(e) => openMenuAbove(e, zoomMenu())} title={m.ribbon.groups.zoom}>
				{m.editor.zoom(Math.round(ed.zoom * 100))}
			</button>
			{@render footerButton(commands.zoomIn)}
		</div>
	{/if}
{/snippet}

{#if error}
	<div class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
		<p class="max-w-md">{error}</p>
		<div class="flex gap-2">
			{#if access}<button class="btn btn-primary" onclick={access.run}>{access.label}</button>{/if}
			<a class="btn" href={resolve('/pdf-editor')}>{m.editor.back}</a>
		</div>
	</div>
{:else if ed.doc}
	{@const doc = ed.doc}
	<div class="flex h-full min-h-0 flex-col">
		<Ribbon {tabs} quick={[commands.undo, commands.redo]} storage="pdf-editor" initial="home" />
		<div class="flex min-h-0 flex-1">
			<PanelRail {panels} context={ed} bind:open={ed.panel} storage="pdf-editor" />
			<div class="flex min-w-0 flex-1 flex-col">
				{#if doc.conflict}
					<div role="alert" class="alert alert-warning rounded-none py-2 text-sm">
						<span class="icon-[material-symbols-light--warning-outline] size-5" aria-hidden="true"></span>
						<span>{doc.conflict === 'changed' ? m.conflict.changed(doc.name) : m.conflict.deleted(doc.name)}</span>
						<div class="flex gap-2">
							{#if doc.conflict === 'changed'}
								<button class="btn btn-sm" onclick={() => void reload?.(true)}>{m.conflict.reload}</button>
							{/if}
							<button class="btn btn-ghost btn-sm" onclick={() => void doc.keepMine()}>{m.conflict.keepMine}</button>
						</div>
					</div>
				{:else if doc.editable === 'encrypted' || doc.editable === 'failed'}
					<div role="status" class="alert rounded-none py-2 text-sm">
						<span class="icon-[material-symbols-light--lock-outline] size-5" aria-hidden="true"></span>
						<span>{doc.editable === 'encrypted' ? m.notice.encrypted : m.notice.failed}</span>
					</div>
				{:else if doc.signed && !signedSeen}
					<div role="status" class="alert rounded-none py-2 text-sm">
						<span class="icon-[material-symbols-light--verified-outline] size-5" aria-hidden="true"></span>
						<span>{m.notice.signed}</span>
						<button class="btn btn-ghost btn-sm btn-square" onclick={() => (signedSeen = true)} title={m.common.close} aria-label={m.common.close}>
							<span class="icon-[material-symbols-light--close] size-5" aria-hidden="true"></span>
						</button>
					</div>
				{/if}
				<div class="relative min-h-0 flex-1">
					{#key doc}
						<Surface {doc} onready={ready} onedit={edit} onview={() => ed.updateView()} hits={ed.hits} current={ed.currentHit} />
					{/key}
					<!-- Next to the surface, not in it: presses on them must not reach the surface's input -->
					{#if ed.selection}
						{@const selection = ed.selection}
						{#if !ed.textEdit && !ed.noteEdit}
							<!-- Only the object's actions here; formats are on the contextual tabs -->
							<SelectionMenu {selection}>
								{#snippet actions()}
									<!-- Writing its text opens on the item (touch screens have no double click) -->
									{#if sc.editText.enabled()}
										<button class="btn btn-ghost btn-sm btn-square" onclick={sc.editText.run} title={sc.editText.label} aria-label={sc.editText.label}>
											<span class="icon-[material-symbols-light--edit-outline] size-5" aria-hidden="true"></span>
										</button>
									{:else if sc.editComment.enabled()}
										<button class="btn btn-ghost btn-sm btn-square" onclick={sc.editComment.run} title={sc.editComment.label} aria-label={sc.editComment.label}>
											<span class="icon-[material-symbols-light--edit-note-outline] size-5" aria-hidden="true"></span>
										</button>
									{/if}
								{/snippet}
							</SelectionMenu>
						{/if}
						<TextEditor {selection} {doc} stage={ed.stage} editing={ed.textEdit} ondone={() => (ed.textEdit = null)} />
						<NoteEditor {selection} {doc} editing={ed.noteEdit} ondone={() => (ed.noteEdit = null)} />
					{/if}
					{#if ed.suggestion}<ShapeSuggestionButton suggestion={ed.suggestion} onaccept={shapeAccepted} />{/if}
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="flex h-full items-center justify-center">
		<span class="loading loading-spinner opacity-60"></span>
	</div>
{/if}
