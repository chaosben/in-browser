<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/i18n/index.js';
	import { itemIcon, itemLabel } from '#lib/project/labels.js';
	import { matchesQuery } from '#lib/ui/inspector-search.js';
	import { entryDuration } from '#lib/project/library.js';
	import { globalLibrary } from '#lib/project/library.svelte.js';
	import type { Clip, LibraryEntry } from '#lib/project/types.js';
	import { itemMedia, projectMedia, type ItemMedia, type MediaPlace } from '#lib/media/visuals.js';
	import { imageState, setLibraryImages } from '#lib/render/images.svelte.js';
	import { libraryMediaFile } from '#lib/storage/store.js';
	import { fontState } from '#lib/render/fonts.svelte.js';
	import { drawItemsPreview } from '#lib/render/item-preview.js';
	import { hasDragPayload, readDragPayload, setDragPayload } from '#lib/tools/drag.js';
	import type { ToolProps } from '#lib/tools/types.js';
	import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
	import { openContextMenu } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { libraryUi, type LibraryScope } from '#lib/ui/library.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { errorMessage, formatTime } from '#lib/util/format.js';

	let { editor, actions }: ToolProps = $props();

	const GLOBAL_MEDIA: MediaPlace = { key: 'library', open: libraryMediaFile };

	onMount(() => {
		globalLibrary.load().catch((e) => {
			console.error(e);
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

	type View = 'list' | 'grid';
	const VIEW_KEY = 'screen-capture:library-view';

	function loadView(): View {
		try {
			return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
		} catch {
			// localStorage not available
			return 'grid';
		}
	}

	/** Many entries with small previews (list) or fewer with large ones (tiles); remembered */
	let view = $state<View>(loadView());

	function setView(next: View) {
		view = next;
		try {
			localStorage.setItem(VIEW_KEY, next);
		} catch {
			// ignore
		}
	}

	const VIEWS: { value: View; label: string; icon: string }[] = [
		{ value: 'list', label: m.library.viewList, icon: 'icon-[material-symbols-light--view-list-outline]' },
		{ value: 'grid', label: m.library.viewGrid, icon: 'icon-[material-symbols-light--grid-view-outline]' }
	];

	/** Section a library tile is dragged over (HTML drag), to move it there */
	let tileOver = $state<LibraryScope | null>(null);
	/** Entry whose name is being edited */
	let renaming = $state<string | null>(null);

	/** Errors of the global library (async) as a toast */
	async function run(task: Promise<unknown> | unknown) {
		try {
			await task;
		} catch (e) {
			console.error(e);
			toast(errorMessage(e), 'error', 8000);
		}
	}

	function rename(scope: LibraryScope, entry: LibraryEntry, name: string) {
		renaming = null;
		const trimmed = name.trim();
		if (!trimmed || trimmed === entry.name) return;
		if (scope === 'project') editor.renameLibraryEntry(entry.id, trimmed);
		else run(globalLibrary.rename(entry.id, trimmed));
	}

	async function remove(scope: LibraryScope, entry: LibraryEntry) {
		const ok = await ask({
			title: m.library.removeTitle,
			message: m.library.removeMessage(entry.name),
			confirm: m.library.removeConfirm,
			danger: true
		});
		if (!ok) return;
		if (scope === 'project') editor.removeLibraryEntry(entry.id);
		else run(globalLibrary.remove(entry.id));
	}

	function menu(e: MouseEvent, scope: LibraryScope, entry: LibraryEntry) {
		openContextMenu(e, [
			{
				label: m.library.insert,
				icon: 'icon-[material-symbols-light--playlist-add]',
				run: () => actions.insertLibrary(scope, entry.id)
			},
			{
				label: m.library.rename,
				icon: 'icon-[material-symbols-light--edit-outline]',
				run: () => (renaming = entry.id)
			},
			{
				label: scope === 'project' ? m.library.moveToGlobal : m.library.moveToProject,
				icon: 'icon-[material-symbols-light--drive-file-move-outline]',
				run: () => actions.transferLibrary(scope, entry.id, true)
			},
			{
				label: scope === 'project' ? m.library.copyToGlobal : m.library.copyToProject,
				icon: 'icon-[material-symbols-light--content-copy]',
				run: () => actions.transferLibrary(scope, entry.id, false)
			},
			{ separator: true },
			{
				label: m.library.remove,
				icon: 'icon-[material-symbols-light--delete-outline]',
				run: () => remove(scope, entry)
			}
		]);
	}

	/**
	 * Picture of the entry's elements on their own, fitted into `width` × `height` pixels. Drawn again when fonts,
	 * images or icons have loaded, and once the clips' thumbnails and waveforms are there.
	 */
	function thumbnail(canvas: HTMLCanvasElement, scope: LibraryScope, entry: LibraryEntry, width: number, height: number) {
		void fontState.version;
		void imageState.version;
		// Not on every project change: the project's size and media are read without subscribing
		const project = untrack(() => editor.project);
		const sources = scope === 'project' ? project.sources : entry.sources;
		const place = scope === 'project' ? projectMedia(project.id) : GLOBAL_MEDIA;
		const hasPicture = (clip: Clip) => sources.find((s) => s.id === clip.sourceId)?.hasVideo !== false;
		let media: ItemMedia | undefined;
		let cancelled = false;
		const draw = () => drawItemsPreview(canvas, entry.items, project.width, project.height, width, height, media, hasPicture);
		untrack(draw);
		itemMedia(entry.items, sources, place).then((loaded) => {
			if (cancelled) return;
			media = loaded;
			draw();
		});
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
					class="btn btn-xs join-item {view === option.value ? 'btn-primary' : ''}"
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
	{#each sections as section (section.scope)}
		{@const active = libraryUi.dropTarget === section.scope || tileOver === section.scope}
		<section
			class="rounded-box flex flex-col gap-2 border-2 border-dashed p-2 transition-colors {active
				? 'border-primary bg-primary/10'
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
				if (payload.scope !== section.scope) actions.transferLibrary(payload.scope, payload.id, true);
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
					<div
						class="bg-base-100 rounded-box hover:outline-primary/60 flex cursor-grab hover:outline-1 {view === 'grid'
							? 'flex-col gap-1 p-1.5'
							: 'items-center gap-2 p-1'}"
						draggable={renaming !== entry.id}
						ondragstart={(e) => {
							setDragPayload(e, { type: 'library', scope: section.scope, id: entry.id });
							// The preview as drag image, so you see what you carry
							const canvas = (e.currentTarget as HTMLElement).querySelector('canvas');
							if (canvas) e.dataTransfer?.setDragImage(canvas, canvas.offsetWidth / 2, canvas.offsetHeight / 2);
						}}
						oncontextmenu={(e) => menu(e, section.scope, entry)}
						role="group"
						aria-label={m.library.entry(entry.name, formatTime(entryDuration(entry.items), 1))}
					>
						<!-- The elements on their own, centered in a fixed box -->
						<button
							class="bg-base-200 grid shrink-0 place-items-center overflow-hidden rounded p-1 {view === 'grid'
								? 'h-24 w-full'
								: 'h-9 w-14'}"
							onclick={() => actions.insertLibrary(section.scope, entry.id)}
							title={m.library.insert}
							aria-label={m.library.insert}
						>
							{#if view === 'grid'}
								<canvas class="max-h-full max-w-full" {@attach (c) => thumbnail(c, section.scope, entry, 320, 176)}></canvas>
							{:else}
								<canvas class="max-h-full max-w-full" {@attach (c) => thumbnail(c, section.scope, entry, 112, 64)}></canvas>
							{/if}
						</button>
						<div class="flex min-w-0 flex-1 flex-col gap-0.5">
							{#if renaming === entry.id}
								<input
									class="input input-xs w-full"
									value={entry.name}
									aria-label={m.library.name}
									{@attach (input) => input.select()}
									onkeydown={(e) => {
										if (e.key === 'Enter') rename(section.scope, entry, e.currentTarget.value);
										else if (e.key === 'Escape') {
											e.stopPropagation();
											renaming = null;
										}
									}}
									onblur={(e) => rename(section.scope, entry, e.currentTarget.value)}
								/>
							{:else}
								<span class="truncate text-xs font-semibold" title={entry.name}>{entry.name}</span>
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
					</div>
				{:else}
					<p class="col-span-2 text-xs opacity-60">{section.all.length ? m.library.noMatches : m.library.empty}</p>
				{/each}
			</div>
		</section>
	{/each}
</div>
