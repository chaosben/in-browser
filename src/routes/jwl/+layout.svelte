<script lang="ts">
	import Layout from '@in-browser/jwl-app/pages/Layout.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<Layout>{@render children()}</Layout>
