<script lang="ts">
	import { onDestroy, tick, untrack } from 'svelte';
	import { describeSource } from '#lib/media/media.js';
	import type { Recording } from '#lib/project/project.js';
	import { devices, openDevice, type DeviceKind } from '#lib/record/devices.svelte.js';
	import { Recorder, type RecordOptions } from '#lib/record/recorder.svelte.js';
	import {
		AUDIO_FILTERS,
		AUDIO_RATES,
		CAMERA_RESOLUTIONS,
		estimateMbPerMinute,
		FRAME_RATES,
		loadRecordSettings,
		RECORD_LEVELS,
		storeRecordSettings,
		type AudioKbps,
		type AudioProcessing,
		type RecordLevel
	} from '#lib/record/settings.js';
	import { formatClock, m } from '#lib/i18n/index.js';
	import { errorMessage, formatTime, isAbort } from '#lib/util/format.js';

	interface Props {
		projectId: string;
		/** Screen, optionally webcam and microphone as separate sources */
		ondone: (recording: Recording) => void;
		oncancel: () => void;
	}

	let { projectId, ondone, oncancel }: Props = $props();

	/** Quality per source and frame rate (persisted) */
	let settings = $state(loadRecordSettings());

	$effect(() => storeRecordSettings($state.snapshot(settings)));

	// Rough size of the recording, so the effect of the quality settings can be judged
	const mbPerMinute = $derived(
		estimateMbPerMinute(settings, { width: screen.width * devicePixelRatio, height: screen.height * devicePixelRatio })
	);

	/** One tab per source; all but the screen can be switched off in the tab header */
	type SourceTab = 'screen' | 'systemAudio' | 'microphone' | 'camera';
	const SOURCE_TABS: SourceTab[] = ['screen', 'systemAudio', 'microphone', 'camera'];
	let tab = $state<SourceTab>('screen');
	/** Voice processing filters the browser can switch */
	const filters = AUDIO_FILTERS.filter((f) => navigator.mediaDevices?.getSupportedConstraints?.()[f]);
	let countdown = $state(0);
	let error = $state<string | null>(null);
	let recorder = $state<Recorder | null>(null);
	/** Set while the recording starts: previews release their devices */
	let starting = $state(false);
	let cameraPreview = $state.raw<MediaStream | null>(null);
	/** The preview shows a picture (until then a spinner keeps the space) */
	let cameraPlaying = $state(false);
	let micLevel = $state(0);
	let deviceError = $state<Partial<Record<DeviceKind, boolean>>>({});
	let dialog: HTMLDialogElement;

	$effect(() => {
		dialog.showModal();
	});

	// Keep the device lists current while the dialog is open
	$effect(() => untrack(() => devices.watch()));

	const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach((t) => t.stop());

	/**
	 * Opens the chosen device for a preview while setting up (also unlocks the device names). `onopen` returns
	 * its own cleanup.
	 */
	function preview(kind: DeviceKind, deviceId: string | undefined, onopen: (stream: MediaStream) => () => void) {
		let cancelled = false;
		let stream: MediaStream | null = null;
		let cleanup = () => {};
		// Reads the settings the device depends on, so the preview reopens when they change
		openDevice(kind, deviceId, settings)
			.then((s) => {
				if (cancelled) return stopStream(s);
				stream = s;
				deviceError[kind] = false;
				cleanup = onopen(s);
				devices.refresh().catch(() => {});
			})
			.catch(() => (deviceError[kind] = true));
		return () => {
			cancelled = true;
			cleanup();
			stopStream(stream);
		};
	}

	// Microphone level meter, so the right microphone (and the effect of the filters) can be recognised
	$effect(() => {
		if (!settings.microphone || starting || recorder) return;
		return preview('microphone', devices.selected.microphone, (stream) => {
			const context = new AudioContext();
			const analyser = context.createAnalyser();
			analyser.fftSize = 512;
			context.createMediaStreamSource(stream).connect(analyser);
			const data = new Float32Array(analyser.fftSize);
			let raf = 0;
			const measure = () => {
				analyser.getFloatTimeDomainData(data);
				let peak = 0;
				for (const v of data) peak = Math.max(peak, Math.abs(v));
				micLevel = Math.max(peak, micLevel * 0.85);
				raf = requestAnimationFrame(measure);
			};
			measure();
			return () => {
				cancelAnimationFrame(raf);
				context.close().catch(() => {});
				micLevel = 0;
			};
		});
	});

	// Live webcam preview before recording
	$effect(() => {
		if (!settings.camera || starting || recorder) return;
		return preview('camera', devices.selected.camera, (stream) => {
			cameraPreview = stream;
			return () => {
				cameraPreview = null;
				cameraPlaying = false;
			};
		});
	});

	async function start() {
		error = null;
		const rec = new Recorder(projectId);
		const chosen: RecordOptions = {
			microphone: settings.microphone,
			camera: settings.camera,
			systemAudio: settings.systemAudio,
			settings: $state.snapshot(settings),
			microphoneId: devices.selected.microphone,
			cameraId: devices.selected.camera
		};
		// Release the preview devices before the recorder opens them
		starting = true;
		await tick();
		try {
			await rec.acquire(chosen);
		} catch (e) {
			if (!isAbort(e)) error = errorMessage(e);
			starting = false;
			return;
		}
		recorder = rec;
		if (settings.countdown) {
			for (countdown = 3; countdown > 0; countdown--) {
				await new Promise((r) => setTimeout(r, 1000));
			}
		}
		try {
			await rec.start(chosen, () => stop());
		} catch (e) {
			error = errorMessage(e);
			await rec.cancel();
			recorder = null;
			starting = false;
		}
	}

	let stopping = false;

	async function stop() {
		// Can fire twice: stop button and "Stop sharing" in the browser
		if (!recorder || stopping) return;
		stopping = true;
		try {
			await recorder.stop();
			const { screen, camera, mic } = recorder.files;
			const clock = formatClock();
			const describe = (file: string | undefined, name: string) =>
				file ? describeSource(projectId, file, name, 'recording') : Promise.resolve(undefined);
			ondone({
				screen: (await describe(screen, m.common.recordingName(clock)))!,
				camera: await describe(camera, m.record.cameraName(clock)),
				mic: await describe(mic, m.record.micName(clock))
			});
		} catch (e) {
			error = m.record.saveFailed(errorMessage(e));
			recorder = null;
			stopping = false;
		}
	}

	async function cancel() {
		await recorder?.cancel();
		oncancel();
	}

	onDestroy(() => {
		if (recorder && recorder.state !== 'done') recorder.cancel();
	});
