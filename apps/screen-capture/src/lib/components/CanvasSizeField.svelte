<script lang="ts">
	import { m } from '#lib/i18n/index.js';
	import { CANVAS_PRESETS, clampCanvasSize, MAX_CANVAS, MIN_CANVAS, type Size } from '#lib/project/canvas.js';

	interface Props {
		value: Size;
		onchange: (size: Size) => void;
	}

	let { value, onchange }: Props = $props();

	const preset = $derived(CANVAS_PRESETS.find((p) => p.width === value.width && p.height === value.height));
	/** Custom fields stay open after a choice, even if the values happen to match a preset */
	let customOpen = $state(false);
	const custom = $derived(customOpen || !preset);

	function choose(name: string) {
		const p = CANVAS_PRESETS.find((p) => p.name === name);
		customOpen = !p;
		if (p) onchange({ width: p.width, height: p.height });
	}

	function setDimension(key: keyof Size, input: HTMLInputElement) {
		const size = clampCanvasSize({ ...value, [key]: Number(input.value) });
		// Shows the clamped value even if the size didn't change
		input.value = String(size[key]);
		onchange(size);
	}
</script>

<div class="flex flex-col gap-2">
	<select
		class="select select-sm w-full"
		value={custom ? 'custom' : preset?.name}
		onchange={(e) => choose(e.currentTarget.value)}
		aria-label={m.newProject.size}
	>
		{#each CANVAS_PRESETS as p (p.name)}
			<option value={p.name}>{p.width} × {p.height} · {m.canvasSize[p.name]}</option>
		{/each}
		<option value="custom">{m.canvasSize.custom}</option>
	</select>
	{#if custom}
		<div class="flex items-center gap-2">
			<input
				type="number"
				class="input input-sm w-24"
				min={MIN_CANVAS}
				max={MAX_CANVAS}
				step="2"
				value={value.width}
				onchange={(e) => setDimension('width', e.currentTarget)}
				aria-label={m.canvasSize.width}
				title={m.canvasSize.width}
			/>
			<span class="opacity-60">×</span>
			<input
				type="number"
				class="input input-sm w-24"
				min={MIN_CANVAS}
				max={MAX_CANVAS}
				step="2"
				value={value.height}
				onchange={(e) => setDimension('height', e.currentTarget)}
				aria-label={m.canvasSize.height}
				title={m.canvasSize.height}
			/>
		</div>
	{/if}
</div>
