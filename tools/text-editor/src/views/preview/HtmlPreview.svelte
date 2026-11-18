<script lang="ts">
	import { m } from '#lib/i18n/index.js';
	import { follow } from '../follow.svelte.js';
	import type { ViewProps } from '../types.js';
	import { htmlDocument } from './preview.js';

	// An HTML file as the page would look – without its scripts and without anything loaded from elsewhere (see
	// preview.ts). Its own colors, not the theme's: that is how the page looks.

	let { tab }: ViewProps = $props();

	const srcdoc = follow(
		() => tab,
		(text) => htmlDocument(text),
		400
	);
</script>

<iframe
	title={m.views.html}
	sandbox="allow-popups allow-popups-to-escape-sandbox"
	srcdoc={srcdoc.current}
	class="size-full border-0 bg-white"
></iframe>
