<script lang="ts" module>
	/** A section of the properties shown alone (a ribbon popover) */
	export type PropertySection = 'content' | 'appearance' | 'background' | 'audio' | 'time' | 'canvas';
</script>

<script lang="ts">
	import CanvasSizeField from './CanvasSizeField.svelte';
	import ColorField from '@in-browser/graphics/ColorField.svelte';
	import InspectorField from '@in-browser/brand/InspectorField.svelte';
	import InspectorSearchField from '@in-browser/brand/InspectorSearchField.svelte';
	import InspectorSection from '@in-browser/brand/InspectorSection.svelte';
	import { getInspector } from '@in-browser/brand/inspector.svelte.js';
	import NumberField from '@in-browser/graphics/NumberField.svelte';
	import type { Size } from '#lib/project/canvas.js';
	import { cropInsets, insetsCrop, type CropInsets } from '#lib/project/crop.js';
	import { fitRect, FREEZE_ICON, OVERLAY_KINDS, ZOOM_ICON } from '#lib/project/defaults.js';
	import { zoomRectAt } from '#lib/project/geometry.js';
	import type { Editor } from '#lib/project/editor.svelte.js';
	import {
		hasShadow,
		isDrawable,
		type Annotation,
		type Clip,
		type AreaShape,
		type ClickStyle,
		type ClipShape,
		type TextAlign,
		type ZoomSegment
	} from '#lib/project/types.js';
	import { rememberDuration, rememberStyle } from '#lib/project/styles.js';
	import { FONT_IDS, loadFont } from '#lib/render/fonts.svelte.js';
	import { fitTextToCanvas, lineHeightOf, overlayBounds } from '#lib/render/overlays.js';
	import { richPatch } from '#lib/ui/text-commands.js';
	import { fontFamilyCss } from '@in-browser/graphics/fonts.js';
	import { graphicsMessages } from '@in-browser/graphics/i18n/index.svelte.js';
	import { LINE_HEIGHTS, styleAll, type TextStyle } from '@in-browser/graphics/rich-text.js';
	import { scaleInsets, type TextSizing } from '@in-browser/graphics/text-box.js';
	import InsetFields from '@in-browser/graphics/InsetFields.svelte';
	import { ANCHORS } from '#lib/media/content.js';
	import {
		clampFade,
		clipDuration,
		fadeEdges,
		retimeAnnotation,
		retimeZoom,
		trim,
		updateItem,
		updateZoom
	} from '#lib/timeline/ops.js';
	import { m } from '#lib/i18n/index.js';
	import { formatTime } from '#lib/util/format.js';
	import { placeClip, type EditorCommands } from '#lib/ui/commands.js';

	interface Props {
		editor: Editor;
		/** The editor's commands (link, crop, delete … act like in the ribbon) */
		commands: EditorCommands;
		/** One section of the selection's (or the project's) properties alone: a ribbon popover's content */
		only?: PropertySection;
	}

	let { editor, commands, only }: Props = $props();

	/** Filters the properties of the selected element; kept when the selection changes */
	const search = getInspector().search;

	const overlay = $derived(editor.selectedOverlay);
	const zoom = $derived(editor.selectedZoom);
	const clip = $derived(editor.selectedClip);
	/** Suggestion for the project panel: canvas that shows shrunk clips 1:1 */
	const largerCanvas = $derived(editor.largerCanvas());
	const clipCanvas = $derived(editor.clipCanvas());
	/** Canvas size being chosen in the project panel (`null`: closed) */
	/** Size being chosen; `clip`: the largest clip, applied with its offset */
	let canvasDraft = $state<(Size & { clip: boolean }) | null>(null);
	/** Several selected, without a primary item (e.g. Ctrl+A) */
	const multiple = $derived(editor.selectedItems.length > 1 && !editor.selectedItem ? editor.selectedItems : null);
	/** Other items selected along with it (e.g. the group of the clicked clip) */
	const others = $derived(editor.selectedItem ? editor.selectedItems.length - 1 : 0);

	// Sliders: all changes of one drag form one undo step (ended via `onchange`)
	function setOverlay(patch: Partial<Annotation>, field: string) {
		const o = overlay;
		if (!o) return;
		editor.update((t) => updateItem(t, o.id, patch), `insp-${o.id}-${field}`);
		// The next annotation of this type starts with the same settings
		rememberStyle(o.kind, patch);
	}

	/**
	 * Changes that can enlarge a text box (text, font, automatic width): the box is then kept within the canvas –
	 * wrapped, if needed with a smaller font. That adjustment belongs to this annotation only, it is not remembered.
	 */
	function setTextBox(patch: Partial<Annotation>, field: string) {
		const o = overlay;
		if (!o || (o.kind !== 'text' && o.kind !== 'callout')) return;
		const { width: W, height: H } = editor.project;
		const fit = fitTextToCanvas({ ...o, ...patch } as typeof o, (a) => overlayBounds(a, W, H));
		const changes = { ...patch, ...fit } as Partial<Annotation>;
		editor.update((t) => updateItem(t, o.id, changes), `insp-${o.id}-${field}`);
		rememberStyle(o.kind, patch);
	}

	/**
	 * The box's own font, size, color, bold …: its parts no longer say otherwise (as the ribbon's format commands do);
	 * kept within the canvas and remembered for the next text of that kind
	 */
	function setOwn(patch: TextStyle & { lineHeight?: number }, field: string) {
		const o = overlay;
		if (!o || (o.kind !== 'text' && o.kind !== 'callout')) return;
		const cleared = Object.fromEntries(Object.keys(patch).map((key) => [key, undefined])) as TextStyle;
		setTextBox({ ...patch, ...(o.rich && richPatch(styleAll(o.rich, cleared))) } as Partial<Annotation>, field);
	}


	/** The three sizings: the box as wide as the longest line, a fixed width with the height following, or a fixed size */
	const SIZINGS: { value: TextSizing; label: string; hint: string; icon: string }[] = [
		{ value: 'auto-width', label: m.inspector.autoWidth, hint: m.inspector.autoWidthHint, icon: 'icon-[material-symbols-light--width]' },
		{ value: 'auto-height', label: m.inspector.autoHeight, hint: m.inspector.autoHeightHint, icon: 'icon-[material-symbols-light--height]' },
		{ value: 'fixed', label: m.inspector.fixedSize, hint: m.inspector.fixedSizeHint, icon: 'icon-[material-symbols-light--crop-free]' }
	];

	function setSizing(to: TextSizing) {
		const o = overlay;
		if (!o || (o.kind !== 'text' && o.kind !== 'callout')) return;
		const { width: W, height: H } = editor.project;
		const b = overlayBounds(o, W, H);
		const patch =
			to === 'auto-width' ? { boxWidth: undefined, boxHeight: undefined } : to === 'auto-height' ? { boxWidth: b.w, boxHeight: undefined } : { boxWidth: b.w, boxHeight: b.h };
		setTextBox(patch, 'boxWidth');
	}

	function setZoom(patch: Partial<Omit<ZoomSegment, 'start' | 'end'>>, field: string) {
		const z = zoom;
		if (z) editor.update((t) => updateZoom(t, z.id, patch), `insp-${z.id}-${field}`);
	}

	/** Change zoom level, keeping the view's center where possible */
	function setZoomLevel(level: number) {
		const z = zoom;
		if (!z) return;
		setZoom({ rect: zoomRectAt(z.rect.x + z.rect.w / 2, z.rect.y + z.rect.h / 2, 1 / level) }, 'level');
	}

	function setTiming(start: number, length: number) {
		if (overlay) {
			editor.update((t) => retimeAnnotation(t, overlay.id, start, start + length), `insp-${overlay.id}-timing`);
			rememberDuration(overlay.kind, length);
		}
		else if (zoom) editor.update((t) => retimeZoom(t, zoom.id, start, start + length), `insp-${zoom.id}-timing`);
	}


	function setClip(c: Clip, patch: Partial<Clip>, field: string) {
		editor.update((t) => updateItem(t, c.id, patch), `insp-${c.id}-${field}`);
	}

	const SHAPES: { value: ClipShape; label: string; icon: string }[] = [
		{ value: 'rect', label: m.inspector.shapeRect, icon: 'icon-[material-symbols-light--crop-landscape-outline]' },
		{ value: 'rounded', label: m.inspector.shapeRounded, icon: 'icon-[material-symbols-light--rounded-corner]' },
		{ value: 'circle', label: m.inspector.shapeCircle, icon: 'icon-[material-symbols-light--circle-outline]' }
	];

	const AREA_SHAPES: { value: AreaShape; label: string; icon: string }[] = [
		{ value: 'rect', label: m.inspector.shapeRect, icon: 'icon-[material-symbols-light--crop-landscape-outline]' },
		{ value: 'ellipse', label: m.inspector.shapeEllipse, icon: 'icon-[material-symbols-light--circle-outline]' }
	];

	const CLICK_STYLES: { value: ClickStyle; label: string; icon: string }[] = [
		{ value: 'ripple', label: m.inspector.clickStyles.ripple, icon: 'icon-[material-symbols-light--radio-button-unchecked]' },
		{ value: 'rings', label: m.inspector.clickStyles.rings, icon: 'icon-[material-symbols-light--adjust]' },
		{ value: 'dot', label: m.inspector.clickStyles.dot, icon: 'icon-[material-symbols-light--circle]' },
		{ value: 'burst', label: m.inspector.clickStyles.burst, icon: 'icon-[material-symbols-light--flare]' }
	];

	const ALIGNS: { value: TextAlign; label: string; icon: string }[] = [
		{ value: 'left', label: m.inspector.alignLeft, icon: 'icon-[material-symbols-light--format-align-left]' },
		{ value: 'center', label: m.inspector.alignCenter, icon: 'icon-[material-symbols-light--format-align-center]' },
		{ value: 'right', label: m.inspector.alignRight, icon: 'icon-[material-symbols-light--format-align-right]' },
		{ value: 'justify', label: m.inspector.alignJustify, icon: 'icon-[material-symbols-light--format-align-justify]' }
	];

	const end = () => editor.endGesture();

	/** Fit the clip or let it fill the canvas (center: canvas center) */
	const place = (c: Clip, cover: boolean) => placeClip(editor, c, cover);

	// “Canvas size …” (the dialog): the size field open from the start
	// svelte-ignore state_referenced_locally
	if (only === 'canvas') canvasDraft = { width: editor.project.width, height: editor.project.height, clip: false };


	const CROP_SIDES: { side: keyof CropInsets; label: string }[] = [
		{ side: 'left', label: m.inspector.cropLeft },
		{ side: 'top', label: m.inspector.cropTop },
		{ side: 'right', label: m.inspector.cropRight },
		{ side: 'bottom', label: m.inspector.cropBottom }
	];

	/** Color change from the ColorField: drag = one undo step, `final` completes it */
	function setColor(field: 'color' | 'background', value: string | null, final: boolean) {
		setOverlay({ [field]: value } as Partial<Annotation>, field);
		if (final) end();
	}
	/** Longest fade or transition in seconds */
	const MAX_FADE = 10;

	interface FadeSide {
		label: string;
		value: number;
		onset: (seconds: number) => void;
	}

	/** The inner margin's field is found by its sides' names too */
	const insetWords = $derived(Object.values(graphicsMessages().insets));
