<script lang="ts">
	// Side panel “Zoom”: its tiles
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import Tiles from './Tiles.svelte';
	import { ZOOM_TILES } from '#lib/tools/groups.js';
	import type { PanelContext } from '#lib/tools/types.js';

	let { context }: PanelProps<PanelContext> = $props();
</script>

<Tiles items={ZOOM_TILES} actions={context.actions} />
