<script lang="ts">
	import { onMount } from 'svelte';
	import Modal from '@in-browser/brand/Modal.svelte';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { filesErrorText, filesMessages, formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { basename } from '@in-browser/files/path.js';
	import type { Version } from '@in-browser/files/sync/versions.js';
	import { trashRetention } from '@in-browser/files/trash-browser.js';
	import { restoreVersion, versionsOf } from '@in-browser/files/versions-browser.js';
	import { formatDateTime, intlLocale, m } from '#lib/i18n/index.js';

	// “Earlier versions …” of a file: what a sync replaced or deleted on this device, newest first; restoring puts a
	// copy next to the file (or at its place when it is gone), never over it

	let { path, onclose, onrestored }: { path: string; onclose: () => void; onrestored: (path: string) => void } = $props();

	let versions = $state<Version[] | null>(null);
	let kept = $state<number | null | undefined>(undefined);
	let busy = $state(false);

	// Listed once when the dialog opens (it is opened anew for another file)
	onMount(() => {
		versionsOf(path)
			.then((list) => (versions = list))
			.catch((e) => {
				console.error(e);
				versions = [];
				toast(filesErrorText(e), 'error', 8000);
			});
		trashRetention().then((days) => (kept = days));
	});

	async function restore(version: Version) {
		busy = true;
		try {
			const restored = await restoreVersion(version, filesMessages().versions.restoredLabel);
			onrestored(restored);
			onclose();
		} catch (e) {
			console.error(e);
			toast(filesErrorText(e), 'error', 8000);
		} finally {
			busy = false;
		}
	}
</script>

<Modal {onclose} {busy} labelledby="versions-title">
	<div class="modal-box flex max-w-lg flex-col gap-3">
		<h3 id="versions-title" class="text-lg font-bold">{m.versions.title(basename(path))}</h3>
		<p class="text-sm opacity-70">{m.versions.intro}{kept === undefined ? '' : ` ${m.trash.kept(kept)}`}</p>
		{#if versions === null}
			<span class="loading loading-spinner loading-sm"></span>
		{:else if !versions.length}
			<p class="text-sm">{m.versions.none}</p>
		{:else}
			<ul class="flex max-h-80 flex-col gap-1 overflow-y-auto">
				{#each versions as version (version.entry)}
					<li class="flex items-center gap-2 text-sm">
						<div class="flex min-w-0 flex-1 flex-col">
							<span>{formatDateTime(version.modified)}</span>
							<span class="text-xs opacity-60">
								{version.reason === 'deleted' ? m.versions.deleted(formatDateTime(version.time)) : m.versions.replaced(formatDateTime(version.time))} · {formatSize(version.size, intlLocale)}
							</span>
						</div>
						<button class="btn btn-sm" disabled={busy} onclick={() => restore(version)}>{m.versions.restore}</button>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="modal-action">
			<button class="btn" onclick={onclose} disabled={busy}>{m.trash.close}</button>
		</div>
	</div>
</Modal>
