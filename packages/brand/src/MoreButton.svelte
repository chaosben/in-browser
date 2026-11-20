<script lang="ts">
	// ⋯ of an entry on touch screens: its menu without a long press, opened below the button (`ui.md` Menus)
	import { brandMessages } from './i18n/index.svelte.js';
	import { openMenuBelow, type MenuEntry } from './ui/context-menu.svelte.js';

	interface Props {
		/** The entry's name (for the label) */
		name: string;
		/** Its menu – called on the click, so it can pick the entry first */
		entries: () => MenuEntry[];
		class?: string;
	}

	let { name, entries, class: classes = '' }: Props = $props();
	const label = $derived(brandMessages().pick.actions(name));
</script>

<button
	class={['btn btn-ghost btn-sm btn-square shrink-0', classes]}
	title={label}
	aria-label={label}
	onclick={(e) => {
		e.stopPropagation();
		openMenuBelow(e, entries());
	}}
>
	<span class="icon-[material-symbols-light--more-vert] size-5" aria-hidden="true"></span>
</button>
