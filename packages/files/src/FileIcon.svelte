<script lang="ts">
	import { formatsOf } from './formats.js';
	import { previewKind } from './kinds.js';

	// The one icon of a file, folder or package – in Files, the file dialog and every tool, so they look the same.

	interface Props {
		name: string;
		kind: 'file' | 'directory';
		size?: string;
	}

	let { name, kind, size = 'size-5' }: Props = $props();

	const format = $derived(formatsOf(name, kind)[0]);
	const fileKind = $derived(kind === 'directory' ? null : previewKind(name));
</script>

{#if format}
	<img src={format.icon} alt="" class="{size} shrink-0" />
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
