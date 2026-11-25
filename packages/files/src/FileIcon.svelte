<script lang="ts">
	import { TOOL_ICONS } from '@in-browser/brand/tool-icons.js';
	import { formatsOf } from './formats.js';
	import { previewKind } from './kinds.js';

	// The one icon of a file, folder or package – in Files, the file dialog and every tool, so they look the same.
	// Packages show their tool's glyph in its color; plain files keep the icon of their kind, and a file one of our
	// tools opens carries that tool's icon as a small tile on its corner (decided by the user, 2026-11-25).

	interface Props {
		name: string;
		kind: 'file' | 'directory';
		size?: string;
		/** Not on this device: a folder opened live from another device (cloud instead of the folder) */
		remote?: boolean;
	}

	let { name, kind, size = 'size-5', remote = false }: Props = $props();

	const format = $derived(formatsOf(name, kind).find((f) => f.kind === 'package'));
	const fileKind = $derived(kind === 'directory' ? null : previewKind(name));
	/** The tool that opens this file (not one that is only offered) */
	const opener = $derived(kind === 'file' ? formatsOf(name, 'file')[0]?.tool : undefined);
</script>

{#snippet badge()}
	{#if opener}
		{@const tool = TOOL_ICONS[opener]}
		<span class="absolute -right-[8%] -bottom-[4%] flex size-[58%] items-center justify-center rounded-[22%] ring-1 ring-base-100" style:background-color={tool.color} aria-hidden="true">
			<span class="{tool.class} size-[85%] text-white"></span>
		</span>
	{/if}
{/snippet}

{#if format}
	{@const icon = TOOL_ICONS[format.tool]}
	<span class="{icon.class} {size} shrink-0" style:color={icon.color} aria-hidden="true"></span>
{:else if kind === 'directory' && remote}
	<span class="icon-[material-symbols-light--cloud-outline] text-folder {size} shrink-0" aria-hidden="true"></span>
{:else if kind === 'directory'}
	<span class="icon-[material-symbols-light--folder-outline] text-folder {size} shrink-0" aria-hidden="true"></span>
{:else}
	<span class="relative inline-flex {size} shrink-0">
		{#if fileKind === 'image'}
			<span class="icon-[material-symbols-light--image-outline] size-full" aria-hidden="true"></span>
		{:else if fileKind === 'video'}
			<span class="icon-[material-symbols-light--movie-outline] size-full" aria-hidden="true"></span>
		{:else if fileKind === 'audio'}
			<span class="icon-[material-symbols-light--music-note] size-full" aria-hidden="true"></span>
		{:else if fileKind === 'text'}
			<span class="icon-[material-symbols-light--description-outline] size-full" aria-hidden="true"></span>
		{:else}
			<span class="icon-[material-symbols-light--draft-outline] size-full" aria-hidden="true"></span>
		{/if}
		{@render badge()}
	</span>
{/if}
