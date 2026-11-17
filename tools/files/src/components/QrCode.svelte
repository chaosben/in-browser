<script lang="ts">
	import { encode } from 'uqr';

	// QR code as SVG drawn from the code's modules (no HTML from a library); dark on white in both themes, so every
	// camera reads it.

	let { text, label, class: className = 'size-48' }: { text: string; label: string; class?: string } = $props();

	const qr = $derived(encode(text, { ecc: 'M', border: 2 }));
	const path = $derived(
		qr.data.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : ''))).join('')
	);
</script>

<svg viewBox="0 0 {qr.size} {qr.size}" class={['rounded-box bg-white', className]} role="img" aria-label={label} shape-rendering="crispEdges">
	<path d={path} fill="#000" />
</svg>
