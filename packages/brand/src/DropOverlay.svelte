<script lang="ts">
	// Shown while files from the computer are dragged over a drop area: a dashed frame with what dropping does.
	// `fixed`: over the whole window (otherwise over the nearest positioned parent).

	let { label, fixed = false }: { label: string; fixed?: boolean } = $props();
</script>

<div
	class={[
		'border-selection bg-base-300/80 rounded-box pointer-events-none z-40 grid place-items-center border-4 border-dashed',
		fixed ? 'fixed inset-4' : 'absolute inset-2'
	]}
>
	<div class="flex flex-col items-center gap-2 text-lg font-semibold">
		<span class="icon-[material-symbols-light--upload-file] size-12" aria-hidden="true"></span>
		{label}
	</div>
</div>
