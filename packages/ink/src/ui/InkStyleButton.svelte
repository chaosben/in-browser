<script lang="ts" generics="P extends SurfacePage, I extends SceneItem">
	// The ribbon's style button of a drawing tool (format tabs): fill, line, hand-drawn and arrowheads of the selected
	// shapes (one undo step per choice), else the style of the next shape (remembered).
	import type { GroupSize } from '@in-browser/brand/ribbon.js';
	import RibbonPopover from '@in-browser/brand/RibbonPopover.svelte';
	import { inkMessages } from '../i18n/index.svelte.js';
	import type { Selection } from '../input/selection.svelte.js';
	import type { SceneItem, SurfacePage } from '../render/kit.js';
	import { closed, fitFromDrag, type ShapeKind, type ShapeStyle } from '../shapes.js';
	import ShapeStyleFields from './ShapeStyleFields.svelte';

	interface Props {
		/** The selection when there is one (else the next shape's style is set) */
		selection: Selection<P, I> | null;
		/** The tool settings (`InkTools`) */
		tools: { readonly tool: string; readonly shape: ShapeKind; shapeStyle: ShapeStyle; store(): void };
		size: GroupSize;
		/** Marks the button (`data-command`) */
		id?: string;
	}

	let { selection, tools, size, id = 'style' }: Props = $props();
	const s = $derived(selection);
</script>

<RibbonPopover {id} label={inkMessages().selection.style} icon="icon-[material-symbols-light--line-style]" {size} disabled={s ? !s.shapes.any : tools.tool !== 'shape'}>
	<div class="flex flex-col gap-2">
		{#if s}
			<ShapeStyleFields
				style={s.style}
				fillable={s.shapes.fillable}
				onchange={(style, final) => final && s.restyle(style)}
				heads={s.shapes.lines ? s.heads : null}
				onheads={(start, end) => s.setHeads(start, end)}
			/>
		{:else}
			<ShapeStyleFields
				style={tools.shapeStyle}
				fillable={closed(fitFromDrag(tools.shape, 0, 0, 10, 10))}
				onchange={(style) => {
					tools.shapeStyle = { ...tools.shapeStyle, ...style };
					tools.store();
				}}
			/>
		{/if}
	</div>
</RibbonPopover>
