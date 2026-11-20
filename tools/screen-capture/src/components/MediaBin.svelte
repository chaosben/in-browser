<script lang="ts">
	// The media bin: sources (video, audio) and own images of the project. Entries are picked like everywhere (`ui.md`
	// Selection: click, Ctrl/Shift+click, Ctrl+A while the list has the focus); a double click, Enter or “Insert” in
	// the menu (right click, ⋯) inserts the picked ones at the playhead, one after another; dragging drops one onto the
	// timeline or the preview. Deleting for good asks first (it can't be undone).
	import { untrack } from 'svelte';
	import MoreButton from '@in-browser/brand/MoreButton.svelte';
	import PickMark from '@in-browser/brand/PickMark.svelte';
	import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
	import { openContextMenu, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { Picker } from '@in-browser/brand/ui/pick.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { mediaUrl } from '@in-browser/files/media-url.js';
	import { thumbnails } from '#lib/media/visuals.js';
	import type { Editor } from '#lib/project/editor.svelte.js';
	import type { ImageAsset, Source } from '#lib/project/types.js';
	import { mediaPath } from '#lib/storage/store.js';
	import { setDragPayload } from '#lib/tools/drag.js';
	import type { BinEntry } from '#lib/tools/types.js';
	import { m } from '#lib/i18n/index.js';
	import { errorMessage, formatTime } from '#lib/util/format.js';

	interface Props {
		editor: Editor;
		/** Inserts the entries at the playhead, one after another */
		oninsert: (entries: BinEntry[]) => void;
		/** After a source is permanently deleted (the preview must dispose of its videos) */
		onremoved: () => void;
	}

	let { editor, oninsert, onremoved }: Props = $props();

	const picker = new Picker();
	const entries = $derived<BinEntry[]>([
		...editor.project.sources.map((source) => ({ kind: 'source' as const, id: source.id, source })),
		...editor.project.images.map((image) => ({ kind: 'image' as const, id: image.id, image }))
	]);
	const order = $derived(entries.map((e) => e.id));
	// Deleted or gone with a reload: no longer picked
	$effect(() => {
		const ids = order;
		untrack(() => picker.keep(ids));
	});

	const nameOf = (entry: BinEntry) => (entry.kind === 'source' ? entry.source.name : entry.image.name);
	const used = (entry: BinEntry) => (entry.kind === 'source' ? editor.isSourceInTimeline(entry.id) : editor.isImageInTimeline(entry.id));
	const inHistory = (entry: BinEntry) => (entry.kind === 'source' ? editor.isSourceInHistory(entry.id) : editor.isImageInHistory(entry.id));
	/** What commands act on: the picked entries in the order shown */
	const picked = () => entries.filter((e) => picker.has(e.id));

	/** Shows an own image from the project folder */
	function imagePreview(img: HTMLImageElement, image: ImageAsset) {
		let release: (() => void) | undefined;
		let cancelled = false;
		const projectId = untrack(() => editor.project.id);
		mediaUrl(mediaPath(projectId, image.file)).then(
			(media) => {
				if (cancelled) return media.release();
				release = media.release;
				img.src = media.url;
			},
			(e) => console.error('[screen-capture] image preview', e)
		);
		return () => {
			cancelled = true;
			release?.();
		};
	}

	function preview(canvas: HTMLCanvasElement, source: Source) {
		let cancelled = false;
		// Depend only on the source, not on every project change
		const projectId = untrack(() => editor.project.id);
		thumbnails(projectId, source).then((thumbs) => {
			const image = thumbs?.images[Math.floor(thumbs.images.length / 3)];
			const ctx = canvas.getContext('2d');
			if (cancelled || !image || !ctx) return;
			canvas.width = image.width;
			canvas.height = image.height;
			ctx.drawImage(image, 0, 0);
		});
		return () => (cancelled = true);
	}

	/** Deletes the picked entries for good, after asking (another text when only the history still uses them) */
	async function removePicked() {
		const list = picked();
		if (!list.length || list.some(used)) return;
		const history = list.some(inHistory);
		const message =
			list.length === 1
				? history
					? m.mediaBin.confirmDeleteHistory(nameOf(list[0]))
					: m.mediaBin.confirmDelete(nameOf(list[0]))
				: history
					? m.mediaBin.confirmDeleteManyHistory(list.length)
					: m.mediaBin.confirmDeleteMany(list.length);
		if (!(await ask({ title: m.mediaBin.deleteTitle, message, confirm: m.common.delete, danger: true }))) return;
		try {
			for (const entry of list) {
				if (entry.kind === 'source') await editor.removeSource(entry.id);
				else await editor.removeImage(entry.id);
			}
		} catch (e) {
			console.error('[screen-capture] delete media', e);
			toast(errorMessage(e), 'error', 8000);
		} finally {
			picker.clear();
			if (list.some((e) => e.kind === 'source')) onremoved();
		}
	}

	function insertPicked() {
		const list = picked();
		if (list.length) oninsert(list);
	}

	function menu(): MenuEntry[] {
		const list = picked();
		const inUse = list.some(used);
		return [
			{ label: m.mediaBin.insert, icon: 'icon-[material-symbols-light--playlist-add]', keys: m.keys.enter, disabled: !list.length, run: insertPicked },
			{ separator: true },
			{
				label: inUse ? `${m.mediaBin.deleteForever} – ${m.mediaBin.inUse}` : m.mediaBin.deleteForever,
				icon: 'icon-[material-symbols-light--delete-forever-outline]',
				keys: m.keys.del,
				disabled: !list.length || inUse,
				run: () => void removePicked()
			}
		];
	}

	function click(e: MouseEvent, entry: BinEntry) {
		if (picker.click(e, entry.id, order) === 'open') oninsert([entry]);
	}

	function keydown(e: KeyboardEvent) {
		const mod = e.ctrlKey || e.metaKey;
		if (mod && e.key.toLowerCase() === 'a' && !e.shiftKey && !e.altKey) picker.selectAll(order);
		else if (e.key === 'Enter' && !mod) insertPicked();
		else if (e.key === 'Delete' && !mod) void removePicked();
		else if (e.key === 'Escape' && picker.selected.size) picker.clear();
		else return;
		// Not the editor's shortcuts (select all items, delete the selection, deselect)
		e.preventDefault();
		e.stopPropagation();
	}
</script>

{#snippet row(entry: BinEntry)}
	{@const isPicked = picker.has(entry.id)}
	{@const name = nameOf(entry)}
	<!-- svelte-ignore a11y_click_events_have_key_events (keys are the list's: Enter, F2, Del, Ctrl+A) -->
	<div
		class="rounded-box relative flex cursor-grab items-center gap-2 p-2 {isPicked ? 'bg-selection/20' : 'bg-base-100'}"
		title={m.mediaBin.dragHint}
		draggable="true"
		ondragstart={(e) => setDragPayload(e, entry.kind === 'source' ? { type: 'source', id: entry.id } : { type: 'image', id: entry.id })}
		onclick={(e) => click(e, entry)}
		ondblclick={() => oninsert([entry])}
		oncontextmenu={(e) => {
			picker.menu(e, entry.id);
			openContextMenu(e, menu());
		}}
		role="option"
		aria-selected={isPicked}
		tabindex="-1"
		aria-label={name}
		data-media={entry.id}
	>
		{#if picker.marking}<PickMark picked={isPicked} class="absolute top-1 left-1 z-10" />{/if}
		{#if entry.kind === 'image'}
			<!-- Checkerboard shows transparency -->
			<img
				class="h-12 w-20 shrink-0 rounded object-contain"
				style="background-image: repeating-conic-gradient(#9ca3af 0 25%, #f3f4f6 0 50%); background-size: 8px 8px"
				alt=""
				draggable="false"
				{@attach (img) => imagePreview(img, entry.image)}
			/>
		{:else if entry.source.hasVideo}
			<canvas class="h-12 w-20 shrink-0 rounded bg-black object-cover" {@attach (c) => preview(c, entry.source)}></canvas>
		{:else}
			<div class="bg-base-300 grid h-12 w-20 shrink-0 place-items-center rounded" title={m.mediaBin.audioOnly}>
				<span class="icon-[material-symbols-light--graphic-eq] size-7 opacity-70" aria-hidden="true"></span>
			</div>
		{/if}
		<div class="flex min-w-0 flex-1 flex-col">
			<span class="truncate text-xs font-semibold" title={name}>{name}</span>
			<span class="text-[10px] opacity-60">
				{#if entry.kind === 'image'}
					{m.mediaBin.image} · {entry.image.width}×{entry.image.height}
				{:else}
					{@const s = entry.source}
					{formatTime(s.duration, 0)} · {s.hasVideo ? `${s.width}×${s.height}` : m.mediaBin.audioOnly}{s.hasAudio ? '' : ` · ${m.mediaBin.noAudio}`}
				{/if}
			</span>
		</div>
		<MoreButton
			{name}
			entries={() => {
				if (!picker.has(entry.id)) picker.only(entry.id);
				return menu();
			}}
		/>
	</div>
{/snippet}

<div class="flex flex-col gap-2 p-3">
	{#if entries.length === 0}
		<p class="text-xs opacity-60">{m.mediaBin.empty}</p>
	{:else}
		<p class="text-xs opacity-60">{m.mediaBin.hint}</p>
		<div
			class="flex flex-col gap-2 outline-none"
			role="listbox"
			aria-multiselectable="true"
			aria-label={m.tools.groups.media}
			tabindex="0"
			onkeydown={keydown}
			onpointerdown={(e) => picker.pointerdown(e)}
		>
			{#each entries as entry (entry.id)}
				{@render row(entry)}
			{/each}
		</div>
	{/if}
</div>
