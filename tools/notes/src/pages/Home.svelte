<script lang="ts">
	// Start page (`StartPage`, `ui.md`): all notebooks in the shared file system as cards – a click opens, the menu
	// shows in Files and deletes into the trash; new notebook, open, import a PDF as a new notebook
	// (also what opening a PDF in Files leads to: `?path=<pdf>`).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { chooseFile } from '@in-browser/files/dialog.svelte.js';
	import { debug } from '@in-browser/brand/debug.js';
	import { shortcutLabel, type Shortcut } from '@in-browser/brand/commands.js';
	import { brandMessages } from '@in-browser/brand/i18n/index.svelte.js';
	import { openMenuBelow, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { filesErrorText, filesMessages } from '@in-browser/files/i18n/index.svelte.js';
	import StartPage, { type StartEntry } from '@in-browser/files/StartPage.svelte';
	import { read, supported, watchSettled } from '@in-browser/files/fs.js';
	import { deleteToTrash } from '@in-browser/files/trash-browser.js';
	import { basename, isInside, normalize, parent, stem } from '@in-browser/files/path.js';
	import { editorUrl } from '#lib/brand.js';
	import { formatDateTime, m } from '#lib/i18n/index.js';
	import { chooseNotebook, createNotebook, createNotebookFromPdf, lastFolder, listNotebooks, type NotebookEntry } from '#lib/model/store.js';
	import { PdfError, readPdfPages } from '@in-browser/pdf/pdfjs.js';
	import { NOTEBOOK_EXT } from '#lib/model/types.js';

	let notebooks = $state<NotebookEntry[] | null>(null);
	let importing = $state(false);
	let pdfInput = $state<HTMLInputElement>();
	const available = typeof navigator !== 'undefined' && supported();

	async function refresh() {
		try {
			notebooks = await listNotebooks();
		} catch (e) {
			console.error('[notes] list', e);
			notebooks = [];
			toast(m.home.loadFailed(filesErrorText(e)), 'error', 8000);
		}
	}

	onMount(() => {
		if (!available) return;
		void refresh();
		// A PDF opened in Files: a new notebook next to it
		const pdf = page.url.searchParams.get('path');
		if (pdf) {
			void goto(resolve('/notes'), { replace: true });
			void importFromFiles(normalize(pdf));
		}
		// Notebooks appear, change or go (also by sync): list again
		return watchSettled((paths) => paths.some((p) => p.includes(NOTEBOOK_EXT)), 300, refresh);
	});

	const open = (path: string) => goto(editorUrl(path));

	async function create() {
		try {
			const path = await createNotebook();
			if (path) await open(path);
		} catch (e) {
			console.error('[notes] new notebook', e);
			toast(m.home.failed(filesErrorText(e)), 'error', 8000);
		}
	}

	/** A new notebook from a PDF: asks where it goes (next to the PDF if it is in Files) */
	async function importPdf(file: File, folder?: string) {
		importing = true;
		try {
			const sizes = await readPdfPages(file);
			const path = await createNotebookFromPdf(file, stem(file.name), sizes, folder);
			if (path) await open(path);
		} catch (e) {
			console.error('[notes] import', e);
			debug(`[notes] PDF import ${file.name}: ${e instanceof Error ? `${e.name}: ${e.message}` : e}`);
			if (e instanceof PdfError) toast(e.reason === 'password' ? m.insert.pdfPassword(file.name) : m.insert.pdfFailed(file.name), 'error', 8000);
			else toast(m.home.failed(filesErrorText(e)), 'error', 8000);
		} finally {
			importing = false;
		}
	}

	async function importFromFiles(path?: string) {
		path ??= (await chooseFile({ mode: 'open', folder: lastFolder(), accept: ['.pdf'], title: m.insert.choosePdf })) ?? undefined;
		if (!path) return;
		try {
			await importPdf(await read(path), parent(path));
		} catch (e) {
			console.error('[notes] import', e);
			toast(m.insert.pdfFailed(basename(path)) + ` (${filesErrorText(e)})`, 'error', 8000);
		}
	}

	function importDevice(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (file) void importPdf(file);
	}

	function importMenu(): MenuEntry[] {
		return [
			{ label: m.insert.pdfFromFiles, icon: 'icon-[material-symbols-light--folder-open-outline]', run: () => void importFromFiles() },
			{ label: m.insert.pdfFromDevice, icon: 'icon-[material-symbols-light--upload-file-outline]', run: () => pdfInput?.click() }
		];
	}

	async function openOther() {
		const path = await chooseNotebook();
		if (path) await open(path);
	}

	// --- The card's menu (right click, long press, ⋯); Del on a focused card. Renaming is Files' job. ---

	/** Into the trash (the message offers to undo it) */
	async function remove(path: string) {
		try {
			if (!(await deleteToTrash([path], () => void refresh()))) return;
			notebooks = notebooks?.filter((n) => !isInside(n.path, path)) ?? null;
		} catch (e) {
			console.error('[notes] delete', e);
			toast(m.home.failed(filesErrorText(e)), 'error', 8000);
		}
	}

	function showInFiles(path: string) {
		location.assign(`${resolve('/files')}?path=${encodeURIComponent(parent(path))}`);
	}

	const keys = (shortcut: Shortcut) => shortcutLabel(shortcut, brandMessages().keys);

	/** The complete menu of a notebook */
	function menu(entry: StartEntry): MenuEntry[] {
		return [
			{ label: filesMessages().start.open, icon: 'icon-[material-symbols-light--folder-open-outline]', href: editorUrl(entry.path), run: () => void open(entry.path) },
			{ label: m.home.showInFiles, icon: 'icon-[material-symbols-light--open-in-new]', href: `${resolve('/files')}?path=${encodeURIComponent(parent(entry.path))}`, run: () => showInFiles(entry.path) },
			{ separator: true },
			{ label: m.common.delete, icon: 'icon-[material-symbols-light--delete-outline]', keys: keys({ key: 'Delete' }), run: () => void remove(entry.path) }
		];
	}

	const entries = $derived<StartEntry[] | null>(
		notebooks?.map((n) => ({ path: n.path, name: n.name, modified: n.modified, kind: 'directory', detail: m.home.pages(n.pages) })) ?? null
	);
</script>

<StartPage
	tagline={m.home.tagline}
	{available}
	heading={m.home.notebooks}
	{entries}
	href={(entry) => editorUrl(entry.path)}
	{menu}
	empty={m.home.empty}
	tool="notes"
	onallowed={refresh}
	formatDate={formatDateTime}
	ondelete={(entry) => void remove(entry.path)}
>
	{#snippet actions()}
		<button class="btn btn-primary" onclick={create}>
			<span class="icon-[material-symbols-light--add-notes-outline] size-6" aria-hidden="true"></span>{m.home.newNotebook}
		</button>
		<button class="btn" onclick={openOther}>
			<span class="icon-[material-symbols-light--folder-open-outline] size-6" aria-hidden="true"></span>{m.home.open}
		</button>
		<!-- Keeps its label while reading; only the icon turns into a spinner -->
		<button class="btn" onclick={(e) => openMenuBelow(e, importMenu())} disabled={importing}>
			{#if importing}
				<span class="loading loading-spinner size-6"></span>
			{:else}
				<span class="icon-[material-symbols-light--picture-as-pdf-outline] size-6" aria-hidden="true"></span>
			{/if}{m.home.importPdf}
		</button>
		<input bind:this={pdfInput} type="file" accept="application/pdf,.pdf" class="hidden" onchange={importDevice} />
	{/snippet}
</StartPage>
