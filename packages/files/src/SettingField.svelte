<script lang="ts">
	// One setting of the settings dialog: its label (named so it explains itself – no help texts for now) and the
	// control for its kind. Text is saved when the field is left, and when the dialog closes while it is typed into.
	import type { Setting } from './settings.js';

	interface Props {
		id: string;
		setting: Setting;
		texts: { label: string; option?: (value: never) => string };
		value: unknown;
		onchange: (value: unknown) => void;
	}

	let { id, setting, texts, value, onchange }: Props = $props();

	/** Text as typed (follows the stored value while not typed into) */
	let draft = $derived(typeof value === 'string' ? value : '');

	function commit() {
		if (setting.kind === 'text' && draft.trim() !== value) onchange(draft.trim());
	}

	// Closing the dialog while typing keeps what was typed
	$effect(() => () => commit());

	const optionText = (option: unknown) => (texts.option as ((value: unknown) => string) | undefined)?.(option) ?? String(option);
	const key = (option: unknown) => JSON.stringify(option);
</script>

<div class="flex flex-col gap-1.5">
	<label for={id} class="text-sm font-medium">{texts.label}</label>

	{#if setting.kind === 'text'}
		<input
			{id}
			class="input input-sm w-full max-w-sm"
			maxlength={setting.max}
			autocomplete={setting.autocomplete}
			bind:value={draft}
			onchange={commit}
		/>
	{:else if setting.kind === 'choice'}
		<select {id} class="select select-sm w-full max-w-sm" value={key(value)} onchange={(e) => onchange(JSON.parse(e.currentTarget.value))}>
			{#each setting.options as option (key(option))}
				<option value={key(option)}>{optionText(option)}</option>
			{/each}
		</select>
	{:else}
		<input {id} type="checkbox" class="toggle" checked={value === true} onchange={(e) => onchange(e.currentTarget.checked)} />
	{/if}
</div>
