<script lang="ts">
	import { m } from '#lib/i18n/index.js';
	import type { Tab } from '#lib/workspace.svelte.js';
	import type { ViewHost } from './types.js';

	// The text doesn't parse: the view shows its last good state (read-only) until the text is fixed.

	let { tab, host, pos, stale }: { tab: Tab; host: ViewHost; pos: number; stale: boolean } = $props();

	const line = $derived(tab.state.doc.lineAt(Math.min(pos, tab.state.doc.length)).number);
</script>

<div role="alert" class="alert alert-warning rounded-none py-2 text-sm">
	<span class="icon-[material-symbols-light--warning-outline] size-5" aria-hidden="true"></span>
	<span>{stale ? m.views.errorStale(line) : m.views.error(line)}</span>
	<button class="btn btn-sm" onclick={() => host.showText(pos)}>{m.views.showError}</button>
</div>
