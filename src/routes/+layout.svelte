<script lang="ts">
	import './layout.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<!-- Shared by the overview (frame `#lib/Shell.svelte`) and every tool (`/<tool>/+layout.svelte`) -->
{@render children()}
