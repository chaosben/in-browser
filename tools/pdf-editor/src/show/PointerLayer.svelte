<script lang="ts">
	// The pointer on a slide: a soft dot with a short trail that fades (calmer than a laser's jitter), or a spotlight –
	// the slide darkened but for a circle around the point. Gone a moment after the last position (a control that
	// lost its connection never leaves it standing).
	import type { PointerMode } from './protocol.js';

	let { pointer }: { pointer: { x: number; y: number; mode: PointerMode } | null } = $props();

	/** Hidden this long after the last position */
	const LINGER_MS = 1000;
	/** A trail point fades over this time */
	const TRAIL_MS = 450;

	let canvas = $state<HTMLCanvasElement>();
	let shown = $state<{ x: number; y: number; mode: PointerMode } | null>(null);
	let trail: { x: number; y: number; t: number }[] = [];
	let hide: ReturnType<typeof setTimeout> | undefined;
	let frame = 0;

	$effect(() => {
		const p = pointer;
		clearTimeout(hide);
		if (!p) {
			shown = null;
			return;
		}
		shown = p;
		if (p.mode === 'dot') trail.push({ x: p.x, y: p.y, t: performance.now() });
		hide = setTimeout(() => (shown = null), LINGER_MS);
	});

	// Drawn anew whenever the pointer moves, changes or goes
	$effect(() => {
		void shown;
		if (!frame) frame = requestAnimationFrame(paint);
	});

	$effect(() => () => {
		clearTimeout(hide);
		cancelAnimationFrame(frame);
	});

	/** The dot and its trail, until the trail has faded */
	function paint() {
		frame = 0;
		const c = canvas;
		const ctx = c?.getContext('2d');
		if (!c || !ctx) return;
		const w = c.clientWidth * devicePixelRatio;
		const h = c.clientHeight * devicePixelRatio;
		if (c.width !== Math.round(w) || c.height !== Math.round(h)) {
			c.width = Math.round(w);
			c.height = Math.round(h);
		}
		ctx.clearRect(0, 0, c.width, c.height);
		const now = performance.now();
		trail = trail.filter((p) => now - p.t < TRAIL_MS);
		const size = Math.max(6, Math.min(c.width, c.height) * 0.014);
		const dot = shown?.mode === 'dot' ? shown : null;
		if (!dot) trail = [];
		ctx.fillStyle = '#e11d48';
		// The trail fades behind the dot
		for (const p of trail) {
			const age = (now - p.t) / TRAIL_MS;
			ctx.globalAlpha = 0.35 * (1 - age);
			ctx.beginPath();
			ctx.arc(p.x * c.width, p.y * c.height, size * (0.55 + 0.45 * (1 - age)), 0, Math.PI * 2);
			ctx.fill();
		}
		if (dot) {
			// A soft edge: calmer than a sharp spot
			const g = ctx.createRadialGradient(dot.x * c.width, dot.y * c.height, 0, dot.x * c.width, dot.y * c.height, size * 1.3);
			g.addColorStop(0, 'rgba(225, 29, 72, 0.9)');
			g.addColorStop(0.7, 'rgba(225, 29, 72, 0.75)');
			g.addColorStop(1, 'rgba(225, 29, 72, 0)');
			ctx.globalAlpha = 1;
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(dot.x * c.width, dot.y * c.height, size * 1.3, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
		if (trail.length) frame = requestAnimationFrame(paint);
	}
</script>

<canvas bind:this={canvas} class="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"></canvas>
{#if shown?.mode === 'spotlight'}
	<div
		class="pointer-events-none absolute inset-0"
		aria-hidden="true"
		style="background: radial-gradient(circle at {shown.x * 100}% {shown.y * 100}%, transparent 0, transparent 11%, rgba(0, 0, 0, 0.62) 14%)"
	></div>
{/if}
