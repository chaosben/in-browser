<script lang="ts">
	import Modal from '@in-browser/brand/Modal.svelte';
	import { m } from '#lib/i18n/index.js';
	import type { Size } from '#lib/project/canvas.js';

	interface Props {
		/** Current canvas */
		canvas: Size;
		/** Suggested larger canvas */
		size: Size;
		onanswer: (grow: boolean) => void;
	}

	let { canvas, size, onanswer }: Props = $props();


	const format = (s: Size) => `${s.width} × ${s.height}`;
</script>

<Modal onclose={() => onanswer(false)}>
	<div class="modal-box">
		<h3 class="flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--open-in-full] size-6" aria-hidden="true"></span>
			{m.canvasDialog.title}
		</h3>
		<p class="py-3">{m.editor.largerMedia(format(size), format(canvas))}</p>
		<p class="text-sm opacity-70">{m.inspector.growCanvasHint}</p>
		<div class="modal-action">
			<button class="btn btn-ghost" onclick={() => onanswer(false)}>{m.canvasDialog.keep}</button>
			<button class="btn btn-primary" onclick={() => onanswer(true)}>{m.editor.growCanvas} ({format(size)})</button>
		</div>
	</div>
</Modal>
