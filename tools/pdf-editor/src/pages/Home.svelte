<script lang="ts">
	// Start page: the PDFs opened recently, "New PDF …" (an empty one with a paper), "Open PDF …" from the files and "Open from the computer …" (a copy in the
	// files first – the editor always works on a file it can save). Files opens PDFs in the editor directly.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { chooseFile } from '@in-browser/files/dialog.svelte.js';
	import { stat, supported, watchSettled } from '@in-browser/files/fs.js';
	import { keepFile } from '@in-browser/files/receive.svelte.js';
	import { filesErrorText, filesMessages } from '@in-browser/files/i18n/index.svelte.js';
	import StartPage, { type StartEntry } from '@in-browser/files/StartPage.svelte';
	import { editorUrl } from '#lib/brand.js';
	import { formatDateTime, m } from '#lib/i18n/index.js';
	import NewPdfDialog from '#lib/components/NewPdfDialog.svelte';
	import { recent } from '#lib/model/recent.js';

	let entries = $state<StartEntry[] | null>(null);
	let input = $state<HTMLInputElement>();
	let copying = $state(false);
	/** "New PDF …" is open */
	let creating = $state(false);
	const available = typeof navigator !== 'undefined' && supported();

	async function refresh() {
		const found = await Promise.all(
			recent.list().map(async (path): Promise<StartEntry | null> => {
				try {
					const entry = await stat(path);
					if (!entry) {
						recent.forget(path);
						return null;
					}
					return { path, modified: entry.modified ?? null };
				} catch {
					return { path, modified: null };
				}
			})
		);
		entries = found.filter((e) => e !== null);
	}

	onMount(() => {
		if (!available) return;
		void refresh();
		return watchSettled((paths) => paths.some((p) => p.toLowerCase().endsWith('.pdf')), 300, refresh);
	});

	const open = (path: string) => goto(editorUrl(path));

	async function openPdf() {
		const path = await chooseFile({ mode: 'open', folder: recent.lastFolder(), accept: ['.pdf'], title: m.home.openTitle });
		if (path) await open(path);
	}

	/** A PDF from the computer: kept in the files first (where the user says), then opened */
	async function fromDevice(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		copying = true;
		try {
			const path = await keepFile(file, { title: m.home.saveTitle });
			if (path) await open(path);
		} catch (e) {
			toast(m.home.failed(filesErrorText(e)), 'error', 8000);
		} finally {
			copying = false;
		}
	}

	function menu(entry: StartEntry): MenuEntry[] {
		return [
			{ label: filesMessages().start.open, icon: 'icon-[material-symbols-light--folder-open-outline]', href: editorUrl(entry.path), run: () => open(entry.path) },
			{ separator: true },
			{
				label: m.home.remove,
				icon: 'icon-[material-symbols-light--playlist-remove]',
				run: () => {
					recent.forget(entry.path);
					entries = entries?.filter((e) => e.path !== entry.path) ?? null;
				}
			}
		];
	}
</script>

<StartPage
	tagline={m.home.tagline}
	{available}
	{entries}
	href={(entry) => editorUrl(entry.path)}
	{menu}
	empty={m.home.empty}
	tool="pdf-editor"
	onallowed={refresh}
	formatDate={formatDateTime}
>
	{#snippet actions()}
		<button class="btn btn-primary" onclick={() => (creating = true)}>
			<span class="icon-[material-symbols-light--note-add-outline] size-6" aria-hidden="true"></span>{m.newPdf.command}
		</button>
		<button class="btn" onclick={openPdf}>
			<span class="icon-[material-symbols-light--folder-open-outline] size-6" aria-hidden="true"></span>{m.home.open}
		</button>
		<button class="btn" onclick={() => input?.click()} disabled={copying}>
			{#if copying}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<span class="icon-[material-symbols-light--upload-file-outline] size-6" aria-hidden="true"></span>
			{/if}
			{m.home.fromDevice}
		</button>
		<input bind:this={input} type="file" accept="application/pdf,.pdf" class="hidden" onchange={fromDevice} />
	{/snippet}
</StartPage>

{#if creating}
	<NewPdfDialog folder={recent.lastFolder()} oncreated={(path) => void open(path)} onclose={() => (creating = false)} />
{/if}
