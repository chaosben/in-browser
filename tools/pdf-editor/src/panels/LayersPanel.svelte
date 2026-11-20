<script lang="ts">
	// Layers (optional content) of the PDF: switch them on and off. Only the view changes, not the file.
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import { m } from '#lib/i18n/index.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';

	let { context }: PanelProps<EditorState> = $props();

	interface Layer {
		id: string;
		name: string;
		visible: boolean;
		depth: number;
	}

	let layers = $state<Layer[]>([]);

	/** The layers in the PDF's order (nested groups indented); without an order, all groups */
	$effect(() => {
		const doc = context.doc;
		if (!doc) return;
		void doc.layers().then((config) => {
			const found: Layer[] = [];
			const add = (id: string, depth: number) => {
				const group = config.getGroup(id) as { name?: string } | null;
				if (group && !found.some((l) => l.id === id)) found.push({ id, name: group.name || id, visible: !!config.isVisible(id), depth });
			};
			const walk = (order: unknown[], depth: number) => {
				for (const item of order) {
					if (typeof item === 'string') add(item, depth);
					else if (item && typeof item === 'object' && Array.isArray((item as { order?: unknown[] }).order)) walk((item as { order: unknown[] }).order, depth + 1);
				}
			};
			const order = config.getOrder() as unknown[] | null;
			if (order) walk(order, 0);
			else for (const [id] of config) add(id as string, 0);
			layers = found;
		});
	});

	async function toggle(layer: Layer) {
		const doc = context.doc;
		if (!doc) return;
		const config = await doc.layers();
		config.setVisibility(layer.id, !layer.visible);
		layer.visible = !!config.isVisible(layer.id);
		doc.layersChanged();
	}
</script>

<div class="p-2">
	{#if layers.length}
		<ul class="flex flex-col">
			{#each layers as layer (layer.id)}
				<li>
					<label class="hover:bg-base-200 flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm" style="padding-left: {6 + layer.depth * 14}px">
						<input type="checkbox" class="checkbox checkbox-sm" checked={layer.visible} onchange={() => toggle(layer)} />
						<span class="truncate">{layer.name}</span>
					</label>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="p-2 text-sm opacity-70">{m.panels.noLayers}</p>
	{/if}
</div>
