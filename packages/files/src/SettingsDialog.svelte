<script lang="ts">
	// The suite settings (gear in the BrandBar, `openSettings()`): categories on the left, the chosen one's settings on
	// the right; phones show the list first and a category as a page of its own. Every change is saved right away (no
	// OK/Cancel).
	// Placed once in `ToolLayout` and the overview's frame; built from the schema in `settings.ts`.
	import { MediaQuery } from 'svelte/reactivity';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { filesErrorText, filesMessages } from './i18n/index.svelte.js';
	import { CATEGORY_IDS, SCHEMA, type CategoryId, type Setting } from './settings.js';
	import SettingField from './SettingField.svelte';
	import { closeSettings, settingsDialog, suiteSettings } from './suite-settings.svelte.js';

	const t = $derived(filesMessages().settings);
	const phone = new MediaQuery('(max-width: 639px), (pointer: coarse) and (max-width: 1023px)', false);

	/** Category shown: the chosen one, on larger screens else the first */
	const shown = $derived<CategoryId | null>(settingsDialog.category ?? (phone.current ? null : CATEGORY_IDS[0]));

	const settingsOf = (category: CategoryId) => Object.entries(SCHEMA[category].settings as Record<string, Setting>);

	function start(dialog: HTMLDialogElement) {
		dialog.showModal();
	}

	function change(category: CategoryId, key: string, value: unknown) {
		// The schema checked the value's kind; the store's typed setter can't see that through the loop
		(suiteSettings.set as (c: CategoryId, k: string, v: unknown) => Promise<void>)(category, key, value).catch((e: unknown) => {
			console.error(e);
			toast(t.saveFailed(filesErrorText(e)), 'error', 8000);
		});
	}
</script>

{#if settingsDialog.open}
	<dialog
		class="modal"
		aria-labelledby="settings-title"
		{@attach start}
		oncancel={(e) => {
			e.preventDefault();
			closeSettings();
		}}
	>
		<div
			class={[
				'modal-box flex flex-col gap-3 p-0',
				phone.current ? 'h-full max-h-none w-full max-w-none rounded-none' : 'h-[min(36rem,85vh)] max-w-3xl'
			]}
		>
			<header class="border-base-300 flex items-center gap-2 border-b px-4 py-3">
				{#if phone.current && shown}
					<button class="btn btn-ghost btn-sm btn-square" title={t.back} aria-label={t.back} onclick={() => (settingsDialog.category = null)}>
						<span class="icon-[material-symbols-light--arrow-back] size-5" aria-hidden="true"></span>
					</button>
				{/if}
				<h2 id="settings-title" class="flex-1 text-lg font-bold">
					{phone.current && shown ? t.categories[shown] : t.title}
				</h2>
				<button class="btn btn-ghost btn-sm btn-square" title={t.close} aria-label={t.close} onclick={closeSettings}>
					<span class="icon-[material-symbols-light--close] size-5" aria-hidden="true"></span>
				</button>
			</header>

			<div class="flex min-h-0 flex-1">
				{#if !phone.current || !shown}
					<nav class={['min-h-0 overflow-y-auto', phone.current ? 'flex-1' : 'border-base-300 w-52 shrink-0 border-r']} aria-label={t.categoriesLabel}>
						<ul class="menu w-full gap-0.5 p-2">
							{#each CATEGORY_IDS as id (id)}
								<li>
									<button
										class={[shown === id && 'bg-selection/15 text-base-content']}
										aria-current={shown === id ? 'page' : undefined}
										onclick={() => (settingsDialog.category = id)}
									>
										<span class="{SCHEMA[id].icon} size-5" aria-hidden="true"></span>
										<span class="flex-1">{t.categories[id]}</span>
										{#if phone.current}<span class="icon-[material-symbols-light--chevron-right] size-5 opacity-60" aria-hidden="true"></span>{/if}
									</button>
								</li>
							{/each}
						</ul>
					</nav>
				{/if}
				{#if shown}
					<section class="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3" aria-labelledby="settings-category">
						{#if !phone.current}<h3 id="settings-category" class="text-base font-semibold">{t.categories[shown]}</h3>{/if}
						<p class="-mt-2 text-xs opacity-60">{t.synced}</p>
						{#each settingsOf(shown) as [key, setting] (`${shown}.${key}`)}
							<SettingField
								id="setting-{shown}-{key}"
								{setting}
								texts={(t[shown] as Record<string, { label: string; option?: (value: never) => string }>)[key]}
								value={(suiteSettings.values[shown] as Record<string, unknown>)[key]}
								onchange={(value) => change(shown, key, value)}
							/>
						{/each}
					</section>
				{/if}
			</div>
		</div>
	</dialog>
{/if}
