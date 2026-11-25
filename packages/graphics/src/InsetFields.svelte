<script lang="ts">
	// Inner margins of a box: four number fields (top, right, bottom, left) and the switch “Same on all sides”, with
	// which a field sets all four. Every change goes out with `oninput`, the end of one (typed, a key, a drag) with `oncommit`.
	import NumberField from './NumberField.svelte';
	import { graphicsMessages } from './i18n/index.svelte.js';
	import { evenInsets, INSET_SIDES, sameInsets, type Insets } from './text-box.js';

	interface Props {
		value: Insets;
		unit: string;
		max: number;
		step?: number;
		decimals?: number;
		oninput: (value: Insets) => void;
		oncommit?: () => void;
	}

	let { value, unit, max, step = 1, decimals = 0, oninput, oncommit }: Props = $props();

	const t = $derived(graphicsMessages().insets);
	/** One value for every side: on while they are equal, until switched off */
	let apart = $state(false);
	const together = $derived(!apart && sameInsets(value));
</script>

<div class="flex min-w-52 flex-col gap-1">
	<label class="flex items-center gap-2 text-xs">
		<input
			type="checkbox"
			class="checkbox checkbox-sm"
			checked={together}
			onchange={(e) => {
				apart = !e.currentTarget.checked;
				if (!apart && !sameInsets(value)) {
					oninput(evenInsets(Math.max(value.top, value.right, value.bottom, value.left)));
					oncommit?.();
				}
			}}
		/>
		{t.same}
	</label>
	<!-- Always four fields, so nothing moves; with one value for all, each sets all four -->
	{#each INSET_SIDES as side (side)}
		<NumberField
			label={t[side]}
			value={value[side]}
			{unit}
			min={0}
			{max}
			{step}
			{decimals}
			oninput={(v) => oninput(together ? evenInsets(v) : { ...value, [side]: v })}
			{oncommit}
		/>
	{/each}
</div>
