<script lang="ts">
	// Start page: all notebooks in the shared file system, new notebook, open, import a PDF as a new notebook (also
	// what opening a PDF in Files leads to: `?path=<pdf>`).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { chooseFile } from '@in-browser/files/dialog.svelte.js';
	import { debug } from '@in-browser/brand/debug.js';
	import { openContextMenu, openMenuBelow, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import FileIcon from '@in-browser/files/FileIcon.svelte';
	import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
	import { read, supported, watch } from '@in-browser/files/fs.js';
	import { deleteToTrash } from '@in-browser/files/trash-browser.js';
	import { basename, isInside, normalize, parent, stem } from '@in-browser/files/path.js';
	import { editorUrl } from '#lib/brand.js';
	import { formatDateTime, m } from '#lib/i18n/index.js';
	import { chooseNotebook, createNotebook, createNotebookFromPdf, lastFolder, listNotebooks, type NotebookEntry } from '#lib/model/store.js';
	import { PdfError, readPdfPages } from '#lib/render/pdf.js';
	import { NOTEBOOK_EXT } from '#lib/model/types.js';

	let notebooks = $state<NotebookEntry[] | null>(null);
	let importing = $state(false);
	let pdfInput = $state<HTMLInputElement>();
	const available = typeof navigator !== 'undefined' && supported();

	async function refresh() {
		try {
			notebooks = await listNotebooks();
		} catch (e) {
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
			void goto(resolve('/notes'), { replaceState: true });
			void importFromFiles(normalize(pdf));
		}
		let timer: ReturnType<typeof setTimeout> | undefined;
		const stop = watch((paths) => {
			// Notebooks appear, change or go (also by sync): list again, a little later for bursts
			if (!paths.some((p) => p.includes(NOTEBOOK_EXT))) return;
			clearTimeout(timer);
			timer = setTimeout(refresh, 300);
		});
		return () => {
			stop();
			clearTimeout(timer);
		};
	});

	const open = (path: string) => goto(editorUrl(path));

	async function create() {
		try {
			const path = await createNotebook();
			if (path) await open(path);
		} catch (e) {
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

	/** Into the trash (the message offers to undo it) */
	async function remove(entry: NotebookEntry) {
		try {
			await deleteToTrash([entry.path], () => void refresh());
			notebooks = notebooks?.filter((n) => !isInside(n.path, entry.path)) ?? null;
		} catch (e) {
			toast(m.home.failed(filesErrorText(e)), 'error', 8000);
		}
	}

	function menu(entry: NotebookEntry): MenuEntry[] {
		return [
			{ label: m.home.openNotebook, icon: 'icon-[material-symbols-light--folder-open-outline]', run: () => open(entry.path) },
			{ separator: true },
			{ label: m.common.delete, icon: 'icon-[material-symbols-light--delete-outline]', run: () => remove(entry) }
		];
	}
</script>

<main class="mx-auto flex w-full max-w-4xl flex-col gap-6 overflow-y-auto p-4 sm:p-8">
	<p class="text-base-content/80 max-w-2xl">{m.home.tagline}</p>

	{#if !available}
		<div role="alert" class="alert alert-warning">{m.home.unsupported}</div>
	{:else}
		<div class="flex flex-wrap gap-2">
			<button class="btn btn-primary" onclick={create}>
				<span class="icon-[material-symbols-light--add-notes-outline] size-6" aria-hidden="true"></span>{m.home.newNotebook}
			</button>
			<button class="btn" onclick={openOther}>
				<span class="icon-[material-symbols-light--folder-open-outline] size-6" aria-hidden="true"></span>{m.home.open}
			</button>
			<button class="btn" onclick={(e) => openMenuBelow(e, importMenu())} disabled={importing}>
				{#if importing}
					<span class="loading loading-spinner loading-sm"></span>{m.home.importing}
				{:else}
					<span class="icon-[material-symbols-light--picture-as-pdf-outline] size-6" aria-hidden="true"></span>{m.home.importPdf}
				{/if}
			</button>
			<input bind:this={pdfInput} type="file" accept="application/pdf,.pdf" class="hidden" onchange={importDevice} />
		</div>

		<section class="flex flex-col gap-2" aria-labelledby="notebooks">
			<h2 id="notebooks" class="text-lg font-semibold">{m.home.notebooks}</h2>
			{#if notebooks === null}
				<span class="loading loading-spinner opacity-60"></span>
			{:else if notebooks.length === 0}
				<p class="opacity-70">{m.home.empty}</p>
			{:else}
				<ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each notebooks as entry (entry.path)}
						<li class="bg-base-100 border-base-300 rounded-box flex items-center border" oncontextmenu={(e) => openContextMenu(e, menu(entry))}>
							<a class="flex min-w-0 flex-1 items-center gap-3 p-3" href={editorUrl(entry.path)}>
								<FileIcon name={entry.path.split('/').pop() ?? ''} kind="directory" />
								<span class="flex min-w-0 flex-col">
									<span class="truncate font-medium">{entry.name}</span>
									<span class="truncate text-xs opacity-70">
										{m.home.pages(entry.pages)} · {formatDateTime(entry.modified)}{parent(entry.path) !== '/' ? ` · ${parent(entry.path)}` : ''}
									</span>
								</span>
							</a>
							<button
								class="btn btn-ghost btn-square btn-sm mr-1"
								onclick={(e) => openMenuBelow(e, menu(entry))}
								aria-label={m.home.actions(entry.name)}
								title={m.home.actions(entry.name)}
							>
								<span class="icon-[material-symbols-light--more-vert] size-5" aria-hidden="true"></span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</main>
