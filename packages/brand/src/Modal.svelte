<script lang="ts">
	// The frame of every modal dialog of the suite: opened as a modal when it appears (top layer, focus kept inside,
	// the page behind inert), and Esc asks to close it – never closes it by itself, so the caller decides (and can
	// refuse while something runs: `busy`). The content is the caller's (`modal-box` and what is in it).
	import type { Snippet } from 'svelte';

	interface Props {
		/** Esc (or the browser's back gesture) */
		onclose: () => void;
		/** Esc does nothing meanwhile (a step that must not be left halfway) */
		busy?: boolean;
		/** id of the element naming the dialog */
		labelledby?: string;
		class?: string;
		children: Snippet;
	}

	let { onclose, busy = false, labelledby, class: extra = '', children }: Props = $props();

	const open = (dialog: HTMLDialogElement) => dialog.showModal();
</script>

<dialog
	class={['modal', extra]}
	aria-labelledby={labelledby}
	{@attach open}
	oncancel={(e) => {
		e.preventDefault();
		if (!busy) onclose();
	}}
>
	{@render children()}
</dialog>
