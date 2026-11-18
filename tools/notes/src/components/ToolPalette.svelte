<script lang="ts">
	// Floating tool palette at the bottom of the surface (no second toolbar below the header): tools, color and
	// thickness of the current tool, insert and page menus. Tapping the active tool again opens its options too. The
	// icon picker opens in the same place as the options. Nine buttons: narrower below `sm` so the bar fits 360 px.
	import ColorField from '@in-browser/graphics/ColorField.svelte';
	import IconPicker from '@in-browser/graphics/IconPicker.svelte';
	import type { IconData } from '@in-browser/graphics/icons/types.js';
	import type { Tool } from '#lib/input/controller.js';
	import { m } from '#lib/i18n/index.js';
	import { fitFromDrag, SHAPE_KINDS, shapePoints, type ShapeKind, type ShapeStyle } from '#lib/ink/shapes.js';
	import ShapeStyleFields from './ShapeStyleFields.svelte';
	import { SMOOTHING_LEVELS } from '#lib/ink/smooth.js';
	import { ERASER_SIZES, HIGHLIGHTER_SIZES, PEN_SIZES, tools } from '#lib/model/tools.svelte.js';

	interface Props {
		/** Options panel (color, thickness) open */
		open: boolean;
		/** Icon picker open */
		icons: boolean;
		onicon: (icon: IconData) => void;
		oninsertmenu: (e: MouseEvent) => void;
		onpagemenu: (e: MouseEvent) => void;
	}

	let { open = $bindable(), icons = $bindable(), onicon, oninsertmenu, onpagemenu }: Props = $props();

	const TOOLS: { id: Tool; icon: string; label: string; hint?: string }[] = [
		{ id: 'pen', icon: 'icon-[material-symbols-light--ink-pen-outline]', label: m.tools.pen },
		{ id: 'highlighter', icon: 'icon-[material-symbols-light--ink-highlighter]', label: m.tools.highlighter },
		{ id: 'shape', icon: 'icon-[material-symbols-light--shapes-outline]', label: m.tools.shape },
		{ id: 'eraser', icon: 'icon-[material-symbols-light--ink-eraser-outline]', label: m.tools.eraser },
		{ id: 'lasso', icon: 'icon-[material-symbols-light--arrow-selector-tool-outline]', label: m.tools.lasso, hint: m.tools.lassoHint },
		{ id: 'laser', icon: 'icon-[material-symbols-light--stylus-laser-pointer-outline]', label: m.tools.laser }
	];
	/** Tools with options (color, thickness …) */
	const hasOptions = $derived(tools.tool !== 'laser');

	const ink = $derived(tools.tool === 'highlighter' ? tools.highlighter : tools.pen);
	const sizes = $derived(tools.tool === 'highlighter' ? HIGHLIGHTER_SIZES : PEN_SIZES);

	function choose(tool: Tool) {
		icons = false;
		if (tools.tool === tool) open = hasOptions && !open;
		else {
			tools.tool = tool;
			tools.store();
			if (!hasOptions) open = false;
		}
	}

	function setEraserMode(mode: 'stroke' | 'pixel') {
		tools.eraserMode = mode;
		tools.store();
	}

	function setColor(color: string | null) {
		if (!color) return;
		ink.color = color.slice(0, 7);
		tools.store();
	}

	function setSize(size: number) {
		ink.size = size;
		tools.store();
	}

	function setSmoothing(level: number) {
		tools.smoothing = level;
		tools.store();
	}

	function setEraser(size: number) {
		tools.eraser = size;
		tools.store();
	}

	/** Previews of the shapes (24 × 24 SVG), drawn by the same geometry as on the page */
	const SHAPES = SHAPE_KINDS.map((kind) => {
		const line = kind === 'line' || kind === 'arrow' || kind === 'doubleArrow';
		const pts = shapePoints(line ? fitFromDrag(kind, 3, 18, 21, 6) : fitFromDrag(kind, 3, 5, 21, 19), 1);
		let points = '';
		for (let i = 0; i < pts.length; i += 3) points += `${pts[i].toFixed(1)},${pts[i + 1].toFixed(1)} `;
		return { kind, points };
	});

	function setShape(kind: ShapeKind) {
		tools.shape = kind;
		tools.store();
	}

	function setShapeStyle(style: Partial<ShapeStyle>) {
		tools.shapeStyle = { ...tools.shapeStyle, ...style };
		tools.store();
	}

	/** Dot size of a thickness choice in the panel (pixels) */
	const dot = (size: number, max: number) => 4 + (size / max) * 20;
