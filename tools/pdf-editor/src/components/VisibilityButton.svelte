<script lang="ts">
	// “Show and hide” on the format tabs: at which steps of their page the selected comments show while presenting
	// (`render/steps.ts`). One row per step of the page – with the page, then each “Next” – with a switch; the steps
	// themselves are managed in the side panel “Presentation steps”. A switch holds from its step until the next change, each change is one undo step.
	import RibbonPopover from '@in-browser/brand/RibbonPopover.svelte';
	import type { GroupSize } from '@in-browser/brand/ribbon.js';
	import { m } from '#lib/i18n/index.js';
	import type { PdfDocument } from '#lib/model/document.svelte.js';
	import { visibleAt } from '#lib/render/steps.js';

	let {
		doc,
		selection,
		steps,
		size
	}: {
		doc: PdfDocument | null;
		/** The selected items of one page */
		selection: { items: readonly { id: string }[]; pageIndex: number; refresh(): void } | null;
		/** The steps of a page as the editor lists them (`EditorState.stepsOf`) */
		steps: (pageIndex: number) => number;
		size: GroupSize;
	} = $props();

	const enabled = $derived(!!selection?.items.length && doc?.editable === 'yes');
	const rows = $derived.by(() => {
		void doc?.changes;
		return selection ? steps(selection.pageIndex) : 0;
	});

	/** Whether all (true), none (false) or some (null) of the selected items show at a step */
	function at(step: number): boolean | null {
		const items = selection?.items ?? [];
		const visible = items.filter((item) => visibleAt(item, step)).length;
		return visible === items.length ? true : visible ? null : false;
	}

	function set(step: number, visible: boolean) {
		if (!doc || !selection) return;
		doc.setVisibility(selection.pageIndex, new Set(selection.items.map((i) => i.id)), step, visible);
		selection.refresh();
	}
</script>

<RibbonPopover id="visibility" label={m.present.visibility} icon="icon-[material-symbols-light--visibility-outline]" {size} disabled={!enabled}>
	{#snippet children()}
		<div class="flex max-h-[60vh] flex-col gap-1 overflow-y-auto p-1">
			{#each { length: rows + 1 }, step (step)}
				{@const state = at(step)}
				<label class="hover:bg-base-200 flex cursor-pointer items-center justify-between gap-4 rounded px-2 py-1.5">
					<span>{step ? m.present.step(step) : m.present.withPage}</span>
					<input
						type="checkbox"
						class="toggle toggle-sm"
						aria-label="{step ? m.present.step(step) : m.present.withPage}: {m.present.visibleAt}"
						checked={state === true}
						indeterminate={state === null}
						data-step={step}
						onchange={() => set(step, state !== true)}
					/>
				</label>
			{/each}
		</div>
	{/snippet}
</RibbonPopover>
