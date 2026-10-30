<script lang="ts">
	import { list } from '@in-browser/files/fs.js';
	import { filesMessages, formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { extname, parent } from '@in-browser/files/path.js';
	import { formatDateTime, intlLocale, m } from '#lib/i18n/index.js';
	import type { Item } from '#lib/items.js';
	import FileIcon from '@in-browser/files/FileIcon.svelte';

	let { item, onclose }: { item: Item; onclose: () => void } = $props();

	const t = $derived(filesMessages());
	/** Totals of a folder or package, counted once when the dialog opens */
	let totals = $state<{ size: number; files: number; folders: number; modified: number } | null>(null);

	const kind = $derived.by(() => {
		if (item.folder) return t.kinds.folder;
		if (item.formats[0]) return t.kinds.package(item.formats[0].toolName);
		const ext = extname(item.name).slice(1).toUpperCase();
		return ext ? t.kinds.fileType(ext) : t.kinds.file;
	});

	async function count(path: string, into: { size: number; files: number; folders: number; modified: number }) {
		for (const entry of await list(path)) {
			if (entry.kind === 'file') {
				into.files++;
				into.size += entry.size ?? 0;
				into.modified = Math.max(into.modified, entry.modified ?? 0);
			} else {
				into.folders++;
				await count(entry.path, into);
			}
		}
		return into;
	}

	function start(dialog: HTMLDialogElement) {
		dialog.showModal();
		if (item.kind === 'directory') {
			count(item.path, { size: 0, files: 0, folders: 0, modified: 0 })
				.then((result) => (totals = result))
				.catch((e) => console.error(e));
		}
	}

	const size = $derived(item.kind === 'file' ? item.size : totals?.size);
	const modified = $derived(item.kind === 'file' ? item.modified : totals?.modified);
</script>

<dialog
	class="modal"
	{@attach start}
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
>
	<div class="modal-box flex flex-col gap-4">
		<h3 class="flex items-center gap-2 text-lg font-bold">
			<FileIcon name={item.name} kind={item.kind} size="size-8" />
			<span class="min-w-0 truncate" title={item.name}>{item.name}</span>
		</h3>
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
			<dt class="opacity-70">{m.properties.kind}</dt>
			<dd>{kind}</dd>
			<dt class="opacity-70">{m.properties.location}</dt>
			<dd class="break-all">{parent(item.path) === '/' ? t.root : parent(item.path)}</dd>
			<dt class="opacity-70">{m.properties.size}</dt>
			<dd>{size === undefined ? m.properties.calculating : formatSize(size, intlLocale)}</dd>
			{#if item.kind === 'directory'}
				<dt class="opacity-70">{m.properties.contents}</dt>
				<dd>{totals ? m.properties.counts(totals.files, totals.folders) : m.properties.calculating}</dd>
			{/if}
			{#if modified}
				<dt class="opacity-70">{m.properties.modified}</dt>
				<dd>{formatDateTime(modified)}</dd>
			{/if}
		</dl>
		<div class="modal-action mt-0">
			<button class="btn btn-primary" onclick={onclose}>{m.common.close}</button>
		</div>
	</div>
</dialog>
