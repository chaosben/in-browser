<script lang="ts">
	// A ribbon button that opens a panel below it: for choices a menu can't hold, e.g.
	// a color field. Use it in a `RibbonCustom` item; it looks like a command of the size it gets. The panel lies in
	// the top layer (Popover API), so the ribbon's scrolling never cuts it; a click outside or Esc closes it.
	import type { Snippet } from 'svelte';
	import { SMALL, type GroupSize } from './ribbon.js';

	interface Props {
		label: string;
		/** Full icon class */
		icon: string;
		size: GroupSize;
		disabled?: boolean;
		/** A color shown as a strip under the icon (e.g. the pen's color): see-through ones over a checkerboard, `null`
		 * an empty strip (“None”); left out, the button has no strip */
		swatch?: string | null;
		/** The panel's content; `close` closes it */
		children: Snippet<[close: () => void]>;
		/** Marks the button (`data-command`) */
		id?: string;
	}

	let { label, icon, size, disabled = false, swatch, children, id }: Props = $props();

	let button = $state<HTMLButtonElement>();
	let panel = $state<HTMLDivElement>();
	let open = $state(false);
	const iconOnly = $derived(size === SMALL);

	function toggle() {
		if (!panel || !button) return;
		if (open) return panel.hidePopover();
		const r = button.getBoundingClientRect();
		panel.style.top = `${r.bottom + 4}px`;
		// Shown first: the panel is as wide as its content, and must stay inside the window
		panel.style.left = '8px';
		panel.showPopover();
		panel.style.left = `${Math.max(8, Math.min(r.left, innerWidth - panel.offsetWidth - 8))}px`;
	}

	const close = () => panel?.hidePopover();
</script>

<button
	bind:this={button}
	class={[
		iconOnly ? 'btn btn-ghost btn-sm btn-square' : 'btn btn-ghost btn-sm justify-start gap-1.5 px-2 font-normal',
		open && 'btn-active'
	]}
	{disabled}
	title={label}
	aria-label={iconOnly ? label : undefined}
	aria-haspopup="dialog"
	aria-expanded={open}
	data-command={id}
	onclick={toggle}
>
	{#if swatch === undefined}
		<span class={[icon, 'size-5 shrink-0']} aria-hidden="true"></span>
	{:else}
		<!-- The icon as large as its neighbours, the color as a strip of its own below it (never over the icon):
		     20 + 1 + 3 px fill a row of the ribbon exactly -->
		<span class="flex shrink-0 flex-col items-center gap-px">
			<span class={[icon, 'size-5']} aria-hidden="true"></span>
			<span
				class="border-base-content/40 h-[3px] w-5 rounded-[1px] border-[0.5px]"
				style:background={swatch ? `linear-gradient(${swatch}, ${swatch}), repeating-conic-gradient(#bbb 0 25%, #fff 0 50%) 0 0 / 4px 4px` : 'transparent'}
				aria-hidden="true"
			></span>
		</span>
	{/if}
	{#if !iconOnly}<span class="truncate">{label}</span><span class="icon-[material-symbols-light--arrow-drop-down] -ml-1 size-4 shrink-0" aria-hidden="true"></span>{/if}
</button>
<div
	bind:this={panel}
	popover="auto"
	class="bg-base-100 border-base-300 rounded-box fixed m-0 w-max max-w-[calc(100vw-1rem)] min-w-72 border p-2 shadow-lg"
	role="dialog"
	aria-label={label}
	ontoggle={(e) => (open = e.newState === 'open')}
>
	{#if open}{@render children(close)}{/if}
</div>
