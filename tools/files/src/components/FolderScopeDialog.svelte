<script lang="ts">
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { list } from '@in-browser/files/fs.js';
	import { formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { isHidden } from '@in-browser/files/path.js';
	import { folderSizes, includeFolder, p2pStatus } from '@in-browser/files/p2p/p2p.svelte.js';
	import { inScope } from '@in-browser/files/p2p/scope.js';
	import { devicesUi } from '#lib/devices.svelte.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	// Which folders this device takes part in: a tree with checkboxes, sizes and where the folders are (also folders
	// that exist only on other devices); subfolders load when opened

	let { onclose }: { onclose: () => void } = $props();

	interface Folder {
		path: string;
		name: string;
		/** Bytes per device ID */
		sizes: Record<string, number>;
	}

	const children = new SvelteMap<string, Folder[]>();
	const expanded = new SvelteSet<string>();
	const scope = $derived(p2pStatus.view.scope);
	const self = $derived(p2pStatus.view.self?.id ?? '');
	const names = $derived(new Map(p2pStatus.view.devices.map((d) => [d.id, d.name])));

	async function load(folder: string) {
		try {
			const [local, sizes] = await Promise.all([list(folder).catch(() => []), folderSizes(folder).catch(() => ({}))]);
			const byPath = new Map<string, Folder>();
			for (const entry of local) {
				if (entry.kind === 'directory' && !isHidden(entry.path)) byPath.set(entry.path, { path: entry.path, name: entry.name, sizes: {} });
			}
			for (const [device, perFolder] of Object.entries(sizes)) {
				for (const [path, bytes] of Object.entries(perFolder)) {
					if (isHidden(path)) continue;
					const folder = byPath.get(path) ?? { path, name: path.split('/').at(-1) ?? path, sizes: {} };
					folder.sizes[device] = bytes;
					byPath.set(path, folder);
				}
			}
			children.set(folder, [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name, intlLocale)));
		} catch (e) {
			console.error(e);
		}
	}

	$effect(() => {
		void load('/');
	});

	function toggleOpen(path: string) {
		if (expanded.has(path)) expanded.delete(path);
		else {
			expanded.add(path);
			if (!children.has(path)) void load(path);
		}
	}

	async function toggle(folder: Folder, on: boolean) {
		if (on) {
			try {
				await includeFolder(folder.path);
			} catch (e) {
				toast(m.devices.failed(e instanceof Error ? e.message : String(e)), 'error', 8000);
			}
		} else {
			devicesUi.exclude = folder.path;
		}
	}

	function where(folder: Folder): string {
		const devices = Object.keys(folder.sizes).filter((id) => folder.sizes[id] > 0);
		const size = Math.max(0, ...Object.values(folder.sizes));
		const sizeText = size ? formatSize(size, intlLocale) : '';
		if (devices.length && !devices.includes(self)) {
			const onlyOn = m.scope.onlyOn(devices.map((id) => names.get(id) ?? id).join(', '));
			return sizeText ? `${sizeText}, ${onlyOn}` : onlyOn;
		}
		return sizeText;
	}

	function start(dialog: HTMLDialogElement) {
		dialog.showModal();
	}
</script>

{#snippet tree(folder: string, depth: number)}
	{#each children.get(folder) ?? [] as child (child.path)}
		{@const parentExcluded = !inScope(folder, scope) && folder !== '/'}
		{@const on = inScope(child.path, scope)}
		<li>
			<div class="hover:bg-base-200 rounded-box flex items-center gap-2 py-1 pr-2" style:padding-left="{depth * 1.25}rem">
				<button
					class="btn btn-ghost btn-xs btn-square"
					onclick={() => toggleOpen(child.path)}
					aria-label={child.name}
					aria-expanded={expanded.has(child.path)}
				>
					<span
						class={['icon-[material-symbols-light--chevron-right] size-4 transition-transform', expanded.has(child.path) && 'rotate-90']}
						aria-hidden="true"
					></span>
				</button>
				<label class="flex min-w-0 flex-1 items-center gap-2">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						checked={on}
						disabled={parentExcluded}
						onchange={(e) => {
							const checked = e.currentTarget.checked;
							e.currentTarget.checked = on;
							toggle(child, checked);
						}}
					/>
					<span class="icon-[material-symbols-light--folder-outline] text-folder size-5 shrink-0" aria-hidden="true"></span>
					<span class="min-w-0 truncate">{child.name}</span>
				</label>
				<span class="shrink-0 text-xs opacity-60">{where(child)}</span>
			</div>
			{#if expanded.has(child.path)}
				<ul>{@render tree(child.path, depth + 1)}</ul>
			{/if}
		</li>
	{/each}
{/snippet}

<dialog
	class="modal"
	{@attach start}
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
>
	<div class="modal-box flex max-w-2xl flex-col gap-3">
		<h3 class="text-lg font-bold">{m.scope.title}</h3>
		<p class="text-sm opacity-80">{m.scope.hint}</p>
		<ul class="max-h-[60vh] overflow-y-auto text-sm">
			{#if children.get('/')?.length === 0}
				<li class="opacity-60">{m.scope.empty}</li>
			{:else if children.has('/')}
				{@render tree('/', 0)}
			{:else}
				<li><span class="loading loading-spinner loading-sm"></span></li>
			{/if}
		</ul>
		<p class="text-xs opacity-60">{m.scope.always}: <code>.apps</code></p>
		<div class="modal-action">
			<button class="btn" onclick={onclose}>{m.devices.close}</button>
		</div>
	</div>
</dialog>
