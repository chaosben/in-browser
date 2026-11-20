<script lang="ts">
	// The mark of an entry in the touch selection mode (`Picker.marking`): picked or not. Place it in a corner of the
	// entry (`class`); it takes no presses – a tap on the entry picks.
	interface Props {
		picked: boolean;
		class?: string;
	}

	let { picked, class: classes = '' }: Props = $props();
</script>

<span class={['bg-base-100 pointer-events-none flex rounded', classes]} aria-hidden="true">
	<span class={['size-6', picked ? 'icon-[material-symbols-light--check-box] text-selection' : 'icon-[material-symbols-light--check-box-outline-blank]']}></span>
</span>
