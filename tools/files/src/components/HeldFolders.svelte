<script lang="ts">
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { basename } from '@in-browser/files/path.js';
	import { openSettings, suiteSettings } from '@in-browser/files/suite-settings.svelte.js';
	import type { HeldFolder } from '@in-browser/files/sync/plan.js';
	import { intlLocale, m } from '#lib/i18n/index.js';

	// New folders held back before they arrive (large, or more than fits): sync them after all or leave them out.
	// Shared by the folder on disk and the devices in the sync dialog.

	interface Props {
		folders: HeldFolder[];
		onsync: (path: string) => Promise<void>;
		onexclude: (path: string) => Promise<void>;
	}

	let { folders, onsync, onexclude }: Props = $props();

	const limit = $derived(suiteSettings.values.sync.askAbove);

	async function run(action: () => Promise<void>) {
		try {
			await action();
		} catch (e) {
			console.error(e);
			toast(m.devices.failed(e instanceof Error ? e.message : String(e)), 'error', 8000);
		}
	}
</script>

{#each folders as folder (folder.path)}
	<div class="alert alert-warning flex-col items-start gap-1 p-2 text-xs">
		<span>{m.held.waiting(basename(folder.path), formatSize(folder.bytes, intlLocale))}</span>
		<span class="opacity-80">
			{#if folder.full}{m.held.full}{:else if limit !== null}{m.held.why(formatSize(limit, intlLocale))}{/if}
			<button class="link" onclick={() => openSettings('sync')}>{m.held.limit}</button>
		</span>
		<div class="flex flex-wrap gap-1">
			<button class="btn btn-xs" onclick={() => run(() => onsync(folder.path))}>{m.held.sync}</button>
			<button class="btn btn-xs" onclick={() => run(() => onexclude(folder.path))}>{m.held.exclude}</button>
		</div>
	</div>
{/each}
