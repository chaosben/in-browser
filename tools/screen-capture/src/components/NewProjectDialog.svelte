<script lang="ts">
	import CanvasSizeField from './CanvasSizeField.svelte';
	import { m } from '#lib/i18n/index.js';
	import { CANVAS_PRESETS, type Size } from '#lib/project/canvas.js';
	import { emptyProjectName } from '#lib/project/project.js';

	interface Props {
		oncreate: (name: string, size: Size) => void;
		oncancel: () => void;
	}

	let { oncreate, oncancel }: Props = $props();

	let dialog: HTMLDialogElement;
	let name = $state(emptyProjectName());
	let size = $state<Size>({ width: CANVAS_PRESETS[0].width, height: CANVAS_PRESETS[0].height });

	$effect(() => {
		dialog.showModal();
	});
</script>

<dialog
	bind:this={dialog}
	class="modal"
	oncancel={(e) => {
		e.preventDefault();
		oncancel();
	}}
>
	<form
		class="modal-box flex flex-col gap-4"
		onsubmit={(e) => {
			e.preventDefault();
			oncreate(name.trim() || m.common.untitled, size);
		}}
	>
		<h3 class="flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--add-box-outline] size-6" aria-hidden="true"></span>
			{m.newProject.title}
		</h3>
		<label class="flex flex-col gap-1">
			<span class="text-sm opacity-70">{m.newProject.name}</span>
			<input class="input input-sm w-full" bind:value={name} />
		</label>
		<div class="flex flex-col gap-1">
			<span class="text-sm opacity-70">{m.newProject.size}</span>
			<CanvasSizeField value={size} onchange={(s) => (size = s)} />
		</div>
		<div class="modal-action mt-0">
			<button type="button" class="btn btn-ghost" onclick={oncancel}>{m.common.cancel}</button>
			<button type="submit" class="btn btn-primary">{m.newProject.create}</button>
		</div>
	</form>
</dialog>