</script>

{#snippet snapToggle()}
	<label class="flex cursor-pointer items-center gap-1" title={m.tools.snapHint}>
		<span class="w-20 shrink-0 truncate text-xs opacity-70">{m.tools.snap}</span>
		<input
			type="checkbox"
			class="toggle toggle-sm toggle-primary"
			checked={tools.snap}
			onchange={(e) => {
				tools.snap = e.currentTarget.checked;
				tools.store();
			}}
		/>
	</label>
{/snippet}

<div class="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-3">
	{#if icons}
		<div
			class="bg-base-100 border-base-300 rounded-box pointer-events-auto flex max-h-[60vh] w-full max-w-sm flex-col border shadow-lg"
			role="dialog"
			aria-label={m.insert.iconsTitle}
		>
			<div class="border-base-300 flex items-center gap-2 border-b py-1 ps-3 pe-1">
				<span class="flex-1 text-sm font-medium">{m.insert.iconsTitle}</span>
				<button class="btn btn-ghost btn-sm btn-square" onclick={() => (icons = false)} title={m.insert.close} aria-label={m.insert.close}>
					<span class="icon-[material-symbols-light--close] size-5" aria-hidden="true"></span>
				</button>
			</div>
			<div class="min-h-0 overflow-y-auto">
				<IconPicker onpick={onicon} hint={m.insert.iconHint} />
			</div>
		</div>
	{:else if open}
		<div
			class="bg-base-100 border-base-300 rounded-box pointer-events-auto flex max-h-[70vh] w-full max-w-sm flex-col gap-3 overflow-y-auto border p-3 shadow-lg"
			role="group"
			aria-label={m.tools.options}
		>
			{#if tools.tool === 'lasso'}
				{@render snapToggle()}
				<p class="text-xs opacity-70">{m.tools.lassoHint}</p>
			{:else if tools.tool === 'eraser'}
				<div class="flex items-center gap-1">
					<span class="w-20 shrink-0 truncate text-xs opacity-70">{m.tools.eraserMode}</span>
					<div class="join min-w-0 flex-1" role="group" aria-label={m.tools.eraserMode}>
						{#each ['stroke', 'pixel'] as const as mode (mode)}
							<button
								class="btn btn-sm join-item flex-1 px-1 {tools.eraserMode === mode ? 'btn-active btn-primary' : ''}"
								onclick={() => setEraserMode(mode)}
								aria-pressed={tools.eraserMode === mode}
							>
								{m.tools.eraserModes[mode]}
							</button>
						{/each}
					</div>
				</div>
				<div class="flex items-center gap-2">
					<span class="w-20 shrink-0 text-xs opacity-70">{m.tools.size}</span>
					{#each ERASER_SIZES as size (size)}
						<button
							class="btn btn-ghost btn-square {tools.eraser === size ? 'btn-active' : ''}"
							onclick={() => setEraser(size)}
							aria-label={m.tools.sizeValue(size)}
							aria-pressed={tools.eraser === size}
						>
							<span class="border-base-content rounded-full border" style="width: {dot(size, 32)}px; height: {dot(size, 32)}px"></span>
						</button>
					{/each}
				</div>
			{:else}
				{#if tools.tool === 'shape'}
					<div class="grid grid-cols-6 gap-1" role="group" aria-label={m.tools.shape}>
						{#each SHAPES as shape (shape.kind)}
							<button
								class="btn btn-ghost btn-square w-full {tools.shape === shape.kind ? 'btn-active text-primary' : ''}"
								onclick={() => setShape(shape.kind)}
								title={m.tools.shapes[shape.kind]}
								aria-label={m.tools.shapes[shape.kind]}
								aria-pressed={tools.shape === shape.kind}
							>
								<svg viewBox="0 0 24 24" class="size-6" aria-hidden="true">
									<polyline points={shape.points} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</button>
						{/each}
					</div>
					<p class="text-xs opacity-70">{m.tools.shapeHint}</p>
				{/if}
				<ColorField value={ink.color} opaque onchange={(v) => setColor(v)} />
				<div class="flex items-center gap-1">
					<span class="w-20 shrink-0 text-xs opacity-70">{m.tools.size}</span>
					{#each sizes as size (size)}
						<button
							class="btn btn-ghost btn-square {ink.size === size ? 'btn-active' : ''}"
							onclick={() => setSize(size)}
							aria-label={m.tools.sizeValue(size)}
							aria-pressed={ink.size === size}
						>
							<span class="rounded-full" style="background: {ink.color}; width: {dot(size, sizes[sizes.length - 1])}px; height: {dot(size, sizes[sizes.length - 1])}px"></span>
						</button>
					{/each}
				</div>
				{#if tools.tool === 'shape'}
					<ShapeStyleFields style={tools.shapeStyle} fillable={tools.shape !== 'line' && tools.shape !== 'arrow' && tools.shape !== 'doubleArrow'} onchange={setShapeStyle} />
					{@render snapToggle()}
				{:else}
					<div class="flex items-center gap-1">
						<span class="w-20 shrink-0 truncate text-xs opacity-70" title={m.tools.smoothingHint}>{m.tools.smoothing}</span>
						<div class="join min-w-0 flex-1" role="group" aria-label={m.tools.smoothing} title={m.tools.smoothingHint}>
							{#each SMOOTHING_LEVELS as level, i (level)}
								<button
									class="btn btn-sm join-item flex-1 px-1 {tools.smoothing === level ? 'btn-active btn-primary' : ''}"
									onclick={() => setSmoothing(level)}
									aria-pressed={tools.smoothing === level}
								>
									{m.tools.smoothingLevels[i]}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		</div>
	{/if}

	<div
		class="bg-base-100 border-base-300 rounded-box pointer-events-auto flex items-center border p-1 shadow-lg max-sm:[&>.btn]:w-[2.125rem] sm:gap-0.5"
		role="toolbar"
		aria-label={m.tools.label}
	>
		{#each TOOLS as t (t.id)}
			<button
				class="btn btn-ghost btn-square {tools.tool === t.id ? 'btn-active text-primary' : ''}"
				onclick={() => choose(t.id)}
				title={t.hint ?? t.label}
				aria-label={t.label}
				aria-pressed={tools.tool === t.id}
			>
				<span class="{t.icon} size-6" aria-hidden="true"></span>
			</button>
		{/each}
		<div class="bg-base-300 mx-0.5 h-6 w-px sm:mx-1"></div>
		<button
			class="btn btn-ghost btn-square {open ? 'btn-active' : ''}"
			disabled={!hasOptions}
			onclick={() => {
				icons = false;
				open = !open;
			}}
			title={m.tools.options}
			aria-label={m.tools.options}
			aria-expanded={open}
		>
			{#if tools.tool === 'eraser'}
				<span class="border-base-content rounded-full border" style="width: {dot(tools.eraser, 32)}px; height: {dot(tools.eraser, 32)}px"></span>
			{:else}
				<span class="border-base-content/30 size-6 rounded-full border" style="background: {ink.color}"></span>
			{/if}
		</button>
		<button class="btn btn-ghost btn-square {icons ? 'btn-active' : ''}" onclick={oninsertmenu} title={m.insert.menu} aria-label={m.insert.menu}>
			<span class="icon-[material-symbols-light--add-photo-alternate-outline] size-6" aria-hidden="true"></span>
		</button>
		<button class="btn btn-ghost btn-square" onclick={onpagemenu} title={m.page.menu} aria-label={m.page.menu}>
			<span class="icon-[material-symbols-light--note-stack-outline] size-6" aria-hidden="true"></span>
		</button>
	</div>
</div>
