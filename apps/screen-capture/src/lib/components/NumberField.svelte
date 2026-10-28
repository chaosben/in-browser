<script lang="ts">
	import { locale } from '#lib/i18n/index.js';
	import { clampNumber, formatNumber, parseNumber } from '#lib/util/number.js';

	interface Props {
		label: string;
		/** In display units (px, %, s …) */
		value: number;
		unit?: string;
		min?: number;
		max?: number;
		step?: number;
		decimals?: number;
		/** `row`: label left, field right; `inline`: narrow field for rows with two values (e.g. fades) */
		layout?: 'row' | 'inline';
		/** Marks the field (yellow, icon instead of the unit); the text explains it as a tooltip */
		warning?: string;
		/** Every change: typed value confirmed, arrow key, each step while dragging */
		oninput: (value: number) => void;
		/** End of a change (one undo step), e.g. after dragging */
		oncommit?: () => void;
	}

	let {
		label,
		value,
		unit = '',
		min = -Infinity,
		max = Infinity,
		step = 1,
		decimals = 0,
		layout = 'row',
		warning,
		oninput,
		oncommit
	}: Props = $props();

	/** Text while typing; null shows the value */
	let draft = $state<string | null>(null);
	let input: HTMLInputElement;

	const shown = $derived(draft ?? formatNumber(value, decimals, locale));

	function set(v: number) {
		const next = clampNumber(v, min, max, decimals);
		if (next !== value) oninput(next);
	}

	function commitDraft() {
		if (draft === null) return;
		const v = parseNumber(draft);
		draft = null;
		if (v === null) return;
		set(v);
		oncommit?.();
	}

	function keydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			commitDraft();
		} else if (e.key === 'Escape') {
			draft = null;
			input.blur();
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			draft = null;
			set(value + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1));
			oncommit?.();
		}
	}

	/** Dragging the label left/right changes the value: a step per 2 px, Shift ×10, Alt ×0.1 */
	function scrub(e: PointerEvent) {
		if (e.button !== 0) return;
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const x0 = e.clientX;
		const v0 = value;
		let moved = false;
		const onmove = (ev: PointerEvent) => {
			const dx = ev.clientX - x0;
			if (!moved && Math.abs(dx) < 3) return;
			moved = true;
			const factor = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
			set(v0 + Math.round(dx / 2) * step * factor);
		};
		const onup = () => {
			el.removeEventListener('pointermove', onmove);
			el.removeEventListener('pointerup', onup);
			el.removeEventListener('pointercancel', onup);
			// A click without dragging edits the value
			if (moved) oncommit?.();
			else input.focus();
		};
		el.addEventListener('pointermove', onmove);
		el.addEventListener('pointerup', onup);
		el.addEventListener('pointercancel', onup);
	}
</script>

<div class="flex min-w-0 items-center gap-1 text-xs">
	<!-- Drag area; the field itself carries the label for assistive technology -->
	<span
		class="min-w-0 flex-1 cursor-ew-resize touch-none truncate opacity-70 select-none"
		onpointerdown={scrub}
		role="presentation"
	>
		{label}
	</span>
	<input
		bind:this={input}
		aria-label={unit ? `${label} (${unit})` : label}
		type="text"
		inputmode="decimal"
		role="spinbutton"
		aria-valuenow={value}
		aria-valuemin={Number.isFinite(min) ? min : undefined}
		aria-valuemax={Number.isFinite(max) ? max : undefined}
		class="input input-xs text-right tabular-nums {layout === 'row' ? 'w-20' : 'w-12'} {warning
			? 'input-warning'
			: ''}"
		value={shown}
		title={warning}
		oninput={(e) => (draft = e.currentTarget.value)}
		onkeydown={keydown}
		onblur={commitDraft}
		onfocus={(e) => e.currentTarget.select()}
	/>
	<!-- Fixed slot: a warning replaces the unit, so the row never reflows -->
	<span class="grid w-5 shrink-0 place-items-center">
		{#if warning}
			<span class="icon-[material-symbols-light--warning-outline] text-warning size-4" title={warning} aria-label={warning} role="img"
			></span>
		{:else}
			<span class="opacity-70">{unit}</span>
		{/if}
	</span>
</div>
