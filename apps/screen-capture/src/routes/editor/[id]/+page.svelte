<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { BRAND } from '#lib/brand.js';
	import ExportDialog from '#lib/components/ExportDialog.svelte';
	import Inspector from '#lib/components/Inspector.svelte';
	import OverlayEditor from '#lib/components/OverlayEditor.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import Timeline from '#lib/components/Timeline.svelte';
	import ToolPanel from '#lib/components/ToolPanel.svelte';
	import ToolRail from '#lib/components/ToolRail.svelte';
	import { importFile, isMediaFile, MEDIA_ACCEPT } from '#lib/media/media.js';
	import type { Recording } from '#lib/project/project.js';
	import { Player } from '#lib/preview/player.svelte.js';
	import { createOverlay, createZoom, FREEZE_ICON } from '#lib/project/defaults.js';
	import { applyStyle, loadStyle } from '#lib/project/styles.js';
	import { Editor } from '#lib/project/editor.svelte.js';
	import type { AnnotationKind } from '#lib/project/types.js';
	import { folderSupported, saveToFolder } from '#lib/storage/folder.js';
	import type { ToolActions } from '#lib/tools/types.js';
	import { cleanupMedia, loadProject } from '#lib/storage/opfs.js';
	import {
		addItem,
		addZoom,
		bringForward,
		bringToFront,
		clipsAt,
		insertFreeze,
		itemEnd,
		nextStepNumber,
		remove,
		removeZoom,
		sendBackward,
		trackState,
		sendToBack,
		split
	} from '#lib/timeline/ops.js';
	import { toast } from '#lib/ui/toast.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import { errorMessage, formatTime, isAbort } from '#lib/util/format.js';

	const FRAME = 1 / 30;

	let editor = $state<Editor | null>(null);
	let player = $state<Player | null>(null);
	let loadError = $state<string | null>(null);
	let dialog = $state<'record' | 'export' | null>(null);
	let importing = $state<{ name: string; progress: number } | null>(null);
	let fileInput = $state<HTMLInputElement>();
	let timeline = $state<ReturnType<typeof Timeline>>();
	let freezeSeconds = $state(3);
	let draggingFiles = $state(false);

	$effect(() => {
		const id = page.params.id;
		if (!id) return;
		let ed: Editor | null = null;
		let pl: Player | null = null;
		let disposed = false;
		(async () => {
			try {
				const project = await loadProject(id);
				pl = new Player(() => ed!.project);
				ed = new Editor(project, (clipsChanged) => (clipsChanged ? pl?.refresh() : pl?.redraw()));
				await pl.syncSources();
				if (disposed) return pl.destroy();
				editor = ed;
				player = pl;
				// Remove leftover files (e.g. aborted recordings) in the background
				cleanupMedia(project).catch(() => {});
			} catch (e) {
				loadError = m.editor.loadFailed(errorMessage(e));
			}
		})();
		return () => {
			disposed = true;
			ed?.save();
			pl?.destroy();
			editor = null;
			player = null;
		};
	});

	const previewSize = $derived.by(() => {
		if (!editor) return { width: 1280, height: 720 };
		const { width, height } = editor.project;
		const scale = Math.min(1, 1920 / width, 1080 / height);
		return { width: Math.round(width * scale), height: Math.round(height * scale) };
	});

	/** Selected items on unlocked tracks */
	function editable() {
		if (!editor) return [];
		const timeline = editor.project.timeline;
		return editor.selectedItems.filter((item) => !trackState(timeline, item.track).locked);
	}

	/**
	 * Selected items under the playhead – cutting tools then only affect those; without any
	 * (`undefined`) they affect all clips under the playhead.
	 */
	function selectedAt(t: number) {
		const ids = editable()
			.filter((item) => item.start <= t && t <= itemEnd(item))
			.map((item) => item.id);
		return ids.length ? ids : undefined;
	}

	const hasVideo = (sourceId: string) => !!editor?.source(sourceId)?.hasVideo;

	function splitAtPlayhead() {
		if (!editor || !player) return;
		const t = player.time;
		const ids = selectedAt(t);
		editor.update((tl) => split(tl, t, ids));
	}

	function holdFrame() {
		if (!editor || !player) return;
		const t = player.time;
		const ids = selectedAt(t);
		editor.update((tl) => insertFreeze(tl, t, freezeSeconds, ids, hasVideo));
		const freeze = clipsAt(editor.project.timeline, t + 0.001).find((c) => c.type === 'freeze');
		if (freeze) editor.select('item', freeze.id);
		player.seek(t);
	}

	function addAnnotation(kind: AnnotationKind) {
		if (!editor || !player) return;
		const start = player.time;
		// Same settings as the last annotation of this type
		const overlay = applyStyle(createOverlay(kind, start, start + 3, nextStepNumber(editor.project.timeline)), loadStyle(kind));
		editor.update((t) => addItem(t, overlay));
		editor.select('item', overlay.id);
	}

	/** Zoom section starting at the playhead (within the timeline) */
	function newZoomRange(length: number) {
		if (!player) return null;
		const start = player.time;
		const end = Math.min(start + length, player.duration);
		if (end - start < 0.2) {
			toast(m.editor.playheadAtEnd, 'warning');
			return null;
		}
		return { start, end };
	}

	function addZoomSegment() {
		const range = newZoomRange(4);
		if (!editor || !range) return;
		const segment = createZoom(range.start, range.end);
		editor.update((t) => addZoom(t, segment));
		if (editor.project.timeline.zoom.some((z) => z.id === segment.id)) editor.select('zoom', segment.id);
		else toast(m.editor.zoomExists, 'warning');
	}

	/** Deletes the selection (excluding locked tracks); later clips move up, with `gap` a gap remains. */
	function removeSelected(gap = false) {
		const s = editor?.selection;
		if (!editor || !s) return;
		if (s.kind === 'zoom') return editor.update((t) => removeZoom(t, s.id));
		const ids = editable().map((item) => item.id);
		if (ids.length) editor.update((t) => remove(t, ids, !gap));
	}

	function openRecordDialog() {
		player?.pause();
		dialog = 'record';
	}

	const actions: ToolActions = {
		addAnnotation,
		addZoom: addZoomSegment,
		record: openRecordDialog,
		importVideo: () => {
			if (!importing) fileInput?.click();
		}
	};

	/** After new sources: the preview loads their videos and redraws */
	async function sourcesAdded() {
		if (!player) return;
		await player.syncSources();
		player.refresh();
	}

	async function recorded(recording: Recording) {
		dialog = null;
		editor?.addRecording(recording);
		await sourcesAdded();
		toast(m.editor.recordingAdded, 'success');
	}

	/** Imports files; audio files start at `at` (default: start of the timeline). */
	async function importFiles(files: FileList | File[] | null | undefined, at = 0) {
		const media = Array.from(files ?? []).filter(isMediaFile);
		if (!media.length || !editor) return;
		try {
			for (const file of media) {
				importing = { name: file.name, progress: 0 };
				const source = await importFile(editor.project.id, file, (p) => (importing!.progress = p));
				// Append videos at the end, audio files at `at`
				editor.addSource(source, at);
				await sourcesAdded();
			}
		} catch (e) {
			toast(errorMessage(e), 'error', 8000);
		} finally {
			importing = null;
			if (fileInput) fileInput.value = '';
		}
	}

	async function saveFolder() {
		if (!editor) return;
		try {
			await editor.save();
			const name = await saveToFolder(editor.project);
			toast(m.editor.savedToFolder(name), 'success');
		} catch (e) {
			if (!isAbort(e)) toast(errorMessage(e), 'error', 8000);
		}
	}

	function onKey(e: KeyboardEvent) {
		if (!editor || !player || dialog) return;
		const target = e.target as HTMLElement;
		if (target.closest('input, select, textarea, [contenteditable]')) return;
		const mod = e.ctrlKey || e.metaKey;
		const key = e.key.toLowerCase();
		if (mod && key === 'z') {
			e.preventDefault();
			if (e.shiftKey) editor.redo();
			else editor.undo();
		} else if (mod && key === 'y') {
			e.preventDefault();
			editor.redo();
		} else if (mod && key === 'a') {
			e.preventDefault();
			editor.selectItems(editor.project.timeline.items.map((item) => item.id));
		} else if (mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && editor.selectedItem) {
			// Track of the selected item (stacking order)
			e.preventDefault();
			const id = editor.selectedItem.id;
			const up = e.key === 'ArrowUp';
			const op = e.shiftKey ? (up ? bringToFront : sendToBack) : up ? bringForward : sendBackward;
			editor.update((t) => op(t, id));
		} else if (mod) {
			return;
		} else if (e.key === ' ' || key === 'k') {
			e.preventDefault();
			player.toggle();
		} else if (key === 's') {
			splitAtPlayhead();
		} else if (key === 'f') {
			holdFrame();
		} else if (e.key === 'Escape') {
			editor.selection = null;
		} else if (e.key === 'Delete' || e.key === 'Backspace') {
			removeSelected(e.shiftKey);
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			player.seek(player.time - (e.shiftKey ? 1 : FRAME));
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			player.seek(player.time + (e.shiftKey ? 1 : FRAME));
		} else if (e.key === 'Home') {
			player.seek(0);
		} else if (e.key === 'End') {
			player.seek(player.duration);
		}
	}

	function onDragOver(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		draggingFiles = true;
	}

	function onDrop(e: DragEvent) {
		draggingFiles = false;
		if (!e.dataTransfer?.files.length) return;
		e.preventDefault();
		// Dragged onto the timeline: audio files start at the drop position
		const onTimeline = (e.target as HTMLElement).closest('[data-timeline]');
		importFiles(e.dataTransfer.files, onTimeline && timeline ? timeline.timeAtClient(e.clientX) : 0);
	}
