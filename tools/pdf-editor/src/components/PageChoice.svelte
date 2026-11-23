<script lang="ts" module>
	export type PageWhich = 'all' | 'current' | 'picked' | 'range';
</script>

<script lang="ts">
	// Which pages a job takes – all, the current one, those picked in the panel “Pages” or typed like `1-3, 7` (by
	// place) – in one row. Shared by “Print …” and “Export …”; `places` is null while the typed range is invalid or
	// empty, `problem` then says why (the dialog shows it in its message line).
	import { m } from '#lib/i18n/index.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';
	import { parsePageRange } from '#lib/model/page-range.js';

	let {
		ed,
		which: initial,
		disabled = false,
		places = $bindable(),
		problem = $bindable(),
		small = false
	}: {
		ed: EditorState;
		which: PageWhich;
		disabled?: boolean;
		places: number[] | null;
		problem?: string | null;
		/** Labels and fields as small as the suite's number fields (dialogs of such rows) */
		small?: boolean;
	} = $props();

	const count = $derived(ed.pageCount);
	/** Places of the pages picked in the panel "Pages" */
	const picked = $derived((ed.doc?.pages ?? []).flatMap((p, i) => (ed.pagePick.has(p.id) ? [i] : [])));
	// svelte-ignore state_referenced_locally
	let which = $state<PageWhich>(initial === 'picked' && !ed.pagePick.selected.size ? 'current' : initial);
	let range = $state('');
	const invalid = $derived(which === 'range' && !!range.trim() && !parsePageRange(range, count));

	$effect(() => {
		places =
			which === 'all' ? Array.from({ length: count }, (_, i) => i) : which === 'current' ? [ed.current] : which === 'picked' ? picked : parsePageRange(range, count);
		problem = invalid ? m.pageChoice.rangeInvalid(count) : null;
	});
</script>

<div class={['flex items-center gap-2', small && 'text-xs']}>
	<span class={['w-28 shrink-0', small ? 'opacity-70' : 'text-sm']}>{m.pageChoice.pages}</span>
	<select class={['select min-w-0 flex-1', small ? 'select-xs' : 'select-sm']} aria-label={m.pageChoice.pages} bind:value={which} {disabled}>
		<option value="all">{m.pageChoice.all(count)}</option>
		<option value="current">{m.pageChoice.current(ed.current + 1)}</option>
		<option value="picked" disabled={!picked.length}>{m.pageChoice.picked(picked.length)}</option>
		<option value="range">{m.pageChoice.range}</option>
	</select>
	<input
		class={['input w-28 shrink-0', small ? 'input-xs' : 'input-sm', invalid && 'input-error']}
		placeholder={m.pageChoice.rangePlaceholder}
		aria-label={m.pageChoice.range}
		bind:value={range}
		onfocus={() => (which = 'range')}
		{disabled}
	/>
</div>
