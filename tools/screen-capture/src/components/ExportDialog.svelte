<script lang="ts">
	import { filesUrl } from '@in-browser/files/formats.js';
	import { checkEncodable, ExportCanceledError, exportProject } from '#lib/export/exporter.js';
	import {
		estimateBytes,
		fitToProject,
		FORMATS,
		GIF_FRAME_RATES,
		GIF_WIDTHS,
		gifIsLarge,
		gifSize,
		loadSettings,
		outputSize,
		QUALITY_LABELS,
		RESOLUTIONS,
		SCALES,
		storeSettings,
		videoBitrate,
		type QualityPreset
	} from '#lib/export/settings.js';
	import { canWriteWebp, IMAGE_FORMAT_IDS } from '@in-browser/graphics/image-formats.js';
	import { END_ACTIONS } from '@in-browser/jwl/playlist.js';
	import { onMount } from 'svelte';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { chooseFile } from '@in-browser/files/dialog.svelte.js';
	import { writable } from '@in-browser/files/fs.js';
	import { filesErrorText, formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { extname, parent } from '@in-browser/files/path.js';
	import type { Project } from '#lib/project/types.js';
	import { duration } from '#lib/timeline/ops.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import { errorMessage, formatTime } from '#lib/util/format.js';
	import { downloadUrl } from '@in-browser/brand/download.js';

	interface Props {
		project: Project;
		/** The playhead: where “Picture” takes its picture */
		at: number;
		onclose: () => void;
	}

	let { project, at, onclose }: Props = $props();
	let webp = $state(true);
	onMount(() => {
		void canWriteWebp().then((ok) => {
			webp = ok;
			if (!ok && settings.picture === 'webp') settings.picture = 'png';
		});
	});

	// The dialog is opened for one project
	// svelte-ignore state_referenced_locally
	let settings = $state(fitToProject(loadSettings(), project.width, project.height));
	let phase = $state<'settings' | 'running' | 'done'>('settings');
	let progress = $state(0);
	let finalizing = $state(false);
	let error = $state<string | null>(null);
	let unsupported = $state<string | null>(null);
	let result = $state<{ file: File; url: string; name: string; size: number; seconds: number } | null>(null);
	let controller: AbortController | null = null;
	let dialog: HTMLDialogElement;

	const total = $derived(duration(project.timeline));
	const isGif = $derived(settings.format === 'gif');
	const isPicture = $derived(settings.format === 'picture');
	const isPlaylist = $derived(settings.format === 'playlist');
	const size = $derived(
		isGif ? gifSize(settings, project.width, project.height) : outputSize(settings, project.width, project.height)
	);
	const bitrate = $derived(videoBitrate(settings, size.width, size.height));
	const estimate = $derived(estimateBytes(settings, size.width, size.height, total));
	const resolutions = $derived(RESOLUTIONS.filter((h) => h < project.height));
	const gifWidths = $derived(GIF_WIDTHS.filter((w) => w < project.width));
	const hasAudio = $derived(project.sources.some((s) => s.hasAudio));

	// Percent and fixed size in one select: '50%' = percent of the canvas, '720' = fixed size, '0' = original
	const sizeKey = (scale: number, fixed: number) => (scale < 100 ? `${scale}%` : String(fixed));
	const parseSizeKey = (key: string) =>
		key.endsWith('%') ? { scale: parseInt(key), fixed: 0 } : { scale: 100, fixed: Number(key) };

	function setResolution(key: string) {
		const { scale, fixed } = parseSizeKey(key);
		settings.scale = scale;
		settings.height = fixed;
	}

	function setGifWidth(key: string) {
		const { scale, fixed } = parseSizeKey(key);
		settings.gifScale = scale;
		settings.gifWidth = fixed;
	}

	$effect(() => {
		dialog.showModal();
		return () => {
			controller?.abort();
			if (result) URL.revokeObjectURL(result.url);
		};
	});

	$effect(() => {
		storeSettings(settings);
		const snapshot = $state.snapshot(settings);
		let stale = false;
		checkEncodable(project, snapshot).then((msg) => {
			if (!stale) unsupported = msg;
		});
		return () => (stale = true);
	});

	async function run() {
		error = null;
		phase = 'running';
		progress = 0;
		finalizing = false;
		controller = new AbortController();
		const started = performance.now();
		try {
			const file = await exportProject(
				project,
				$state.snapshot(settings),
				(p) => {
					progress = p.progress;
					finalizing = p.phase === 'finalizing';
				},
				controller.signal,
				at
			);
			if (result) URL.revokeObjectURL(result.url);
			result = {
				file,
				url: URL.createObjectURL(file),
				name: file.name,
				size: file.size,
				seconds: (performance.now() - started) / 1000
			};
			phase = 'done';
		} catch (e) {
			phase = 'settings';
			if (!(e instanceof ExportCanceledError)) {
				console.error('[screen-capture] export', e);
				error = errorMessage(e);
			}
		} finally {
			controller = null;
		}
	}

	/** Keeps the file in the shared file system (next to the project by default) */
	async function saveToFiles() {
		if (!result) return;
		const path = await chooseFile({
			mode: 'save',
			folder: parent(project.id),
			accept: [extname(result.name)],
			name: result.name,
			overwrite: true
		});
		if (!path) return;
		try {
			await result.file.stream().pipeTo(await writable(path));
			// The suite has no player of its own: Files shows the file in its folder (in a new tab, the editor stays)
			toast(m.export.savedToFiles(path), 'success', 8000, {
				label: m.export.showInFiles,
				run: () => void window.open(filesUrl(path), '_blank')
			});
		} catch (e) {
			console.error('[screen-capture] save export', e);
			toast(filesErrorText(e), 'error', 8000);
		}
	}

	function download() {
		if (result) downloadUrl(result.url, result.name);
	}

	function close() {
		controller?.abort();
		onclose();
	}
</script>

<dialog bind:this={dialog} class="modal" oncancel={(e) => { e.preventDefault(); if (phase !== 'running') close(); }}>
	<div class="modal-box max-w-lg">
		<h3 class="text-lg font-bold">{m.export.title}</h3>

		{#if phase === 'settings'}
			<fieldset class="fieldset mt-2 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3">
				<span class="label">{m.export.format}</span>
				<div class="join">
					{#each FORMATS as format (format)}
						<input
							class="join-item btn btn-sm"
							type="radio"
							name="format"
							aria-label={m.export.formats[format]}
							value={format}
							bind:group={settings.format}
						/>
					{/each}
				</div>

				{#if isGif}
					<span class="label">{m.export.width}</span>
					<select class="select select-sm" bind:value={() => sizeKey(settings.gifScale, settings.gifWidth), setGifWidth}>
						<option value="0">{m.export.original(project.width, project.height)}</option>
						{#each SCALES as scale (scale)}
							{@const s = gifSize({ gifWidth: 0, gifScale: scale }, project.width, project.height)}
							<option value="{scale}%">{m.export.scale(scale, s.width, s.height)}</option>
						{/each}
						{#each gifWidths as w (w)}
							<option value={String(w)}>{w} px</option>
						{/each}
					</select>

					<span class="label">{m.export.frameRate}</span>
					<select class="select select-sm" bind:value={settings.gifFps}>
						{#each GIF_FRAME_RATES as fps (fps)}
							<option value={fps}>{fps} fps</option>
						{/each}
					</select>

					<span></span>
					<label class="label">
						<input type="checkbox" class="checkbox checkbox-sm" bind:checked={settings.gifLoop} />
						{m.export.loop}
					</label>
				{:else if isPicture}
					<span class="label">{m.export.pictureFormat}</span>
					<div class="join">
						{#each IMAGE_FORMAT_IDS as format (format)}
							<input
								class="join-item btn btn-sm"
								type="radio"
								name="picture"
								aria-label={m.export.pictureFormats[format]}
								title={format === 'webp' && !webp ? m.export.noWebp : undefined}
								value={format}
								disabled={format === 'webp' && !webp}
								bind:group={settings.picture}
							/>
						{/each}
					</div>

					<span class="label">{m.export.resolution}</span>
					<select class="select select-sm" bind:value={() => sizeKey(settings.scale, settings.height), setResolution}>
						<option value="0">{m.export.original(project.width, project.height)}</option>
						{#each SCALES as scale (scale)}
							{@const s = outputSize({ height: 0, scale }, project.width, project.height)}
							<option value="{scale}%">{m.export.scale(scale, s.width, s.height)}</option>
						{/each}
						{#each resolutions as h (h)}
							<option value={String(h)}>{h}p</option>
						{/each}
					</select>
				{:else}
					<span class="label">{m.export.resolution}</span>
					<select class="select select-sm" bind:value={() => sizeKey(settings.scale, settings.height), setResolution}>
						<option value="0">{m.export.original(project.width, project.height)}</option>
						{#each SCALES as scale (scale)}
							{@const s = outputSize({ height: 0, scale }, project.width, project.height)}
							<option value="{scale}%">{m.export.scale(scale, s.width, s.height)}</option>
						{/each}
						{#each resolutions as h (h)}
							<option value={String(h)}>{h}p</option>
						{/each}
					</select>

					<span class="label">{m.export.quality}</span>
					<div class="join">
						{#each Object.entries(QUALITY_LABELS) as [value, label] (value)}
							<input
								class="join-item btn btn-sm"
								type="radio"
								name="quality"
								aria-label={label}
								value={value}
								checked={settings.quality === value}
								onchange={() => (settings.quality = value as QualityPreset)}
							/>
						{/each}
					</div>

					{#if settings.quality === 'custom'}
						<span class="label">{m.export.bitrate}</span>
						<label class="input input-sm w-40">
							<input type="number" min="0.2" max="100" step="0.1" bind:value={settings.customMbps} />
							<span class="label">Mbit/s</span>
						</label>
					{/if}

					<span class="label">{m.export.frameRate}</span>
					<select class="select select-sm" bind:value={settings.fps}>
						{#each [15, 24, 30, 60] as fps (fps)}
							<option value={fps}>{fps} fps</option>
						{/each}
					</select>

					<span class="label">{m.export.audio}</span>
					<select class="select select-sm" bind:value={settings.audioKbps} disabled={!hasAudio}>
						<option value={0}>{m.export.noAudio}</option>
						<option value={96}>96 kbit/s</option>
						<option value={128}>128 kbit/s</option>
						<option value={192}>192 kbit/s</option>
						<option value={256}>256 kbit/s</option>
					</select>

					{#if isPlaylist}
						<span class="label">{m.export.endAction}</span>
						<select class="select select-sm" bind:value={settings.endAction}>
							{#each END_ACTIONS as action (action)}
								<option value={action}>{m.export.endActions[action]}</option>
							{/each}
						</select>
					{/if}
				{/if}
			</fieldset>

			<div class="bg-base-200 rounded-box mt-4 grid grid-cols-2 gap-1 p-3 text-sm">
				<span class="opacity-70">{m.export.output}</span>
				<span>{size.width}×{size.height}, {isPicture ? m.export.pictureFormats[settings.picture] : m.export.formats[settings.format]}</span>
				{#if isPicture}
					<span class="opacity-70">{m.export.pictureAt}</span>
					<span>{formatTime(Math.min(at, total))}</span>
					<span class="col-span-2 mt-1 opacity-70">{m.export.pictureNote}</span>
				{:else}
					<span class="opacity-70">{m.export.duration}</span>
					<span>{formatTime(total)}</span>
				{/if}
				{#if isPicture}
					<!-- One picture: no bitrate or size estimate -->
				{:else if isGif}
					<span class="col-span-2 mt-1 opacity-70">{m.export.gifNote}</span>
				{:else}
					<span class="opacity-70">{m.export.videoBitrate}</span>
					<span>{(bitrate / 1_000_000).toFixed(1)} Mbit/s</span>
					<span class="opacity-70">{m.export.estimatedSize}</span>
					<span class="font-semibold">≈ {formatSize(estimate, intlLocale)}</span>
					{#if isPlaylist}<span class="col-span-2 mt-1 opacity-70">{m.export.playlistNote}</span>{/if}
				{/if}
			</div>

			{#if isGif && gifIsLarge(size.width, size.height, total)}<div role="alert" class="alert alert-warning mt-3">{m.export.gifLarge}</div>{/if}
			{#if unsupported}<div role="alert" class="alert alert-warning mt-3">{unsupported}</div>{/if}
			{#if error}<div role="alert" class="alert alert-error mt-3">{error}</div>{/if}

			<div class={['modal-action', result && 'justify-between']}>
				<!-- The finished file stays until a new export succeeds or the dialog closes -->
				{#if result}
					<button class="btn btn-ghost" onclick={() => (phase = 'done')}><span class="icon-[material-symbols-light--arrow-back] size-5" aria-hidden="true"></span> {m.export.backToResult}</button>
				{/if}
				<div class="flex gap-2">
					<button class="btn btn-ghost" onclick={close}>{m.common.close}</button>
					<button class="btn btn-primary" onclick={run} disabled={!!unsupported || total === 0}><span class="icon-[material-symbols-light--ios-share] size-5" aria-hidden="true"></span> {m.export.export}</button>
				</div>
			</div>
		{:else if phase === 'running'}
			<div class="flex flex-col gap-3 py-6">
				<progress class="progress progress-primary w-full" value={progress} max="1"></progress>
				<div class="flex justify-between text-sm">
					<span>{finalizing ? (isPlaylist ? m.export.packing : m.export.finalizing) : isGif ? m.export.renderingGif : isPicture ? m.export.renderingPicture : m.export.rendering}</span>
					<span class="tabular-nums">{Math.round(progress * 100)} %</span>
				</div>
				<p class="text-xs opacity-60">{m.export.keepTabOpen}</p>
			</div>
			<div class="modal-action">
				<button class="btn" onclick={() => controller?.abort()}>{m.common.cancel}</button>
			</div>
		{:else if result}
			<div class="flex flex-col gap-2 py-4">
				<div role="status" class="alert alert-success">{m.export.finished}</div>
				<p class="text-sm">
					<strong>{result.name}</strong> · {formatSize(result.size, intlLocale)} · {m.export.renderedIn(formatTime(result.seconds, 0))}
				</p>
				<!-- What to do with the file: the two actions in full width -->
				<div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
					<button class="btn btn-primary" onclick={download}><span class="icon-[material-symbols-light--download] size-5" aria-hidden="true"></span> {m.export.download}</button>
					<button class="btn" onclick={saveToFiles}><span class="icon-[material-symbols-light--save-outline] size-5" aria-hidden="true"></span> {m.export.saveToFiles}</button>
				</div>
			</div>
			<div class="modal-action justify-between">
				<button class="btn btn-ghost" onclick={() => (phase = 'settings')}><span class="icon-[material-symbols-light--tune] size-5" aria-hidden="true"></span> {m.export.otherSettings}</button>
				<button class="btn" onclick={close}>{m.common.done}</button>
			</div>
		{/if}
	</div>
</dialog>
