<script lang="ts">
	import { untrack } from 'svelte';
	import PickMark from '@in-browser/brand/PickMark.svelte';
	import { Picker } from '@in-browser/brand/ui/pick.svelte.js';
	import { closeFileDialog, fileDialogState } from './dialog.svelte.js';
	import FileIcon from './FileIcon.svelte';
	import { formatsOf } from './formats.js';
	import { list, mkdir, type Entry } from './fs.js';
	import { filesErrorText, filesMessages } from './i18n/index.svelte.js';
	import { extname, join, nameKey, nameProblem, parent, placeRoot, segments } from './path.js';
	import { FilesError } from './fs.js';
	import { accessAction, connectionLabel, connections } from './sources/connections.svelte.js';

	// One instance per tool (in its layout); opened via `chooseFile()`. Entries are picked like in Files (`ui.md`
	// Selection): a click picks, double-click or Enter opens, arrow keys move; with `multiple` Ctrl/Shift+click, Ctrl+A
	// and on touch screens the selection mode (a long press starts it, taps then pick).

	const t = $derived(filesMessages());

	let folder = $state('/');
	let entries = $state<Entry[] | null>(null);
	/** Picked files (open) */
	const pick = new Picker<string>();
	/** Folder marked by a click (like in Files: a click marks, double-click or Enter opens) */
	let markedFolder = $state<string | null>(null);
	let listEl = $state<HTMLElement>();
	let name = $state('');
	let newFolder = $state<string | null>(null);
	let error = $state<string | null>(null);
	/** The folder is connected and the browser asks for access again */
	let access = $state<ReturnType<typeof accessAction>>(undefined);

	const options = $derived(fileDialogState.current);
	// No formats named: every file (attaching any file to a PDF, saving a file of no known kind) – but none when a
	// folder is picked
	const accepts = (entry: Entry) => (options ? (options.mode !== 'folder' && !options.accept.length) || options.accept.includes(extname(entry.name)) : false);
	/** Plain folder (packages count as files) */
	const isFolder = (entry: Entry) => entry.kind === 'directory' && formatsOf(entry.name, 'directory').length === 0;

	const shown = $derived(
		(entries ?? [])
			.filter((e) => !e.name.startsWith('.') && (isFolder(e) || accepts(e)))
			.sort((a, b) => Number(isFolder(b)) - Number(isFolder(a)) || a.name.localeCompare(b.name))
	);
	/** The files shown (the order of Shift ranges) */
	const files = $derived(shown.filter((e) => !isFolder(e)).map((e) => e.path));
	const selected = $derived(pick.ordered(files));

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
		(options?.mode === 'save' ? existing?.path === entry.path : pick.has(entry.path));
	const canConfirm = $derived(
		!!markedFolder || options?.mode === 'folder' || (options?.mode === 'save' ? !!name.trim() && !nameIssue && !taken : selected.length > 0)
	);

	/** Saving over a file of a format that merges: “Merge” is the main button, “Replace” stands next to it */
	const merging = $derived(options?.mode === 'save' && !!options.merge);
	const confirmText = $derived.by(() => {
		if (markedFolder) return t.dialog.open;
		if (options?.mode === 'folder') return options.confirmLabel ?? t.dialog.chooseFolder;
		if (merging) return replacing && !nameIssue ? t.dialog.merge : t.dialog.save;
		if (options?.mode === 'save') return replacing && !nameIssue ? t.dialog.replace : t.dialog.save;
		return selected.length > 1 ? t.dialog.openCount(selected.length) : t.dialog.open;
	});

	/** Shows a folder; the error if it can't be read (also shown) */
	async function load(path: string): Promise<unknown> {
		error = null;
		access = undefined;
		pick.clear();
		markedFolder = null;
		entries = null;
		try {
			const result = await list(path);
			folder = path;
			entries = result;
			return null;
		} catch (e) {
			// A gone folder is expected (e.g. the start folder deleted meanwhile)
			if (!(e instanceof FilesError && e.code === 'notFound')) console.error(e);
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
			// The start folder is never created: one that is gone opens the next folder above it (above a connection
			// that is gone: My files)
			const from = async (path: string): Promise<void> => {
				const e = await load(path);
				if (e instanceof FilesError && e.code === 'notFound' && path !== '/') return from(path === placeRoot(path) ? '/' : parent(path));
			};
			void from(options.folder);
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
		closeFileDialog(options?.mode === 'save' ? [join(folder, replacing && existing ? existing.name : fullName)] : selected, merging && replacing);
	}

	/** “Replace” next to “Merge” */
	function replace() {
		if (!canConfirm || markedFolder || !replacing || !existing) return;
		closeFileDialog([join(folder, existing.name)], false);
	}

	/** Click on an entry: a folder is marked, a file picked (with `multiple` like in Files: Ctrl/Shift, touch mode) */
	function choose(e: MouseEvent, entry: Entry) {
		if (isFolder(entry)) {
			pick.clear();
			markedFolder = entry.path;
			return;
		}
		markedFolder = null;
		if (options?.mode === 'save') {
			name = entry.name;
			return;
		}
		if (!options?.multiple) return pick.only(entry.path);
		// A tap outside the selection mode opens the file, like in Files
		if (pick.click(e, entry.path, files) === 'open') closeFileDialog([entry.path]);
	}

	/** Long press (touch) on a file with `multiple`: the selection mode starts */
	function press(e: MouseEvent, entry: Entry) {
		if (!options?.multiple || isFolder(entry) || options.mode === 'save') return;
		e.preventDefault();
		markedFolder = null;
		pick.menu(e, entry.path);
	}

	/** Arrow keys move through the entries (Shift extends the pick with `multiple`), Ctrl+A picks every file */
	function listKey(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
			if (!options?.multiple || options.mode === 'save') return;
			e.preventDefault();
			markedFolder = null;
			pick.selectAll(files);
			return;
		}
		const step = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[e.key];
		if (!step || e.altKey || e.ctrlKey || e.metaKey || !listEl) return;
		e.preventDefault();
		const rows = [...listEl.querySelectorAll<HTMLElement>('[role="option"]')];
		const at = rows.indexOf(document.activeElement as HTMLElement);
		const next = Math.max(0, Math.min(shown.length - 1, at < 0 ? 0 : at + step));
		const entry = shown[next];
		if (!entry) return;
		rows[next]?.focus();
		if (e.shiftKey && options?.multiple && !isFolder(entry) && options.mode !== 'save') {
			markedFolder = null;
			pick.extend(entry.path, files);
		} else choose(new MouseEvent('click'), entry);
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
			console.error(e);
			error = filesErrorText(e);
			access = accessAction(e, () => void createFolder());
		}
	}

	/** My files and the connected folders */
	const places = $derived([
		{ path: '/', name: t.root },
		...(options?.places === false ? [] : connections.list.map((c) => ({ path: c.path, name: connectionLabel(c) })))
	]);
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
					<!-- Icon only on narrow screens, so the row fits 360 px -->
					<button
						class="btn btn-ghost btn-sm max-sm:btn-square shrink-0 gap-1"
						onclick={() => (newFolder = newFolder === null ? '' : null)}
						title={t.dialog.newFolder}
						aria-label={t.dialog.newFolder}
					>
						<span class="icon-[material-symbols-light--create-new-folder-outline] size-5" aria-hidden="true"></span>
						<span class="hidden sm:inline">{t.dialog.newFolder}</span>
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
						<input
							class="input input-sm flex-1"
							bind:value={newFolder}
							placeholder={t.dialog.folderName}
							aria-label={t.dialog.folderName}
							autofocus
							onkeydown={(e) => {
								// Esc leaves the field, not the dialog
								if (e.key !== 'Escape') return;
								e.preventDefault();
								e.stopPropagation();
								newFolder = null;
							}}
						/>
						<button class="btn btn-sm btn-primary" type="submit">{t.dialog.create}</button>
					</form>
				{/if}

				<ul
					bind:this={listEl}
					class="border-base-300 rounded-box min-h-48 flex-1 overflow-y-auto border p-1"
					role="listbox"
					aria-label={t.root}
					aria-multiselectable={options.multiple}
					onkeydown={listKey}
					onpointerdown={(e) => pick.pointerdown(e)}
				>
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
								onclick={(e) => choose(e, entry)}
								oncontextmenu={(e) => press(e, entry)}
								ondblclick={() => open(entry)}
								onkeydown={(e) => {
									if (e.key !== 'Enter') return;
									e.preventDefault();
									open(entry);
								}}
							>
								{#if pick.marking && !isFolder(entry)}<PickMark picked={pick.has(entry.path)} />{/if}
								<FileIcon name={entry.name} kind={entry.kind} remote={entry.remote} />
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
				{/if}
				<!-- One line kept free for messages, so the buttons never jump -->
				<p class="flex min-h-8 flex-wrap items-center gap-2 text-sm" role="status">
					{#if error}
						<span class="text-error">{error}</span>
						{#if access}<button class="btn btn-sm btn-primary" onclick={access.run}>{access.label}</button>{/if}
					{:else if options.mode === 'save' && nameIssue}
						<span class="text-error">{t.names[nameIssue]}</span>
					{:else if options.mode === 'save' && taken}
						<span class="text-error">{t.dialog.exists(fullName)}</span>
					{:else if merging && replacing && existing}
						<span class="text-warning">{t.dialog.mergeOrReplace(existing.name)}</span>
					{:else if options.mode === 'save' && replacing && existing}
						<span class="text-warning">{t.dialog.replaces(existing.name)}</span>
					{/if}
				</p>

				<div class="modal-action mt-0">
					<button class="btn btn-ghost" onclick={() => closeFileDialog(null)}>{t.dialog.cancel}</button>
					{#if merging}
						<!-- Always in its place, enabled only over an existing file -->
						<button class="btn" disabled={!replacing || !!nameIssue || !!markedFolder} onclick={replace}>{t.dialog.replace}</button>
					{/if}
					<button
						class={['btn', (merging || !(replacing && !nameIssue && !markedFolder)) && 'btn-primary']}
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