</script>

<!-- Size relative to the canvas height, shown and entered in canvas pixels (`min`/`max` as shares of the height) -->
{#snippet pixels(label: string, value: number, min: number, max: number, onset: (v: number) => void)}
	{@const H = editor.project.height}
	<InspectorField {label}>
		<NumberField
			{label}
			value={Math.round(value * H)}
			unit="px"
			min={min === 0 ? 0 : Math.max(1, Math.ceil(min * H))}
			max={Math.max(1, Math.floor(max * H))}
			oninput={(px) => onset(px / H)}
			oncommit={end}
		/>
	</InspectorField>
{/snippet}

<!-- Fade or transition at the start and end, each with its own duration (0: none), in one compact row. Together
	 they never exceed the element's duration; if it got shorter later, a side only partly takes effect – marked. -->
{#snippet inOut(label: string, sides: [FadeSide, FadeSide], start: number, stop: number)}
	{@const duration = stop - start}
	{@const [inEnd, outStart] = fadeEdges(start, stop, sides[0].value, sides[1].value)}
	<InspectorField {label} keywords={sides.map((side) => side.label)}>
		<!-- Label, then both sides sharing the rest of the width -->
		<div class="grid grid-cols-[auto_1fr_1fr] items-center gap-x-2 text-xs">
			<span class="opacity-70">{label}</span>
			{#each sides as side, i (side.label)}
				{@const other = sides[1 - i].value}
				{@const effective = i === 0 ? inEnd - start : stop - outStart}
				{@const shortened = side.value > 0 && effective < side.value - 0.005}
				<NumberField
					label={side.label}
					layout="inline"
					value={side.value}
					unit="s"
					min={0}
					max={Math.max(0, Math.min(MAX_FADE, duration - other))}
					step={0.1}
					decimals={2}
					warning={shortened ? m.inspector.fadeShortened(effective.toFixed(2)) : undefined}
					oninput={(v) => side.onset(clampFade(v, other, duration))}
					oncommit={end}
				/>
			{/each}
		</div>
	</InspectorField>
{/snippet}

{#snippet checkbox(label: string, checked: boolean, onset: (v: boolean) => void)}
	<InspectorField {label}>
		<label class="label text-xs">
			<input
				type="checkbox"
				class="checkbox checkbox-xs"
				{checked}
				onchange={(e) => {
					onset(e.currentTarget.checked);
					end();
				}}
			/>
			{label}
		</label>
	</InspectorField>
{/snippet}

{#snippet timing(start: number, stop: number)}
	<InspectorField label={m.inspector.start}>
		<NumberField
			label={m.inspector.start}
			value={start}
			unit="s"
			min={0}
			step={0.1}
			decimals={2}
			oninput={(v) => setTiming(v, stop - start)}
			oncommit={end}
		/>
	</InspectorField>
	<InspectorField label={m.inspector.duration}>
		<NumberField
			label={m.inspector.duration}
			value={stop - start}
			unit="s"
			min={0.1}
			step={0.1}
			decimals={2}
			oninput={(v) => setTiming(start, v)}
			oncommit={end}
		/>
	</InspectorField>
{/snippet}

{#snippet color(label: string, value: string | null, onchange: (v: string | null, final: boolean) => void, allowNone = false)}
	<InspectorField {label}>
		<div class="flex flex-col gap-1">
			<span class="text-xs opacity-70">{label}</span>
			<ColorField {value} {allowNone} projectColors={editor.colors} {onchange} />
		</div>
	</InspectorField>
{/snippet}

{#snippet placement(label: string, onplace: (cover: boolean) => void, hint?: string)}
	<InspectorField {label} keywords={[m.inspector.fit, m.inspector.fill]}>
		<div class="flex flex-col gap-1">
			<span class="text-xs opacity-70">{label}</span>
			<div class="join">
				<button class="btn btn-sm join-item flex-1" onclick={() => onplace(false)}>
					<span class="icon-[material-symbols-light--fit-screen-outline] size-5" aria-hidden="true"></span> {m.inspector.fit}
				</button>
				<button class="btn btn-sm join-item flex-1" onclick={() => onplace(true)}>
					<span class="icon-[material-symbols-light--fullscreen] size-5" aria-hidden="true"></span> {m.inspector.fill}
				</button>
			</div>
			{#if hint}<p class="text-xs opacity-60">{hint}</p>{/if}
		</div>
	</InspectorField>
{/snippet}

<!-- Type of the selected element, then the search over its properties -->
{#snippet header(icon: string, title: string)}
	{#if !only}
	<h3 class="flex items-center gap-2 font-semibold">
		<span class="{icon} size-5" aria-hidden="true"></span>
		{title}
	</h3>
	<InspectorSearchField />
	{/if}
{/snippet}

<!-- Nothing selected: the project's canvas and background (also the ribbon's “Canvas” popover, whatever is selected) -->
{#snippet projectFields()}
		{@render header('icon-[material-symbols-light--movie-edit-outline]', m.inspector.project)}
		{#if !only || only === 'canvas'}<InspectorSection id="canvas" title={m.inspector.sections.canvas}>
			<InspectorField label={m.inspector.canvas} keywords={[m.inspector.changeCanvas, m.editor.growCanvas, m.canvasSize.largestClip]}>
				<div class="flex flex-col gap-1">
					<span class="flex items-center justify-between text-xs">
						<span class="opacity-70">{m.inspector.canvas}</span>
						<span class="flex items-center gap-1">
							<span class="tabular-nums">{editor.project.width} × {editor.project.height}</span>
							<button
								class="btn btn-ghost btn-xs"
								onclick={() => (canvasDraft = canvasDraft ? null : { width: editor.project.width, height: editor.project.height, clip: false })}
								aria-expanded={!!canvasDraft}
							>
								{m.inspector.changeCanvas}
							</button>
						</span>
					</span>
					{#if canvasDraft}
						{@const draft = canvasDraft}
						<CanvasSizeField value={draft} largestClip={clipCanvas?.size} onchange={(s, clip) => (canvasDraft = { ...s, clip })} />
						<p class="text-xs opacity-60">{draft.clip ? m.inspector.cropCanvasHint : m.inspector.changeCanvasHint}</p>
						<button
							class="btn btn-sm btn-primary"
							onclick={() => {
								if (draft.clip && clipCanvas) editor.resizeCanvas(clipCanvas.size, clipCanvas.offset);
								else editor.resizeCanvas({ width: draft.width, height: draft.height });
								canvasDraft = null;
							}}
						>
							{m.inspector.applyCanvas}
						</button>
					{/if}
					<button class="btn btn-sm" disabled={!largerCanvas} onclick={() => largerCanvas && editor.resizeCanvas(largerCanvas)}>
						<span class="icon-[material-symbols-light--open-in-full] size-5" aria-hidden="true"></span>
						{m.editor.growCanvas}
					</button>
					<p class="text-xs opacity-60">
						{largerCanvas ? m.inspector.growCanvasSize(largerCanvas.width, largerCanvas.height) : m.inspector.growCanvasNone}
						{m.inspector.growCanvasHint}
					</p>

				</div>
			</InspectorField>
		</InspectorSection>{/if}
		{#if !only || only === 'canvas'}<InspectorSection id="project-background" title={m.inspector.sections.background}>
			<InspectorField label={m.inspector.background}>
				<div class="flex flex-col gap-1">
					<span class="text-xs opacity-70">{m.inspector.background}</span>
					<ColorField
						value={editor.project.background}
						opaque
						projectColors={editor.colors}
						onchange={(v, final) => {
							if (v) editor.setBackground(v, 'background');
							if (final) end();
						}}
					/>
				</div>
			</InspectorField>
		</InspectorSection>{/if}
		{#if !search.active && !only}
			<div class="flex flex-col gap-2 text-xs opacity-70">
				<p>{m.inspector.nothing}</p>
				<p>{m.inspector.nothingHint}</p>
			</div>
		{/if}
{/snippet}

<div class={['flex flex-col gap-4 text-sm', only ? 'max-h-[70vh] w-80 max-w-full overflow-y-auto' : 'p-3']}>
	{#if only === 'canvas'}
		{@render projectFields()}
	{:else if multiple && !only}
		<h3 class="flex items-center gap-2 font-semibold">
			<span class="icon-[material-symbols-light--select-all] size-5" aria-hidden="true"></span>
			{m.inspector.selected(multiple.length)}
		</h3>
		<p class="text-xs opacity-70">{m.inspector.multipleHint}</p>
	{:else if overlay}
		{@const o = overlay}
		{@render header(OVERLAY_KINDS[o.kind].icon, OVERLAY_KINDS[o.kind].label)}

		{#if o.kind === 'step' || o.kind === 'click' || o.kind === 'image' || o.kind === 'barcode'}
			{#if !only || only === 'content'}<InspectorSection id="content" title={m.inspector.sections.content}>
				{#if o.kind === 'step'}
					<InspectorField label={m.inspector.stepNumber}>
						<NumberField
							label={m.inspector.stepNumber}
							value={o.number}
							min={1}
							max={999}
							oninput={(v) => setOverlay({ number: v }, 'number')}
							oncommit={end}
						/>
					</InspectorField>
				{:else if o.kind === 'click'}
					<InspectorField label={m.inspector.clickStyle} keywords={CLICK_STYLES.map((style) => style.label)}>
						<div class="flex flex-col gap-1">
							<span class="text-xs opacity-70">{m.inspector.clickStyle}</span>
							<div class="grid grid-cols-2 gap-1">
								{#each CLICK_STYLES as style (style.value)}
									<button
										class="btn btn-sm justify-start {o.style === style.value ? 'btn-active' : ''}"
										aria-pressed={o.style === style.value}
										onclick={() => {
											setOverlay({ style: style.value }, 'style');
											end();
										}}
									>
										<span class="{style.icon} size-5" aria-hidden="true"></span>
										{style.label}
									</button>
								{/each}
							</div>
							<p class="text-xs opacity-60">{m.inspector.clickHint}</p>
						</div>
					</InspectorField>
				{:else if o.kind === 'barcode'}
					<InspectorField label={commands.editBarcode.label}>
						<button class="btn btn-sm w-full justify-start" onclick={() => commands.editBarcode.run?.()}>
							<span class="{commands.editBarcode.icon} size-5" aria-hidden="true"></span>
							{commands.editBarcode.label}
						</button>
					</InspectorField>
				{:else if o.kind === 'image'}
					{@const image = editor.image(o.imageId)}
					{#if image}
						{@render placement(m.inspector.placement, (cover) => {
							setOverlay({ rect: fitRect(image, editor.project.width, editor.project.height, cover) }, 'rect');
							end();
						})}
					{/if}
				{/if}
			</InspectorSection>{/if}
		{/if}

		{#if o.kind === 'text' || o.kind === 'callout'}
			{#if !only}<InspectorSection id="font" title={m.inspector.sections.font}>
				<InspectorField label={m.inspector.font}>
					<label class="flex flex-col gap-1">
						<span class="text-xs opacity-70">{m.inspector.font}</span>
						<!-- Load all fonts once the list opens, so every option shows in its own font -->
						<select
							class="select select-sm"
							style="font-family: {fontFamilyCss(o.font)}"
							value={o.font}
							onfocus={() => loadFont(...FONT_IDS)}
							onchange={(e) => {
								setOwn({ font: e.currentTarget.value as (typeof FONT_IDS)[number] }, 'font');
								end();
							}}
						>
							{#each FONT_IDS as id (id)}<option value={id} style="font-family: {fontFamilyCss(id)}">{graphicsMessages().text.fonts[id]}</option>{/each}
						</select>
					</label>
				</InspectorField>
				{@render pixels(m.inspector.fontSize, o.size, 1 / editor.project.height, 1, (v) => setOwn({ size: v }, 'size'))}
				<InspectorField label={m.inspector.style} keywords={[graphicsMessages().text.bold, graphicsMessages().text.italic, graphicsMessages().text.underline]}>
					<div class="flex flex-col gap-1">
						<span class="text-xs opacity-70">{m.inspector.style}</span>
						<div class="join">
							{#each [{ key: 'bold', icon: 'icon-[material-symbols-light--format-bold]' }, { key: 'italic', icon: 'icon-[material-symbols-light--format-italic]' }, { key: 'underline', icon: 'icon-[material-symbols-light--format-underlined]' }] as const as s (s.key)}
								<button
									class="btn btn-xs join-item {o[s.key] ? 'btn-active' : ''}"
									onclick={() => {
										setOwn({ [s.key]: !o[s.key] }, s.key);
										end();
									}}
									title={graphicsMessages().text[s.key]}
									aria-label={graphicsMessages().text[s.key]}
									aria-pressed={!!o[s.key]}
								>
									<span class="{s.icon} size-4" aria-hidden="true"></span>
								</button>
							{/each}
						</div>
					</div>
				</InspectorField>
				<InspectorField label={m.inspector.align} keywords={ALIGNS.map((a) => a.label)}>
					<div class="flex flex-col gap-1">
						<span class="text-xs opacity-70">{m.inspector.align}</span>
						<div class="join">
							{#each ALIGNS as a (a.value)}
								<button
									class="btn btn-xs join-item {o.align === a.value ? 'btn-active' : ''}"
									onclick={() => {
										setOverlay({ align: a.value }, 'align');
										end();
									}}
									title={a.label}
									aria-label={a.label}
									aria-pressed={o.align === a.value}
								>
									<span class="{a.icon} size-4" aria-hidden="true"></span>
								</button>
							{/each}
						</div>
					</div>
				</InspectorField>
				{@const lineHeight = lineHeightOf(o)}
				<InspectorField label={graphicsMessages().text.lineHeight}>
					<label class="flex flex-col gap-1">
						<span class="text-xs opacity-70">{graphicsMessages().text.lineHeight}</span>
						<select
							class="select select-sm"
							value={lineHeight}
							onchange={(e) => {
								setOwn({ lineHeight: Number(e.currentTarget.value) }, 'lineHeight');
								end();
							}}
						>
							{#each LINE_HEIGHTS.includes(lineHeight) ? LINE_HEIGHTS : [...LINE_HEIGHTS, lineHeight].sort((a, b) => a - b) as h (h)}
								<option value={h}>{graphicsMessages().text.lineHeightValue(h)}</option>
							{/each}
						</select>
					</label>
				</InspectorField>
				{@const sizing = o.boxWidth === undefined ? 'auto-width' : o.boxHeight === undefined ? 'auto-height' : 'fixed'}
				<InspectorField label={m.inspector.boxSize} keywords={SIZINGS.map((z) => z.label)}>
					<div class="flex flex-col gap-1">
						<span class="text-xs opacity-70">{m.inspector.boxSize}</span>
						<div class="join">
							{#each SIZINGS as z (z.value)}
								<button
									class="btn btn-xs join-item {sizing === z.value ? 'btn-active' : ''}"
									onclick={() => {
										setSizing(z.value);
										end();
									}}
									title={z.hint}
									aria-label={z.label}
									aria-pressed={sizing === z.value}
								>
									<span class="{z.icon} size-4" aria-hidden="true"></span>
								</button>
							{/each}
						</div>
					</div>
				</InspectorField>
				{@render color(m.inspector.color, o.color, (v, final) => {
					setOwn({ color: v ?? o.color }, 'color');
					if (final) end();
				})}
			</InspectorSection>{/if}
		{/if}

		{#if !only || only === 'appearance'}<InspectorSection id="appearance" title={m.inspector.sections.appearance}>
			<!-- Text and speech bubble show their color under Font -->
			{#if 'color' in o && o.kind !== 'text' && o.kind !== 'callout'}
				{@render color(m.inspector.color, o.color, (v, final) => setColor('color', v ?? o.color, final))}
			{/if}
			{#if o.kind === 'arrow' || o.kind === 'rect' || o.kind === 'ellipse' || o.kind === 'line'}
				{@render pixels(m.inspector.lineWidth, o.width, 1 / editor.project.height, 0.1, (v) => setOverlay({ width: v }, 'width'))}
			{/if}
			{#if o.kind === 'line'}
				{@render checkbox(m.inspector.dashed, o.dashed, (v) => setOverlay({ dashed: v }, 'dashed'))}
			{/if}
			{#if o.kind === 'step' || o.kind === 'click'}
				{@render pixels(m.inspector.size, o.size, 8 / editor.project.height, 1, (v) => setOverlay({ size: v }, 'size'))}
			{/if}
			{#if o.kind === 'rect'}
				{@render pixels(m.inspector.radius, o.radius, 0, 0.05, (v) => setOverlay({ radius: v }, 'radius'))}
			{/if}
			{#if o.kind === 'image'}
				{@render pixels(m.inspector.radius, o.radius, 0, 0.1, (v) => setOverlay({ radius: v }, 'radius'))}
			{/if}
			{#if o.kind === 'spotlight' || o.kind === 'blur'}
				<InspectorField label={m.inspector.areaShape} keywords={AREA_SHAPES.map((shape) => shape.label)}>
					<div class="flex flex-col gap-1">
						<span class="text-xs opacity-70">{m.inspector.areaShape}</span>
						<div class="join">
							{#each AREA_SHAPES as shape (shape.value)}
								<button
									class="btn btn-sm join-item flex-1 {o.shape === shape.value ? 'btn-active' : ''}"
									aria-pressed={o.shape === shape.value}
									onclick={() => {
										setOverlay({ shape: shape.value }, 'shape');
										end();
									}}
								>
									<span class="{shape.icon} size-5" aria-hidden="true"></span>
									{shape.label}
								</button>
							{/each}
						</div>
					</div>
				</InspectorField>
				{#if o.shape === 'rect'}
					{@render pixels(m.inspector.radius, o.radius, 0, 0.5, (v) => setOverlay({ radius: v }, 'radius'))}
				{/if}
			{/if}
			{#if o.kind === 'spotlight'}
				{@render pixels(m.inspector.spotlightBlur, o.blur, 0, 0.05, (v) => setOverlay({ blur: v }, 'blur'))}
			{/if}
			{#if o.kind === 'blur'}
				{@render pixels(m.inspector.strength, o.strength, 0.002, 0.05, (v) => setOverlay({ strength: v }, 'strength'))}
			{/if}
			{#if isDrawable(o)}
				{@render checkbox(m.inspector.sketch, o.sketch, (v) => setOverlay({ sketch: v }, 'sketch'))}
			{/if}
			{#if hasShadow(o)}
				{@render checkbox(m.inspector.shadow, o.shadow, (v) => setOverlay({ shadow: v }, 'shadow'))}
			{/if}
		</InspectorSection>{/if}

		{#if o.kind === 'text' || o.kind === 'callout'}
			{#if !only || only === 'background'}<InspectorSection id="background" title={m.inspector.sections.background}>
				{@render color(m.inspector.background, o.background, (v, final) => setColor('background', v, final), o.kind === 'text')}
				{#if o.background}
					<!-- Up to the canvas height like the font size: scaling the box at a corner scales both along -->
					{@render pixels(m.inspector.radius, o.radius, 0, 1, (v) => setOverlay({ radius: v }, 'radius'))}
					<InspectorField label={m.inspector.padding} keywords={insetWords}>
						<div class="flex flex-col gap-1">
							<span class="text-xs opacity-70">{m.inspector.padding}</span>
							<InsetFields
								value={scaleInsets(o.padding, editor.project.height)}
								unit="px"
								max={editor.project.height}
								oninput={(px) => setTextBox({ padding: scaleInsets(px, 1 / editor.project.height) }, 'padding')}
								oncommit={end}
							/>
						</div>
					</InspectorField>
				{/if}
			</InspectorSection>{/if}
		{/if}

		{#if !only || only === 'time'}<InspectorSection id="time" title={m.inspector.sections.time}>
			{@render timing(o.start, o.end)}
			{@render inOut(
				m.inspector.fade,
				[
					{ label: m.inspector.fadeIn, value: o.fadeIn, onset: (v) => setOverlay({ fadeIn: v }, 'fadeIn') },
					{ label: m.inspector.fadeOut, value: o.fadeOut, onset: (v) => setOverlay({ fadeOut: v }, 'fadeOut') }
				],
				o.start,
				o.end
			)}
			{#if isDrawable(o)}
				<!-- 0: appears at once; the shape draws itself while playing and in the export -->
				<InspectorField label={m.inspector.drawIn}>
					<NumberField
						label={m.inspector.drawIn}
						value={o.drawIn}
						unit="s"
						min={0}
						max={Math.max(0, o.end - o.start)}
						step={0.1}
						decimals={2}
						oninput={(v) => setOverlay({ drawIn: Math.min(v, o.end - o.start) }, 'drawIn')}
						oncommit={end}
					/>
				</InspectorField>
			{/if}
		</InspectorSection>{/if}
	{:else if zoom}
		{@const z = zoom}
		{@render header(ZOOM_ICON, m.inspector.zoomSegment)}
		{#if !only || only === 'content'}<InspectorSection id="content" title={m.inspector.sections.content}>
			<InspectorField label={m.inspector.zoomLevel}>
				<NumberField
					label={m.inspector.zoomLevel}
					value={1 / z.rect.w}
					unit="×"
					min={1.1}
					max={6}
					step={0.1}
					decimals={1}
					oninput={setZoomLevel}
					oncommit={end}
				/>
				<p class="text-xs opacity-70">{m.inspector.zoomHint}</p>
			</InspectorField>
		</InspectorSection>{/if}
		{#if !only || only === 'time'}<InspectorSection id="time" title={m.inspector.sections.time}>
			{@render timing(z.start, z.end)}
			{@render inOut(
				m.inspector.ease,
				[
					{ label: m.inspector.zoomIn, value: z.easeIn, onset: (v) => setZoom({ easeIn: v }, 'easeIn') },
					{ label: m.inspector.zoomOut, value: z.easeOut, onset: (v) => setZoom({ easeOut: v }, 'easeOut') }
				],
				z.start,
				z.end
			)}
		</InspectorSection>{/if}
	{:else if clip}
		{@const c = clip}
		{@const source = editor.source(c.sourceId)}
		{#if c.type === 'freeze'}
			{@render header(FREEZE_ICON, m.inspector.freeze)}
		{:else if source && !source.hasVideo}
			{@render header('icon-[material-symbols-light--music-note]', m.inspector.audioClip)}
		{:else}
			{@render header('icon-[material-symbols-light--movie-outline]', m.inspector.clip)}
		{/if}
		{#if !only || only === 'content'}<InspectorSection id="content" title={m.inspector.sections.content}>
			<InspectorField label={m.inspector.source} keywords={[m.inspector.range, m.inspector.frameAt, m.export.duration]}>
				<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
					<dt class="opacity-70">{m.inspector.source}</dt>
					<dd class="truncate">{source?.name ?? '–'}</dd>
					{#if c.type === 'video'}
						<dt class="opacity-70">{m.inspector.range}</dt>
						<dd>{formatTime(c.in, 2)} – {formatTime(c.out, 2)}</dd>
					{:else}
						<dt class="opacity-70">{m.inspector.frameAt}</dt>
						<dd>{formatTime(c.at, 2)}</dd>
					{/if}
					<dt class="opacity-70">{m.export.duration}</dt>
					<dd>{formatTime(clipDuration(c), 2)}</dd>
				</dl>
			</InspectorField>
			{#if source?.hasVideo}
				{@render placement(m.inspector.placement, (cover) => place(c, cover), m.inspector.placementHint)}
				{@const fit = editor.clipCanvasOf(c.id)}
				<InspectorField label={m.inspector.fitCanvasToClip} keywords={[m.inspector.canvas]}>
					<div class="flex flex-col gap-1">
						<button class="btn btn-sm" disabled={!fit} onclick={() => editor.fitCanvasToClip(c.id)}>
							<span class="icon-[material-symbols-light--fit-screen-outline] size-5" aria-hidden="true"></span>
							{m.inspector.fitCanvasToClip}
						</button>
						<p class="text-xs opacity-60">
							{fit ? m.inspector.fitCanvasToClipSize(fit.size.width, fit.size.height) : m.inspector.fitCanvasToClipNone}
							{m.inspector.fitCanvasToClipHint}
						</p>
					</div>
				</InspectorField>
				{@const cropping = editor.croppingClip?.id === c.id}
				{@const insets = cropInsets(source, c.crop)}
				<InspectorField label={m.inspector.crop} keywords={[m.inspector.removeCrop, ...CROP_SIDES.map((s) => s.label)]}>
					<div class="flex flex-col gap-1">
						<span class="text-xs opacity-70">{m.inspector.crop}</span>
						<div class="flex gap-1">
							<button
								class="btn btn-sm flex-1 {cropping ? 'btn-active' : ''}"
								onclick={() => commands.crop.run()}
								disabled={!commands.crop.enabled()}
								aria-pressed={cropping}
							>
								<span class="icon-[material-symbols-light--crop] size-5" aria-hidden="true"></span>
								{m.inspector.crop}
							</button>
							<button class="btn btn-sm flex-1" disabled={!commands.removeCrop.enabled()} onclick={() => commands.removeCrop.run()}>
								<span class="icon-[material-symbols-light--crop-free] size-5" aria-hidden="true"></span>
								{m.inspector.removeCrop}
							</button>
						</div>
						<div class="grid grid-cols-2 gap-x-3 gap-y-1">
							{#each CROP_SIDES as { side, label } (side)}
								<NumberField
									{label}
									layout="inline"
									value={insets[side]}
									unit="px"
									min={0}
									max={(side === 'left' || side === 'right' ? source.width : source.height) - 16}
									oninput={(px) => editor.setCrop(c.id, insetsCrop(source, { ...insets, [side]: px }), `crop-${c.id}-${side}`)}
									oncommit={end}
								/>
							{/each}
						</div>
						<p class="text-xs opacity-60">{m.inspector.cropHint}</p>
					</div>
				</InspectorField>
				<!-- Recorded window was resized: where it sits while it is smaller (only then, and without a crop) -->
				{@const anchorable = !!source.sizes && !c.crop}
				<InspectorField label={m.inspector.windowPosition}>
					<div class="flex flex-col gap-1">
						<span class="text-xs opacity-70">{m.inspector.windowPosition}</span>
						<div class="grid w-fit grid-cols-3 gap-1">
							{#each ANCHORS as anchor (anchor)}
								<button
									class="btn btn-xs btn-square {anchorable && (c.anchor ?? 'center') === anchor ? 'btn-active' : ''}"
									disabled={!anchorable}
									aria-pressed={anchorable && (c.anchor ?? 'center') === anchor}
									onclick={() => editor.update((t) => updateItem(t, c.id, { anchor }))}
									title={m.inspector.anchors[anchor]}
									aria-label={m.inspector.anchors[anchor]}
								>
									<span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>
								</button>
							{/each}
						</div>
						<p class="text-xs opacity-60">{c.crop ? m.inspector.windowPositionCropped : m.inspector.windowPositionHint}</p>
					</div>
				</InspectorField>
			{/if}
		</InspectorSection>{/if}
		{#if source?.hasVideo}
			{#if !only || only === 'appearance'}<InspectorSection id="appearance" title={m.inspector.sections.appearance}>
				<InspectorField label={m.inspector.shape} keywords={SHAPES.map((shape) => shape.label)}>
					<div class="flex flex-col gap-1">
						<span class="text-xs opacity-70">{m.inspector.shape}</span>
						<div class="join">
							{#each SHAPES as shape (shape.value)}
								<button
									class="btn btn-sm join-item flex-1 {(c.shape ?? 'rect') === shape.value ? 'btn-active' : ''}"
									aria-pressed={(c.shape ?? 'rect') === shape.value}
									onclick={() => editor.update((t) => updateItem(t, c.id, { shape: shape.value }))}
									title={shape.label}
									aria-label={shape.label}
								>
									<span class="{shape.icon} size-5" aria-hidden="true"></span>
								</button>
							{/each}
						</div>
					</div>
				</InspectorField>
			</InspectorSection>{/if}
		{/if}
		{#if c.type === 'video' && source?.hasAudio}
			{@const volume = c.volume ?? 1}
			{#if !only || only === 'audio'}<InspectorSection id="audio" title={m.inspector.sections.audio}>
				<InspectorField label={m.inspector.volume} keywords={[m.inspector.mute]}>
					<div class="flex items-center gap-2">
						<div class="flex-1">
							<NumberField
								label={m.inspector.volume}
								value={Math.round(volume * 100)}
								unit="%"
								min={0}
								max={100}
								oninput={(v) => setClip(c, { volume: v / 100 }, 'volume')}
								oncommit={end}
							/>
						</div>
						<button
							class="btn btn-xs btn-square btn-ghost {volume === 0 ? 'btn-active' : ''}"
							onclick={() => editor.update((t) => updateItem(t, c.id, { volume: volume === 0 ? 1 : 0 }))}
							title={m.inspector.mute}
							aria-label={m.inspector.mute}
							aria-pressed={volume === 0}
						>
							<span
								class="{volume === 0 ? 'icon-[material-symbols-light--volume-off-outline]' : 'icon-[material-symbols-light--volume-up-outline]'} size-5"
								aria-hidden="true"
							></span>
						</button>
					</div>
				</InspectorField>
			</InspectorSection>{/if}
		{/if}
		{#if !only || only === 'time'}<InspectorSection id="time" title={m.inspector.sections.time}>
			{#if c.type === 'freeze'}
				<InspectorField label={m.inspector.duration}>
					<NumberField
						label={m.inspector.duration}
						value={c.duration}
						unit="s"
						min={0.1}
						step={0.1}
						decimals={2}
						oninput={(v) => editor.update((t) => trim(t, c.id, 'out', v, 0), `insp-${c.id}-duration`)}
						oncommit={end}
					/>
				</InspectorField>
			{/if}
			<!-- Clips with a picture fade it, clips with sound fade that too -->
			{@render inOut(
				m.inspector.fade,
				[
					{ label: m.inspector.fadeIn, value: c.fadeIn ?? 0, onset: (v) => setClip(c, { fadeIn: v }, 'fadeIn') },
					{ label: m.inspector.fadeOut, value: c.fadeOut ?? 0, onset: (v) => setClip(c, { fadeOut: v }, 'fadeOut') }
				],
				c.start,
				c.start + clipDuration(c)
			)}
		</InspectorSection>{/if}
	{:else}
		{@render projectFields()}
	{/if}

	{#if others > 0 && !only}
		<p class="text-xs opacity-70">{m.inspector.alsoSelected(others)}</p>
	{/if}
	{#if !only && (multiple || overlay || zoom || clip)}
		<div class="flex gap-1">
			{#each [commands.link, commands.unlink] as cmd (cmd.id)}
				<button class="btn btn-sm btn-outline flex-1" disabled={!cmd.enabled()} onclick={() => cmd.run()} title={cmd.tip}>
					<span class="{cmd.icon} size-5" aria-hidden="true"></span> {cmd.label}
				</button>
			{/each}
		</div>
		<button class="btn btn-sm btn-outline" disabled={!commands.delete.enabled()} onclick={() => commands.delete.run()} title={commands.delete.tip}>
			<span class="icon-[material-symbols-light--delete-outline] size-5" aria-hidden="true"></span> {m.common.delete}
		</button>
	{/if}
</div>
