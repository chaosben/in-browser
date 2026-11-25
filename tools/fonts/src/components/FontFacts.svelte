<script lang="ts">
	// What a font file says about itself: style, weight, characters, version, designer, copyright, license and its
	// flag about embedding (shown, never enforced)
	import type { FontFileInfo } from '@in-browser/graphics/user-fonts.svelte.js';
	import { m } from '#lib/i18n/index.js';

	let { info }: { info: FontFileInfo } = $props();

	const rows = $derived(
		(
			[
				[m.family.file, info.name],
				[m.family.style, info.style],
				[m.family.weight, String(info.weight)],
				[m.family.glyphs, String(info.glyphs)],
				[m.family.version, info.version],
				[m.family.designer, info.designer],
				[m.family.copyright, info.copyright],
				[m.family.license, info.license],
				[m.family.embedding, m.family.embeddings[info.embedding]]
			] as [string, string | undefined][]
		).filter((r): r is [string, string] => !!r[1])
	);
</script>

<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
	{#each rows as [label, value] (label)}
		<dt class="opacity-70">{label}</dt>
		<dd class="min-w-0 break-words">{value}</dd>
	{/each}
</dl>
