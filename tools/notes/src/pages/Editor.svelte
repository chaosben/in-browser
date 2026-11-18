<script lang="ts">
	// A notebook (`?path=` of its package): drawing surface, palette, page actions. One tab at a time edits a
	// notebook (Web Lock); changes from elsewhere reload what is not edited here.
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { setBrandBar, startRename } from '@in-browser/brand/brand-bar.svelte.js';
	import { debug } from '@in-browser/brand/debug.js';
	import { setBrandFooter } from '@in-browser/brand/brand-footer.svelte.js';
	import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
	import { openMenuAbove, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { chooseFiles } from '@in-browser/files/dialog.svelte.js';
	import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
	import { read, watch } from '@in-browser/files/fs.js';
	import type { IconData } from '@in-browser/graphics/icons/types.js';
	import { normalize } from '@in-browser/files/path.js';
	import { BRAND, editorUrl } from '#lib/brand.js';
	import ExportDialog from '#lib/components/ExportDialog.svelte';
	import PerfOverlay from '#lib/components/PerfOverlay.svelte';
	import SelectionMenu from '#lib/components/SelectionMenu.svelte';
	import ShapeSuggestionButton from '#lib/components/ShapeSuggestion.svelte';
	import type { Selection } from '#lib/input/selection.svelte.js';
	import type { ShapeSuggestion } from '#lib/input/suggestion.svelte.js';
	import Surface from '#lib/components/Surface.svelte';
	import ToolPalette from '#lib/components/ToolPalette.svelte';
	import { m } from '#lib/i18n/index.js';
	import { NotebookDoc } from '#lib/model/notebook.svelte.js';
	import { IMAGE_EXTENSIONS, iconItem, imageItem, prepareImage } from '#lib/model/insert.js';
	import { lastFolder, notebookName, rememberNotebook, renameNotebook } from '#lib/model/store.js';
	import { tools } from '#lib/model/tools.svelte.js';
	import { FormatError, PAGE_SIZES, PAPERS, pageSize, pageSizeOf, type PageSize, type Paper, type Picture } from '#lib/model/types.js';
	import { PdfError, readPdfPages } from '#lib/render/pdf.js';
	import type { Stage } from '#lib/render/stage.js';

	let doc = $state<NotebookDoc | null>(null);
	let error = $state<string | null>(null);
	let stage = $state.raw<Stage | null>(null);
	let selection = $state.raw<Selection | null>(null);
	let suggestion = $state.raw<ShapeSuggestion | null>(null);
	let paletteOpen = $state(false);
	let iconsOpen = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let pdfInput = $state<HTMLInputElement>();
	let exportOpen = $state(false);
	/** Current page (middle of the view) and zoom, for the footer */
	let current = $state(0);
	let zoom = $state(1);
	const perf = $derived(page.url.searchParams.has('perf'));

	/** Holds the notebook's lock until the returned function is called; `null` if another tab holds it */
	function lock(path: string): Promise<(() => void) | null> {
		return new Promise((resolve) => {
			navigator.locks.request(`notes:notebook:${path}`, { ifAvailable: true }, (held) => {
				if (!held) return resolve(null);
				return new Promise<void>((release) => resolve(release));
			});
		});
	}

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
				release = await lock(path);
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
			}
		})();

		const flush = () => opened?.flush();
		const hidden = () => document.visibilityState === 'hidden' && flush();
		window.addEventListener('pagehide', flush);
		document.addEventListener('visibilitychange', hidden);
		return () => {
			disposed = true;
			window.removeEventListener('pagehide', flush);
			document.removeEventListener('visibilitychange', hidden);
			stopWatch?.();
			const last = opened;
			doc = null;
			stage = null;
			Promise.resolve(last?.dirty ? last.save() : undefined)
				.catch(() => {})
				.finally(() => {
					last?.destroy();
					release?.();
				});
		};
	});

	onDestroy(() => doc?.flush());

	function ready(s: Stage, sel: Selection, sug: ShapeSuggestion) {
		stage = s;
		selection = sel;
		suggestion = sug;
		updateView();
	}

	function undo() {
		suggestion?.clear();
		doc?.undo();
		selection?.refresh();
	}

	function redo() {
		suggestion?.clear();
		doc?.redo();
		selection?.refresh();
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
		tools.tool = 'lasso';
		tools.store();
		selection?.select(shape.page, new Set([shape.id]));
	}

	function updateView() {
		if (!stage) return;
		current = Math.min(stage.currentPage(), Math.max(0, stage.pages.length - 1));
		zoom = stage.view.zoom;
	}

	async function rename(name: string) {
		const d = doc;
		if (!d || !name.trim() || name === notebookName(d.path)) return;
		try {
			await d.save();
			const target = await renameNotebook(d.path, name);
			if (target !== d.path) await goto(editorUrl(target), { replaceState: true });
		} catch (e) {
			toast(m.editor.renameFailed(filesErrorText(e)), 'error', 8000);
		}
	}

	// --- Inserting pictures ---

	/** Puts a picture on a page and selects it, so it can be moved and resized right away */
	function place(picture: Picture, page: number) {
		if (!doc) return;
		doc.addPicture(page, picture);
		tools.tool = 'lasso';
		tools.store();
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
				console.error('[notes] image', e);
				toast(m.insert.imageFailed(file.name), 'error', 8000);
				continue;
			}
			try {
				const asset = await d.addAsset(image.blob, image.ext);
				if (doc !== d) return;
				const page = d.pages[target.page];
				if (page) place(imageItem(asset, image, page, target.x + i * 16, target.y + i * 16), target.page);
			} catch (e) {
				toast(m.editor.saveFailed(filesErrorText(e)), 'error', 8000);
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
			toast(m.editor.loadFailed(filesErrorText(e)), 'error', 8000);
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
				console.error('[notes] PDF', e);
				debug(`[notes] PDF ${file.name}: ${e instanceof Error ? `${e.name}: ${e.message}` : e}`);
				if (e instanceof PdfError) toast(e.reason === 'password' ? m.insert.pdfPassword(file.name) : m.insert.pdfFailed(file.name), 'error', 8000);
				else toast(m.insert.pdfError(e instanceof Error ? e.message : String(e)), 'error', 8000);
				continue;
			}
			try {
				const asset = await d.addAsset(file, 'pdf');
				if (doc !== d) return;
				const at = d.insertPdf(current, asset, sizes);
				stage?.scrollToPage(at);
				toast(m.insert.pdfInserted(sizes.length), 'success');
			} catch (e) {
				toast(m.editor.saveFailed(filesErrorText(e)), 'error', 8000);
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
			toast(m.editor.loadFailed(filesErrorText(e)), 'error', 8000);
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
		iconsOpen = false;
		place(iconItem(icon, tools.pen.color, page, target.x, target.y), target.page);
	}

	function insertMenu(): MenuEntry[] {
		return [
			{ label: m.insert.imageFromFiles, icon: 'icon-[material-symbols-light--folder-open-outline]', run: () => void imagesFromFiles() },
			{ label: m.insert.imageFromDevice, icon: 'icon-[material-symbols-light--add-photo-alternate-outline]', run: () => fileInput?.click() },
			{
				label: m.insert.icon,
				icon: 'icon-[material-symbols-light--interests-outline]',
				run: () => {
					// The selection's menu would float over the picker
					selection?.clear();
					paletteOpen = false;
					iconsOpen = true;
				}
			},
			{ separator: true },
			{ label: m.insert.pdfFromFiles, icon: 'icon-[material-symbols-light--picture-as-pdf-outline]', run: () => void pdfsFromFiles() },
			{ label: m.insert.pdfFromDevice, icon: 'icon-[material-symbols-light--upload-file-outline]', run: () => pdfInput?.click() }
		];
	}

	const imageFiles = (list: FileList | null | undefined) => [...(list ?? [])].filter((f) => f.type.startsWith('image/'));
	const isPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
	const pdfFiles = (list: FileList | null | undefined) => [...(list ?? [])].filter(isPdf);

	function paste(e: ClipboardEvent) {
		if (!doc || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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

	async function deletePage() {
		if (!doc || doc.pages.length <= 1) return;
		const index = current;
		const ok = await ask({ ...m.page.deleteQuestion, message: m.page.deleteQuestion.message(index + 1), danger: true });
		if (ok) doc.deletePage(index);
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

	function pageMenu(): MenuEntry[] {
		const d = doc;
		if (!d) return [];
		const meta = d.pages[current];
		const paper = meta?.paper;
		// Imported PDF pages keep the size and look of their PDF page
		const pdf = !!meta?.background;
		const size = meta ? pageSizeOf(meta) : null;
		const landscape = size?.landscape ?? (meta ? meta.w > meta.h : false);
		return [
			{ label: m.page.add, icon: 'icon-[material-symbols-light--note-add-outline]', run: addPage },
			{ heading: m.page.paper },
			...PAPERS.map((p) => ({
				label: m.page.papers[p],
				icon: p === paper ? 'icon-[material-symbols-light--check]' : PAPER_ICONS[p],
				disabled: pdf,
				run: () => d.setPaper(current, p)
			})),
			{ heading: m.page.size },
			...(Object.keys(PAGE_SIZES) as PageSize[]).map((s) => ({
				label: m.page.sizes[s],
				icon: s === size?.size ? 'icon-[material-symbols-light--check]' : 'icon-[material-symbols-light--crop-portrait-outline]',
				disabled: pdf,
				run: () => d.setSize(current, pageSize(s, landscape))
			})),
			{
				label: m.page.landscape,
				icon: landscape ? 'icon-[material-symbols-light--check]' : 'icon-[material-symbols-light--crop-landscape-outline]',
				disabled: pdf || !meta,
				run: () => meta && d.setSize(current, { w: meta.h, h: meta.w })
			},
			{ separator: true },
			{ label: m.page.moveUp, icon: 'icon-[material-symbols-light--arrow-upward]', disabled: current === 0, run: () => movePage(-1) },
			{ label: m.page.moveDown, icon: 'icon-[material-symbols-light--arrow-downward]', disabled: current >= d.pages.length - 1, run: () => movePage(1) },
			{ label: m.page.delete, icon: 'icon-[material-symbols-light--delete-outline]', disabled: d.pages.length <= 1, run: deletePage }
		];
	}

	function zoomMenu(): MenuEntry[] {
		return [
			{ label: m.editor.fitWidth, icon: 'icon-[material-symbols-light--fit-page-width]', run: () => stage?.fitWidth() },
			{ label: m.editor.actualSize, icon: 'icon-[material-symbols-light--fit-page]', keys: 'Ctrl+0', run: () => stage?.setZoom(1) },
			{ label: m.editor.zoomIn, icon: 'icon-[material-symbols-light--zoom-in]', keys: 'Ctrl++', run: () => stage?.setZoom(zoom * 1.25) },
			{ label: m.editor.zoomOut, icon: 'icon-[material-symbols-light--zoom-out]', keys: 'Ctrl+-', run: () => stage?.setZoom(zoom / 1.25) }
		];
	}

	function togglePenOnly() {
		tools.penOnly = !tools.penOnly;
		tools.store();
		toast(tools.penOnly ? m.editor.penOnlyOn : m.editor.penOnly, 'info');
	}

	function keydown(e: KeyboardEvent) {
		if (!doc || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		const mod = e.ctrlKey || e.metaKey;
		if (mod && e.key.toLowerCase() === 'z') {
			e.preventDefault();
			if (e.shiftKey) redo();
			else undo();
		} else if (mod && e.key.toLowerCase() === 'y') {
			e.preventDefault();
			redo();
		} else if ((e.key === 'Delete' || e.key === 'Backspace') && selection?.active) {
			e.preventDefault();
			selection.delete();
		} else if (e.key === 'Escape' && selection?.active) {
			selection.clear();
		} else if (mod && (e.key === '+' || e.key === '=')) {
			e.preventDefault();
			stage?.setZoom(zoom * 1.25);
		} else if (mod && e.key === '-') {
			e.preventDefault();
			stage?.setZoom(zoom / 1.25);
		} else if (mod && e.key === '0') {
			e.preventDefault();
			stage?.setZoom(1);
		}
	}

	// Notebook name with all its actions on the left of the BrandBar, undo/redo right after it
	$effect(() => {
		const d = doc;
		if (!d) return setBrandBar({ crumbs: [{ label: m.editor.back, href: resolve('/notes') }] });
		return setBrandBar({
			crumbs: [
				{
					label: notebookName(d.path),
					rename: (name) => void rename(name),
					menu: [
						{ label: m.editor.undo, icon: 'icon-[material-symbols-light--undo]', keys: 'Ctrl+Z', disabled: !d.canUndo, run: undo },
						{ label: m.editor.redo, icon: 'icon-[material-symbols-light--redo]', keys: 'Ctrl+Shift+Z', disabled: !d.canRedo, run: redo },
						{ separator: true },
						{ label: m.editor.rename, icon: 'icon-[material-symbols-light--edit-outline]', run: startRename },
						{ label: m.export.menu, icon: 'icon-[material-symbols-light--ios-share]', run: () => (exportOpen = true) },
						{ label: m.page.add, icon: 'icon-[material-symbols-light--note-add-outline]', run: addPage },
						{
							label: m.editor.penOnly,
							icon: tools.penOnly ? 'icon-[material-symbols-light--check]' : 'icon-[material-symbols-light--do-not-touch-outline]',
							run: togglePenOnly
						}
					]
				}
			],
			primary: barPrimary
		});
	});

	$effect(() =>
		setBrandFooter({
			status: footerStatus,
			save: doc
				? doc.saving
					? { state: 'saving', text: m.editor.saving }
					: doc.dirty
						? { state: 'unsaved', text: m.editor.notSaved }
						: { state: 'saved', text: m.editor.saved }
				: null
		})
	);
</script>

<svelte:window onkeydown={keydown} onpaste={paste} />

<svelte:head>
	{#if doc}<title>{notebookName(doc.path)} · {BRAND.tool}</title>{/if}
</svelte:head>

{#snippet barPrimary()}
	{#if doc}
		{@const d = doc}
		<button class="btn btn-ghost btn-sm" onclick={undo} disabled={!d.canUndo} title="{m.editor.undo} (Ctrl+Z)">
			<span class="icon-[material-symbols-light--undo] size-5" aria-hidden="true"></span>{m.editor.undo}
		</button>
		<button class="btn btn-ghost btn-sm" onclick={redo} disabled={!d.canRedo} title="{m.editor.redo} (Ctrl+Shift+Z)">
			<span class="icon-[material-symbols-light--redo] size-5" aria-hidden="true"></span>{m.editor.redo}
		</button>
		<button class="btn btn-ghost btn-sm" onclick={() => (exportOpen = true)}>
			<span class="icon-[material-symbols-light--ios-share] size-5" aria-hidden="true"></span>{m.export.title}
		</button>
	{/if}
{/snippet}

{#snippet footerStatus()}
	{#if doc}
		<span>{m.editor.pageOf(current + 1, doc.pages.length)}</span>
		<button class="btn btn-ghost btn-xs font-normal tabular-nums" onclick={(e) => openMenuAbove(e, zoomMenu())} title={m.editor.zoomMenu}>
			{m.editor.zoom(Math.round(zoom * 100))}
		</button>
		{#if tools.penOnly}
			<button class="btn btn-ghost btn-xs font-normal" onclick={togglePenOnly} title={m.editor.penOnly}>
				<span class="icon-[material-symbols-light--do-not-touch-outline] size-4" aria-hidden="true"></span>{m.editor.penOnly}
			</button>
		{/if}
	{/if}
{/snippet}

<div class="relative h-full" role="presentation" ondragover={dragover} ondrop={drop}>
	{#if error}
		<div class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
			<p class="max-w-md">{error}</p>
			<a class="btn" href={resolve('/notes')}>{m.editor.back}</a>
		</div>
	{:else if doc}
		{#key doc}
			<Surface
				{doc}
				onready={ready}
				onview={updateView}
				onpress={() => {
					paletteOpen = false;
					iconsOpen = false;
				}}
			/>
		{/key}
		<ToolPalette
			bind:open={paletteOpen}
			bind:icons={iconsOpen}
			onicon={insertIcon}
			oninsertmenu={(e) => openMenuAbove(e, insertMenu())}
			onpagemenu={(e) => openMenuAbove(e, pageMenu())}
		/>
		<input bind:this={fileInput} type="file" accept="image/*" multiple class="hidden" onchange={imagesFromDevice} />
		<input bind:this={pdfInput} type="file" accept="application/pdf,.pdf" multiple class="hidden" onchange={pdfsFromDevice} />
		{#if exportOpen}<ExportDialog {doc} page={current} onclose={() => (exportOpen = false)} />{/if}
		{#if selection}<SelectionMenu {selection} />{/if}
		{#if suggestion}<ShapeSuggestionButton {suggestion} onaccept={shapeAccepted} />{/if}
		{#if perf && stage}<PerfOverlay {stage} />{/if}
	{:else}
		<div class="flex h-full items-center justify-center">
			<span class="loading loading-spinner opacity-60"></span>
		</div>
	{/if}
</div>