</script>

<svelte:window onkeydown={onKey} />
<svelte:head><title>{editor?.project.name ?? m.editor.title} · {BRAND.tool}</title></svelte:head>

{#if loadError}
	<main class="mx-auto max-w-xl p-10">
		<div role="alert" class="alert alert-error">{loadError}</div>
		<a class="btn mt-4" href={resolve('/')}>{m.editor.backToOverview}</a>
	</main>
{:else if !editor || !player}
	<main class="grid h-full place-items-center"><span class="loading loading-spinner loading-lg"></span></main>
{:else}
	<div
		class="relative flex h-full flex-col overflow-hidden"
		ondragover={onDragOver}
		ondragleave={(e) => {
			if (e.currentTarget === e.target) draggingFiles = false;
		}}
		ondrop={onDrop}
		role="application"
	>
		<nav class="navbar bg-base-200 min-h-0 gap-2 px-3 py-1">
			<a class="btn btn-ghost btn-sm" href={resolve('/')} aria-label={m.editor.backToOverview}>
				<span class="icon-[material-symbols-light--arrow-back] size-6" aria-hidden="true"></span>
			</a>
			<input
				class="input input-ghost input-sm w-64 font-semibold"
				value={editor.project.name}
				onchange={(e) => editor?.rename(e.currentTarget.value)}
				aria-label={m.editor.projectName}
			/>
			<span class="text-xs opacity-50">{editor.saving ? m.common.saving : m.common.saved}</span>
			<div class="ml-auto flex flex-wrap items-center gap-2">
				{#if folderSupported()}
					<button class="btn btn-sm btn-ghost" onclick={saveFolder}>
						<span class="icon-[material-symbols-light--save-outline] size-5" aria-hidden="true"></span> {m.editor.saveFolder}
					</button>
				{/if}
				<button
					class="btn btn-sm btn-primary"
					disabled={player.duration === 0}
					onclick={() => {
						player?.pause();
						dialog = 'export';
					}}
				>
					<span class="icon-[material-symbols-light--download] size-5" aria-hidden="true"></span> {m.editor.export}
				</button>
			</div>
			<input
				bind:this={fileInput}
				type="file"
				accept={MEDIA_ACCEPT}
				multiple
				hidden
				onchange={(e) => importFiles(e.currentTarget.files)}
			/>
		</nav>

		{#if importing}
			<div class="bg-base-200 flex items-center gap-3 px-4 pb-2 text-sm">
				{m.common.importing(importing.name)}
				<progress class="progress progress-primary w-64" value={importing.progress} max="1"></progress>
			</div>
		{/if}

		<div class="flex min-h-0 flex-1">
			<ToolRail />
			<ToolPanel {editor} {player} {actions} />

			<section class="flex min-w-0 flex-1 flex-col">
				<!-- Preview with editing layer -->
				<div class="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4 [container-type:size]">
					<div
						class="relative shadow-lg"
						style="width: min(100cqw, calc(100cqh * {previewSize.width / previewSize.height})); aspect-ratio: {previewSize.width} / {previewSize.height}"
					>
						<canvas
							width={previewSize.width}
							height={previewSize.height}
							class="block h-full w-full bg-black"
							{@attach (canvas) => player?.attach(canvas)}
						></canvas>
						<OverlayEditor {editor} {player} />
					</div>
				</div>
			</section>

			<aside class="bg-base-200 border-base-300 flex w-80 shrink-0 flex-col border-l">
				<h2 class="flex items-center gap-1 px-3 py-2 text-sm font-semibold">
					<span class="icon-[material-symbols-light--tune] size-5" aria-hidden="true"></span> {m.editor.properties}
				</h2>
				<div class="min-h-0 flex-1 overflow-y-auto">
					<Inspector {editor} />
				</div>
			</aside>
		</div>

		<section class="flex flex-col gap-2 p-3">
			<div class="flex flex-wrap items-center gap-2">
				<button class="btn btn-sm btn-ghost" onclick={() => player?.seek(0)} aria-label={m.editor.toStart}>
					<span class="icon-[material-symbols-light--skip-previous] size-6" aria-hidden="true"></span>
				</button>
				<button class="btn btn-sm btn-primary w-28" onclick={() => player?.toggle()}>
					{#if player.playing}
						<span class="icon-[material-symbols-light--pause] size-5" aria-hidden="true"></span> {m.editor.pause}
					{:else}
						<span class="icon-[material-symbols-light--play-arrow] size-5" aria-hidden="true"></span> {m.editor.play}
					{/if}
				</button>
				<span class="font-mono text-sm tabular-nums">
					{formatTime(player.time, 2)} / {formatTime(player.duration, 2)}
				</span>
				<div class="divider divider-horizontal mx-1"></div>
				<button class="btn btn-sm" onclick={splitAtPlayhead}>
					<span class="icon-[material-symbols-light--content-cut] size-5" aria-hidden="true"></span> {m.editor.split}
					<kbd class="kbd kbd-xs">S</kbd>
				</button>
				<div class="join">
					<button class="btn btn-sm join-item" onclick={holdFrame} title={m.editor.holdFrameTitle}>
						<span class="{FREEZE_ICON} size-5" aria-hidden="true"></span> {m.editor.holdFrame}
						<kbd class="kbd kbd-xs">F</kbd>
					</button>
					<select class="select select-sm join-item w-20" bind:value={freezeSeconds} aria-label={m.editor.freezeDuration}>
						{#each [1, 2, 3, 5, 8] as s (s)}
							<option value={s}>{s} s</option>
						{/each}
					</select>
				</div>
				<button
					class="btn btn-sm"
					onclick={(e) => removeSelected(e.shiftKey)}
					disabled={!editor.selection}
					title={m.editor.deleteTitle}
				>
					<span class="icon-[material-symbols-light--delete-outline] size-5" aria-hidden="true"></span> {m.editor.delete}
					<kbd class="kbd kbd-xs">{m.keys.del}</kbd>
				</button>
				<div class="divider divider-horizontal mx-1"></div>
				<button class="btn btn-sm btn-ghost" onclick={() => editor?.undo()} disabled={!editor.canUndo}>
					<span class="icon-[material-symbols-light--undo] size-5" aria-hidden="true"></span> {m.editor.undo}
				</button>
				<button class="btn btn-sm btn-ghost" onclick={() => editor?.redo()} disabled={!editor.canRedo}>
					<span class="icon-[material-symbols-light--redo] size-5" aria-hidden="true"></span> {m.editor.redo}
				</button>
			</div>

			<Timeline bind:this={timeline} {editor} {player} />
		</section>

		{#if draggingFiles}
			<div
				class="border-primary bg-base-300/80 pointer-events-none absolute inset-2 z-40 grid place-items-center rounded-box border-4 border-dashed"
			>
				<div class="flex flex-col items-center gap-2 text-lg font-semibold">
					<span class="icon-[material-symbols-light--upload-file] size-12" aria-hidden="true"></span>
					{m.editor.dropToImport}
				</div>
			</div>
		{/if}
	</div>

	{#if dialog === 'record'}
		<RecordDialog projectId={editor.project.id} ondone={recorded} oncancel={() => (dialog = null)} />
	{:else if dialog === 'export'}
		<ExportDialog project={editor.project} onclose={() => (dialog = null)} />
	{/if}
{/if}
