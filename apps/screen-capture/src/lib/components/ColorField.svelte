<script module lang="ts">
	import { isDefaultPalette, loadPalette, placeColor, storePalette } from '#lib/util/palette.js';
	import { loadRecent, pushRecent, storeRecent } from '#lib/util/recent-colors.js';

	// Shared by all color fields, so a color picked in one is offered in the others right away
	let recent = $state(loadRecent());
	let palette = $state(loadPalette());

	function remember(hex: string) {
		recent = pushRecent(recent, hex);
		storeRecent(recent);
	}

	function setPalette(colors: string[]) {
		palette = colors;
		storePalette(colors);
	}

	/** Swatches carry their color while dragged onto a preset place */
	const COLOR_MIME = 'application/x-screen-capture-color';
</script>

<script lang="ts">
	import { m } from '#lib/i18n/index.js';
	import NumberField from './NumberField.svelte';
	import { COLORS } from '#lib/project/defaults.js';
	import { formatColor, parseColor } from '#lib/util/color.js';
	import { mergeSwatches } from '#lib/util/recent-colors.js';

	interface Props {
		/** CSS color (`#rrggbb[aa]`) or `null` for "None" */
		value: string | null;
		/** Offers "None" (e.g. text background) */
		allowNone?: boolean;
		/** Opaque colors only (no opacity), e.g. for the project background */
		opaque?: boolean;
		/** Colors already used in the project (`#rrggbb`), offered next to the recent ones */
		projectColors?: string[];
		/**
		 * `final` is `false` during a drag (slider, color picker) and `true` at the end or on a
		 * click – the caller uses it to complete the undo step.
		 */
		onchange: (value: string | null, final: boolean) => void;
	}

	let { value, allowNone = false, opaque = false, projectColors = [], onchange }: Props = $props();

	const popoverId = $props.id();
	let opacityButton = $state<HTMLButtonElement>();

	const parsed = $derived(value === null ? null : parseColor(value));
	/** When switching from "None" to a color: full opacity */
	const alpha = $derived(parsed?.alpha ?? 1);
	const percent = $derived(Math.round(alpha * 100));
	const custom = $derived(mergeSwatches(recent, projectColors, palette));

	/** Applies a color with the current opacity */
	const apply = (hex: string, final: boolean) => onchange(formatColor(hex, alpha), final);

	/** New custom color from the picker: moves to the front of the remembered ones once final */
	function pick(hex: string, final: boolean) {
		apply(hex, final);
		if (final && !palette.includes(hex)) remember(hex);
	}

	/** Preset place a color is being dragged over */
	let dropIndex = $state<number | null>(null);

	function dragColor(e: DragEvent, hex: string) {
		e.dataTransfer?.setData(COLOR_MIME, hex);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copyMove';
	}

	function dragOver(e: DragEvent, index: number) {
		if (!e.dataTransfer?.types.includes(COLOR_MIME)) return;
		e.preventDefault();
		dropIndex = index;
	}

	function drop(e: DragEvent, index: number) {
		const hex = e.dataTransfer?.getData(COLOR_MIME);
		dropIndex = null;
		if (!hex) return;
		e.preventDefault();
		setPalette(placeColor(palette, index, hex));
	}

	function setAlpha(percent: number, final: boolean) {
		if (parsed) onchange(formatColor(parsed.hex, percent / 100), final);
	}

	/** Removes the listeners that close the open popover */
	let unlisten: (() => void) | undefined;
	$effect(() => () => unlisten?.());

	/**
	 * Popovers live in the top layer: place it below the button, right-aligned. It does not follow the button,
	 * so scrolling or resizing closes it.
	 */
	function placePopover(e: ToggleEvent) {
		unlisten?.();
		unlisten = undefined;
		const popover = e.currentTarget as HTMLElement;
		if (e.newState !== 'open' || !opacityButton) return;
		const rect = opacityButton.getBoundingClientRect();
		popover.style.top = `${rect.bottom + 4}px`;
		popover.style.left = `${Math.max(4, rect.right - popover.offsetWidth)}px`;
		const close = () => popover.hidePopover();
		window.addEventListener('scroll', close, { capture: true });
		window.addEventListener('resize', close);
		unlisten = () => {
			window.removeEventListener('scroll', close, { capture: true });
			window.removeEventListener('resize', close);
		};
	}

	// Checkerboard behind the opacity preview makes transparency visible
	const checker =
		'background-image: repeating-conic-gradient(#9ca3af 0 25%, #f3f4f6 0 50%); background-size: 8px 8px';
	const swatchClass = 'relative size-5 shrink-0 overflow-hidden rounded border';
	const selected = 'border-base-content ring-primary ring-2';
