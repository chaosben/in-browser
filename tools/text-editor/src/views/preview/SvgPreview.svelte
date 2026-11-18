<script lang="ts">
	import { m } from '#lib/i18n/index.js';
	import { follow } from '../follow.svelte.js';
	import type { ViewProps } from '../types.js';

	// An SVG file as an image: only ever through `<img>` (scripts in it don't run there, as in the Files preview),
	// on a checkerboard so transparent parts show.

	let { tab }: ViewProps = $props();

	const text = follow(
		() => tab,
		(t) => t,
		300
	);
	const url = $derived(URL.createObjectURL(new Blob([text.current], { type: 'image/svg+xml' })));
	/** Address of the version that couldn't be shown (the next edit tries again) */
	let failed = $state<string | null>(null);
	const broken = $derived(failed === url);
	$effect(() => {
		const current = url;
		return () => URL.revokeObjectURL(current);
	});
</script>

<div class="checker grid size-full place-items-center overflow-auto p-4">
	{#if broken}
		<p class="bg-base-100 rounded-box p-3 text-sm opacity-80">{m.views.svgBroken}</p>
	{:else}
		<img src={url} alt={tab.name} class="max-h-full max-w-full" onerror={() => (failed = url)} />
	{/if}
</div>

<style>
	.checker {
		background-color: var(--color-base-100);
		background-image: conic-gradient(var(--color-base-200) 25%, transparent 0 50%, var(--color-base-200) 0 75%, transparent 0);
		background-size: 16px 16px;
	}
</style>
