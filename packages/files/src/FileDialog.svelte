<script lang="ts">
	import { untrack } from 'svelte';
	import { closeFileDialog, fileDialogState } from './dialog.svelte.js';
	import FileIcon from './FileIcon.svelte';
	import { formatsOf } from './formats.js';
	import { list, mkdir, type Entry } from './fs.js';
	import { filesErrorText, filesMessages } from './i18n/index.svelte.js';
	import { extname, isConnected, join, nameKey, nameProblem, parent, placeRoot, segments } from './path.js';
	import { FilesError } from './fs.js';
	import { accessAction, connections } from './sources/connections.svelte.js';

	// One instance per tool (in its layout); opened via `chooseFile()`.

	const t = $derived(filesMessages());

	let folder = $state('/');
	let entries = $state<Entry[] | null>(null);
	let selected = $state<string[]>([]);
	/** Folder marked by a click (like in Files: a click marks, double-click or Enter opens) */
	let markedFolder = $state<string | null>(null);
	/** Start of Shift ranges */
	let anchor: string | null = null;
	let name = $state('');
	let newFolder = $state<string | null>(null);
	let error = $state<string | null>(null);
	/** The folder is connected and the browser asks for access again */
	let access = $state<ReturnType<typeof accessAction>>(undefined);

	const options = $derived(fileDialogState.current);
	const accepts = (entry: Entry) => options?.accept.includes(extname(entry.name)) ?? false;
	/** Plain folder (packages count as files) */
	const isFolder = (entry: Entry) => entry.kind === 'directory' && formatsOf(entry.name, 'directory').length === 0;

	const shown = $derived(
		(entries ?? [])
			.filter((e) => !e.name.startsWith('.') && (isFolder(e) || accepts(e)))
			.sort((a, b) => Number(isFolder(b)) - Number(isFolder(a)) || a.name.localeCompare(b.name))
	);

	/** Name as saved: with the (first) extension of the format if the user gave none of the accepted ones */
	const fullName = $derived.by(() => {
		const ext = options?.accept[0] ?? '';
		const trimmed = name.trim();
		return ext && !options?.accept.includes(extname(trimmed)) ? trimmed + ext : trimmed;
	});
	const nameIssue = $derived(options?.mode === 'save' && name.trim() ? nameProblem(fullName) : null);
	/** Entry with the chosen name when saving */
	const existing = $derived(
		options?.mode === 'save' ? (entries ?? []).find((e) => nameKey(e.name) === nameKey(fullName)) : undefined
	);
	/** It may be replaced (`overwrite`, a file or package of an accepted format – never a plain folder) */
	const replacing = $derived(!!existing && !!options?.overwrite && accepts(existing) && !isFolder(existing));
	const taken = $derived(!!existing && !replacing);
	/** Saving: the entry matching the typed name is marked, so changing the name clears the mark */
	const isSelected = (entry: Entry) =>
		markedFolder === entry.path ||
		(options?.mode === 'save' ? existing?.path === entry.path : selected.includes(entry.path));
	const canConfirm = $derived(
		!!markedFolder || options?.mode === 'folder' || (options?.mode === 'save' ? !!name.trim() && !nameIssue && !taken : selected.length > 0)
	);

	const confirmText = $derived.by(() => {
		if (markedFolder) return t.dialog.open;
		if (options?.mode === 'folder') return options.confirmLabel ?? t.dialog.chooseFolder;
		if (options?.mode === 'save') return replacing && !nameIssue ? t.dialog.replace : t.dialog.save;
		return selected.length > 1 ? t.dialog.openCount(selected.length) : t.dialog.open;
	});

	/** Shows a folder; the error if it can't be read (also shown) */
	async function load(path: string): Promise<unknown> {
		error = null;
		access = undefined;
		selected = [];
		markedFolder = null;
		anchor = null;
		entries = null;
		try {
			// Folders of My files the tool asks for are created; connected folders are only read
			if (!isConnected(path)) await mkdir(path);
			const result = await list(path);
			folder = path;
			entries = result;
			return null;
		} catch (e) {
			console.error(e);
			error = filesErrorText(e);
			access = accessAction(e, () => void load(path));
			entries = [];
			return e;
		}
	}

	/** Each opening builds a fresh dialog (`{#key}`): start in the requested folder */
	function start(node: HTMLDialogElement) {
		untrack(() => {
			if (!options) return;
			name = options.name ?? '';
			newFolder = null;
			// A connected folder that is gone: My files instead
			const start = options.folder;
			void load(start).then((e) => {
				if (e instanceof FilesError && e.code === 'notFound' && isConnected(start)) void load('/');
			});
		});
		node.showModal();
	}

	function open(entry: Entry) {
		if (isFolder(entry)) load(entry.path);
		else if (accepts(entry)) {
			if (options?.mode === 'save') name = entry.name;
			else closeFileDialog([entry.path]);
		}
	}

	function confirm() {
		if (!canConfirm) return;
		// With a folder marked the button opens it, like in system dialogs
		if (markedFolder) return load(markedFolder);
		if (options?.mode === 'folder') return closeFileDialog([folder]);
		// Replacing keeps the existing spelling (a name differing only in case would collide)
		closeFileDialog(options?.mode === 'save' ? [join(folder, replacing && existing ? existing.name : fullName)] : selected);
	}

	/** Click on a file: alone; with `multiple` Ctrl/Cmd toggles, Shift selects the range from the last click */
	function pick(e: MouseEvent, entry: Entry) {
		if (isFolder(entry)) {
			selected = [];
			markedFolder = entry.path;
			return;
		}
		markedFolder = null;
		if (options?.mode === 'save') {
			name = entry.name;
			return;
		}
		const files = shown.filter((s) => !isFolder(s)).map((s) => s.path);
		if (options?.multiple && e.shiftKey && anchor && files.includes(anchor)) {
			const [a, b] = [files.indexOf(anchor), files.indexOf(entry.path)].sort((x, y) => x - y);
			selected = files.slice(a, b + 1);
			return;
		}
		if (options?.multiple && (e.ctrlKey || e.metaKey)) {
			selected = selected.includes(entry.path) ? selected.filter((p) => p !== entry.path) : [...selected, entry.path];
		} else selected = [entry.path];
		anchor = entry.path;
	}

	async function createFolder() {
		const folderName = newFolder?.trim() ?? '';
		const problem = nameProblem(folderName);
		if (problem) {
			error = t.names[problem];
			return;
		}
		try {
			if ((entries ?? []).some((e) => nameKey(e.name) === nameKey(folderName))) throw new Error(t.dialog.exists(folderName));
			await mkdir(join(folder, folderName));
			newFolder = null;
			await load(join(folder, folderName));
		} catch (e) {
			error = filesErrorText(e);
		}
	}

	/** My files and the connected folders */
	const places = $derived([{ path: '/', name: t.root }, ...connections.list.map((c) => ({ path: c.path, name: c.name }))]);
	const root = $derived(placeRoot(folder));
	const rootName = $derived(places.find((p) => p.path === root)?.name ?? t.root);
	const crumbs = $derived(
		segments(folder)
			.slice(segments(root).length)
			.map((part, i, all) => ({ name: part, path: join(root, ...all.slice(0, i + 1)) }))
	);
