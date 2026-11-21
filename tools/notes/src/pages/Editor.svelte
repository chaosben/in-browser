<script lang="ts">
	import { showError } from '@in-browser/files/errors.js';
	import { filesUrl } from '@in-browser/files/formats.js';
	// A notebook (`?path=` of its package): the ribbon on top (also on phones, one icon bar there), the drawing
	// surface below it, page and zoom in the footer. Every action is a `Command` (ribbon, menus, keys). One tab at a
	// time edits a notebook (Web Lock); changes from elsewhere reload what is not edited here.
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { setBrandBar } from '@in-browser/brand/brand-bar.svelte.js';
	import { debug } from '@in-browser/brand/debug.js';
	import { saveStateOf, setBrandFooter } from '@in-browser/brand/brand-footer.svelte.js';
	import { installCommandKeys, type Command } from '@in-browser/brand/commands.js';
	import Ribbon from '@in-browser/brand/Ribbon.svelte';
	import type { GroupSize, RibbonGroup, RibbonTab } from '@in-browser/brand/ribbon.js';
	import RibbonPopover from '@in-browser/brand/RibbonPopover.svelte';
	import { openMenuAbove, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { inTextField } from '@in-browser/brand/ui/typing.js';
	import { brandMessages, toolName } from '@in-browser/brand/i18n/index.svelte.js';
	import { chooseFiles } from '@in-browser/files/dialog.svelte.js';
	import { filesErrorText, filesMessages } from '@in-browser/files/i18n/index.svelte.js';
	import { read, watch } from '@in-browser/files/fs.js';
	import { flushWhenHidden, lockDocument } from '@in-browser/files/documents.js';
	import { normalize } from '@in-browser/files/path.js';
	import { accessAction } from '@in-browser/files/sources/connections.svelte.js';
	import { deleteToTrash } from '@in-browser/files/trash-browser.js';
	import IconPicker from '@in-browser/graphics/IconPicker.svelte';
	import type { IconData } from '@in-browser/graphics/icons/types.js';
	import { inkMessages } from '@in-browser/ink/i18n/index.svelte.js';
	import type { Tool } from '@in-browser/ink/input/controller.js';
	import { installNudgeKeys } from '@in-browser/ink/input/keys.js';
	import { inkColor } from '@in-browser/ink/outline.js';
	import { SHAPE_KINDS, shapeGlyph } from '@in-browser/ink/shapes.js';
	import { ERASER_SIZES } from '@in-browser/ink/sizes.js';
	import { SMOOTHING_LEVELS } from '@in-browser/ink/smooth.js';
	import InkColorButton from '@in-browser/ink/ui/InkColorButton.svelte';
	import InkStyleButton from '@in-browser/ink/ui/InkStyleButton.svelte';
	import { arrangeGroups, inkSelectionCommands } from '@in-browser/ink/ui/selection-commands.js';
	import SelectionMenu from '@in-browser/ink/ui/SelectionMenu.svelte';
	import ShapeSuggestionButton from '@in-browser/ink/ui/ShapeSuggestion.svelte';
	import { PdfError, readPdfPages } from '@in-browser/pdf/pdfjs.js';
		import ExportDialog from '#lib/components/ExportDialog.svelte';
	import PerfOverlay from '#lib/components/PerfOverlay.svelte';
	import Surface from '#lib/components/Surface.svelte';
	import { m } from '#lib/i18n/index.js';
	import { NotebookDoc } from '#lib/model/notebook.svelte.js';
	import { IMAGE_EXTENSIONS, iconItem, imageItem, prepareImage } from '#lib/model/insert.js';
	import { lastFolder, notebookName, rememberNotebook} from '#lib/model/store.js';
	import { tools } from '#lib/model/tools.svelte.js';
	import { FormatError, isInk, PAGE_SIZES, PAPERS, pageSize, pageSizeOf, type PageMeta, type PageSize, type Paper, type Picture, type Item } from '#lib/model/types.js';
	import type { NotesSelection, NotesStage, NotesSuggestion } from '#lib/render/surface.js';

	let doc = $state<NotebookDoc | null>(null);
	let error = $state<string | null>(null);
	/** Opening failed because the browser doesn't allow access to the connected folder right now */
	let access = $state<ReturnType<typeof accessAction>>(undefined);
	let stage = $state.raw<NotesStage | null>(null);
	let selection = $state.raw<NotesSelection | null>(null);
	let suggestion = $state.raw<NotesSuggestion | null>(null);
	let fileInput = $state<HTMLInputElement>();
	let pdfInput = $state<HTMLInputElement>();
	let exportOpen = $state(false);
	/** Current page (middle of the view) and zoom, for the footer */
	let current = $state(0);
	let zoom = $state(1);
	const perf = $derived(page.url.searchParams.has('perf'));

	function loadError(e: unknown): string {
		if (e instanceof FormatError) return e.reason === 'newer' ? m.editor.newerVersion : m.editor.unknownFormat;
		return m.editor.loadFailed(filesErrorText(e));
	}

	$effect(() => {
		const param = page.url.searchParams.get('path');
		if (!param) return;
		const path = normalize(param);
		let disposed = false;
		let release: (() => void) | null = null;
		let stopWatch: (() => void) | null = null;
		let opened: NotebookDoc | null = null;
		error = null;

		(async () => {
			try {
				release = await lockDocument(`notes:notebook:${path}`);
				if (disposed) return release?.();
				if (!release) {
					error = m.editor.openElsewhere;
					return;
				}
				const next = await NotebookDoc.open(path);
				if (disposed) return;
				opened = doc = next;
				rememberNotebook(path);
				stopWatch = watch((paths) => void next.external(paths));
				void next.cleanup();
			} catch (e) {
				console.error('[notes] open', e);
				error = loadError(e);
				access = accessAction(e, () => location.reload());
			}
		})();

		const stopFlush = flushWhenHidden(() => opened?.flush());
		return () => {
			disposed = true;
			stopFlush();
			stopWatch?.();
			const last = opened;
			doc = null;
			stage = null;
			Promise.resolve(last?.dirty ? last.save() : undefined)
				.catch((e) => console.error('[notes] save', e))
				.finally(() => {
					last?.destroy();
					release?.();
				});
		};
	});

	onDestroy(() => doc?.flush());

	function ready(s: NotesStage, sel: NotesSelection, sug: NotesSuggestion) {
		stage = s;
		selection = sel;
		suggestion = sug;
		updateView();
	}

	/** After undo or redo: the suggestion goes, the selection follows */
	function changed(run: () => void) {
		suggestion?.clear();
		run();
		selection?.refresh();
	}

	/** Picks a tool (remembered) */
	function choose(tool: Tool) {
		tools.tool = tool;
		tools.store();
	}

	// Another tool ends the selection and the shape suggestion
	$effect(() => {
		const tool = tools.tool;
		untrack(() => {
			suggestion?.clear();
			if (tool !== 'lasso') selection?.clear();
		});
	});

	/** A stroke became a shape: select it, so its points can be moved right away */
	function shapeAccepted(shape: { page: number; id: string }) {
		choose('lasso');
		selection?.select(shape.page, new Set([shape.id]));
	}

	function updateView() {
		if (!stage) return;
		current = Math.min(stage.currentPage(), Math.max(0, stage.pages.length - 1));
		zoom = stage.view.zoom;
	}

	function failed(context: string, e: unknown, text: string) {
		showError(e, { context: `[notes] ${context}`, text });
	}

	/** Into the trash (the message offers to undo it): saved first, then the notebook is left */
	async function deleteNotebook() {
		const d = doc;
		if (!d) return;
		try {
			await d.save();
			const path = d.path;
			await goto(resolve('/notes'));
			await deleteToTrash([path]);
		} catch (e) {
			failed('delete', e, m.home.failed(filesErrorText(e)));
		}
	}

	function showInFiles() {
		if (doc) location.assign(filesUrl(doc.path));
	}

	// --- Inserting pictures ---

	/** Puts a picture on a page and selects it, so it can be moved and resized right away */
	function place(picture: Picture, page: number) {
		if (!doc) return;
		doc.items.addOnTop(page, [picture]);
		choose('lasso');
		selection?.select(page, new Set([picture.id]));
	}

	/** Inserts image files at a screen point (drop) or in the middle of the view, slightly offset from each other */
	async function insertImages(files: File[], at?: { sx: number; sy: number }) {
		for (const [i, file] of files.entries()) {
			const d = doc;
			const target = stage?.insertPoint(at?.sx, at?.sy);
			if (!d || !target) return;
			let image;
			try {
				image = await prepareImage(file);
			} catch (e) {
				failed('image', e, m.insert.imageFailed(file.name));
				continue;
			}
			try {
				const asset = await d.addAsset(image.blob, image.ext);
				if (doc !== d) return;
				const page = d.pages[target.page];
				if (page) place(imageItem(asset, image, page, target.x + i * 16, target.y + i * 16), target.page);
			} catch (e) {
				failed('image', e, filesMessages().document.saveFailed(filesErrorText(e)));
				return;
			}
		}
	}

	async function imagesFromFiles() {
		const paths = await chooseFiles({ mode: 'open', multiple: true, folder: lastFolder(), accept: IMAGE_EXTENSIONS, title: m.insert.chooseImage });
		if (!paths) return;
		try {
			await insertImages(await Promise.all(paths.map((p) => read(p))));
		} catch (e) {
			failed('image', e, m.editor.loadFailed(filesErrorText(e)));
		}
	}

	function imagesFromDevice(e: Event & { currentTarget: HTMLInputElement }) {
		const files = [...(e.currentTarget.files ?? [])];
		e.currentTarget.value = '';
		void insertImages(files);
	}

	/** Inserts the pages of PDF files after the current page, each PDF one undo step */
	async function insertPdfs(files: File[]) {
		for (const file of files) {
			const d = doc;
			if (!d) return;
			let sizes;
			try {
				sizes = await readPdfPages(file);
			} catch (e) {
				debug(`[notes] PDF ${file.name}: ${e instanceof Error ? `${e.name}: ${e.message}` : e}`);
				if (e instanceof PdfError) failed('PDF', e, e.reason === 'password' ? m.insert.pdfPassword(file.name) : m.insert.pdfFailed(file.name));
				else failed('PDF', e, m.insert.pdfError(e instanceof Error ? e.message : String(e)));
				continue;
			}
			try {
				const asset = await d.addAsset(file, 'pdf');
				if (doc !== d) return;
				const at = d.insertPdf(current, asset, sizes);
				stage?.scrollToPage(at);
				toast(m.insert.pdfInserted(sizes.length), 'success');
			} catch (e) {
				failed('PDF', e, filesMessages().document.saveFailed(filesErrorText(e)));
				return;
			}
		}
	}

	async function pdfsFromFiles() {
		const paths = await chooseFiles({ mode: 'open', multiple: true, folder: lastFolder(), accept: ['.pdf'], title: m.insert.choosePdf });
		if (!paths) return;
		try {
			await insertPdfs(await Promise.all(paths.map((p) => read(p))));
		} catch (e) {
			failed('PDF', e, m.editor.loadFailed(filesErrorText(e)));
		}
	}

	function pdfsFromDevice(e: Event & { currentTarget: HTMLInputElement }) {
		const files = [...(e.currentTarget.files ?? [])];
		e.currentTarget.value = '';
		void insertPdfs(files);
	}

	function insertIcon(icon: IconData) {
		const target = stage?.insertPoint();
		const page = target && doc?.pages[target.page];
		if (!target || !page) return;
		place(iconItem(icon, tools.pen.color, page, target.x, target.y), target.page);
	}

	const imageFiles = (list: FileList | null | undefined) => [...(list ?? [])].filter((f) => f.type.startsWith('image/'));
	const isPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
	const pdfFiles = (list: FileList | null | undefined) => [...(list ?? [])].filter(isPdf);

	function paste(e: ClipboardEvent) {
		if (!doc || inTextField(e.target)) return;
		const files = imageFiles(e.clipboardData?.files);
		const pdfs = pdfFiles(e.clipboardData?.files);
		if (!files.length && !pdfs.length) return;
		e.preventDefault();
		void insertImages(files).then(() => insertPdfs(pdfs));
	}

	function dragover(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	}

	function drop(e: DragEvent) {
		const files = imageFiles(e.dataTransfer?.files);
		const pdfs = pdfFiles(e.dataTransfer?.files);
		if ((!files.length && !pdfs.length) || !stage) return;
		e.preventDefault();
		const [sx, sy] = stage.local(e.clientX, e.clientY);
		void insertImages(files, { sx, sy }).then(() => insertPdfs(pdfs));
	}

	// --- Pages ---

	function addPage() {
		if (!doc || !stage) return;
		const at = doc.addPage(current);
		stage.scrollToPage(at);
	}

	/** Deletes the current page without asking; the message offers to undo it */
	function deletePage() {
		const undo = doc?.deletePage(current);
		if (undo) toast(m.page.deleted(current + 1), 'info', 8000, { label: m.editor.undo, run: () => changed(undo) });
	}

	function movePage(by: number) {
		if (!doc || !stage) return;
		const to = current + by;
		doc.movePage(current, to);
		stage.scrollToPage(to);
	}

	const PAPER_ICONS: Record<Paper, string> = {
		blank: 'icon-[material-symbols-light--crop-portrait-outline]',
		lined: 'icon-[material-symbols-light--notes]',
		grid: 'icon-[material-symbols-light--grid-4x4]',
		dotted: 'icon-[material-symbols-light--more-horiz]'
	};

	/** The current page (null while nothing is open) */
	const meta = (): PageMeta | null => doc?.pages[current] ?? null;
	/** Imported PDF pages keep the size and look of their PDF page */
	const plainPage = () => {
		const p = meta();
		return !!p && !p.background;
	};
	const landscape = () => {
		const p = meta();
		return p ? (pageSizeOf(p)?.landscape ?? p.w > p.h) : false;
	};

	function togglePenOnly() {
		tools.penOnly = !tools.penOnly;
		tools.store();
		if (tools.penOnly) toast(m.editor.penOnlyOn, 'info');
	}

	// --- Commands ---

	// A tool's language is fixed when it loads
	const tm = inkMessages().tools;
	const has = () => !!stage;
	/** The chosen tool draws ink (its format: color, thickness, smoothing) */
	const drawsInk = () => tools.tool === 'pen' || tools.tool === 'highlighter' || tools.tool === 'shape';

	/** A tool of the ink core: picked by its command and a letter */
	function drawingTool(tool: Tool, label: string, icon: string, key: string): Command {
		return { id: tool, label, icon, shortcut: { key }, active: () => tools.tool === tool, run: () => choose(tool) };
	}

	// The selection's commands, shared with the PDF Editor (duplicate, delete, thickness, arrange)
	const sc = inkSelectionCommands<PageMeta, Item>({ selection: () => selection, tools, drawsInk });

	const commands = {
		// The notebook itself (tab “File”); it is named after its file – renamed in Files
		exportNotebook: { id: 'export', label: m.export.menu, icon: 'icon-[material-symbols-light--ios-share]', enabled: () => !!doc, run: () => (exportOpen = true) },
		showInFiles: { id: 'showInFiles', label: m.editor.showInFiles, icon: 'icon-[material-symbols-light--folder-open-outline]', enabled: () => !!doc, run: showInFiles },
		deleteNotebook: { id: 'deleteNotebook', label: m.common.delete, icon: 'icon-[material-symbols-light--delete-outline]', enabled: () => !!doc, run: () => void deleteNotebook() },
		undo: { id: 'undo', label: m.editor.undo, icon: 'icon-[material-symbols-light--undo]', shortcut: { key: 'z', ctrl: true }, enabled: () => !!doc?.canUndo, run: () => changed(() => doc?.undo()) },
		redo: {
			id: 'redo',
			label: m.editor.redo,
			icon: 'icon-[material-symbols-light--redo]',
			shortcut: { key: 'z', ctrl: true, shift: true },
			enabled: () => !!doc?.canRedo,
			run: () => changed(() => doc?.redo())
		},
		pen: drawingTool('pen', tm.pen, 'icon-[material-symbols-light--ink-pen-outline]', 'p'),
		highlighter: drawingTool('highlighter', tm.highlighter, 'icon-[material-symbols-light--ink-highlighter]', 'h'),
		shape: {
			...drawingTool('shape', tm.shape, 'icon-[material-symbols-light--shapes-outline]', 's'),
			tip: tm.shapeHint,
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
				{ heading: tm.eraserMode },
				...(['stroke', 'pixel'] as const).map((mode) => ({
					label: tm.eraserModes[mode],
					checked: mode === tools.eraserMode,
					run: () => {
						tools.eraserMode = mode;
						choose('eraser');
					}
				})),
				{ heading: tm.size },
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
		laser: drawingTool('laser', tm.laser, 'icon-[material-symbols-light--stylus-laser-pointer-outline]', 'r'),
		smoothing: {
			id: 'smoothing',
			label: tm.smoothing,
			tip: tm.smoothingHint,
			icon: 'icon-[material-symbols-light--gesture]',
			enabled: () => !sc.sel() && (tools.tool === 'pen' || tools.tool === 'highlighter'),
			menu: () =>
				SMOOTHING_LEVELS.map((level, i) => ({
					label: tm.smoothingLevels[i],
					checked: level === tools.smoothing,
					run: () => {
						tools.smoothing = level;
						tools.store();
					}
				}))
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
		penOnly: { id: 'penOnly', label: m.editor.penOnly, tip: m.editor.penOnlyTip, icon: 'icon-[material-symbols-light--do-not-touch-outline]', active: () => tools.penOnly, run: togglePenOnly },
		selectAll: {
			id: 'selectAll',
			label: m.editor.selectAll,
			tip: m.editor.selectAllTip,
			icon: 'icon-[material-symbols-light--select-all]',
			shortcut: { key: 'a', ctrl: true },
			enabled: has,
			run: () => {
				if (!stage) return;
				choose('lasso');
				selection?.selectAll(stage.currentPage());
			}
		},
		deleteSelection: sc.delete,
		image: {
			id: 'image',
			label: m.insert.image,
			icon: 'icon-[material-symbols-light--add-photo-alternate-outline]',
			enabled: has,
			menu: () => [
				{ label: m.insert.imageFromFiles, icon: 'icon-[material-symbols-light--folder-open-outline]', run: () => void imagesFromFiles() },
				{ label: m.insert.imageFromDevice, icon: 'icon-[material-symbols-light--upload-file-outline]', run: () => fileInput?.click() }
			]
		},
		pdf: {
			id: 'insertPdf',
			label: m.insert.pdf,
			icon: 'icon-[material-symbols-light--picture-as-pdf-outline]',
			enabled: has,
			menu: () => [
				{ label: m.insert.pdfFromFiles, icon: 'icon-[material-symbols-light--folder-open-outline]', run: () => void pdfsFromFiles() },
				{ label: m.insert.pdfFromDevice, icon: 'icon-[material-symbols-light--upload-file-outline]', run: () => pdfInput?.click() }
			]
		},
		addPage: { id: 'addPage', label: m.page.add, icon: 'icon-[material-symbols-light--note-add-outline]', enabled: has, run: addPage },
		paper: {
			id: 'paper',
			label: m.page.paper,
			icon: 'icon-[material-symbols-light--texture]',
			enabled: plainPage,
			menu: () =>
				PAPERS.map((p) => ({
					label: m.page.papers[p],
					icon: PAPER_ICONS[p],
					checked: p === meta()?.paper,
					run: () => doc?.setPaper(current, p)
				}))
		},
		size: {
			id: 'pageSize',
			label: m.page.size,
			icon: 'icon-[material-symbols-light--aspect-ratio-outline]',
			enabled: plainPage,
			menu: () => {
				const p = meta();
				const size = p ? pageSizeOf(p)?.size : null;
				return (Object.keys(PAGE_SIZES) as PageSize[]).map((s) => ({
					label: m.page.sizes[s],
					checked: s === size,
					run: () => doc?.setSize(current, pageSize(s, landscape()))
				}));
			}
		},
		landscape: {
			id: 'landscape',
			label: m.page.landscape,
			icon: 'icon-[material-symbols-light--crop-landscape-outline]',
			enabled: plainPage,
			active: landscape,
			run: () => {
				const p = meta();
				if (p) doc?.setSize(current, { w: p.h, h: p.w });
			}
		},
		moveUp: { id: 'movePageUp', label: m.page.moveUp, icon: 'icon-[material-symbols-light--arrow-upward]', enabled: () => !!doc && current > 0, run: () => movePage(-1) },
		moveDown: {
			id: 'movePageDown',
			label: m.page.moveDown,
			icon: 'icon-[material-symbols-light--arrow-downward]',
			enabled: () => !!doc && current < doc.pages.length - 1,
			run: () => movePage(1)
		},
		deletePage: {
			id: 'deletePage',
			label: m.page.delete,
			tip: m.page.deleteTip,
			icon: 'icon-[material-symbols-light--delete-outline]',
			// The last page stays
			enabled: () => (doc?.pages.length ?? 0) > 1,
			run: deletePage
		},
		fitWidth: { id: 'fitWidth', label: m.editor.fitWidth, icon: 'icon-[material-symbols-light--fit-page-width]', enabled: has, run: () => stage?.fitWidth() },
		actualSize: { id: 'actualSize', label: m.editor.actualSize, icon: 'icon-[material-symbols-light--crop-free]', shortcut: { key: '0', ctrl: true }, enabled: has, run: () => stage?.setZoom(1) },
		zoomIn: { id: 'zoomIn', label: m.editor.zoomIn, icon: 'icon-[material-symbols-light--zoom-in]', shortcut: { key: '+', ctrl: true }, enabled: has, run: () => stage?.setZoom(zoom * 1.25) },
		zoomOut: { id: 'zoomOut', label: m.editor.zoomOut, icon: 'icon-[material-symbols-light--zoom-out]', shortcut: { key: '-', ctrl: true }, enabled: has, run: () => stage?.setZoom(zoom / 1.25) }
	} satisfies Record<string, Command>;

	// `=` is `+` without Shift on many layouts; Ctrl+Y redoes too; Backspace deletes too
	const zoomInAlt: Command = { ...commands.zoomIn, id: 'zoomInAlt', shortcut: { key: '=', ctrl: true } };
	const redoAlt: Command = { ...commands.redo, id: 'redoAlt', shortcut: { key: 'y', ctrl: true } };
	const deleteAlt: Command = { ...commands.deleteSelection, id: 'deleteAlt', shortcut: { key: 'Backspace' } };

	// --- Ribbon ---

	/** What is selected: only strokes and shapes ("Drawing"), or with pictures ("Selection"); null: nothing */
	const kind = $derived(selection?.count ? (selection.items.every(isInk) ? 'drawing' : 'selection') : null);
	const formatGroup: RibbonGroup = {
		id: 'format',
		label: m.ribbon.groups.format,
		items: [{ id: 'color', label: inkMessages().selection.color, custom: colorButton }, sc.thickness, commands.smoothing, { id: 'style', label: inkMessages().selection.style, custom: styleButton }]
	};
	/** The tab of a selection: its format, then duplicate, delete and select all (phones switch to it) */
	const selectionTab = (id: 'drawing' | 'selection', label: string): RibbonTab => ({
		id,
		label,
		contextual: true,
		visible: () => kind === id,
		groups: [formatGroup, { id: 'object', label: m.ribbon.groups.object, items: [sc.duplicate, commands.deleteSelection, commands.selectAll] }]
	});

	const tabs: RibbonTab[] = [
		{
			id: 'file',
			label: brandMessages().ribbon.file,
			groups: [{ id: 'notebook', label: m.ribbon.groups.notebook, items: [commands.exportNotebook, commands.showInFiles, commands.deleteNotebook] }]
		},
		{
			id: 'draw',
			label: m.ribbon.tabs.draw,
			groups: [
				{ id: 'tools', label: m.ribbon.groups.tools, items: [commands.lasso, commands.pen, commands.highlighter, commands.shape, commands.eraser, commands.laser] },
				formatGroup,
				{ id: 'options', label: m.ribbon.groups.options, items: [commands.snap, commands.penOnly] }
			]
		},
		{
			id: 'insert',
			label: m.ribbon.tabs.insert,
			groups: [
				{ id: 'pictures', label: m.ribbon.groups.pictures, items: [commands.image, { id: 'icon', label: m.insert.icon, custom: iconButton }] },
				{ id: 'pages', label: m.ribbon.groups.pages, items: [commands.pdf, commands.addPage] }
			]
		},
		{
			id: 'pages',
			label: m.ribbon.tabs.pages,
			groups: [
				{ id: 'page', label: m.ribbon.groups.page, items: [commands.paper, commands.size, commands.landscape] },
				{ id: 'organize', label: m.ribbon.groups.organize, items: [commands.addPage, commands.moveUp, commands.moveDown, commands.deletePage] }
			]
		},
		{
			id: 'view',
			label: m.ribbon.tabs.view,
			groups: [{ id: 'zoom', label: m.ribbon.groups.zoom, items: [commands.fitWidth, commands.actualSize, commands.zoomIn, commands.zoomOut] }]
		},
		selectionTab('drawing', m.ribbon.tabs.drawing),
		selectionTab('selection', m.ribbon.tabs.selection),
		{ id: 'arrange', label: m.ribbon.tabs.arrange, contextual: true, visible: () => kind !== null, follow: () => false, groups: arrangeGroups(sc) }
	];

	// --- Keys ---

	$effect(() => installCommandKeys(() => (doc ? [...Object.values(commands), zoomInAlt, redoAlt, deleteAlt] : [])));
	// Arrow keys move the selection (one undo step per key sequence)
	$effect(() => installNudgeKeys(() => selection));

	// Esc ends a selection; without one it goes back from any tool to "Select" (not while typing or while a menu,
	// popover or dialog takes the Esc)
	$effect(() => {
		const key = (e: KeyboardEvent) => {
			if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector(':popover-open, dialog[open], .modal-open')) return;
			if (selection?.active) selection.clear();
			else if (tools.tool !== 'lasso' && doc && !inTextField(e.target)) choose('lasso');
		};
		addEventListener('keydown', key);
		return () => removeEventListener('keydown', key);
	});

	// --- Bars ---

	// Where you are: the notebook's name (its file name) – its actions are in the ribbon's tab “File”
	$effect(() => {
		const d = doc;
		return setBrandBar({ crumbs: [{ label: d ? notebookName(d.path) : m.editor.back, href: d ? undefined : resolve('/notes') }] });
	});

	function zoomMenu(): MenuEntry[] {
		return [commands.fitWidth, commands.actualSize, commands.zoomIn, commands.zoomOut].map((c) => ({ label: c.label, icon: c.icon, run: c.run }));
	}

	$effect(() =>
		setBrandFooter({
			status: footerStatus,
			save: doc ? saveStateOf(doc) : null
		})
	);
</script>

<svelte:window onpaste={paste} />

<svelte:head>
	{#if doc}<title>{notebookName(doc.path)} · {toolName('notes')}</title>{/if}
</svelte:head>

<!-- Format: the color of the selection, else of what the chosen tool draws next (with its opacity) -->
{#snippet colorButton(size: GroupSize)}
	{@const s = sc.sel()}
	<InkColorButton
		selection={s}
		value={inkColor(tools.tool === 'highlighter' ? 'highlighter' : 'pen', tools.ink.color)}
		onpick={(c) => {
			tools.ink.color = c;
			tools.store();
		}}
		{size}
		disabled={s ? !s.colorable : !drawsInk()}
	/>
{/snippet}

<!-- Format: style of the selected shapes, else of the next shape -->
{#snippet styleButton(size: GroupSize)}
	<InkStyleButton selection={sc.sel()} {tools} {size} />
{/snippet}

<!-- Insert: an icon in the pen color, in the middle of the view -->
{#snippet iconButton(size: GroupSize)}
	<RibbonPopover id="icon" label={m.insert.icon} icon="icon-[material-symbols-light--interests-outline]" {size} disabled={!stage}>
		{#snippet children(close)}
			<div class="max-h-[60vh] w-80 max-w-[calc(100vw-2.5rem)] overflow-x-hidden overflow-y-auto">
				<IconPicker
					onpick={(icon) => {
						close();
						insertIcon(icon);
					}}
					hint={m.insert.iconHint}
				/>
			</div>
		{/snippet}
	</RibbonPopover>
{/snippet}

{#snippet footerStatus()}
	{#if doc}
		<span class="inline-block min-w-28 tabular-nums">{m.editor.pageOf(current + 1, doc.pages.length)}</span>
		<button class="btn btn-ghost btn-xs min-w-14 font-normal tabular-nums" onclick={(e) => openMenuAbove(e, zoomMenu())} title={m.editor.zoomMenu}>
			{m.editor.zoom(Math.round(zoom * 100))}
		</button>
		{#if tools.penOnly}
			<button class="btn btn-ghost btn-xs font-normal" onclick={togglePenOnly} title={m.editor.penOnly}>
				<span class="icon-[material-symbols-light--do-not-touch-outline] size-4" aria-hidden="true"></span>{m.editor.penOnly}
			</button>
		{/if}
	{/if}
{/snippet}

{#if error}
	<div class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
		<p class="max-w-md">{error}</p>
		<div class="flex gap-2">
			{#if access}<button class="btn btn-primary" onclick={access.run}>{access.label}</button>{/if}
			<a class="btn" href={resolve('/notes')}>{m.editor.back}</a>
		</div>
	</div>
{:else if doc}
	<div class="flex h-full min-h-0 flex-col">
		<Ribbon {tabs} quick={[commands.undo, commands.redo]} storage="notes" initial="draw" />
		<div class="relative min-h-0 flex-1" role="presentation" ondragover={dragover} ondrop={drop}>
			{#key doc}
				<Surface {doc} onready={ready} onview={updateView} />
			{/key}
			<!-- Next to the surface, not in it: presses on them must not reach the surface's input -->
			{#if selection}<SelectionMenu {selection} />{/if}
			{#if suggestion}<ShapeSuggestionButton {suggestion} onaccept={shapeAccepted} />{/if}
			{#if perf && stage}<PerfOverlay {stage} />{/if}
		</div>
		<input bind:this={fileInput} type="file" accept="image/*" multiple class="hidden" onchange={imagesFromDevice} />
		<input bind:this={pdfInput} type="file" accept="application/pdf,.pdf" multiple class="hidden" onchange={pdfsFromDevice} />
		{#if exportOpen}<ExportDialog {doc} page={current} onclose={() => (exportOpen = false)} />{/if}
	</div>
{:else}
	<div class="flex h-full items-center justify-center">
		<span class="loading loading-spinner opacity-60"></span>
	</div>
{/if}
