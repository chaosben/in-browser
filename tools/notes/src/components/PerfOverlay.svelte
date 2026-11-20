<script lang="ts">
	// Measurements of the drawing surface (`?perf` in the address): frame time, input-to-pixel latency, input rate.
	import { m } from '#lib/i18n/index.js';
	import type { StageStats } from '@in-browser/ink/render/stage.js';
	import type { NotesStage } from '#lib/render/surface.js';

	let { stage }: { stage: NotesStage } = $props();
	let stats = $state<StageStats>({ frame: 0, latency: 0, rate: 0, tiles: 0 });

	$effect(() => {
		const s = stage;
		const timer = setInterval(() => (stats = { ...s.takeStats() }), 500);
		return () => clearInterval(timer);
	});
</script>

<div class="bg-base-100/90 rounded-box pointer-events-none absolute top-2 right-2 p-2 font-mono text-xs shadow" data-testid="perf">
	<div>{m.perf.frame}: {stats.frame.toFixed(2)} ms</div>
	<div>{m.perf.latency}: {stats.latency.toFixed(2)} ms</div>
	<div>{m.perf.rate}: {Math.round(stats.rate)}</div>
	<div>{m.perf.tiles}: {stats.tiles}</div>
</div>
