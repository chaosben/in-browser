<script lang="ts">
	// How shapes are drawn besides color and thickness: fill and cloud (closed shapes), line style, hand-drawn, what
	// lines carry at their ends. Used by the shape tool's panel and the selection menu.
	import ColorField from '@in-browser/graphics/ColorField.svelte';
	import { inkMessages } from '../i18n/index.svelte.js';
	import { DASHES, LINE_ENDS, type LineEnd, type ShapeStyle } from '../shapes.js';

	interface Props {
		style: ShapeStyle;
		/** Offer the fill (some shape encloses an area) */
		fillable: boolean;
		/** `final`: the color field is done (not while dragging in it) */
		onchange: (style: Partial<ShapeStyle>, final: boolean) => void;
		/** What lines carry at their ends, when lines are concerned */
		heads?: { start: LineEnd | null; end: LineEnd | null } | null;
		onheads?: (start: LineEnd | null, end: LineEnd | null) => void;
	}

	let { style, fillable, onchange, heads = null, onheads }: Props = $props();

	const m = $derived(inkMessages());

	let fillOpen = $state(false);

	/** Fills are stored with their opacity (`#rrggbbaa`) */
	const fillOf = (v: string | null) => (v ? (v.length === 7 ? `${v}ff` : v).toLowerCase() : null);

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
{#if fillable}
	<label class="flex cursor-pointer items-center gap-1">
		<span class="w-20 shrink-0 truncate text-xs opacity-70">{m.shapeStyle.cloud}</span>
		<input type="checkbox" class="toggle toggle-sm toggle-primary" checked={style.cloud ?? false} onchange={(e) => onchange({ cloud: e.currentTarget.checked }, true)} />
	</label>
{/if}
{#if heads && onheads}
	{#each ['start', 'end'] as const as side (side)}
		<label class="flex items-center gap-1">
			<span class="w-20 shrink-0 truncate text-xs opacity-70">{m.shapeStyle.ends[side]}</span>
			<select
				class="select select-sm min-w-0 flex-1"
				value={heads[side] ?? ''}
				onchange={(e) => {
					const end = (e.currentTarget.value || null) as LineEnd | null;
					onheads(side === 'start' ? end : heads.start, side === 'end' ? end : heads.end);
				}}
			>
				<option value="">{m.shapeStyle.endOptions.none}</option>
				{#each LINE_ENDS as end (end)}<option value={end}>{m.shapeStyle.endOptions[end]}</option>{/each}
			</select>
		</label>
	{/each}
{/if}
