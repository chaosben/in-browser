<script lang="ts">
	// The suite as long as the tab lives, placed once by the app's root layout – under every page, the overview's
	// as well as a tool's: what runs for the tab (`suite.ts`) and the overlays any page may ask for (messages,
	// questions, menus, the file dialog, the settings, sharing, the update banner). A page's own frame
	// (`ToolLayout`, the overview's `Shell`) holds only what the page looks like.
	import { untrack } from 'svelte';
	import ConfirmDialog from '@in-browser/brand/ConfirmDialog.svelte';
	import ContextMenu from '@in-browser/brand/ContextMenu.svelte';
	import type { ToolSlug } from '@in-browser/brand/i18n/index.svelte.js';
	import { navigate } from '@in-browser/brand/navigate.js';
	import Toasts from '@in-browser/brand/Toasts.svelte';
	import UpdateBanner from '@in-browser/brand/UpdateBanner.svelte';
	import FileDialog from './FileDialog.svelte';
	import OpenShareDialog from './OpenShareDialog.svelte';
	import { takeReceived } from './receive.svelte.js';
	import SettingsDialog from './SettingsDialog.svelte';
	import ShareDialog from './ShareDialog.svelte';
	import { shareDialog } from './share-dialog.svelte.js';
	import { startSuite } from './suite.js';

	interface Props {
		/** `?received=<id>` of the page's address: files from another app wait to be taken */
		received: string | null;
		/** The tool the page belongs to; `null` on the overview and the help pages */
		tool: ToolSlug | null;
	}

	let { received, tool }: Props = $props();

	startSuite();

	// Files from other apps, shared to the installed suite or opened with it (`?received=<id>`): taken on whatever
	// page the address names them – after the page registered its receiver (it does so when it is created)
	$effect(() => {
		// Also when only the tool changed: what was handed on to its tool arrives there under the same id
		const [id, on] = [received, tool];
		if (id) untrack(() => void takeReceived(on, id));
	});
</script>

<Toasts />
<ConfirmDialog />
<ContextMenu />
<FileDialog />
<SettingsDialog />
<UpdateBanner />
{#if shareDialog.target}
	{#key shareDialog.target}<ShareDialog target={shareDialog.target} onclose={() => (shareDialog.target = null)} />{/key}
{/if}
{#if shareDialog.opening}
	<OpenShareDialog
		onclose={() => (shareDialog.opening = false)}
		onopened={(root) => {
			shareDialog.opening = false;
			// Files shows it (and opens a single shared file in its tool)
			navigate(`/files?path=${encodeURIComponent(root)}&open`);
		}}
	/>
{/if}
