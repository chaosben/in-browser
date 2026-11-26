<script lang="ts">
	// Start page (`ui.md` “Start page”): the backups and playlists opened recently, “Open …” from the files and “Import
	// from the device …” (kept in the files where the user says and
	// listed here, not opened: decided by the user, 2026-11-25). Files shared from JW Library arrive the same way.
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { formatDateTime } from '@in-browser/brand/i18n/tool.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { chooseFile } from '@in-browser/files/dialog.svelte.js';
	import { filesUrl } from '@in-browser/files/formats.js';
	import { stat, supported, watchSettled, write } from '@in-browser/files/fs.js';
	import { filesErrorText, filesMessages } from '@in-browser/files/i18n/index.svelte.js';
	import { basename, stem } from '@in-browser/files/path.js';
	import { keepFile, setReceiver } from '@in-browser/files/receive.svelte.js';
	import { newPlaylist } from '@in-browser/jwl/jwl-file.js';
	import StartPage, { type StartEntry } from '@in-browser/files/StartPage.svelte';
	import { editorUrl } from '#lib/brand.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import { EXTENSIONS, recent } from '#lib/model/recent.js';

	let entries = $state<StartEntry[] | null>(null);
	let input = $state<HTMLInputElement>();
	let copying = $state(false);
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
		return watchSettled((paths) => paths.some((p) => EXTENSIONS.some((ext) => p.toLowerCase().endsWith(ext))), 300, refresh);
	});

	const open = (path: string) => goto(editorUrl(path));

	async function openFile() {
		const path = await chooseFile({ mode: 'open', folder: recent.lastFolder(), accept: EXTENSIONS, title: m.home.openTitle });
		if (path) await open(path);
	}

	/** “New playlist …”: an empty `.jwlplaylist` where the user says, named after its file, then opened */
	async function createPlaylist() {
		const path = await chooseFile({ mode: 'save', folder: recent.lastFolder(), accept: ['.jwlplaylist'], name: `${m.home.newPlaylistName}.jwlplaylist`, title: m.home.newPlaylistTitle });
		if (!path) return;
		try {
			await write(path, await newPlaylist(stem(basename(path))));
			recent.usedFolderOf(path);
			await open(path);
		} catch (e) {
			console.error('[jwl] new playlist', e);
			toast(m.home.failed(filesErrorText(e)), 'error', 8000);
		}
	}

	/** A file from outside: kept where the user says and listed here – not opened */
	async function take(file: File) {
		copying = true;
		try {
			const path = await keepFile(file, { title: m.home.saveTitle });
			if (!path) return;
			recent.remember(path);
			await refresh();
			toast(m.home.kept(basename(path)), 'success', 8000, { label: filesMessages().start.open, run: () => void open(path) });
		} catch (e) {
			console.error('[jwl] keep', e);
			toast(m.home.failed(filesErrorText(e)), 'error', 8000);
		} finally {
			copying = false;
		}
	}

	function fromDevice(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (file) void take(file);
	}

	// Shared from JW Library or opened with the installed suite (`ToolLayout` hands it over)
	onDestroy(
		setReceiver(async ({ files }) => {
			const file = files[0];
			if (!file) return;
			if (files.length > 1) toast(m.home.onlyFirst(file.name), 'info');
			await take(file);
		})
	);

	function menu(entry: StartEntry): MenuEntry[] {
		return [
			{ label: filesMessages().start.open, icon: 'icon-[material-symbols-light--folder-open-outline]', href: editorUrl(entry.path), run: () => open(entry.path) },
			{ label: m.commands.showInFiles, icon: 'icon-[material-symbols-light--open-in-new]', href: filesUrl(entry.path), run: () => location.assign(filesUrl(entry.path)) },
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
	tool="jwl-files"
	onallowed={refresh}
	formatDate={(ms) => formatDateTime(ms, intlLocale)}
>
	{#snippet actions()}
		<button class="btn btn-primary" onclick={openFile}>
			<span class="icon-[material-symbols-light--folder-open-outline] size-6" aria-hidden="true"></span>{m.home.open}
		</button>
		<button class="btn" onclick={createPlaylist}>
			<span class="icon-[material-symbols-light--playlist-add] size-6" aria-hidden="true"></span>{m.home.newPlaylist}
		</button>
		<button class="btn" onclick={() => input?.click()} disabled={copying}>
			{#if copying}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<span class="icon-[material-symbols-light--upload-file-outline] size-6" aria-hidden="true"></span>
			{/if}
			{m.home.fromDevice}
		</button>
		<input bind:this={input} type="file" accept={EXTENSIONS.join(',')} class="hidden" onchange={fromDevice} />
	{/snippet}
	{#snippet extra()}
		<p class="text-sm opacity-60">{m.home.hint}</p>
	{/snippet}
</StartPage>
