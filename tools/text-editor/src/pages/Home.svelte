<script lang="ts">
	// The start page (`ui.md` “Start page”): new, open from Files, open from the computer and “Recently opened”. Each
	// file opens on the editor page (`/text-editor/editor`), one file per page.
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { installCommandKeys, type Command } from '@in-browser/brand/commands.js';
	import DropOverlay from '@in-browser/brand/DropOverlay.svelte';
	import { formatDateTime } from '@in-browser/brand/i18n/tool.js';
	import { type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { stat, supported } from '@in-browser/files/fs.js';
	import { filesMessages } from '@in-browser/files/i18n/index.svelte.js';
	import { EDITABLE_EXTENSIONS } from '@in-browser/files/kinds.js';
	import { normalize, safeName } from '@in-browser/files/path.js';
	import { setReceiver } from '@in-browser/files/receive.svelte.js';
	import StartPage, { type StartEntry } from '@in-browser/files/StartPage.svelte';
	import { draftUrl, editorUrl } from '#lib/brand.js';
	import { droppedFile, hasFiles } from '#lib/drop.js';
	import { SHORTCUTS as S } from '#lib/editor/shortcuts.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import { migrateTabs } from '#lib/session.js';
	import { filesUrl } from '@in-browser/files/formats.js';
	import { chooseFileToOpen, draftFromComputer, forgetRecent, recentFiles, showFolderOf } from '#lib/workspace.svelte.js';

	/** “Recently opened” with their dates (null while loading); gone files drop off */
	let entries = $state<StartEntry[] | null>(null);
	let dropping = $state(false);
	let fileInput = $state<HTMLInputElement>();

	async function refresh() {
		const found = await Promise.all(
			recentFiles().map(async (path): Promise<StartEntry | null> => {
				try {
					const entry = await stat(path);
					if (!entry || entry.kind !== 'file') {
						forgetRecent(path);
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
		if (!supported()) return;
		// Old links (`/text-editor?path=…`) open the file on the editor page
		const path = page.url.searchParams.get('path');
		if (path) return void goto(editorUrl(normalize(path)), { replace: true });
		void migrateTabs().then((target) => {
			if (target) void goto('path' in target ? editorUrl(target.path) : draftUrl(target.draft), { replace: true });
			else void refresh();
		});
	});

	// Shared with the installed suite or opened with it (`ToolLayout` hands it over): a text file, or shared text
	// and links as a new text – a draft without a place, like a file from the computer (decided by the user)
	onDestroy(
		setReceiver(async ({ files, title, text, url }) => {
			const file = files[0] ?? new File([[text, url].filter(Boolean).join('\n')], `${safeName(title ?? '', 'Text')}.txt`, { type: 'text/plain' });
			if (files.length > 1) toast(m.toasts.onlyFirst(file.name));
			await openFromComputer(file);
		})
	);

	async function openFromComputer(file: File | null) {
		const id = file && (await draftFromComputer(file));
		if (id) await goto(draftUrl(id));
	}

	const commands = {
		new: { id: 'new', label: m.actions.new, icon: 'icon-[material-symbols-light--note-add-outline]', shortcut: S.new, run: () => void goto(draftUrl()) },
		openFromFiles: {
			id: 'openFromFiles',
			label: m.actions.openFromFiles,
			icon: 'icon-[material-symbols-light--folder-open-outline]',
			shortcut: S.open,
			run: async () => {
				const path = await chooseFileToOpen();
				if (path) await goto(editorUrl(path));
			}
		},
		openFromComputer: { id: 'openFromComputer', label: m.actions.openFromComputer, icon: 'icon-[material-symbols-light--upload-file-outline]', run: () => fileInput?.click() }
	} satisfies Record<string, Command>;

	$effect(() => installCommandKeys(() => (supported() ? Object.values(commands) : [])));

	const forget = (path: string) => {
		forgetRecent(path);
		entries = entries?.filter((e) => e.path !== path) ?? null;
	};

	/** The complete menu of a card */
	const menu = (entry: StartEntry): MenuEntry[] => [
		{ label: filesMessages().start.open, icon: 'icon-[material-symbols-light--folder-open-outline]', href: editorUrl(entry.path), run: () => void goto(editorUrl(entry.path)) },
		{ label: m.actions.showInFiles, icon: 'icon-[material-symbols-light--open-in-new]', href: filesUrl(entry.path), run: () => showFolderOf(entry.path) },
		{ separator: true },
		{ label: m.actions.removeRecent, icon: 'icon-[material-symbols-light--playlist-remove]', run: () => forget(entry.path) }
	];

	function dragOver(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'copy';
		dropping = true;
	}

	function drop(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault();
		dropping = false;
		void openFromComputer(droppedFile(e));
	}
</script>

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

<div
	class="relative flex h-full flex-col"
	role="presentation"
	ondragover={dragOver}
	ondragleave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && (dropping = false)}
	ondrop={drop}
>
	<StartPage
		tagline={m.home.tagline}
		{entries}
		href={(entry) => editorUrl(entry.path)}
		{menu}
		empty={m.home.noRecent}
		available={supported()}
		tool="text-editor"
		onallowed={() => void refresh()}
		formatDate={(ms) => formatDateTime(ms, intlLocale)}
	>
		{#snippet actions()}
			<button class="btn btn-primary" onclick={commands.new.run}>
				<span class="icon-[material-symbols-light--note-add-outline] size-6" aria-hidden="true"></span>{m.actions.new}
			</button>
			<button class="btn" onclick={commands.openFromFiles.run}>
				<span class="icon-[material-symbols-light--folder-open-outline] size-6" aria-hidden="true"></span>{m.actions.openFromFiles}
			</button>
			<button class="btn" onclick={commands.openFromComputer.run}>
				<span class="icon-[material-symbols-light--upload-file-outline] size-6" aria-hidden="true"></span>{m.actions.openFromComputer}
			</button>
		{/snippet}
		{#snippet extra()}
			<p class="text-sm opacity-60">{m.home.dropHint}</p>
		{/snippet}
	</StartPage>
	{#if dropping}
		<DropOverlay label={m.drop.release} />
	{/if}
</div>
