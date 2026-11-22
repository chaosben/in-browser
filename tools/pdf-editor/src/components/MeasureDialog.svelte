<script lang="ts">
	// The scale this PDF is measured with: 1 on paper is so much in reality, shown in a unit. Every measurement of
	// the PDF measures anew with it. (A plan of unknown scale: "Calibrate", `CalibrateDialog.svelte`.)
	import Modal from '@in-browser/brand/Modal.svelte';
	import type { MeasureUnit } from '@in-browser/ink/items.js';
	import NumberField from '@in-browser/graphics/NumberField.svelte';
	import { m } from '#lib/i18n/index.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';
	import { MEASURE_UNITS } from '#lib/render/measure.js';

	let { ed, onclose }: { ed: EditorState; onclose: () => void } = $props();

	// svelte-ignore state_referenced_locally
	const now = ed.doc!.measureScale();
	let scale = $state(now.scale);
	let unit = $state<MeasureUnit>(now.unit);

	const round = (v: number) => Math.round(v * 1000) / 1000;

	function apply(e: SubmitEvent) {
		e.preventDefault();
		if (!(scale > 0)) return;
		ed.doc?.setMeasureScale(scale, unit);
		onclose();
	}
</script>

<Modal {onclose} labelledby="measure-title">
	<form class="modal-box flex max-w-sm flex-col gap-4" onsubmit={apply}>
		<h3 id="measure-title" class="flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--straighten-outline] size-6" aria-hidden="true"></span>
			{m.measure.scaleTitle}
		</h3>
		<p class="text-sm opacity-70">{m.measure.scaleHint}</p>
		<NumberField label={m.measure.scale} value={round(scale)} min={0.001} max={1000000} step={1} decimals={3} oninput={(v) => (scale = v)} />
		<label class="flex items-center justify-between gap-2 text-sm">
			{m.measure.unit}
			<select class="select select-sm w-auto" bind:value={unit}>
				{#each MEASURE_UNITS as u (u)}<option value={u}>{m.measure.units[u]}</option>{/each}
			</select>
		</label>
		<div class="modal-action mt-0">
			<button type="button" class="btn btn-ghost" onclick={onclose}>{m.common.cancel}</button>
			<button type="submit" class="btn btn-primary">{m.measure.apply}</button>
		</div>
	</form>
</Modal>
