<script lang="ts">
	// Typing into a text box: a text field exactly over the box (same font, size, color, direction, background and
	// border), growing with the text as its sizing says (auto width: wider, else taller; a fixed size at least its
	// box). Meanwhile the box itself isn't drawn and has no frame (the field stands for it – nothing shows through a
	// see-through background, and the field's outline grows with it). Leaving it (Esc, a press elsewhere, another
	// selection) writes the text as one step – its lines broken for the box's width; an emptied box is removed.
	import { untrack } from 'svelte';
	import { m } from '#lib/i18n/index.js';
	import type { PdfDocument } from '#lib/model/document.svelte.js';
	import { typing } from '#lib/render/markup.js';
	import type { PdfSelection, PdfStage } from '#lib/render/surface.js';
	import { alignOf, borderOf, fontOf, isText, itemBounds, LINE_HEIGHT, roomOf, sizingOf, TEXT_PAD, textBounds, textExtent, withText, type TextItem } from '#lib/render/textbox.js';

	interface Props {
		selection: PdfSelection;
		doc: PdfDocument;
		stage: PdfStage | null;
		/** The text box being typed into (it is the selection) */
		editing: string | null;
		ondone: () => void;
	}

	let { selection, doc, stage, editing, ondone }: Props = $props();

	const item = $derived.by(() => {
		const [first] = selection.items;
		return editing && selection.items.length === 1 && isText(first) && first.id === editing ? first : null;
	});
	let draft = $state('');
	/** The box whose text `draft` holds: the field shows only then, so it is as high as that text from the start
	 * (shown with the previous draft, it measured one line and grew only while typing) */
	let drafted = $state('');

	/** Room to the page's edge for a box of auto width */
	function room(t: TextItem, page: number) {
		const p = doc.pages[page];
		return p ? roomOf(t, p) : Infinity;
	}

	/** The box as the draft would make it: an auto width follows the longest line */
	const live = $derived(item && sizingOf(item) === 'auto-width' ? withText(item, draft || ' ', room(item, selection.pageIndex)) : item);

	function commit(t: TextItem, page: number) {
		const text = draft.replace(/\s+$/, '');
		if (!text) doc.items.deleteItems(page, new Set([t.id]));
		else if (text !== t.text) doc.items.change(page, new Set([t.id]), (i) => (isText(i) && i.id === t.id ? withText(i, text, room(i, page)) : null));
	}

	/** Draws the box's place again (shown or hidden) */
	function repaint(t: TextItem, page: number) {
		const id = doc.pages[page]?.id;
		if (id) stage?.regionChanged(id, itemBounds(t));
	}

	// The box's text, the box hidden meanwhile; leaving it writes what was typed
	$effect(() => {
		const t = item;
		const page = selection.pageIndex;
		if (!t) return;
		untrack(() => {
			draft = t.text;
			drafted = t.id;
			typing.id = t.id;
			selection.hideFrame(true);
			repaint(t, page);
		});
		return () =>
			untrack(() => {
				drafted = '';
				typing.id = '';
				repaint(t, page);
				commit(t, page);
				selection.hideFrame(false);
				ondone();
			});
	});

	const framed = $derived(selection.rect);
	/** CSS pixels per page point, from the item on screen (exactly as the stage draws it) */
	const zoom = $derived.by(() => {
		if (!framed || !item) return 1;
		const b = itemBounds(item);
		return framed.w / (b.x1 - b.x0 || 1);
	});
	/** The box on screen: the selection's frame less a callout's line */
	const rect = $derived.by(() => {
		if (!framed || !item) return framed;
		const all = itemBounds(item);
		const b = textBounds(item);
		return { x: framed.x + (b.x0 - all.x0) * zoom, y: framed.y + (b.y0 - all.y0) * zoom, w: (b.x1 - b.x0) * zoom, h: (b.y1 - b.y0) * zoom };
	});
	/** Grows with the text (its height on the page follows when it is written) */
	function grow(el: HTMLTextAreaElement) {
		el.style.height = 'auto';
		el.style.height = `${el.scrollHeight}px`;
	}
</script>

{#if item && live && rect && drafted === item.id}
	{@const along = textExtent(live).w * zoom}
	<!-- An auto width doesn't wrap, unless it reached the page's edge -->
	{@const auto = sizingOf(item) === 'auto-width' && live.lines.length <= (draft || ' ').split('\n').length}
	{@const least = sizingOf(item) === 'fixed' ? textExtent(item).h * zoom : 0}
	{@const bw = borderOf(item) * zoom}
	<!-- From the text's own top left corner, turned with it: it grows the way its lines go -->
	{@const left = item.rot === 90 || item.rot === 180 ? rect.x + rect.w : rect.x}
	{@const top = item.rot === 180 || item.rot === 270 ? rect.y + rect.h : rect.y}
	<textarea
		rows="1"
		class="outline-selection pointer-events-auto absolute z-10 box-border block resize-none overflow-hidden outline-2"
		style="left: {left}px; top: {top}px; width: {along}px; min-height: {least}px; white-space: {auto ? 'pre' : 'pre-wrap'}; transform-origin: 0 0; transform: rotate({item.rot}deg); margin: 0;
			border: {bw ? `${bw}px solid ${item.border}` : '0'}; background: {item.fill ?? '#ffffff'};
			font: {fontOf(item.size * zoom)}; line-height: {LINE_HEIGHT}; text-align: {alignOf(item)}; padding: {TEXT_PAD * zoom}px; color: {item.color}"
		bind:value={draft}
		aria-label={m.textbox.label}
		oninput={(e) => grow(e.currentTarget)}
		{@attach (el) => {
			grow(el);
			el.focus();
			el.setSelectionRange(el.value.length, el.value.length);
		}}
	></textarea>
{/if}
