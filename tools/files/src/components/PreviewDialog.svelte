<script lang="ts">
	import { read } from '@in-browser/files/fs.js';
	import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import { previewKind, type Item } from '#lib/items.js';

	// Preview of a file. Content only ever as blob URL in <img>/<video>/<audio> or as plain text – never as HTML or
	// inline SVG on the page: all tools share one origin, an uploaded file must not run scripts there.

	interface Props {
		item: Item;
		ondownload: (item: Item) => void;
		onclose: () => void;
	}

	let { item, ondownload, onclose }: Props = $props();

	const TEXT_LIMIT = 1_000_000;
	const kind = $derived(previewKind(item.name));

	let url = $state<string | null>(null);
	let text = $state<string | null>(null);
	let error = $state<string | null>(null);

	/** Opens the dialog and loads the content; the blob URL goes when it closes */
	function start(dialog: HTMLDialogElement) {
		dialog.showModal();
		let created: string | null = null;
		read(item.path)
			.then(async (file) => {
				if (kind === 'text') text = file.size > TEXT_LIMIT ? null : await file.text();
				else if (kind) url = created = URL.createObjectURL(file);
			})
			.catch((e) => (error = filesErrorText(e)));
		return () => {
			if (created) URL.revokeObjectURL(created);
		};
	}
</script>

<dialog
	class="modal"
	{@attach start}
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
>
	<div class="modal-box flex max-h-[90vh] w-11/12 max-w-4xl flex-col gap-3">
		<h3 class="truncate text-lg font-bold" title={item.name}>{item.name}</h3>
		<div class="bg-base-200 rounded-box grid min-h-40 flex-1 place-items-center overflow-auto">
			{#if error}
				<p class="text-error p-6">{error}</p>
			{:else if kind === 'image' && url}
				<img src={url} alt={item.name} class="max-h-[70vh] max-w-full object-contain" />
			{:else if kind === 'video' && url}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video src={url} controls class="max-h-[70vh] max-w-full"></video>
			{:else if kind === 'audio' && url}
				<audio src={url} controls class="w-full max-w-md"></audio>
			{:else if kind === 'text' && text !== null}
				<pre class="w-full self-start p-4 text-sm break-words whitespace-pre-wrap">{text}</pre>
			{:else if kind === 'text' && item.size !== undefined && item.size > TEXT_LIMIT}
				<p class="p-6 opacity-70">{m.preview.tooLarge}</p>
			{:else if !kind}
				<p class="p-6 opacity-70">{m.preview.none}</p>
			{:else}
				<span class="loading loading-spinner"></span>
			{/if}
		</div>
		<div class="modal-action mt-0">
			<button class="btn btn-ghost" onclick={() => ondownload(item)}>
				<span class="icon-[material-symbols-light--download] size-5" aria-hidden="true"></span>
				{m.common.download}
			</button>
			<button class="btn btn-primary" onclick={onclose}>{m.common.close}</button>
		</div>
	</div>
</dialog>
