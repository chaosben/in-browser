<script lang="ts">
	import { m } from '#lib/i18n/index.js';
	import type { Tab } from '#lib/tab.svelte.js';
	import type { ViewSpec } from './registry.js';
	import type { ViewHost } from './types.js';

	// Loads a view (component and format, only when a file needs it) and shows it for the file.

	let { tab, spec, host }: { tab: Tab; spec: ViewSpec; host: ViewHost } = $props();

	const loaded = $derived(
		Promise.all([spec.component(), spec.format?.()]).catch((e: unknown) => {
			console.error(e);
			throw e;
		})
	);
</script>

{#await loaded}
	<div class="grid size-full place-items-center"><span class="loading loading-spinner"></span></div>
{:then [View, format]}
	<!-- A new instance per file: views keep selection, filters and open nodes of the file they show -->
	{#key tab}
		<View {tab} {host} {format} />
	{/key}
{:catch e}
	<div role="alert" class="alert alert-error m-4">{m.views.loadFailed} {e instanceof Error ? e.message : ''}</div>
{/await}
