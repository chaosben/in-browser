<script lang="ts">
	// The steps of the current page (`render/steps.ts`): one row per step – the page as it comes, then each “Next” –
	// with what comes and goes there. A click selects those comments; the menu of a step (right click, long press, ⋯)
	// moves it, puts a step before it or deletes it – for all comments of the page, one undo step each; “Another step”
	// adds one at the end. Steps are managed here only; which comments show at a step is set with “Show and hide” on
	// the format tabs. With a mouse a step is dragged to another place.
	import MoreButton from '@in-browser/brand/MoreButton.svelte';
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { openContextMenu, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';
	import { changesAt, MAX_STEP } from '#lib/render/steps.js';

	let { context }: PanelProps<EditorState> = $props();

	const doc = $derived(context.doc);
	const index = $derived(context.current);
	const page = $derived(doc?.pages[index] ?? null);
	const locked = $derived(doc?.editable !== 'yes');
	const rows = $derived.by(() => {
		void doc?.changes;
		if (!doc || !page) return [];
		const items = doc.scene(page.id)?.items ?? [];
		return Array.from({ length: context.stepsOf(index) + 1 }, (_, step) => ({ step, ...changesAt(items, step) }));
	});
	const steps = $derived(rows.length - 1);

	const name = (step: number) => (step ? m.present.step(step) : m.present.withPage);

	function menu(step: number): MenuEntry[] {
		const off = locked || !doc;
		return [
			{ label: m.present.stepUp, icon: 'icon-[material-symbols-light--arrow-upward]', disabled: off || step < 2, run: () => context.moveStep(index, step, step - 1) },
			{ label: m.present.stepDown, icon: 'icon-[material-symbols-light--arrow-downward]', disabled: off || step >= steps, run: () => context.moveStep(index, step, step + 1) },
			{ label: m.present.stepInsert, icon: 'icon-[material-symbols-light--add]', disabled: off || steps >= MAX_STEP, run: () => context.insertStep(index, step) },
			{ separator: true },
			{ label: m.present.stepDelete, icon: 'icon-[material-symbols-light--delete-outline]', disabled: off, run: () => context.removeStep(index, step) }
		];
	}

	// Dragging (mouse): a step to another place – the step it would stand before shows as a line
	let dragging = $state<number | null>(null);
	let dropAt = $state<number | null>(null);

	function dragStart(e: DragEvent, step: number) {
		if (locked || !step) return e.preventDefault();
		dragging = step;
		e.dataTransfer?.setData('text/plain', name(step));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function dragOver(e: DragEvent, step: number) {
		if (dragging === null) return;
		e.preventDefault();
		const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
		// Before or after this step by the half the pointer is in; never before the page as it comes
		dropAt = Math.max(1, step + (e.clientY > box.top + box.height / 2 ? 1 : 0));
	}

	function drop(e: DragEvent) {
		e.preventDefault();
		const from = dragging;
		const before = dropAt;
		dragEnd();
		if (from === null || before === null) return;
		const to = before > from ? before - 1 : before;
		if (to !== from) context.moveStep(index, from, to);
	}

	function dragEnd() {
		dragging = null;
		dropAt = null;
	}
</script>

<div class="flex h-full flex-col gap-2 overflow-y-auto p-2">
	<p class="text-base-content/70 text-sm">{m.present.stepsOf(String(index + 1))}</p>
	{#if steps < 1}
		<p class="text-base-content/70 text-sm">{m.present.noSteps}</p>
	{:else}
		<ol class="flex flex-col gap-0.5" ondragover={(e) => dragging !== null && e.preventDefault()} ondrop={drop}>
			{#each rows as row (row.step)}
				{@const changing = [...row.come, ...row.go]}
				<li
					class={[
						'hover:bg-base-200 relative flex items-center rounded',
						dragging === row.step && 'opacity-50',
						dropAt === row.step && 'before:bg-selection before:absolute before:-top-0.5 before:right-0 before:left-0 before:h-0.5',
						dropAt === row.step + 1 && row.step === steps && 'after:bg-selection after:absolute after:right-0 after:-bottom-0.5 after:left-0 after:h-0.5'
					]}
					draggable={row.step > 0 && !locked && !coarsePointer.current}
					ondragstart={(e) => dragStart(e, row.step)}
					ondragover={(e) => dragOver(e, row.step)}
					ondragend={dragEnd}
					oncontextmenu={(e) => row.step && openContextMenu(e, menu(row.step))}
				>
					<button
						type="button"
						class="flex min-w-0 flex-1 flex-col items-start px-2 py-1.5 text-left"
						data-step={row.step}
						onclick={() => context.selectItems(index, new Set(changing.map((item) => item.id)))}
					>
						<span>{name(row.step)}</span>
						<span class="text-base-content/70 text-xs">
							{row.step ? m.present.stepChanges(row.come.length, row.go.length) : row.go.length ? m.present.hiddenAtStart(row.go.length) : m.present.allShown}
						</span>
					</button>
					{#if row.step}
						<MoreButton name={name(row.step)} entries={() => menu(row.step)} />
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
	<button type="button" class="btn btn-ghost btn-sm justify-start font-normal" disabled={locked || steps >= MAX_STEP} onclick={() => context.addStep(index)}>
		<span class="icon-[material-symbols-light--add] size-5" aria-hidden="true"></span>
		{m.present.addStep}
	</button>
	{#if locked && doc?.editable !== 'checking'}
		<p class="text-base-content/70 text-xs">{m.present.stepsLocked}</p>
	{/if}
</div>
