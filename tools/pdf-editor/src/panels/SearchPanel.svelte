<script lang="ts">
	// Search in the whole PDF: Enter finds (again: the next hit), Shift+Enter the previous one; every hit listed with
	// the words around it, marked on the pages.
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import { m } from '#lib/i18n/index.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';

	let { context, close }: PanelProps<EditorState> = $props();

	let found = $state({ query: '', matchCase: false });
	let list = $state<HTMLElement>();

	const focus = (input: HTMLInputElement) => {
		input.focus();
		input.select();
	};

	async function submit(back: boolean) {
		const s = context.search;
		if (s.query !== found.query || s.matchCase !== found.matchCase || !context.hits.length) {
			found = { query: s.query, matchCase: s.matchCase };
			await context.find();
		} else context.showHit(context.hit + (back ? -1 : 1));
	}

	function keydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		void submit(e.shiftKey);
	}

	function go(i: number) {
		context.showHit(i);
		if (matchMedia('(pointer: coarse), (max-width: 639px)').matches) close();
	}

	// The current hit stays in sight in the list
	$effect(() => {
		const i = context.hit;
		list?.querySelector(`[data-hit="${i}"]`)?.scrollIntoView({ block: 'nearest' });
	});
</script>

<div class="flex h-full flex-col">
	<div class="border-base-300 flex flex-col gap-2 border-b p-2">
		<div class="join w-full">
			<input
				class="input input-sm join-item min-w-0 flex-1"
				type="search"
				placeholder={m.panels.searchPlaceholder}
				aria-label={m.panels.searchPlaceholder}
				bind:value={context.search.query}
				onkeydown={keydown}
				{@attach focus}
			/>
			<button class="btn btn-sm join-item btn-square" onclick={() => submit(true)} disabled={!context.hits.length} title={m.panels.previous} aria-label={m.panels.previous}>
				<span class="icon-[material-symbols-light--keyboard-arrow-up] size-5" aria-hidden="true"></span>
			</button>
			<button class="btn btn-sm join-item btn-square" onclick={() => submit(false)} disabled={!context.search.query.trim()} title={m.panels.next} aria-label={m.panels.next}>
				<span class="icon-[material-symbols-light--keyboard-arrow-down] size-5" aria-hidden="true"></span>
			</button>
		</div>
		<label class="flex cursor-pointer items-center gap-2 text-sm">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={context.search.matchCase} />{m.panels.matchCase}
		</label>
		<p class="text-xs opacity-70" aria-live="polite">
			{#if context.search.busy}{m.panels.searching}{:else if found.query && !context.hits.length}{m.panels.noResults}{:else if context.hits.length}{m.panels.results(context.hits.length)}{/if}
		</p>
	</div>
	<ul bind:this={list} class="min-h-0 flex-1 overflow-auto p-1">
		{#each context.hits as hit, i (i)}
			<li data-hit={i}>
				<button class={['w-full rounded px-2 py-1.5 text-left text-sm', i === context.hit ? 'bg-selection/20' : 'hover:bg-base-200']} onclick={() => go(i)}>
					<span class="block text-xs opacity-60">{m.panels.pageLabel(String(hit.page + 1))}</span>
					<span class="line-clamp-2">{hit.before}<mark class="bg-selection/40 text-base-content rounded-sm">{hit.match}</mark>{hit.after}</span>
				</button>
			</li>
		{/each}
	</ul>
</div>
