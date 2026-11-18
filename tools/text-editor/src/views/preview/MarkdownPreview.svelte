<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { theme } from '@in-browser/brand/theme.svelte.js';
	import { locale, m } from '#lib/i18n/index.js';
	import { follow } from '../follow.svelte.js';
	import type { ViewProps } from '../types.js';
	import { previewDocument, type PreviewColors } from './preview.js';

	// Markdown of the tab, rendered in a sandboxed frame (see preview.ts); follows typing with a short delay.

	let { tab }: ViewProps = $props();

	const markdown = follow(
		() => tab,
		(text) => text
	);
	const dark = new MediaQuery('(prefers-color-scheme: dark)');

	// The frame can't see the page's CSS variables: hand over the theme's current colors
	const colors = $derived.by((): PreviewColors => {
		void theme.choice;
		void dark.current;
		const style = getComputedStyle(document.documentElement);
		const css = (name: string) => style.getPropertyValue(`--color-${name}`).trim();
		const mix = (name: string, percent: number) => `color-mix(in oklch, ${css(name)} ${percent}%, transparent)`;
		return {
			background: css('base-100'),
			text: css('base-content'),
			muted: mix('base-content', 70),
			border: css('base-300'),
			surface: css('base-200'),
			link: css('primary')
		};
	});

	const srcdoc = $derived(previewDocument(markdown.current, colors, locale));
</script>

<iframe
	title={m.views.markdown}
	sandbox="allow-popups allow-popups-to-escape-sandbox"
	{srcdoc}
	class="bg-base-100 size-full border-0"
></iframe>
