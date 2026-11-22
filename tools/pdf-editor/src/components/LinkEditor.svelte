<script lang="ts">
	// Where a link leads: a web address or a page of this PDF, set in a small box at the link – open while a link is
	// drawn, pressed with "Link", double-clicked with "Select" or opened with "Edit link". Enter or leaving keeps
	// (one step), Esc puts back what was there; a new link left without a target disappears.
	import { untrack } from 'svelte';
	import NumberField from '@in-browser/graphics/NumberField.svelte';
	import { m } from '#lib/i18n/index.js';
	import type { PdfDocument } from '#lib/model/document.svelte.js';
	import { isLink, safeUrl, type LinkItem } from '#lib/render/link.js';
	import type { PdfSelection } from '#lib/render/surface.js';

	interface Props {
		selection: PdfSelection;
		doc: PdfDocument;
		/** The link being set (it is the selection) */
		editing: string | null;
		ondone: () => void;
	}

	let { selection, doc, editing, ondone }: Props = $props();

	const link = $derived.by(() => {
		const [first] = selection.items;
		return editing && selection.items.length === 1 && isLink(first) && first.id === editing ? first : null;
	});
	let kind = $state<'url' | 'page'>('url');
	let url = $state('');
	let page = $state(1);
	let discard = false;
	const address = $derived(safeUrl(url));

	function commit(l: LinkItem, index: number) {
		if (discard) return;
		const target = kind === 'url' ? (address ? { url: address } : null) : doc.pages[page - 1] ? { page: doc.pages[page - 1].id } : null;
		// Nothing to lead to: a link that had a target keeps it, a new one goes
		if (!target) return void (!l.url && !l.page && doc.items.erase(index, [l]));
		if (target.url === l.url && target.page === l.page) return;
		doc.items.change(index, new Set([l.id]), (item) => (isLink(item) && item.id === l.id ? { id: item.id, type: 'link', x: item.x, y: item.y, w: item.w, h: item.h, ...target } : null));
	}

	$effect(() => {
		const l = link;
		const index = selection.pageIndex;
		if (!l) return;
		untrack(() => {
			const at = doc.pages.findIndex((p) => p.id === l.page);
			kind = at >= 0 ? 'page' : 'url';
			url = l.url ?? '';
			page = at >= 0 ? at + 1 : Math.min(doc.pages.length, index + 1);
			discard = false;
		});
		return () =>
			untrack(() => {
				commit(l, index);
				ondone();
			});
	});

	function keep(e: SubmitEvent) {
		e.preventDefault();
		ondone();
	}
	function escape(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		e.stopPropagation();
		discard = true;
		ondone();
	}

	const rect = $derived(selection.rect);
	const WIDTH = 288;
</script>

{#if link && rect}
	<!-- Below the link (above it near the bottom of the window), inside the window -->
	{@const below = rect.y + rect.h + 8 + 150 < window.innerHeight}
	<form
		class="bg-base-100 border-base-300 pointer-events-auto absolute z-10 flex flex-col gap-2 rounded border p-2 text-sm shadow-lg"
		style="left: {Math.max(8, Math.min(rect.x, window.innerWidth - WIDTH - 8))}px; {below ? `top: ${rect.y + rect.h + 8}px` : `top: ${rect.y - 8}px; transform: translateY(-100%)`}; width: {WIDTH}px; max-width: calc(100vw - 1rem)"
		aria-label={m.link.edit}
		onsubmit={keep}
	>
		<label class="flex items-center gap-2"><input type="radio" class="radio radio-sm" bind:group={kind} value="url" />{m.link.toUrl}</label>
		<input
			class="input input-sm w-full"
			type="text"
			inputmode="url"
			bind:value={url}
			disabled={kind !== 'url'}
			aria-label={m.link.url}
			placeholder={m.link.urlPlaceholder}
			aria-invalid={kind === 'url' && !!url.trim() && !address}
			onkeydown={escape}
			{@attach (el) => {
				if (kind === 'url') el.focus();
			}}
		/>
		<label class="flex items-center gap-2"><input type="radio" class="radio radio-sm" bind:group={kind} value="page" />{m.link.toPage}</label>
		<fieldset disabled={kind !== 'page'} class={[kind !== 'page' && 'opacity-50']}>
			<NumberField label={m.link.page(doc.pages.length)} value={page} min={1} max={doc.pages.length} oninput={(v) => (page = Math.round(v))} />
		</fieldset>
		<!-- One line always: nothing jumps -->
		<p class="text-error min-h-5 text-xs">{kind === 'url' && url.trim() && !address ? m.link.invalid : ''}</p>
		<!-- Enter keeps, from every field -->
		<button type="submit" class="sr-only" tabindex="-1">{m.link.edit}</button>
	</form>
{/if}
