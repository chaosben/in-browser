<script lang="ts">
	import { checkEncodable, ExportCanceledError, exportProject } from '#lib/export/exporter.js';
	import {
		estimateBytes,
		formatBytes,
		loadSettings,
		outputSize,
		QUALITY_LABELS,
		RESOLUTIONS,
		storeSettings,
		videoBitrate,
		type QualityPreset
	} from '#lib/export/settings.js';
	import type { Project } from '#lib/project/types.js';
	import { duration } from '#lib/timeline/ops.js';
	import { m } from '#lib/i18n/index.js';
	import { errorMessage, formatTime } from '#lib/util/format.js';

	interface Props {
		project: Project;
		onclose: () => void;
	}

	let { project, onclose }: Props = $props();

	let settings = $state(loadSettings());
	let phase = $state<'settings' | 'running' | 'done'>('settings');
	let progress = $state(0);
	let finalizing = $state(false);
	let error = $state<string | null>(null);
	let unsupported = $state<string | null>(null);
	let result = $state<{ url: string; name: string; size: number; seconds: number } | null>(null);
	let controller: AbortController | null = null;
	let dialog: HTMLDialogElement;

	const total = $derived(duration(project.timeline));
	const size = $derived(outputSize(settings, project.width, project.height));
	const bitrate = $derived(videoBitrate(settings, size.width, size.height));
	const estimate = $derived(estimateBytes(settings, size.width, size.height, total));
	const resolutions = $derived(RESOLUTIONS.filter((h) => h < project.height));
	const hasAudio = $derived(project.sources.some((s) => s.hasAudio));

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
				controller.signal
			);
			if (result) URL.revokeObjectURL(result.url);
			result = {
				url: URL.createObjectURL(file),
				name: file.name,
				size: file.size,
				seconds: (performance.now() - started) / 1000
			};
			phase = 'done';
			download();
		} catch (e) {
			phase = 'settings';
			if (!(e instanceof ExportCanceledError)) error = errorMessage(e);
		} finally {
			controller = null;
		}
	}

	function download() {
		if (!result) return;
		const a = document.createElement('a');
		a.href = result.url;
		a.download = result.name;
		a.click();
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
				<span class="label">{m.export.resolution}</span>
				<select class="select select-sm" bind:value={settings.height}>
					<option value={0}>{m.export.original(project.width, project.height)}</option>
					{#each resolutions as h (h)}
						<option value={h}>{h}p</option>
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
			</fieldset>

			<div class="bg-base-200 rounded-box mt-4 grid grid-cols-2 gap-1 p-3 text-sm">
				<span class="opacity-70">{m.export.output}</span>
				<span>{size.width}×{size.height}, MP4</span>
				<span class="opacity-70">{m.export.duration}</span>
				<span>{formatTime(total)}</span>
				<span class="opacity-70">{m.export.videoBitrate}</span>
				<span>{(bitrate / 1_000_000).toFixed(1)} Mbit/s</span>
				<span class="opacity-70">{m.export.estimatedSize}</span>
				<span class="font-semibold">≈ {formatBytes(estimate)}</span>
			</div>

			{#if unsupported}<div role="alert" class="alert alert-warning mt-3">{unsupported}</div>{/if}
			{#if error}<div role="alert" class="alert alert-error mt-3">{error}</div>{/if}

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={close}>{m.common.close}</button>
				<button class="btn btn-primary" onclick={run} disabled={!!unsupported || total === 0}><span class="icon-[material-symbols-light--download] size-5" aria-hidden="true"></span> {m.export.export}</button>
			</div>
		{:else if phase === 'running'}
			<div class="flex flex-col gap-3 py-6">
				<progress class="progress progress-primary w-full" value={progress} max="1"></progress>
				<div class="flex justify-between text-sm">
					<span>{finalizing ? m.export.finalizing : m.export.rendering}</span>
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
					<strong>{result.name}</strong> · {formatBytes(result.size)} · {m.export.renderedIn(formatTime(result.seconds, 0))}
				</p>
			</div>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (phase = 'settings')}>{m.export.otherSettings}</button>
				<button class="btn" onclick={download}><span class="icon-[material-symbols-light--download] size-5" aria-hidden="true"></span> {m.export.downloadAgain}</button>
				<button class="btn btn-primary" onclick={close}>{m.common.done}</button>
			</div>
		{/if}
	</div>
</dialog>