</script>

<!-- Always opaque, so colors stay recognizable at a low opacity (the opacity button shows it). Preset places
	 (`index`) take a color dropped on them. -->
{#snippet swatch(color: string, index?: number)}
	<button
		class="{swatchClass} {parsed?.hex === color ? selected : 'border-base-content/30'} {index !== undefined && dropIndex === index ? 'ring-primary ring-2 ring-offset-1' : ''}"
		style="background: {color}"
		draggable="true"
		onclick={() => apply(color, true)}
		ondragstart={(e) => dragColor(e, color)}
		ondragover={index === undefined ? undefined : (e) => dragOver(e, index)}
		ondragleave={index === undefined ? undefined : () => (dropIndex = null)}
		ondrop={index === undefined ? undefined : (e) => drop(e, index)}
		title={index === undefined ? color : `${color} – ${m.inspector.paletteHint}`}
		aria-label={m.inspector.colorValue(color)}
	></button>
{/snippet}

<!-- Swatches on the left (custom ones in the same columns as the presets), tools on the right -->
<div class="flex flex-col gap-2">
	<div class="flex items-center gap-1">
		{#if allowNone}
			<button
				class="{swatchClass} bg-base-100 {value === null ? selected : 'border-base-content/30'}"
				onclick={() => onchange(null, true)}
				title={m.inspector.none}
				aria-label={m.inspector.none}
			>
				<!-- Struck through = no color -->
				<span class="bg-error absolute top-1/2 left-1/2 h-0.5 w-8 -translate-x-1/2 -translate-y-1/2 -rotate-45"></span>
			</button>
		{/if}
		{#each palette as color, i (color)}
			{@render swatch(color, i)}
		{/each}

		{#if parsed && !opaque}
			<button
				bind:this={opacityButton}
				popovertarget={popoverId}
				class="btn btn-xs ml-auto w-14 gap-0.5 px-1 font-normal tabular-nums"
				title={m.inspector.opacity}
				aria-label={m.inspector.opacity}
			>
				<!-- The color with its opacity over a checkerboard -->
				<span class="relative size-3.5 shrink-0 overflow-hidden rounded-sm border border-base-content/30" style={checker} aria-hidden="true">
					<span class="absolute inset-0" style="background: {value}"></span>
				</span>{percent}%
			</button>
			<!-- Opens only via the button; closes on a click outside or Esc -->
			<div
				id={popoverId}
				popover
				class="bg-base-100 text-base-content border-base-300 rounded-box m-0 w-52 border p-3 shadow"
				ontoggle={placePopover}
			>
				<NumberField
					label={m.inspector.opacity}
					value={percent}
					unit="%"
					min={0}
					max={100}
					oninput={(v) => setAlpha(v, false)}
					oncommit={() => setAlpha(percent, true)}
				/>
			</div>
		{/if}
	</div>

	<div class="flex items-center gap-1">
		{#if custom.length}
			{#if allowNone}
				<!-- Keeps the custom colors below the presets, not below "None" -->
				<span class="size-5 shrink-0" aria-hidden="true"></span>
			{/if}
			<div class="flex items-center gap-1" role="group" aria-label={m.inspector.recentColors}>
				{#each custom as color (color)}
					{@render swatch(color)}
				{/each}
			</div>
		{/if}
		{#if !isDefaultPalette(palette)}
			<button
				class="btn btn-ghost btn-xs btn-square ml-auto"
				onclick={() => setPalette([...COLORS])}
				title={m.inspector.resetPalette}
				aria-label={m.inspector.resetPalette}
			>
				<span class="icon-[material-symbols-light--restart-alt] size-4" aria-hidden="true"></span>
			</button>
		{/if}
		<input
			type="color"
			class="{isDefaultPalette(palette) ? 'ml-auto' : ''} size-6 shrink-0 cursor-pointer bg-transparent"
			value={parsed?.hex ?? '#000000'}
			oninput={(e) => pick(e.currentTarget.value, false)}
			onchange={(e) => pick(e.currentTarget.value, true)}
			title={m.inspector.customColor}
			aria-label={m.inspector.customColor}
		/>
	</div>
</div>
