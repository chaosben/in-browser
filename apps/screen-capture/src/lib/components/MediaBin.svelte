<script lang="ts">
	import { untrack } from 'svelte';
	import { thumbnails } from '#lib/media/visuals.js';
	import type { Editor } from '#lib/project/editor.svelte.js';
	import type { Source } from '#lib/project/types.js';
	import { setDragPayload } from '#lib/tools/drag.js';
	import { ask } from '#lib/ui/confirm.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import { formatTime } from '#lib/util/format.js';

	interface Props {
		editor: Editor;
		/** Insert source into the timeline (at the playhead) */
		oninsert: (sourceId: string) => void;
		/** After a source is permanently deleted (the preview must dispose of its videos) */
		onremoved: () => void;
	}

	let { editor, oninsert, onremoved }: Props = $props();

	function preview(canvas: HTMLCanvasElement, source: Source) {
		let cancelled = false;
		// Depend only on the source, not on every project change
		const projectId = untrack(() => editor.project.id);
		thumbnails(projectId, source).then((thumbs) => {
			const image = thumbs?.images[Math.floor(thumbs.images.length / 3)];
			const ctx = canvas.getContext('2d');
			if (cancelled || !image || !ctx) return;
			canvas.width = image.width;
			canvas.height = image.height;
			ctx.drawImage(image, 0, 0);
		});
		return () => (cancelled = true);
	}

	async function removeSource(source: Source) {
		const message = editor.isSourceInHistory(source.id)
			? m.mediaBin.confirmDeleteHistory(source.name)
			: m.mediaBin.confirmDelete(source.name);
		if (!(await ask({ title: m.mediaBin.deleteTitle, message, confirm: m.common.delete, danger: true }))) return;
		await editor.removeSource(source.id);
		onremoved();
	}
</script>

<div class="flex flex-col gap-2 p-3">
	{#if editor.project.sources.length === 0}
		<p class="text-xs opacity-60">{m.mediaBin.empty}</p>
	{/if}
	{#each editor.project.sources as source (source.id)}
		{@const used = editor.isSourceInTimeline(source.id)}
		<div
			class="bg-base-100 rounded-box flex cursor-grab gap-2 p-2"
			title={m.mediaBin.dragHint}
			draggable="true"
			ondragstart={(e) => setDragPayload(e, { type: 'source', id: source.id })}
			role="group"
			aria-label={source.name}
		>
			{#if source.hasVideo}
				<canvas class="h-12 w-20 shrink-0 rounded bg-black object-cover" {@attach (c) => preview(c, source)}></canvas>
			{:else}
				<div class="bg-base-300 grid h-12 w-20 shrink-0 place-items-center rounded" title={m.mediaBin.audioOnly}>
					<span class="icon-[material-symbols-light--graphic-eq] size-7 opacity-70" aria-hidden="true"></span>
				</div>
			{/if}
			<div class="flex min-w-0 flex-1 flex-col">
				<span class="truncate text-xs font-semibold" title={source.name}>{source.name}</span>
				<span class="text-[10px] opacity-60">
					{formatTime(source.duration, 0)} ·
					{source.hasVideo ? `${source.width}×${source.height}` : m.mediaBin.audioOnly}{source.hasAudio ? '' : ` · ${m.mediaBin.noAudio}`}
				</span>
				<div class="mt-auto flex gap-1">
					<button class="btn btn-xs" onclick={() => oninsert(source.id)} title={m.mediaBin.insertTitle}>
						<span class="icon-[material-symbols-light--playlist-add] size-4" aria-hidden="true"></span> {m.mediaBin.insert}
					</button>
					<button
						class="btn btn-xs btn-ghost text-error"
						disabled={used}
						onclick={() => removeSource(source)}
						title={used ? m.mediaBin.inUse : m.mediaBin.deleteForever}
						aria-label={m.mediaBin.deleteForever}
					>
						<span class="icon-[material-symbols-light--delete-forever-outline] size-4" aria-hidden="true"></span>
					</button>
				</div>
			</div>
		</div>
	{/each}
</div>
