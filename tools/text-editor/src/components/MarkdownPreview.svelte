<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { theme } from '@in-browser/brand/theme.svelte.js';
	import { locale, m } from '#lib/i18n/index.js';
	import { previewDocument, type PreviewColors } from '#lib/preview.js';
	import type { Tab } from '#lib/workspace.svelte.js';

	// Markdown of the tab, rendered in a sandboxed frame (see preview.ts); follows typing with a short delay.

	let { tab }: { tab: Tab } = $props();

	const dark = new MediaQuery('(prefers-color-scheme: dark)');
	let markdown = $state('');

	/** Tab shown last: another tab appears at once, typing is debounced */
	let shown: string | null = null;

	$effect(() => {
		void tab.version;
		const current = tab;
		const timer = setTimeout(
			() => {
				shown = current.id;
				markdown = current.state.doc.toString();
			},
			shown === current.id ? 250 : 0
		);
		return () => clearTimeout(timer);
	});

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

	const srcdoc = $derived(previewDocument(markdown, colors, locale));
</script>

<iframe
	title={m.preview.title}
	sandbox="allow-popups allow-popups-to-escape-sandbox"
	{srcdoc}
	class="bg-base-100 size-full border-0"
></iframe>