</script>

{#if options}
	{#key options}
		<dialog
			{@attach start}
			class="modal"
			oncancel={(e) => {
				e.preventDefault();
				closeFileDialog(null);
			}}
		>
			<div class="modal-box flex max-h-[85vh] w-11/12 max-w-2xl flex-col gap-3">
				<h3 class="text-lg font-bold">{options.title ?? (options.mode === 'save' ? t.dialog.titleSave : options.mode === 'folder' ? t.dialog.titleFolder : t.dialog.titleOpen)}</h3>

				<div class="flex items-center gap-1">
					<button
						class="btn btn-ghost btn-sm btn-square"
						onclick={() => load(parent(folder))}
						disabled={folder === root}
						title={t.dialog.up}
						aria-label={t.dialog.up}
					>
						<span class="icon-[material-symbols-light--arrow-upward] size-5" aria-hidden="true"></span>
					</button>
					{#if places.length > 1}
						<select
							class="select select-sm w-auto max-w-40"
							aria-label={t.dialog.place}
							title={t.dialog.place}
							value={root}
							onchange={(e) => load(e.currentTarget.value)}
						>
							{#each places as place (place.path)}
								<option value={place.path}>{place.name}</option>
							{/each}
						</select>
					{/if}
					<div class="breadcrumbs min-w-0 flex-1 py-0 text-sm">
						<ul>
							<!-- With the place choice in front, its name is repeated only as the way back from deeper folders -->
							{#if places.length === 1 || folder !== root}
								<li><button class="link link-hover" onclick={() => load(root)}>{rootName}</button></li>
							{/if}
							{#each crumbs as crumb (crumb.path)}
								<li><button class="link link-hover" onclick={() => load(crumb.path)}>{crumb.name}</button></li>
							{/each}
						</ul>
					</div>
					<button class="btn btn-ghost btn-sm gap-1" onclick={() => (newFolder = newFolder === null ? '' : null)}>
						<span class="icon-[material-symbols-light--create-new-folder-outline] size-5" aria-hidden="true"></span>
						{t.dialog.newFolder}
					</button>
				</div>

				{#if newFolder !== null}
					<form
						class="flex gap-2"
						onsubmit={(e) => {
							e.preventDefault();
							createFolder();
						}}
					>
						<!-- svelte-ignore a11y_autofocus -->
						<input class="input input-sm flex-1" bind:value={newFolder} placeholder={t.dialog.folderName} aria-label={t.dialog.folderName} autofocus />
						<button class="btn btn-sm btn-primary" type="submit">{t.dialog.create}</button>
					</form>
				{/if}

				<ul class="border-base-300 rounded-box min-h-48 flex-1 overflow-y-auto border p-1" role="listbox" aria-label={t.root} aria-multiselectable={options.multiple}>
					{#if entries === null}
						<li class="flex justify-center p-6"><span class="loading loading-spinner"></span></li>
					{:else if shown.length === 0}
						<li class="p-6 text-center text-sm opacity-60">{t.dialog.empty}</li>
					{/if}
					{#each shown as entry (entry.path)}
						<li>
							<button
								role="option"
								aria-selected={isSelected(entry)}
								class={['flex w-full items-center gap-2 rounded px-2 py-1.5 text-left', isSelected(entry) ? 'bg-selection/20' : 'hover:bg-base-200']}
								onclick={(e) => pick(e, entry)}
								ondblclick={() => open(entry)}
								onkeydown={(e) => {
									if (e.key !== 'Enter') return;
									e.preventDefault();
									open(entry);
								}}
							>
								<FileIcon name={entry.name} kind={entry.kind} />
								<span class="min-w-0 flex-1 truncate">{entry.name}</span>
							</button>
						</li>
					{/each}
				</ul>

				{#if options.mode === 'save'}
					<label class="flex flex-col gap-1">
						<span class="text-sm">{t.dialog.name}</span>
						<input
							class={['input w-full', (nameIssue || taken) && 'input-error']}
							bind:value={name}
							oninput={() => (markedFolder = null)}
							onkeydown={(e) => e.key === 'Enter' && confirm()}
						/>
					</label>
					{#if nameIssue}
						<p class="text-error text-sm">{t.names[nameIssue]}</p>
					{:else if taken}
						<p class="text-error text-sm">{t.dialog.exists(fullName)}</p>
					{:else if replacing && existing}
						<p class="text-warning text-sm">{t.dialog.replaces(existing.name)}</p>
					{/if}
				{/if}
				{#if error}
					<p class="text-error flex flex-wrap items-center gap-2 text-sm">
						{error}
						{#if access}<button class="btn btn-sm" onclick={access.run}>{access.label}</button>{/if}
					</p>
				{/if}

				<div class="modal-action mt-0">
					<button class="btn btn-ghost" onclick={() => closeFileDialog(null)}>{t.dialog.cancel}</button>
					<button
						class={['btn', replacing && !nameIssue && !markedFolder ? 'btn-warning' : 'btn-primary']}
						disabled={!canConfirm}
						onclick={confirm}
					>
						{confirmText}
					</button>
				</div>
			</div>
		</dialog>
	{/key}
{/if}
