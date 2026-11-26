<script lang="ts" module>
	/** Seconds as `m:ss` (tenths when there are any) */
	export function clock(seconds: number): string {
		const tenths = Math.round(seconds * 10);
		const m = Math.floor(tenths / 600);
		const s = (tenths % 600) / 10;
		const whole = Math.floor(s);
		return `${m}:${String(whole).padStart(2, '0')}${s % 1 ? `.${Math.round((s % 1) * 10)}` : ''}`;
	}

	/** `m:ss`, `h:mm:ss` or plain seconds (a comma or a point for tenths); null when it isn't a time */
	export function parseClock(text: string): number | null {
		const parts = text.trim().replace(',', '.').split(':');
		if (!parts.length || parts.length > 3 || parts.some((p) => !/^\d+(\.\d*)?$/.test(p))) return null;
		return parts.reduce((sum, p) => sum * 60 + Number(p), 0);
	}
</script>

<script lang="ts">
	// “Trim …” of a playlist item: the part of a video or a piece of music that is played. An own video shows a
	// preview whose position can be taken as start or end; a publication's media lies in JW Library – only the times.
	import Modal from '@in-browser/brand/Modal.svelte';
	import { m } from '#lib/i18n/index.js';

	interface Props {
		label: string;
		start: number;
		end: number;
		length: number;
		/** An own video's address for the preview, null for a publication's media */
		video: string | null;
		ondone: (start: number, end: number) => void;
		onclose: () => void;
	}

	let { label, start: initialStart, end: initialEnd, length, video, ondone, onclose }: Props = $props();

	// Edited here; the item changes only on “Done”
	// svelte-ignore state_referenced_locally
	let start = $state(initialStart);
	// svelte-ignore state_referenced_locally
	let end = $state(initialEnd);
	let player = $state<HTMLVideoElement>();

	const valid = $derived(start >= 0 && end <= length && end > start);

	function take(which: 'start' | 'end', text: string, field: HTMLInputElement) {
		const seconds = parseClock(text);
		if (seconds === null) {
			field.value = clock(which === 'start' ? start : end);
			return;
		}
		const at = Math.min(Math.max(0, seconds), length);
		if (which === 'start') start = at;
		else end = at;
		field.value = clock(at);
	}

	function here(which: 'start' | 'end') {
		if (!player) return;
		const at = Math.round(player.currentTime * 10) / 10;
		if (which === 'start') start = at;
		else end = at;
	}

	function seek(at: number) {
		if (!player) return;
		player.currentTime = at;
		void player.play();
	}
</script>

<Modal {onclose} labelledby="jwl-trim-title">
	<div class="modal-box flex w-11/12 max-w-xl flex-col gap-3">
		<h3 id="jwl-trim-title" class="text-lg font-bold">{m.trim.title(label)}</h3>
		{#if video}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video bind:this={player} src={video} controls preload="metadata" class="bg-base-300 max-h-64 w-full rounded"></video>
		{:else}
			<p class="text-sm opacity-70">{m.trim.publication}</p>
		{/if}
		<div class="grid grid-cols-2 gap-3">
			{#each ['start', 'end'] as const as which (which)}
				<div class="flex flex-col gap-1">
					<label class="flex flex-col gap-1">
						<span class="text-sm">{which === 'start' ? m.trim.start : m.trim.end}</span>
						<input
							class="input w-full tabular-nums"
							inputmode="decimal"
							value={clock(which === 'start' ? start : end)}
							onfocus={(e) => e.currentTarget.select()}
							onchange={(e) => take(which, e.currentTarget.value, e.currentTarget)}
							onkeydown={(e) => {
								if (e.key === 'Enter') take(which, e.currentTarget.value, e.currentTarget);
							}}
						/>
					</label>
					{#if video}
						<div class="flex gap-1">
							<button class="btn btn-sm flex-1" onclick={() => here(which)}>
								<span class={[which === 'start' ? 'icon-[material-symbols-light--line-start]' : 'icon-[material-symbols-light--line-end]', 'size-5']} aria-hidden="true"></span>
								{which === 'start' ? m.trim.startHere : m.trim.endHere}
							</button>
							<button class="btn btn-sm btn-ghost" title={m.trim.play} aria-label={m.trim.play} onclick={() => seek(which === 'start' ? start : Math.max(start, end - 3))}>
								<span class="icon-[material-symbols-light--play-arrow-outline] size-5" aria-hidden="true"></span>
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
		<p class="text-sm" role="status">
			{#if valid}
				{m.trim.length(clock(end - start), clock(length))}
			{:else}
				<span class="text-error">{m.trim.invalid}</span>
			{/if}
		</p>
		<div class="modal-action mt-0 flex-wrap">
			<button
				class="btn btn-ghost mr-auto"
				disabled={start === 0 && end === length}
				onclick={() => {
					start = 0;
					end = length;
				}}
			>
				<span class="icon-[material-symbols-light--restart-alt] size-5" aria-hidden="true"></span>{m.trim.reset}
			</button>
			<button class="btn btn-ghost" onclick={onclose}>{m.common.cancel}</button>
			<button class="btn btn-primary" disabled={!valid} onclick={() => ondone(start, end)}>{m.common.done}</button>
		</div>
	</div>
</Modal>
