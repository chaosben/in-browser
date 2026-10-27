<script lang="ts">
	import { m } from '#lib/i18n/index.js';
	import { COLORS } from '#lib/project/defaults.js';
	import { formatColor, parseColor } from '#lib/util/color.js';

	interface Props {
		/** CSS color (`#rrggbb[aa]`) or `null` for "None" */
		value: string | null;
		/** Offers "None" (e.g. text background) */
		allowNone?: boolean;
		/** Opaque colors only (no opacity slider), e.g. for the project background */
		opaque?: boolean;
		/**
		 * `final` is `false` during a drag (slider, color picker) and `true` at the end or on a
		 * click – the caller uses it to complete the undo step.
		 */
		onchange: (value: string | null, final: boolean) => void;
	}

	let { value, allowNone = false, opaque = false, onchange }: Props = $props();

	const parsed = $derived(value === null ? null : parseColor(value));
	/** When switching from "None" to a color: full opacity */
	const alpha = $derived(parsed?.alpha ?? 1);

	// Checkerboard behind the swatches makes transparency visible
	const checker =
		'background-image: repeating-conic-gradient(#9ca3af 0 25%, #f3f4f6 0 50%); background-size: 8px 8px';
	const swatch = 'relative size-6 overflow-hidden rounded border';
	const selected = 'border-base-content ring-primary ring-2';
</script>

<div class="flex flex-col gap-2">
	<div class="flex flex-wrap items-center gap-1">
		{#if allowNone}
			<button
				class="{swatch} bg-base-100 {value === null ? selected : 'border-base-content/30'}"
				onclick={() => onchange(null, true)}
				title={m.inspector.none}
				aria-label={m.inspector.none}
			>
				<!-- Struck through = no color -->
				<span class="bg-error absolute top-1/2 left-1/2 h-0.5 w-8 -translate-x-1/2 -translate-y-1/2 -rotate-45"></span>
			</button>
		{/if}
		{#each COLORS as color (color)}
			<button
				class="{swatch} {parsed?.hex === color ? selected : 'border-base-content/30'}"
				style={checker}
				onclick={() => onchange(formatColor(color, alpha), true)}
				title={color}
				aria-label={m.inspector.colorValue(color)}
			>
				<span class="absolute inset-0" style="background: {formatColor(color, alpha)}"></span>
			</button>
		{/each}
		<input
			type="color"
			class="size-7 cursor-pointer bg-transparent"
			value={parsed?.hex ?? '#000000'}
			oninput={(e) => onchange(formatColor(e.currentTarget.value, alpha), false)}
			onchange={(e) => onchange(formatColor(e.currentTarget.value, alpha), true)}
			title={m.inspector.customColor}
			aria-label={m.inspector.customColor}
		/>
	</div>

	{#if parsed && !opaque}
		<label class="flex items-center gap-2 text-xs">
			<span class="opacity-70">{m.inspector.opacity}</span>
			<input
				type="range"
				class="range range-xs flex-1"
				min="0"
				max="100"
				step="1"
				value={Math.round(alpha * 100)}
				oninput={(e) => onchange(formatColor(parsed.hex, Number(e.currentTarget.value) / 100), false)}
				onchange={(e) => onchange(formatColor(parsed.hex, Number(e.currentTarget.value) / 100), true)}
			/>
			<span class="w-9 text-right tabular-nums">{Math.round(alpha * 100)} %</span>
			<span class="relative size-5 overflow-hidden rounded border border-base-content/30" style={checker}>
				<span class="absolute inset-0" style="background: {value}"></span>
			</span>
		</label>
	{/if}
</div>