</script>

{#snippet levelSelect(label: string, value: RecordLevel, onchange: (level: RecordLevel) => void)}
	<select
		class="select select-sm w-full"
		aria-label={label}
		{value}
		onchange={(e) => onchange(e.currentTarget.value as RecordLevel)}
	>
		{#each RECORD_LEVELS as level (level)}<option value={level}>{m.export.qualities[level]}</option>{/each}
	</select>
{/snippet}

{#snippet audioOptions(kbps: AudioKbps, onkbps: (kbps: AudioKbps) => void, processing: AudioProcessing)}
	<div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
		<span>{m.record.audioQuality}</span>
		<select
			class="select select-sm w-full"
			aria-label={m.record.audioQuality}
			value={kbps}
			onchange={(e) => onkbps(Number(e.currentTarget.value) as AudioKbps)}
		>
			{#each AUDIO_RATES as rate (rate)}<option value={rate}>{rate} kbit/s</option>{/each}
		</select>
	</div>
	{#if filters.length}
		<div class="flex flex-col gap-1.5">
			{#each filters as filter (filter)}
				<label class="label text-sm">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						checked={processing[filter]}
						onchange={(e) => (processing[filter] = e.currentTarget.checked)}
					/>
					{m.record.filters[filter]}
				</label>
			{/each}
			<p class="label text-xs whitespace-normal">{m.record.filtersHint}</p>
		</div>
	{/if}
{/snippet}

{#snippet deviceSelect(kind: DeviceKind, list: MediaDeviceInfo[], label: string)}
	<select
		class="select select-sm w-full"
		aria-label={label}
		value={devices.selected[kind] ?? ''}
		onchange={(e) => devices.select(kind, e.currentTarget.value || undefined)}
	>
		<option value="">{m.record.defaultDevice}</option>
		{#each list as device, i (device.deviceId)}
			<option value={device.deviceId}>{device.label || m.record.deviceFallback(label, i + 1)}</option>
		{/each}
	</select>
{/snippet}

<dialog bind:this={dialog} class="modal" oncancel={(e) => e.preventDefault()}>
	<div class="modal-box">
		{#if !recorder}
			<h3 class="text-lg font-bold">{m.record.title}</h3>
			<p class="py-2 text-sm opacity-70">
				{m.record.intro}
			</p>
			<div role="tablist" class="tabs tabs-border">
				{#each SOURCE_TABS as id (id)}
					<div class="tab gap-2 px-3 {tab === id ? 'tab-active' : ''}">
						{#if id !== 'screen'}
							<input
								type="checkbox"
								class="checkbox checkbox-xs"
								aria-label={m.record[id]}
								bind:checked={settings[id]}
								onchange={(e) => e.currentTarget.checked && (tab = id)}
							/>
						{/if}
						<button
							type="button"
							role="tab"
							id="record-tab-{id}"
							aria-selected={tab === id}
							aria-controls="record-panel-{id}"
							onclick={() => (tab = id)}>{m.record.tabs[id]}</button
						>
					</div>
				{/each}
			</div>
			<div role="tabpanel" id="record-panel-{tab}" aria-labelledby="record-tab-{tab}" class="py-3">
				<fieldset class="fieldset gap-3" disabled={tab !== 'screen' && !settings[tab]}>
					{#if tab === 'screen'}
						<div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
							<span>{m.record.videoQuality}</span>
							{@render levelSelect(m.record.videoQuality, settings.screenQuality, (v) => (settings.screenQuality = v))}
							<span>{m.record.frameRate}</span>
							<select class="select select-sm w-full" bind:value={settings.frameRate} aria-label={m.record.frameRate}>
								{#each FRAME_RATES as fps (fps)}<option value={fps}>{fps} fps</option>{/each}
							</select>
						</div>
					{:else if tab === 'systemAudio'}
						<p class="label text-xs whitespace-normal">{m.record.systemAudioHint}</p>
						{@render audioOptions(settings.systemKbps, (v) => (settings.systemKbps = v), settings.systemProcessing)}
					{:else if tab === 'microphone'}
						<div class="flex flex-col gap-1">
							{@render deviceSelect('microphone', devices.microphones, m.record.microphoneDevice)}
							<progress class="progress progress-success h-1.5 w-full" value={micLevel} max="1" aria-label={m.record.level}
							></progress>
							{#if deviceError.microphone}<p class="text-warning text-xs">{m.record.noMicrophone}</p>{/if}
						</div>
						{@render audioOptions(settings.micKbps, (v) => (settings.micKbps = v), settings.micProcessing)}
					{:else}
						<div class="flex flex-col gap-2">
							{@render deviceSelect('camera', devices.cameras, m.record.cameraDevice)}
							<!-- Fixed size from the start, so the dialog does not jump when the picture arrives -->
							<div class="rounded-box bg-base-300 relative grid aspect-video w-48 place-items-center overflow-hidden">
								<video
									class="absolute inset-0 h-full w-full object-cover {cameraPlaying ? '' : 'invisible'}"
									autoplay
									muted
									playsinline
									aria-label={m.record.cameraPreview}
									onplaying={() => (cameraPlaying = true)}
									{@attach (video) => {
										video.srcObject = cameraPreview;
									}}
								></video>
								{#if deviceError.camera}
									<span class="icon-[material-symbols-light--videocam-off-outline] size-8 opacity-60" aria-hidden="true"></span>
								{:else if settings.camera && !cameraPlaying}
									<span class="loading loading-spinner opacity-60"></span>
								{/if}
							</div>
							{#if deviceError.camera}<p class="text-warning text-xs">{m.record.noCamera}</p>{/if}
						</div>
						<div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
							<span>{m.record.videoQuality}</span>
							{@render levelSelect(m.record.videoQuality, settings.cameraQuality, (v) => (settings.cameraQuality = v))}
							<span>{m.record.resolution}</span>
							<select class="select select-sm w-full" bind:value={settings.cameraResolution} aria-label={m.record.resolution}>
								{#each CAMERA_RESOLUTIONS as r (r)}<option value={r}>{r}p</option>{/each}
							</select>
						</div>
					{/if}
				</fieldset>
			</div>
			<fieldset class="fieldset border-base-300 gap-2 border-t pt-3">
				<p class="label text-xs whitespace-normal">{m.record.separateTracksHint}</p>
				<label class="label">
					<input type="checkbox" class="toggle toggle-primary" bind:checked={settings.countdown} />
					{m.record.countdown}
				</label>
				<p class="text-sm opacity-60">{m.record.sizePerMinute(mbPerMinute.toFixed(0))}</p>
			</fieldset>
			{#if error}<div role="alert" class="alert alert-error mt-4">{error}</div>{/if}
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={cancel}>{m.common.cancel}</button>
				<button class="btn btn-primary" onclick={start}><span class="icon-[material-symbols-light--screen-share-outline] size-5" aria-hidden="true"></span> {m.record.chooseSource}</button>
			</div>
		{:else if countdown > 0}
			<div class="flex flex-col items-center gap-2 py-8">
				<span class="countdown font-mono text-7xl">
					<span style="--value:{countdown};" aria-live="polite" aria-label={String(countdown)}>{countdown}</span>
				</span>
				<span class="opacity-70">{m.record.startingSoon}</span>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-4 py-4">
				<div class="flex items-center gap-3">
					{#if recorder.state === 'recording'}
						<span class="status status-error status-lg animate-pulse"></span>
						<span class="font-semibold">{m.record.recording}</span>
					{:else if recorder.state === 'paused'}
						<span class="status status-warning status-lg"></span>
						<span class="font-semibold">{m.record.paused}</span>
					{:else}
						<span class="loading loading-spinner"></span>
						<span class="font-semibold">{m.record.finalizing}</span>
					{/if}
				</div>
				<div class="font-mono text-5xl tabular-nums">{formatTime(recorder.elapsed, 0)}</div>
				{#if recorder.camera}
					<video
						class="rounded-box aspect-video w-48 bg-black object-cover"
						autoplay
						muted
						playsinline
						aria-label={m.record.cameraPreview}
						{@attach (video) => {
							video.srcObject = recorder?.camera ?? null;
						}}
					></video>
				{/if}
				{#if recorder.warning}<div role="alert" class="alert alert-warning text-sm">{recorder.warning}</div>{/if}
				{#if error}<div role="alert" class="alert alert-error">{error}</div>{/if}
				<p class="text-center text-sm opacity-70">
					{m.record.stopHint}
				</p>
				<div class="flex gap-2">
					{#if recorder.state === 'recording'}
						<button class="btn" onclick={() => recorder?.pause()}><span class="icon-[material-symbols-light--pause] size-5" aria-hidden="true"></span> {m.record.pause}</button>
					{:else if recorder.state === 'paused'}
						<button class="btn" onclick={() => recorder?.resume()}><span class="icon-[material-symbols-light--resume-outline] size-5" aria-hidden="true"></span> {m.record.resume}</button>
					{/if}
					<button
						class="btn btn-error"
						disabled={recorder.state !== 'recording' && recorder.state !== 'paused'}
						onclick={stop}><span class="icon-[material-symbols-light--stop] size-5" aria-hidden="true"></span> {m.record.stop}</button
					>
					<button class="btn btn-ghost" onclick={cancel} disabled={recorder.state === 'finalizing'}>{m.record.discard}</button>
				</div>
			</div>
		{/if}
	</div>
</dialog>
