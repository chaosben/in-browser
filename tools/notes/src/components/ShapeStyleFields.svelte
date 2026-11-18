<script lang="ts">
	// How shapes are drawn besides color and thickness: fill (closed shapes), line style, hand-drawn, arrowheads
	// (lines). Used by the shape tool's panel and the selection menu.
	import ColorField from '@in-browser/graphics/ColorField.svelte';
	import { DASHES, type ShapeStyle } from '#lib/ink/shapes.js';
	import { m } from '#lib/i18n/index.js';

	interface Props {
		style: ShapeStyle;
		/** Offer the fill (some shape encloses an area) */
		fillable: boolean;
		/** `final`: the color field is done (not while dragging in it) */
		onchange: (style: Partial<ShapeStyle>, final: boolean) => void;
		/** Arrowheads of lines, when lines are concerned */
		heads?: { start: boolean; end: boolean } | null;
		onheads?: (start: boolean, end: boolean) => void;
	}

	let { style, fillable, onchange, heads = null, onheads }: Props = $props();

	let fillOpen = $state(false);

	/** Fills are stored with their opacity (`#rrggbbaa`) */
	const fillOf = (v: string | null) => (v ? (v.length === 7 ? `${v}ff` : v).toLowerCase() : null);

	const HEADS = [
		{ id: 'none', start: false, end: false },
		{ id: 'end', start: false, end: true },
		{ id: 'start', start: true, end: false },
		{ id: 'both', start: true, end: true }
	] as const;

	/** Dash pattern of the line style previews */
	const PATTERNS = { solid: '', dashed: '5 3', dotted: '0 3.5' };
</script>

{#if fillable}
	<div class="flex items-center gap-1">
		<span class="w-20 shrink-0 truncate text-xs opacity-70">{m.shapeStyle.fill}</span>
		<button class="btn btn-sm min-w-0 flex-1 justify-start font-normal {fillOpen ? 'btn-active' : ''}" onclick={() => (fillOpen = !fillOpen)} aria-expanded={fillOpen}>
			{#if style.fill}
				<!-- The fill is a document color, shown as it is -->
				<span class="border-base-content/30 size-4 shrink-0 rounded border" style="background: {style.fill}" aria-hidden="true"></span>
			{:else}
				<span class="icon-[material-symbols-light--block] size-4 shrink-0 opacity-60" aria-hidden="true"></span>
			{/if}
			<span class="truncate">{style.fill ? style.fill.slice(0, 7) : m.shapeStyle.noFill}</span>
		</button>
	</div>
	{#if fillOpen}
		<ColorField value={style.fill} allowNone onchange={(v, final) => onchange({ fill: fillOf(v) }, final)} />
	{/if}
{/if}
<div class="flex items-center gap-1">
	<span class="w-20 shrink-0 truncate text-xs opacity-70">{m.shapeStyle.line}</span>
	<div class="join min-w-0 flex-1" role="group" aria-label={m.shapeStyle.line}>
		{#each DASHES as dash (dash)}
			<button
				class="btn btn-sm join-item flex-1 px-1 {style.dash === dash ? 'btn-active btn-primary' : ''}"
				onclick={() => onchange({ dash }, true)}
				title={m.shapeStyle.dashes[dash]}
				aria-label={m.shapeStyle.dashes[dash]}
				aria-pressed={style.dash === dash}
			>
				<svg viewBox="0 0 32 8" class="h-2 w-8" aria-hidden="true">
					<line x1="3" y1="4" x2="29" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray={PATTERNS[dash]} />
				</svg>
			</button>
		{/each}
	</div>
</div>
<label class="flex cursor-pointer items-center gap-1">
	<span class="w-20 shrink-0 truncate text-xs opacity-70">{m.shapeStyle.sketch}</span>
	<input type="checkbox" class="toggle toggle-sm toggle-primary" checked={style.sketch} onchange={(e) => onchange({ sketch: e.currentTarget.checked }, true)} />
</label>
{#if heads && onheads}
	<div class="flex items-center gap-1">
		<span class="w-20 shrink-0 truncate text-xs opacity-70">{m.shapeStyle.heads}</span>
		<div class="join min-w-0 flex-1" role="group" aria-label={m.shapeStyle.heads}>
			{#each HEADS as h (h.id)}
				{@const active = heads.start === h.start && heads.end === h.end}
				<button
					class="btn btn-sm join-item flex-1 px-1 {active ? 'btn-active btn-primary' : ''}"
					onclick={() => onheads(h.start, h.end)}
					title={m.shapeStyle.headOptions[h.id]}
					aria-label={m.shapeStyle.headOptions[h.id]}
					aria-pressed={active}
				>
					<svg viewBox="0 0 32 12" class="h-3 w-8" aria-hidden="true">
						<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
							<line x1="3" y1="6" x2="29" y2="6" />
							{#if h.end}<polyline points="24,2 29,6 24,10" />{/if}
							{#if h.start}<polyline points="8,2 3,6 8,10" />{/if}
						</g>
					</svg>
				</button>
			{/each}
		</div>
	</div>
{/if}
