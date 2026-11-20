<script lang="ts">
	// The panel “Shares” of Files: folders this device shares with a guest
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import SharesSection from '#lib/components/SharesSection.svelte';
	import type { FilesPanelContext } from './context.js';

	let { context }: PanelProps<FilesPanelContext> = $props();
</script>

<SharesSection onshare={context.openShare} menu={context.shareMenu} onnew={context.shareNew} />
