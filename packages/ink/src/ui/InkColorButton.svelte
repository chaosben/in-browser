<script lang="ts" generics="P extends SurfacePage, I extends SceneItem">
	// The ribbon's color button of a drawing tool (format tabs): the color of the selection – a color dragged in the
	// field (opacity, picker) is shown at once and applied as one undo step at the end – else of what the chosen tool
	// draws next (set at once). Every color may be see-through. The popover stays open while colors are tried.
	import type { GroupSize } from '@in-browser/brand/ribbon.js';
	import RibbonPopover from '@in-browser/brand/RibbonPopover.svelte';
	import ColorField from '@in-browser/graphics/ColorField.svelte';
	import { inkMessages } from '../i18n/index.svelte.js';
	import type { Selection } from '../input/selection.svelte.js';
	import type { SceneItem, SurfacePage } from '../render/kit.js';

	interface Props {
		/** The selection when there is one (else the tool's color is set) */
		selection: Selection<P, I> | null;
		/** The chosen tool's color (with its opacity) */
		value: string;
		/** Sets the chosen tool's color */
		onpick: (color: string) => void;
		size: GroupSize;
		disabled?: boolean;
		/** Defaults to "Color" */
		label?: string;
		/** Marks the button (`data-command`) */
		id?: string;
	}

	let { selection, value, onpick, size, disabled = false, label, id = 'color' }: Props = $props();

	/** The selection's color while it is dragged; gone with another selection */
	let draft = $derived.by((): string | null => {
		void selection?.items;
		return null;
	});
	const shown = $derived(selection ? (draft ?? selection.color) : value);
</script>

<RibbonPopover {id} label={label ?? inkMessages().selection.color} icon="icon-[material-symbols-light--palette-outline]" {size} swatch={shown} {disabled}>
	<ColorField
		value={shown}
		onchange={(v, final) => {
			if (!v) return;
			if (!selection) return onpick(v);
			draft = final ? null : v;
			if (final) selection.recolor(v);
		}}
	/>
</RibbonPopover>
