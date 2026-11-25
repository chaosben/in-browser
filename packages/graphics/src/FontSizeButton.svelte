<script lang="ts">
	// The font size in the ribbon, the same in every tool: a button opening a field for any size and the list of the
	// usual ones below it (the current one marked). It acts by the suite's rule (`rich-commands.ts`): the text selected
	// in the field typed into, else the selected boxes, else the next new box.
	import RibbonPopover from '@in-browser/brand/RibbonPopover.svelte';
	import type { GroupSize } from '@in-browser/brand/ribbon.js';
	import NumberField from './NumberField.svelte';
	import { graphicsMessages } from './i18n/index.svelte.js';
	import type { richTextCommands } from './rich-commands.js';

	interface Props {
		commands: ReturnType<typeof richTextCommands>;
		size: GroupSize;
	}

	let { commands, size }: Props = $props();

	const s = $derived(commands.fontSizes);
	const label = $derived(graphicsMessages().text.fontSize);
	const shown = (v: number) => s.field.shown?.(v) ?? v;
	const stored = (v: number) => s.field.stored?.(v) ?? v;
	/** A value being dragged or stepped: applied once when the change ends */
	let draft = $state<number | null>(null);
	const current = $derived(s.current());
</script>

<RibbonPopover id="fontSize" {label} icon="icon-[material-symbols-light--format-size]" {size} disabled={!s.enabled()}>
	{#snippet children(close)}
		<div class="flex w-full flex-col gap-2">
			<NumberField
				{label}
				value={draft ?? shown(current ?? s.base())}
				unit={s.field.unit}
				min={s.field.min}
				max={s.field.max}
				step={s.field.step}
				decimals={s.field.decimals}
				oninput={(v) => (draft = v)}
				oncommit={() => {
					if (draft !== null) s.set(stored(draft));
					draft = null;
				}}
			/>
			<ul class="menu menu-sm max-h-72 w-full flex-nowrap overflow-y-auto p-0">
				{#each s.sizes() as option (option)}
					<li>
						<button
							type="button"
							class={s.same(current, option) ? 'menu-active' : undefined}
							aria-pressed={s.same(current, option)}
							onclick={() => {
								s.set(option);
								close();
							}}>{s.label(option)}</button
						>
					</li>
				{/each}
			</ul>
		</div>
	{/snippet}
</RibbonPopover>
