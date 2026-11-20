<script lang="ts">
	// Side panel “Media”: record or import, then the media bin
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import MediaBin from './MediaBin.svelte';
	import type { BinEntry, PanelContext } from '#lib/tools/types.js';
	import { IMAGE_SECONDS } from '#lib/project/project.js';
	import { m } from '#lib/i18n/index.js';

	let { context }: PanelProps<PanelContext> = $props();

	/** Inserts the entries at the playhead, one after another; the playhead stays where it was */
	function insert(entries: BinEntry[]) {
		const { editor, player, actions } = context;
		const from = player.time;
		let at = from;
		for (const entry of entries) {
			if (entry.kind === 'source') {
				editor.insertSource(entry.id, at);
				at += entry.source.duration;
			} else {
				actions.addImage(entry.id, entries.length > 1 ? { start: at } : {});
				at += IMAGE_SECONDS;
			}
		}
		if (entries.length > 1) player.seek(from);
	}
</script>

<div class="flex flex-col gap-2 px-3 pt-3">
	<button class="btn btn-sm btn-primary" onclick={() => context.actions.record()}>
		<span class="icon-[material-symbols-light--screen-record-outline] size-5" aria-hidden="true"></span> {m.editor.addRecording}
	</button>
	<button class="btn btn-sm" onclick={() => context.actions.importMedia()}>
		<span class="icon-[material-symbols-light--upload-file] size-5" aria-hidden="true"></span> {m.editor.importMedia}
	</button>
	<button class="btn btn-sm" onclick={() => context.actions.importFromFiles()}>
		<span class="icon-[material-symbols-light--folder-open-outline] size-5" aria-hidden="true"></span> {m.editor.importFromFiles}
	</button>
	<p class="text-xs opacity-60">{m.tools.dropHint}</p>
</div>
<MediaBin editor={context.editor} oninsert={insert} onremoved={() => context.player.syncSources()} />
