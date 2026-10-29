<script lang="ts">
	import { m } from '#lib/i18n/index.js';
	import type { Item } from '#lib/project/types.js';
	import { libraryUi, type LibraryScope } from '#lib/ui/library.svelte.js';

	interface Props {
		onsave: (name: string, scope: LibraryScope, items: Item[]) => void;
	}

	let { onsave }: Props = $props();

	let dialog: HTMLDialogElement;
	let name = $state('');

	const request = $derived(libraryUi.request);
	const hasClips = $derived(!!request?.items.some((item) => item.type !== 'annotation'));

	$effect(() => {
		if (request) {
			name = request.name;
			if (!dialog.open) dialog.showModal();
		} else if (dialog.open) dialog.close();
	});

	/** One step: the button chooses the library; Enter takes the one chosen last time */
	function save(scope: LibraryScope) {
		if (!request || !name.trim()) return;
		onsave(name.trim(), scope, request.items);
		libraryUi.request = null;
	}

	const SCOPES: { value: LibraryScope; label: string; icon: string }[] = [
		{ value: 'project', label: m.library.project, icon: 'icon-[material-symbols-light--folder-outline]' },
		{ value: 'global', label: m.library.global, icon: 'icon-[material-symbols-light--public]' }
	];
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (libraryUi.request = null)}>
	<form
		class="modal-box flex flex-col gap-4"
		onsubmit={(e) => {
			e.preventDefault();
			if (request) save(request.scope);
		}}
	>
		<h3 class="flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--bookmark-add-outline] size-6" aria-hidden="true"></span>
			{m.library.saveTitle}
		</h3>
		<label class="flex flex-col gap-1">
			<span class="text-sm">{m.library.name}</span>
			<input class="input w-full" bind:value={name} required />
		</label>
		{#if hasClips}
			<p class="text-sm opacity-70">{m.library.globalHint}</p>
		{/if}
		<div class="modal-action mt-0 flex-wrap">
			<button type="button" class="btn btn-ghost mr-auto" onclick={() => (libraryUi.request = null)}>{m.common.cancel}</button>
			{#each SCOPES as option (option.value)}
				<!-- The library chosen last time is the default (Enter) -->
				<button
					type={request?.scope === option.value ? 'submit' : 'button'}
					class="btn {request?.scope === option.value ? 'btn-primary' : ''}"
					disabled={!name.trim()}
					onclick={(e) => {
						if (request?.scope === option.value) return;
						e.preventDefault();
						save(option.value);
					}}
				>
					<span class="{option.icon} size-5" aria-hidden="true"></span>
					{option.label}
				</button>
			{/each}
		</div>
	</form>
</dialog>
