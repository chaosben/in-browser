<script lang="ts">
	// A text or callout typed into right on the preview (the suite's way, `ui.md` “Editing in place”): the field lies
	// over the box in its font, size, alignment and color; the canvas draws the box's background and tail but not its
	// text meanwhile (`typingText`). Every input changes the item (so the box grows as it is drawn) as one gesture:
	// leaving keeps it as one undo step, Esc puts back what was there.
	import RichTextEditor from '@in-browser/graphics/RichTextEditor.svelte';
	import { fontFamilyCss, fontWeight } from '@in-browser/graphics/fonts.js';
	import type { FullStyle, RichText } from '@in-browser/graphics/rich-text.js';
	import { onMount, untrack } from 'svelte';
	import type { Editor } from '#lib/project/editor.svelte.js';
	import type { Player } from '#lib/preview/player.svelte.js';
	import type { Annotation, Rect } from '#lib/project/types.js';
	import { rememberStyle } from '#lib/project/styles.js';
	import { baseStyle, fitTextToCanvas, lineHeightOf, overlayBounds, richTextOf, typingText } from '#lib/render/overlays.js';
	import { richPatch, type TextLike } from '#lib/ui/text-commands.js';
	import { updateItem } from '#lib/timeline/ops.js';
	import { m } from '#lib/i18n/index.js';

	interface Props {
		editor: Editor;
		player: Player;
		item: TextLike;
		/** The box on the canvas (fractions of the canvas), and the layer's height in screen pixels */
		rect: Rect;
		layerHeight: number;
		/** Typing ended (left, Esc) */
		ondone: () => void;
	}

	let { editor, player, item, rect, layerHeight, ondone }: Props = $props();

	// svelte-ignore state_referenced_locally
	const id = item.id;
	const key = `type-${id}`;
	/** Esc: nothing of this typing stays */
	let cancelled = false;
	/** The style the field starts with (built anew would lose the caret) */
	// svelte-ignore state_referenced_locally
	const base: FullStyle = baseStyle(item);
	// svelte-ignore state_referenced_locally
	const start: RichText = richTextOf(item);

	onMount(() => {
		player.pause();
		typingText.id = id;
		untrack(() => player.redraw());
		return () => {
			typingText.id = '';
			if (cancelled) editor.cancelGesture(key);
			else editor.endGesture();
			untrack(() => player.redraw());
		};
	});

	function input(value: RichText) {
		const o = editor.project.timeline.items.find((i) => i.id === id);
		if (!o || o.type !== 'annotation' || (o.kind !== 'text' && o.kind !== 'callout')) return;
		const patch = richPatch(value);
		const { width: W, height: H } = editor.project;
		const fit = fitTextToCanvas({ ...o, ...patch } as typeof o, (a) => overlayBounds(a, W, H));
		const changes = { ...patch, ...fit } as Partial<Annotation>;
		editor.update((t) => updateItem(t, id, changes), key);
		rememberStyle(o.kind, patch);
	}

	function keydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		e.stopPropagation();
		cancelled = true;
		ondone();
	}

	/** Inner margin on screen (only a box with a background has one), in the canvas's fractions of its height */
	const pad = $derived(item.background ? item.padding : { top: 0, right: 0, bottom: 0, left: 0 });
	const auto = $derived(item.boxWidth === undefined);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="absolute z-10"
	style="left: {rect.x * 100}%; top: {rect.y * 100}%; width: {auto ? 'auto' : `${rect.w * 100}%`}; min-width: {rect.w * 100}%; min-height: {rect.h * 100}%"
	onfocusout={(e) => {
		// Leaving the field keeps it – not when the focus goes to a format command, a menu or a popover of the ribbon
		const to = e.relatedTarget as Element | null;
		if (to?.closest('[data-command], [popover], [role="menu"]')) return;
		ondone();
	}}
	onkeydown={keydown}
	onpointerdown={(e) => e.stopPropagation()}
>
	{#key id}
		<RichTextEditor
			value={start}
			{base}
			zoom={layerHeight}
			label={m.textbox.label}
			class="outline-selection block outline-2 outline-dashed {auto ? 'whitespace-pre' : 'whitespace-pre-wrap'}"
			style="padding: {pad.top * layerHeight}px {pad.right * layerHeight}px {pad.bottom * layerHeight}px {pad.left * layerHeight}px; font-family: {fontFamilyCss(item.font)}; font-weight: {fontWeight(base)}; font-style: {item.italic ? 'italic' : 'normal'}; text-decoration: {item.underline ? 'underline' : 'none'}; font-size: {item.size * layerHeight}px; line-height: {lineHeightOf(item)}; text-align: {item.align}; color: {item.color}; caret-color: {item.color}; background: transparent"
			oninput={input}
		/>
	{/key}
</div>
