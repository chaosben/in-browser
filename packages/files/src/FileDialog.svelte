<script lang="ts">
	import { untrack } from 'svelte';
	import { closeFileDialog, fileDialogState } from './dialog.svelte.js';
	import FileIcon from './FileIcon.svelte';
	import { formatsOf } from './formats.js';
	import { list, mkdir, type Entry } from './fs.js';
	import { filesErrorText, filesMessages } from './i18n/index.svelte.js';
	import { extname, join, nameKey, nameProblem, parent, segments } from './path.js';

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

	const options = $derived(fileDialogState.current);
	const accepts = (entry: Entry) => options?.accept.includes(extname(entry.name)) ?? false;
	/** Plain folder (packages count as files) */
	const isFolder = (entry: Entry) => entry.kind === 'directory' && formatsOf(entry.name, 'directory').length === 0;

	const shown = $derived(
		(entries ?? [])
			.filter((e) => !e.name.startsWith('.') && (isFolder(e) || accepts(e)))
			.sort((a, b) => Number(isFolder(b)) - Number(isFolder(a)) || a.name.localeCompare(b.name))
	);

	/** Name as saved: with the extension of the format if the user left it out */
	const fullName = $derived.by(() => {
		const ext = options?.accept[0] ?? '';
		const trimmed = name.trim();
		return ext && extname(trimmed) !== ext ? trimmed + ext : trimmed;
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
		!!markedFolder || (options?.mode === 'save' ? !!name.trim() && !nameIssue && !taken : selected.length > 0)
	);

	async function load(path: string) {
		error = null;
		selected = [];
		markedFolder = null;
		anchor = null;
		entries = null;
		try {
			await mkdir(path);
			const result = await list(path);
			folder = path;
			entries = result;
		} catch (e) {
			console.error(e);
			error = filesErrorText(e);
			entries = [];
		}
	}

	/** Each opening builds a fresh dialog (`{#key}`): start in the requested folder */
	function start(node: HTMLDialogElement) {
		untrack(() => {
			if (!options) return;
			name = options.name ?? '';
			newFolder = null;
			load(options.folder);
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

	const crumbs = $derived(segments(folder).map((part, i, all) => ({ name: part, path: '/' + all.slice(0, i + 1).join('/') })));
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
				<h3 class="text-lg font-bold">{options.title ?? (options.mode === 'save' ? t.dialog.titleSave : t.dialog.titleOpen)}</h3>

				<div class="flex items-center gap-1">
					<button
						class="btn btn-ghost btn-sm btn-square"
						onclick={() => load(parent(folder))}
						disabled={folder === '/'}
						title={t.dialog.up}
						aria-label={t.dialog.up}
					>
						<span class="icon-[material-symbols-light--arrow-upward] size-5" aria-hidden="true"></span>
					</button>
					<div class="breadcrumbs min-w-0 flex-1 py-0 text-sm">
						<ul>
							<li><button class="link link-hover" onclick={() => load('/')}>{t.root}</button></li>
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
				{#if error}<p class="text-error text-sm">{error}</p>{/if}

				<div class="modal-action mt-0">
					<button class="btn btn-ghost" onclick={() => closeFileDialog(null)}>{t.dialog.cancel}</button>
					<button
						class={['btn', replacing && !nameIssue && !markedFolder ? 'btn-warning' : 'btn-primary']}
						disabled={!canConfirm}
						onclick={confirm}
					>
						{markedFolder
							? t.dialog.open
							: options.mode === 'save'
								? replacing && !nameIssue
									? t.dialog.replace
									: t.dialog.save
								: selected.length > 1
									? t.dialog.openCount(selected.length)
									: t.dialog.open}
					</button>
				</div>
			</div>
		</dialog>
	{/key}
{/if}
