<script lang="ts">
	import { brandMessages } from './i18n/index.svelte.js';
	import { setTheme, theme, type ThemeChoice } from './theme.svelte.js';

	const t = $derived(brandMessages().theme);
	const options: { value: ThemeChoice; label: string; icon: string }[] = $derived([
		{ value: 'system', label: t.system, icon: 'icon-[material-symbols-light--computer]' },
		{ value: 'light', label: t.light, icon: 'icon-[material-symbols-light--light-mode]' },
		{ value: 'dark', label: t.dark, icon: 'icon-[material-symbols-light--dark-mode]' }
	]);

	const current = $derived(options.find((o) => o.value === theme.choice) ?? options[0]);

	function choose(value: ThemeChoice) {
		setTheme(value);
		// Close the dropdown (daisyUI opens on focus)
		(document.activeElement as HTMLElement | null)?.blur();
	}
</script>

<div class="dropdown dropdown-end">
	<div
		tabindex="0"
		role="button"
		class="btn btn-ghost btn-xs btn-square"
		title="{t.label}: {current.label}"
		aria-label="{t.label}: {current.label}"
	>
		<span class="{current.icon} size-5" aria-hidden="true"></span>
	</div>
	<ul tabindex="-1" class="dropdown-content menu menu-sm bg-base-100 rounded-box z-50 mt-1 w-36 p-1 shadow-lg">
		{#each options as option (option.value)}
			<li>
				<button class={theme.choice === option.value ? 'menu-active' : ''} onclick={() => choose(option.value)}>
					<span class="{option.icon} size-5" aria-hidden="true"></span>
					{option.label}
				</button>
			</li>
		{/each}
	</ul>
</div>
