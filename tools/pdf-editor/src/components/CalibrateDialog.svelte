<script lang="ts">
	// Asked after a distance was dragged with "Calibrate": how long is it really? The scale of the PDF follows from
	// the answer (the dragged line itself is never kept).
	import Modal from '@in-browser/brand/Modal.svelte';
	import { lang } from '@in-browser/brand/i18n/index.svelte.js';
	import type { MeasureUnit } from '@in-browser/ink/items.js';
	import { formatNumber, parseNumber } from '@in-browser/graphics/number.js';
	import { m } from '#lib/i18n/index.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';
	import { MEASURE_UNITS, unitsPerPoint } from '#lib/render/measure.js';

	/** `points`: the dragged length in page points; `onclose(done)`: done when the scale was set */
	let { ed, points, onclose }: { ed: EditorState; points: number; onclose: (done: boolean) => void } = $props();

	// svelte-ignore state_referenced_locally
	let unit = $state<MeasureUnit>(ed.doc!.measureScale().unit);
	let text = $state('');

	const length = $derived(parseNumber(text));
	/** The scale that makes the dragged distance this long; null while nothing usable is typed */
	const scale = $derived.by(() => {
		if (length === null || !(length > 0)) return null;
		const found = length / (points * unitsPerPoint(1, unit));
		return Number.isFinite(found) && found > 0 ? found : null;
	});

	function apply(e: SubmitEvent) {
		e.preventDefault();
		if (scale === null) return;
		ed.doc?.setMeasureScale(scale, unit);
		onclose(true);
	}
</script>

<Modal onclose={() => onclose(false)} labelledby="calibrate-title">
	<form class="modal-box flex max-w-sm flex-col gap-4" onsubmit={apply}>
		<h3 id="calibrate-title" class="flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--architecture] size-6" aria-hidden="true"></span>
			{m.measure.calibrateTitle}
		</h3>
		<p class="text-sm opacity-70">{m.measure.calibrateHint}</p>
		<div class="flex items-end gap-2">
			<label class="flex min-w-0 flex-1 flex-col gap-1 text-sm">
				{m.measure.length}
				<!-- svelte-ignore a11y_autofocus -->
				<input class="input input-sm w-full" type="text" inputmode="decimal" autocomplete="off" bind:value={text} autofocus />
			</label>
			<label class="flex flex-col gap-1 text-sm">
				{m.measure.unit}
				<select class="select select-sm w-auto" bind:value={unit}>
					{#each MEASURE_UNITS as u (u)}<option value={u}>{m.measure.units[u]}</option>{/each}
				</select>
			</label>
		</div>
		<!-- Always there, so nothing jumps -->
		<p class={['text-sm', scale === null && 'invisible']}>{m.measure.calibrated(formatNumber(scale ?? 1, 2, lang.current))}</p>
		<div class="modal-action mt-0">
			<button type="button" class="btn btn-ghost" onclick={() => onclose(false)}>{m.common.cancel}</button>
			<button type="submit" class="btn btn-primary" disabled={scale === null}>{m.measure.apply}</button>
		</div>
	</form>
</Modal>
