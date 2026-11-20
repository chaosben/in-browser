<script lang="ts">
	// Guides while dragging, the same in every tool: lines across the frame, each with a badge where it starts showing
	// what it snaps to (the frame or an item); outlines of the items snapped to; equal gaps as measures with their length.
	// Placed over the content (pointer events pass through); `unit` maps the view's numbers to CSS lengths.
	import type { GuideView } from './snap.js';

	interface Unit {
		x(v: number): string;
		y(v: number): string;
		w(v: number): string;
		h(v: number): string;
	}

	const PX: Unit = { x: (v) => `${v}px`, y: (v) => `${v}px`, w: (v) => `${v}px`, h: (v) => `${v}px` };

	let { view, unit = PX }: { view: GuideView | null; unit?: Unit } = $props();

	const box = (r: { x: number; y: number; w: number; h: number }) => `left: ${unit.x(r.x)}; top: ${unit.y(r.y)}; width: ${unit.w(r.w)}; height: ${unit.h(r.h)}`;
</script>

{#if view}
	{@const f = view.frame}
	{#each view.gaps as gap, i (i)}
		{#if gap.axis === 'x'}
			<div
				class="border-guide pointer-events-none absolute flex h-2 -translate-y-1/2 justify-center border-x"
				style="left: {unit.x(gap.from)}; width: {unit.w(gap.to - gap.from)}; top: {unit.y(gap.at)}"
			>
				<div class="bg-guide absolute inset-x-0 top-1/2 h-px"></div>
				<span class="bg-guide text-guide-content absolute top-2 rounded px-1 text-[10px] leading-4 whitespace-nowrap">{gap.label}</span>
			</div>
		{:else}
			<div
				class="border-guide pointer-events-none absolute flex w-2 -translate-x-1/2 items-center border-y"
				style="top: {unit.y(gap.from)}; height: {unit.h(gap.to - gap.from)}; left: {unit.x(gap.at)}"
			>
				<div class="bg-guide absolute inset-y-0 left-1/2 w-px"></div>
				<span class="bg-guide text-guide-content absolute left-2 rounded px-1 text-[10px] leading-4 whitespace-nowrap">{gap.label}</span>
			</div>
		{/if}
	{/each}
	{#each view.outlines as outline, i (i)}
		<div class="outline-guide pointer-events-none absolute outline-1" style={box(outline)}></div>
	{/each}
	{#each view.lines as line (line.axis)}
		{#if line.axis === 'x'}
			<div class="bg-guide pointer-events-none absolute w-px" style="left: {unit.x(line.at)}; top: {unit.y(f.y)}; height: {unit.h(f.h)}"></div>
		{:else}
			<div class="bg-guide pointer-events-none absolute h-px" style="top: {unit.y(line.at)}; left: {unit.x(f.x)}; width: {unit.w(f.w)}"></div>
		{/if}
		<!-- Where the line starts, kept in sight when the frame's edge is scrolled away -->
		<span
			class="bg-guide text-guide-content pointer-events-none absolute flex rounded p-0.5"
			style={line.axis === 'x'
				? `left: ${unit.x(line.at)}; top: max(4px, ${unit.y(f.y)} + 4px); transform: translateX(-50%)`
				: `top: ${unit.y(line.at)}; left: max(4px, ${unit.x(f.x)} + 4px); transform: translateY(-50%)`}
			role="img"
			aria-label={line.mark.label}
			data-guide-mark={line.axis}
		>
			{#if line.mark.glyph}
				<svg class="size-3.5" viewBox="0 0 24 24" aria-hidden="true">
					<polyline points={line.mark.glyph} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			{:else}
				<span class="{line.mark.icon ?? ''} size-3.5" aria-hidden="true"></span>
			{/if}
		</span>
	{/each}
{/if}
