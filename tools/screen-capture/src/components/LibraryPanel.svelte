<script lang="ts">
	// Side panel “Library”: one list, first this project's entries, then those of all projects. Entries are picked like
	// everywhere (`ui.md` Selection: click, Ctrl/Shift+click, Ctrl+A while the list has the focus); a double click, Enter
	// or “Insert” in the menu inserts the picked ones at the playhead, dragging drops one onto the preview or the timeline
	// (onto the other section: moves it there). A click on the name of the one picked entry or F2 renames it.
	import { onMount, untrack } from 'svelte';
	import MoreButton from '@in-browser/brand/MoreButton.svelte';
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import PickMark from '@in-browser/brand/PickMark.svelte';
	import { Picker } from '@in-browser/brand/ui/pick.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import { itemIcon, itemLabel } from '#lib/project/labels.js';
	import { matchesQuery } from '@in-browser/brand/ui/search.js';
	import { readStored, writeStored } from '@in-browser/brand/storage.js';
	import { entryDuration } from '#lib/project/library.js';
	import { globalLibrary } from '#lib/project/library.svelte.js';
	import type { Clip, LibraryEntry, Source } from '#lib/project/types.js';
	import { itemMedia, projectMedia, type ItemMedia, type MediaPlace } from '#lib/media/visuals.js';
	import { imageState, setLibraryImages } from '#lib/render/images.svelte.js';
	import { libraryMediaFile } from '#lib/storage/store.js';
	import { fontState } from '#lib/render/fonts.svelte.js';
	import { drawItemsPreview, previewBounds } from '#lib/render/item-preview.js';
	import { hasDragPayload, readDragPayload, setDragPayload } from '#lib/tools/drag.js';
	import type { PanelContext } from '#lib/tools/types.js';
	import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
	import { openContextMenu, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { libraryUi, type LibraryScope } from '#lib/ui/library.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { errorMessage, formatTime } from '#lib/util/format.js';

	let { context }: PanelProps<PanelContext> = $props();
	const editor = $derived(context.editor);
	const actions = $derived(context.actions);

	const GLOBAL_MEDIA: MediaPlace = { key: 'library', open: libraryMediaFile };

	onMount(() => {
		globalLibrary.load().catch((e) => {
			console.error('[screen-capture] library', e);
			toast(errorMessage(e), 'error', 8000);
		});
	});

	/** Narrows the entries by their name and the captions of their elements */
	let query = $state('');
	const matches = (entry: LibraryEntry) =>
		matchesQuery(query, entry.name, ...entry.items.map((item) => itemLabel(item, editor)));

	// Previews of global entries draw their images from the library's own folder
	$effect(() => setLibraryImages(globalLibrary.entries.flatMap((entry) => entry.images)));

	const sections = $derived(
		[
			{ scope: 'project' as const, title: m.library.project, all: editor.project.library },
			{ scope: 'global' as const, title: m.library.global, all: globalLibrary.entries }
		].map((section) => ({ ...section, entries: query.trim() ? section.all.filter(matches) : section.all }))
	);

	/** Picked entries, as `<scope>:<id>` */
	const picker = new Picker();
	const keyOf = (scope: LibraryScope, entry: LibraryEntry) => `${scope}:${entry.id}`;
	const shown = $derived(
		sections.flatMap((section) => section.entries.map((entry) => ({ scope: section.scope, entry, key: keyOf(section.scope, entry) })))
	);
	const order = $derived(shown.map((s) => s.key));
	// Gone or filtered out: no longer picked
	$effect(() => {
		const keys = order;
		untrack(() => picker.keep(keys));
	});
	/** What commands act on: the picked entries in the order shown */
	const picked = () => shown.filter((s) => picker.has(s.key));

	type View = 'list' | 'grid';
	const VIEW_KEY = 'screen-capture:library-view';

	/** Many entries with small previews (list) or fewer with large ones (tiles); remembered */
	let view = $state<View>(readStored(VIEW_KEY) === 'list' ? 'list' : 'grid');

	function setView(next: View) {
		view = next;
		writeStored(VIEW_KEY, next);
	}

	const VIEWS: { value: View; label: string; icon: string }[] = [
		{ value: 'list', label: m.library.viewList, icon: 'icon-[material-symbols-light--view-list-outline]' },
		{ value: 'grid', label: m.library.viewGrid, icon: 'icon-[material-symbols-light--grid-view-outline]' }
	];

	/** Section a library tile is dragged over (HTML drag), to move it there */
	let tileOver = $state<LibraryScope | null>(null);
	/** Entry whose name is being edited (`<scope>:<id>`) */
	let renaming = $state<string | null>(null);

	/** Errors of the global library (async) as a toast */
	async function run(task: Promise<unknown> | unknown) {
		try {
			await task;
		} catch (e) {
			console.error('[screen-capture] library', e);
			toast(errorMessage(e), 'error', 8000);
		}
	}

	/** Keeps a typed name – once: Enter only leaves the field, leaving keeps */
	function rename(scope: LibraryScope, entry: LibraryEntry, name: string) {
		if (renaming !== keyOf(scope, entry)) return;
		renaming = null;
		const trimmed = name.trim();
		if (!trimmed || trimmed === entry.name) return;
		if (scope === 'project') editor.renameLibraryEntry(entry.id, trimmed);
		else run(globalLibrary.rename(entry.id, trimmed));
	}

	/** Inserts entries (the picked ones) at the playhead, one after another; the playhead stays */
	async function insertPicked(list = picked()) {
		if (!list.length) return;
		const from = context.player.time;
		let at = from;
		for (const { scope, entry } of list) {
			await actions.insertLibrary(scope, entry.id, list.length > 1 ? { start: at } : undefined);
			at += entryDuration(entry.items);
		}
		if (list.length > 1) context.player.seek(from);
	}

	/**
	 * Removes the picked entries after asking: entries are no files that could go to the trash, and removing one from
	 * “All projects” deletes the media copies only it used – there is nothing to undo
	 */
	async function removePicked() {
		const list = picked();
		if (!list.length) return;
		const ok = await ask({
			title: m.library.removeTitle,
			message: list.length === 1 ? m.library.removeMessage(list[0].entry.name) : m.library.removeMany(list.length),
			confirm: m.library.removeConfirm,
			danger: true
		});
		if (!ok) return;
		picker.clear();
		for (const { scope, entry } of list) {
			if (scope === 'project') editor.removeLibraryEntry(entry.id);
			else await run(globalLibrary.remove(entry.id));
		}
	}

	/** Moves or copies the picked entries, each into the other library */
	async function transferPicked(move: boolean) {
		for (const { scope, entry } of picked()) await actions.transferLibrary(scope, entry.id, move);
	}

	function startRename() {
		const list = picked();
		if (list.length === 1) renaming = list[0].key;
	}

	function menu(): MenuEntry[] {
		const list = picked();
		const scopes = new Set(list.map((s) => s.scope));
		// Picked in both sections: each goes into its other library
		const scope = scopes.size === 1 ? list[0].scope : null;
		return [
			{ label: m.library.insert, icon: 'icon-[material-symbols-light--playlist-add]', keys: m.keys.enter, disabled: !list.length, run: () => void insertPicked() },
			{ label: m.library.rename, icon: 'icon-[material-symbols-light--edit-outline]', keys: 'F2', disabled: list.length !== 1, run: startRename },
			{
				label: scope === 'project' ? m.library.moveToGlobal : scope === 'global' ? m.library.moveToProject : m.library.moveToOther,
				icon: 'icon-[material-symbols-light--drive-file-move-outline]',
				disabled: !list.length,
				run: () => void transferPicked(true)
			},
			{
				label: scope === 'project' ? m.library.copyToGlobal : scope === 'global' ? m.library.copyToProject : m.library.copyToOther,
				icon: 'icon-[material-symbols-light--content-copy]',
				disabled: !list.length,
				run: () => void transferPicked(false)
			},
			{ separator: true },
			{
				label: m.library.remove,
				icon: 'icon-[material-symbols-light--delete-outline]',
				keys: m.keys.del,
				disabled: !list.length,
				run: () => void removePicked()
			}
		];
	}

	function click(e: MouseEvent, scope: LibraryScope, entry: LibraryEntry) {
		if (renaming) return;
		const key = keyOf(scope, entry);
		// A click on the name of the one picked entry renames it (like in Files)
		const onName = !!(e.target as HTMLElement).closest('[data-name]');
		const wasOnly = picker.selected.size === 1 && picker.has(key);
		const result = picker.click(e, key, order);
		if (result === 'open') void insertPicked([{ scope, entry, key }]);
		else if (result === 'plain' && onName && wasOnly && e.detail === 1) renaming = key;
	}

	function keydown(e: KeyboardEvent) {
		if (renaming) return;
		const mod = e.ctrlKey || e.metaKey;
		if (mod && e.key.toLowerCase() === 'a' && !e.shiftKey && !e.altKey) picker.selectAll(order);
		else if (e.key === 'Enter' && !mod) void insertPicked();
		else if (e.key === 'F2') startRename();
		else if (e.key === 'Delete' && !mod) void removePicked();
		else if (e.key === 'Escape' && picker.selected.size) picker.clear();
		else return;
		// Not the editor's shortcuts (select all items, delete the selection, deselect)
		e.preventDefault();
		e.stopPropagation();
	}

	// Unchanged while the timeline changes (e.g. during a drag), so the tiles don't check again
	const projectSources = $derived(editor.project.sources);
	const canvasWidth = $derived(editor.project.width);
	const canvasHeight = $derived(editor.project.height);
	const sourcesOf = (scope: LibraryScope, entry: LibraryEntry) => (scope === 'project' ? projectSources : entry.sources);
	const pictureIn = (sources: readonly Source[]) => (clip: Clip) => sources.find((s) => s.id === clip.sourceId)?.hasVideo !== false;

	/** Does the entry have anything to show? An entry of only audio gets an icon instead */
	const hasPreview = (scope: LibraryScope, entry: LibraryEntry) =>
		!!previewBounds(entry.items, canvasWidth, canvasHeight, pictureIn(sourcesOf(scope, entry)));

	/**
	 * Picture of the entry's elements on their own, fitted into `width` × `height` pixels. Drawn again when fonts,
	 * images or icons have loaded, and once the clips' thumbnails are there.
	 */
	function thumbnail(canvas: HTMLCanvasElement, scope: LibraryScope, entry: LibraryEntry, width: number, height: number) {
		void fontState.version;
		void imageState.version;
		// Not on every project change: the project's size and media are read without subscribing
		const project = untrack(() => editor.project);
		const sources = untrack(() => sourcesOf(scope, entry));
		const place = scope === 'project' ? projectMedia(project.id) : GLOBAL_MEDIA;
		const hasPicture = pictureIn(sources);
		let media: ItemMedia | undefined;
		let cancelled = false;
		const draw = () => drawItemsPreview(canvas, entry.items, project.width, project.height, width, height, media, hasPicture);
		untrack(draw);
		itemMedia(entry.items, sources, place).then(
			(loaded) => {
				if (cancelled) return;
				media = loaded;
				draw();
			},
			(e) => console.error('[screen-capture] library preview', e)
		);
		return () => (cancelled = true);
	}

	/** Distinct type icons of the entry's items */
	const icons = (entry: LibraryEntry) => [...new Set(entry.items.map((item) => itemIcon(item, editor)))].slice(0, 5);
</script>

<div class="flex flex-col gap-3 p-3">
	<div class="flex items-center gap-2">
		<label class="input input-sm min-w-0 flex-1">
			<span class="icon-[material-symbols-light--search] size-4 opacity-60" aria-hidden="true"></span>
			<input
				type="search"
				class="grow"
				placeholder={m.library.search}
				aria-label={m.library.search}
				bind:value={query}
				onkeydown={(e) => {
					if (e.key === 'Escape' && query) {
						e.stopPropagation();
						query = '';
					}
				}}
			/>
		</label>
		<div class="join" role="group" aria-label={m.library.view}>
			{#each VIEWS as option (option.value)}
				<button
					class="btn btn-xs join-item {view === option.value ? 'btn-active' : ''}"
					onclick={() => setView(option.value)}
					title={option.label}
					aria-label={option.label}
					aria-pressed={view === option.value}
				>
					<span class="{option.icon} size-4" aria-hidden="true"></span>
				</button>
			{/each}
		</div>
	</div>
	<div
		class="flex flex-col gap-3 outline-none"
		role="listbox"
		aria-multiselectable="true"
		aria-label={m.tools.groups.library}
		tabindex="0"
		onkeydown={keydown}
		onpointerdown={(e) => picker.pointerdown(e)}
	>
		{#each sections as section (section.scope)}
			{@const active = libraryUi.dropTarget === section.scope || tileOver === section.scope}
			<section
				class="rounded-box flex flex-col gap-2 border-2 border-dashed p-2 transition-colors {active
					? 'border-selection bg-selection/20'
					: libraryUi.dragging
						? 'border-base-content/30'
						: 'border-transparent'}"
				data-library-drop={section.scope}
				aria-label={section.title}
				ondragover={(e) => {
					if (!hasDragPayload(e)) return;
					e.preventDefault();
					tileOver = section.scope;
				}}
				ondragleave={(e) => {
					if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) tileOver = null;
				}}
				ondrop={(e) => {
					tileOver = null;
					const payload = readDragPayload(e);
					if (payload?.type !== 'library') return;
					e.preventDefault();
					e.stopPropagation();
					if (payload.scope !== section.scope) void actions.transferLibrary(payload.scope, payload.id, true);
				}}
			>
				<h3 class="flex items-center gap-1 text-xs font-semibold opacity-70">
					<span
						class="{section.scope === 'project'
							? 'icon-[material-symbols-light--folder-outline]'
							: 'icon-[material-symbols-light--public]'} size-4"
						aria-hidden="true"
					></span>
					{section.title}
					<span class="font-normal">
						({query.trim() ? `${section.entries.length}/${section.all.length}` : section.all.length})
					</span>
				</h3>
				<div class={view === 'grid' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-1'}>
					{#each section.entries as entry (entry.id)}
						{@const key = keyOf(section.scope, entry)}
						{@const isPicked = picker.has(key)}
						<!-- svelte-ignore a11y_click_events_have_key_events (keys are the list's: Enter, F2, Del, Ctrl+A) -->
						<div
							class="rounded-box hover:outline-selection/60 relative flex cursor-grab hover:outline-1 {isPicked
								? 'bg-selection/20'
								: 'bg-base-100'} {view === 'grid' ? 'flex-col gap-1 p-1.5' : 'items-center gap-2 p-1'}"
							draggable={renaming !== key}
							ondragstart={(e) => {
								setDragPayload(e, { type: 'library', scope: section.scope, id: entry.id });
								// The preview as drag image, so you see what you carry
								const canvas = (e.currentTarget as HTMLElement).querySelector('canvas');
								if (canvas) e.dataTransfer?.setDragImage(canvas, canvas.offsetWidth / 2, canvas.offsetHeight / 2);
							}}
							onclick={(e) => click(e, section.scope, entry)}
							ondblclick={() => {
								if (!renaming) void insertPicked([{ scope: section.scope, entry, key }]);
							}}
							oncontextmenu={(e) => {
								picker.menu(e, key);
								openContextMenu(e, menu());
							}}
							role="option"
							aria-selected={isPicked}
							tabindex="-1"
							aria-label={m.library.entry(entry.name, formatTime(entryDuration(entry.items), 1))}
						>
							{#if picker.marking}<PickMark picked={isPicked} class="absolute top-1 left-1 z-10" />{/if}
							<!-- The elements on their own, centered in a fixed box -->
							<div
								class="bg-base-200 grid shrink-0 place-items-center overflow-hidden rounded p-1 {view === 'grid'
									? 'h-24 w-full'
									: 'h-9 w-14'}"
							>
								{#if !hasPreview(section.scope, entry)}
									<span
										class="icon-[material-symbols-light--graphic-eq] opacity-70 {view === 'grid' ? 'size-12' : 'size-6'}"
										title={m.library.audioOnly}
										aria-hidden="true"
									></span>
								{:else if view === 'grid'}
									<canvas class="max-h-full max-w-full" {@attach (c) => thumbnail(c, section.scope, entry, 320, 176)}></canvas>
								{:else}
									<canvas class="max-h-full max-w-full" {@attach (c) => thumbnail(c, section.scope, entry, 112, 64)}></canvas>
								{/if}
							</div>
							<div class="flex min-w-0 flex-1 items-center gap-1">
								<div class="flex min-w-0 flex-1 flex-col gap-0.5">
									{#if renaming === key}
										<input
											class="input input-xs w-full"
											value={entry.name}
											aria-label={m.library.name}
											{@attach (input) => input.select()}
											onclick={(e) => e.stopPropagation()}
											ondblclick={(e) => e.stopPropagation()}
											onkeydown={(e) => {
												e.stopPropagation();
												if (e.key === 'Enter') e.currentTarget.blur();
												else if (e.key === 'Escape') renaming = null;
											}}
											onblur={(e) => rename(section.scope, entry, e.currentTarget.value)}
										/>
									{:else}
										<span class="truncate text-xs font-semibold" title={entry.name} data-name>{entry.name}</span>
									{/if}
									<span class="flex items-center gap-1 text-[10px] opacity-60">
										{formatTime(entryDuration(entry.items), 1)}
										{#if view === 'grid'}
											<span class="ml-auto flex gap-0.5">
												{#each icons(entry) as icon (icon)}
													<span class="{icon} size-3.5" aria-hidden="true"></span>
												{/each}
											</span>
										{:else}
											· {m.library.elements(entry.items.length)}
										{/if}
									</span>
								</div>
								<MoreButton
									name={entry.name}
									class="btn-xs"
									entries={() => {
										if (!picker.has(key)) picker.only(key);
										return menu();
									}}
								/>
							</div>
						</div>
					{:else}
						<p class="col-span-2 text-xs opacity-60">{section.all.length ? m.library.noMatches : m.library.empty}</p>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</div>
