<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Recorder } from '#lib/record/recorder.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import { formatTime } from '#lib/util/format.js';

	interface Props {
		/** null only briefly while the sources are being set up */
		recorder: Recorder | null;
		/** Seconds left before the recording starts (0 = none) */
		countdown: number;
		onstop: () => void;
		/** Compact single line for the floating window, with a button to hide it */
		onhide?: () => void;
		/** Dialog only: shown between the time and the buttons */
		children?: Snippet;
		/** Dialog only: further buttons after Stop */
		extra?: Snippet;
	}

	let { recorder, countdown, onstop, onhide, children, extra }: Props = $props();
	const compact = $derived(!!onhide);
</script>

{#snippet status(rec: Recorder)}
	<div class="flex items-center gap-2">
		{#if rec.state === 'recording'}
			<span class="status status-error status-lg animate-pulse"></span>
			<span class="font-semibold">{m.record.recording}</span>
		{:else if rec.state === 'paused'}
			<span class="status status-warning status-lg"></span>
			<span class="font-semibold">{m.record.paused}</span>
		{:else}
			<span class="loading loading-spinner"></span>
			<span class="font-semibold">{m.record.finalizing}</span>
		{/if}
	</div>
{/snippet}

<!-- Compact: icon buttons with tooltip, so the line fits the small window -->
{#snippet buttons(rec: Recorder)}
	{#if rec.state === 'recording'}
		<button
			class="btn {compact ? 'btn-sm btn-square' : ''}"
			title={compact ? m.record.pause : undefined}
			aria-label={compact ? m.record.pause : undefined}
			onclick={() => rec.pause()}
			><span class="icon-[material-symbols-light--pause] size-5" aria-hidden="true"></span>
			{#if !compact}{m.record.pause}{/if}</button
		>
	{:else if rec.state === 'paused'}
		<button
			class="btn {compact ? 'btn-sm btn-square' : ''}"
			title={compact ? m.record.resume : undefined}
			aria-label={compact ? m.record.resume : undefined}
			onclick={() => rec.resume()}
			><span class="icon-[material-symbols-light--resume-outline] size-5" aria-hidden="true"></span>
			{#if !compact}{m.record.resume}{/if}</button
		>
	{/if}
	<button
		class="btn btn-error {compact ? 'btn-sm btn-square' : ''}"
		title={compact ? m.record.stop : undefined}
		aria-label={compact ? m.record.stop : undefined}
		disabled={rec.state !== 'recording' && rec.state !== 'paused'}
		onclick={onstop}
		><span class="icon-[material-symbols-light--stop] size-5" aria-hidden="true"></span>
		{#if !compact}{m.record.stop}{/if}</button
	>
{/snippet}

{#if compact}
	<div class="flex h-screen items-center gap-3 px-3">
		{#if !recorder}
			<span class="loading loading-spinner"></span>
		{:else if countdown > 0}
			<span class="countdown font-mono text-4xl">
				<span style="--value:{countdown};" aria-live="polite" aria-label={String(countdown)}>{countdown}</span>
			</span>
			<span class="text-sm opacity-70">{m.record.startingSoon}</span>
		{:else}
			<div class="flex flex-col">
				{@render status(recorder)}
				<span class="font-mono tabular-nums">{formatTime(recorder.elapsed, 0)}</span>
			</div>
			<div class="ml-auto flex gap-1">{@render buttons(recorder)}</div>
		{/if}
		<button
			class="btn btn-ghost btn-sm btn-square {recorder && countdown === 0 ? '' : 'ml-auto'}"
			title={m.record.pipHide}
			aria-label={m.record.pipHide}
			onclick={onhide}
			><span class="icon-[material-symbols-light--close] size-5" aria-hidden="true"></span></button
		>
	</div>
{:else if recorder && countdown > 0}
	<div class="flex flex-col items-center gap-2 py-8">
		<span class="countdown font-mono text-7xl">
			<span style="--value:{countdown};" aria-live="polite" aria-label={String(countdown)}>{countdown}</span>
		</span>
		<span class="opacity-70">{m.record.startingSoon}</span>
	</div>
{:else if recorder}
	<div class="flex flex-col items-center gap-4 py-4">
		{@render status(recorder)}
		<div class="font-mono text-5xl tabular-nums">{formatTime(recorder.elapsed, 0)}</div>
		{@render children?.()}
		<div class="flex gap-2">
			{@render buttons(recorder)}
			{@render extra?.()}
		</div>
	</div>
{/if}
