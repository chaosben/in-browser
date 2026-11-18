<script lang="ts">
	import { onMount } from 'svelte';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { m } from '#lib/i18n/index.js';

	// The field for changing a cell or value in place, over what it edits. Several lines are allowed: on a keyboard
	// Enter saves and Shift+Enter or Alt+Enter starts a new line (as in spreadsheets); by touch Enter starts a new
	// line and the ✓ below saves. Tapping or clicking elsewhere saves as well.

	let {
		value = $bindable(),
		label,
		select = true,
		oncommit,
		oncancel
	}: {
		value: string;
		label: string;
		/** Select the text at the start (off when editing started with a typed character) */
		select?: boolean;
		/** `next`: where the selection goes afterwards (Enter: down, Tab: right, Shift+Tab: left) */
		oncommit: (next?: 'down' | 'right' | 'left') => void;
		oncancel: () => void;
	} = $props();

	let field = $state<HTMLTextAreaElement>();
	let done = false;
	const lines = $derived(value.split('\n').length);
	const multiline = $derived(lines > 1);

	onMount(() => {
		field?.focus();
		if (select) field?.select();
		else field?.setSelectionRange(value.length, value.length);
	});

	function finish(next?: 'down' | 'right' | 'left') {
		if (done) return;
		done = true;
		oncommit(next);
	}

	function cancel() {
		if (done) return;
		done = true;
		oncancel();
	}

	function newLine() {
		// In the field itself, so the cursor is behind the line break before the next key arrives
		field!.setRangeText('\n', field!.selectionStart, field!.selectionEnd, 'end');
		value = field!.value;
	}

	function key(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Escape') return e.preventDefault(), cancel();
		if (e.key === 'Tab') return e.preventDefault(), finish(e.shiftKey ? 'left' : 'right');
		if (e.key !== 'Enter' || e.isComposing) return;
		// Touch keyboards have no Shift+Enter: there Enter is a new line and ✓ saves
		if (coarsePointer.current) return;
		e.preventDefault();
		if (e.shiftKey || e.altKey) newLine();
		else finish('down');
	}
</script>

<div class={['absolute top-0 left-0 z-30', multiline || coarsePointer.current ? 'min-w-full' : 'size-full']} style:width={multiline ? 'max(100%, 22rem)' : undefined}>
	<textarea
		bind:this={field}
		bind:value
		rows={Math.min(lines, 10)}
		class={[
			'bg-base-100 outline-selection block w-full resize-none px-2 outline-2 -outline-offset-2',
			multiline ? 'rounded-box shadow-lg' : 'h-full overflow-hidden whitespace-pre'
		]}
		style:line-height={multiline ? '1.5' : undefined}
		aria-label={label}
		aria-multiline="true"
		onkeydown={key}
		onblur={() => finish()}
	></textarea>
	{#if coarsePointer.current}
		<!-- Pressed before the field loses focus, so the ✕ isn't taken for "save" -->
		<div class="bg-base-200 rounded-box mt-1 flex justify-end gap-1 p-1 shadow-lg">
			<button class="btn btn-ghost btn-sm btn-square" aria-label={m.common.cancel} title={m.common.cancel} onpointerdown={(e) => (e.preventDefault(), cancel())}>
				<span class="icon-[material-symbols-light--close] size-5" aria-hidden="true"></span>
			</button>
			<button class="btn btn-primary btn-sm btn-square" aria-label={m.views.apply} title={m.views.apply} onpointerdown={(e) => (e.preventDefault(), finish())}>
				<span class="icon-[material-symbols-light--check] size-5" aria-hidden="true"></span>
			</button>
		</div>
	{/if}
</div>
