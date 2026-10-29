<script lang="ts">
	import MediaBin from './MediaBin.svelte';
	import type { ToolProps } from '#lib/tools/types.js';
	import { m } from '#lib/i18n/index.js';

	let { editor, player, actions }: ToolProps = $props();
</script>

<div class="flex flex-col gap-2 px-3 pt-3">
	<button class="btn btn-sm btn-primary" onclick={() => actions.record()}>
		<span class="icon-[material-symbols-light--screen-record-outline] size-5" aria-hidden="true"></span> {m.editor.addRecording}
	</button>
	<button class="btn btn-sm" onclick={() => actions.importMedia()}>
		<span class="icon-[material-symbols-light--upload-file] size-5" aria-hidden="true"></span> {m.editor.importMedia}
	</button>
	<p class="text-xs opacity-60">{m.tools.dropHint}</p>
</div>
<MediaBin
	{editor}
	oninsert={(id) => editor.insertSource(id, player.time)}
	oninsertImage={(id) => actions.addImage(id)}
	onremoved={() => player.syncSources()}
/>
