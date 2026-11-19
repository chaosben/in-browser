<script lang="ts">
	import { TOOL_ICONS } from '@in-browser/brand/tool-icons.js';
	import { formatsOf } from './formats.js';
	import { previewKind } from './kinds.js';

	// The one icon of a file, folder or package – in Files, the file dialog and every tool, so they look the same.
	// Packages show their tool's glyph in its color; plain files keep the icon of their kind even if a tool opens them.

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
</script>

{#if format}
	{@const icon = TOOL_ICONS[format.tool]}
	<span class="{icon.class} {size} shrink-0" style:color={icon.color} aria-hidden="true"></span>
{:else if kind === 'directory' && remote}
	<span class="icon-[material-symbols-light--cloud-outline] text-folder {size} shrink-0" aria-hidden="true"></span>
{:else if kind === 'directory'}
	<span class="icon-[material-symbols-light--folder-outline] text-folder {size} shrink-0" aria-hidden="true"></span>
{:else if fileKind === 'image'}
	<span class="icon-[material-symbols-light--image-outline] {size} shrink-0" aria-hidden="true"></span>
{:else if fileKind === 'video'}
	<span class="icon-[material-symbols-light--movie-outline] {size} shrink-0" aria-hidden="true"></span>
{:else if fileKind === 'audio'}
	<span class="icon-[material-symbols-light--music-note] {size} shrink-0" aria-hidden="true"></span>
{:else if fileKind === 'text'}
	<span class="icon-[material-symbols-light--description-outline] {size} shrink-0" aria-hidden="true"></span>
{:else}
	<span class="icon-[material-symbols-light--draft-outline] {size} shrink-0" aria-hidden="true"></span>
{/if}
