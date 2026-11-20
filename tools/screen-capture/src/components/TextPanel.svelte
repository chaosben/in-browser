<script lang="ts">
	// Side panel “Text”: its tiles
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import Tiles from './Tiles.svelte';
	import { TEXT_TILES } from '#lib/tools/groups.js';
	import type { PanelContext } from '#lib/tools/types.js';

	let { context }: PanelProps<PanelContext> = $props();
</script>

<Tiles items={TEXT_TILES} actions={context.actions} />
