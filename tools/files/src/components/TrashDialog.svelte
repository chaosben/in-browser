<script lang="ts">
	import { untrack } from 'svelte';
	import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import FileIcon from '@in-browser/files/FileIcon.svelte';
	import { watch } from '@in-browser/files/fs.js';
	import { filesMessages, formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { basename, parent } from '@in-browser/files/path.js';
	import { RETENTIONS, inTrash, type Retention } from '@in-browser/files/trash.js';
	import {
		deleteFromTrash,
		emptyTrash,
		listTrash,
		restoreFromTrash,
		setTrashRetention,
		trashRetention,
		type TrashItem
	} from '@in-browser/files/trash-browser.js';
	import { formatDateTime, intlLocale, m } from '#lib/i18n/index.js';

	// The trash: what you deleted (here or on another device), to restore where it was or delete for good, and how long
	// it is kept (for all devices). Every action is a visible button (touch: no menus, hover or right-click needed).

	let { onclose }: { onclose: () => void } = $props();

	/** Rows shown at most (a full trash stays usable; the rest after restoring or deleting some) */
	const LIMIT = 300;

	let items = $state<TrashItem[] | null>(null);
	let retention = $state<Retention | undefined>(undefined);
	let busy = $state(false);

	async function refresh() {
		items = await listTrash().catch((e: unknown) => {
			console.error(e);
			return [];
		});
	}

	$effect(() => {
		untrack(() => {
			void refresh();
			void trashRetention().then((r) => (retention = r));
		});
		// Entries also arrive from other devices
		let timer: ReturnType<typeof setTimeout> | undefined;
		const stop = watch((paths) => {
			if (!paths.some(inTrash)) return;
			clearTimeout(timer);
			timer = setTimeout(() => void refresh(), 500);
		});
		return () => {
			stop();
			clearTimeout(timer);
		};
	});

	function start(dialog: HTMLDialogElement) {
		dialog.showModal();
	}

	async function run(action: () => Promise<void>) {
		busy = true;
		try {
			await action();
		} catch (e) {
			console.error(e);
			toast(e instanceof Error ? e.message : String(e), 'error', 8000);
		} finally {
			busy = false;
			await refresh();
		}
	}

	const restore = (item: TrashItem) =>
		run(async () => {
			const path = await restoreFromTrash(item);
			toast(m.trash.restored(path), 'success');
		});

	async function remove(item: TrashItem) {
		const ok = await ask({ title: m.trash.removeTitle, message: m.trash.removeMessage(basename(item.path)), confirm: m.trash.remove, danger: true });
		if (ok) await run(() => deleteFromTrash(item));
	}

	async function empty() {
		const ok = await ask({ title: m.trash.emptyTitle, message: m.trash.emptyMessage(items?.length ?? 0), confirm: m.trash.empty, danger: true });
		if (ok) await run(emptyTrash);
	}

	async function choose(value: string) {
		const next: Retention = value === 'forever' ? null : Number(value);
		retention = next;
		await run(() => setTrashRetention(next));
	}
</script>

<dialog
	class="modal"
	{@attach start}
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
>
	<div class="modal-box flex max-w-2xl flex-col gap-3">
		<h3 class="text-lg font-bold">{m.trash.title}</h3>
		<p class="text-sm opacity-70">{m.trash.intro}</p>
		<div class="flex flex-wrap items-center gap-2 text-sm">
			<label class="flex items-center gap-2">
				<span>{m.trash.keep}</span>
				<select
					class="select select-sm w-auto"
					value={retention === undefined ? '' : retention === null ? 'forever' : String(retention)}
					disabled={retention === undefined || busy}
					onchange={(e) => choose(e.currentTarget.value)}
				>
					{#each RETENTIONS as option (option)}
						<option value={option === null ? 'forever' : String(option)}>{option === null ? m.trash.forever : m.trash.days(option)}</option>
					{/each}
				</select>
			</label>
			<span class="text-xs opacity-60">{m.trash.keepHint}</span>
		</div>
		{#if items === null}
			<span class="loading loading-spinner loading-sm"></span>
		{:else if !items.length}
			<p class="text-sm opacity-70">{m.trash.nothing}</p>
		{:else}
			<p class="text-xs opacity-60">{m.trash.summary(items.length, formatSize(items.reduce((sum, item) => sum + item.size, 0), intlLocale))}</p>
			<ul class="flex max-h-[55vh] flex-col overflow-y-auto">
				{#each items.slice(0, LIMIT) as item (item.entry)}
					{@const name = basename(item.path)}
					<li class="border-base-300 flex items-center gap-2 border-b py-1.5 last:border-b-0">
						<FileIcon {name} kind={item.kind} size="size-6" />
						<div class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-sm" title={item.path}>{name}</span>
							<span class="truncate text-xs opacity-60">{m.trash.from(parent(item.path) === '/' ? filesMessages().root : parent(item.path))}</span>
							<span class="text-xs break-words opacity-60">{m.trash.when(formatDateTime(item.deleted), formatSize(item.size, intlLocale))}</span>
						</div>
						<button class="btn btn-sm btn-ghost" disabled={busy} onclick={() => restore(item)} aria-label={m.trash.restore} title={m.trash.restore}>
							<span class="icon-[material-symbols-light--restore-from-trash-outline] size-5" aria-hidden="true"></span>
							<span class="hidden sm:inline">{m.trash.restore}</span>
						</button>
						<button class="btn btn-sm btn-ghost btn-square" disabled={busy} onclick={() => remove(item)} aria-label={m.trash.remove} title={m.trash.remove}>
							<span class="icon-[material-symbols-light--delete-forever-outline] size-5" aria-hidden="true"></span>
						</button>
					</li>
				{/each}
			</ul>
			{#if items.length > LIMIT}
				<p class="text-xs opacity-60">{m.trash.more(items.length - LIMIT)}</p>
			{/if}
		{/if}
		<p class="text-xs opacity-60">{m.trash.elsewhere}</p>
		<div class="modal-action flex-wrap">
			{#if items?.length}
				<button class="btn btn-ghost text-error" disabled={busy} onclick={empty}>
					<span class="icon-[material-symbols-light--delete-sweep-outline] size-5" aria-hidden="true"></span>
					{m.trash.empty}
				</button>
			{/if}
			<button class="btn" onclick={onclose}>{m.trash.close}</button>
		</div>
	</div>
</dialog>
