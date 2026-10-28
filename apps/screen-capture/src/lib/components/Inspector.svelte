<script lang="ts">
	import CanvasSizeField from './CanvasSizeField.svelte';
	import ColorField from './ColorField.svelte';
	import NumberField from './NumberField.svelte';
	import type { Size } from '#lib/project/canvas.js';
	import { fitRect, FREEZE_ICON, OVERLAY_KINDS, ZOOM_ICON } from '#lib/project/defaults.js';
	import type { Editor } from '#lib/project/editor.svelte.js';
	import {
		hasShadow,
		type Annotation,
		type Clip,
		type ClipShape,
		type FontId,
		type TextAlign,
		type ZoomSegment
	} from '#lib/project/types.js';
	import { rememberDuration, rememberStyle } from '#lib/project/styles.js';
	import { FONT_IDS, FONTS, loadFont } from '#lib/render/fonts.svelte.js';
	import { fitTextToCanvas, overlayBounds } from '#lib/render/overlays.js';
	import { ANCHORS } from '#lib/media/content.js';
	import {
		clampFade,
		clipDuration,
		fadeEdges,
		remove,
		removeZoom,
		retimeAnnotation,
		retimeZoom,
		trim,
		updateItem,
		updateZoom
	} from '#lib/timeline/ops.js';
	import { m } from '#lib/i18n/index.js';
	import { formatTime } from '#lib/util/format.js';

	interface Props {
		editor: Editor;
	}

	let { editor }: Props = $props();

	const overlay = $derived(editor.selectedOverlay);
	const zoom = $derived(editor.selectedZoom);
	const clip = $derived(editor.selectedClip);
	/** Suggestion for the project panel: canvas that shows shrunk clips 1:1 */
	const largerCanvas = $derived(editor.largerCanvas());
	/** Canvas size being chosen in the project panel (`null`: closed) */
	let canvasDraft = $state<Size | null>(null);
	/** Several selected, without a primary item (e.g. Ctrl+A) */
	const multiple = $derived(editor.selectedItems.length > 1 && !editor.selectedItem ? editor.selectedItems : null);
	/** Other items selected along with it (e.g. the group of the clicked clip) */
	const others = $derived(editor.selectedItem ? editor.selectedItems.length - 1 : 0);
	/** Are selected items linked? */
	const grouped = $derived(editor.selectedItems.some((item) => item.group));

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

	function setZoom(patch: Partial<Omit<ZoomSegment, 'start' | 'end'>>, field: string) {
		const z = zoom;
		if (z) editor.update((t) => updateZoom(t, z.id, patch), `insp-${z.id}-${field}`);
	}

	/** Change zoom level, keeping the view's center where possible */
	function setZoomLevel(level: number) {
		const z = zoom;
		if (!z) return;
		const w = 1 / level;
		const cx = z.rect.x + z.rect.w / 2;
		const cy = z.rect.y + z.rect.h / 2;
		const clamp = (v: number) => Math.min(Math.max(v, 0), 1 - w);
		setZoom({ rect: { x: clamp(cx - w / 2), y: clamp(cy - w / 2), w, h: w } }, 'level');
	}

	function setTiming(start: number, length: number) {
		if (overlay) {
			editor.update((t) => retimeAnnotation(t, overlay.id, start, start + length), `insp-${overlay.id}-timing`);
			rememberDuration(overlay.kind, length);
		}
		else if (zoom) editor.update((t) => retimeZoom(t, zoom.id, start, start + length), `insp-${zoom.id}-timing`);
	}

	function removeSelected() {
		const ids = editor.selectedIds;
		if (ids.length) editor.update((t) => remove(t, ids, true, (id) => !!editor.source(id)?.hasVideo));
		else if (zoom) editor.update((t) => removeZoom(t, zoom.id));
	}

	function setClip(c: Clip, patch: Partial<Clip>, field: string) {
		editor.update((t) => updateItem(t, c.id, patch), `insp-${c.id}-${field}`);
	}

	const SHAPES: { value: ClipShape; label: string; icon: string }[] = [
		{ value: 'rect', label: m.inspector.shapeRect, icon: 'icon-[material-symbols-light--crop-landscape-outline]' },
		{ value: 'rounded', label: m.inspector.shapeRounded, icon: 'icon-[material-symbols-light--rounded-corner]' },
		{ value: 'circle', label: m.inspector.shapeCircle, icon: 'icon-[material-symbols-light--circle-outline]' }
	];

	const ALIGNS: { value: TextAlign; label: string; icon: string }[] = [
		{ value: 'left', label: m.inspector.alignLeft, icon: 'icon-[material-symbols-light--format-align-left]' },
		{ value: 'center', label: m.inspector.alignCenter, icon: 'icon-[material-symbols-light--format-align-center]' },
		{ value: 'right', label: m.inspector.alignRight, icon: 'icon-[material-symbols-light--format-align-right]' },
		{ value: 'justify', label: m.inspector.alignJustify, icon: 'icon-[material-symbols-light--format-align-justify]' }
	];

	const end = () => editor.endGesture();

	/** Fit the clip or let it fill the canvas (center: canvas center) */
	function place(c: Clip, cover: boolean) {
		const source = editor.source(c.sourceId);
		if (!source) return;
		const rect = fitRect(source, editor.project.width, editor.project.height, cover);
		editor.update((t) => updateItem(t, c.id, { rect }));
	}

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
</script>

<!-- Size relative to the canvas height, shown and entered in canvas pixels (`min`/`max` as shares of the height) -->
{#snippet pixels(label: string, value: number, min: number, max: number, onset: (v: number) => void)}
	{@const H = editor.project.height}
	<NumberField
		{label}
		value={Math.round(value * H)}
		unit="px"
		min={Math.max(1, Math.ceil(min * H))}
		max={Math.max(1, Math.floor(max * H))}
		oninput={(px) => onset(px / H)}
		oncommit={end}
	/>
{/snippet}

<!-- Fade or transition at the start and end, each with its own duration (0: none), in one compact row. Together
	 they never exceed the element's duration; if it got shorter later, a side only partly takes effect – marked. -->
{#snippet inOut(label: string, sides: [FadeSide, FadeSide], start: number, stop: number)}
	{@const duration = stop - start}
	{@const [inEnd, outStart] = fadeEdges(start, stop, sides[0].value, sides[1].value)}
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
{/snippet}

{#snippet checkbox(label: string, checked: boolean, onset: (v: boolean) => void)}
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
{/snippet}

{#snippet timing(start: number, stop: number)}
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
{/snippet}

<div class="flex flex-col gap-4 p-3 text-sm">
	{#if multiple}
		<h3 class="flex items-center gap-2 font-semibold">
			<span class="icon-[material-symbols-light--select-all] size-5" aria-hidden="true"></span>
			{m.inspector.selected(multiple.length)}
		</h3>
		<p class="text-xs opacity-70">{m.inspector.multipleHint}</p>
	{:else if overlay}
		{@const o = overlay}
		<h3 class="flex items-center gap-2 font-semibold">
			<span class="{OVERLAY_KINDS[o.kind].icon} size-5" aria-hidden="true"></span>
			{OVERLAY_KINDS[o.kind].label}
		</h3>

		{#if o.kind === 'text' || o.kind === 'callout'}
			<label class="flex flex-col gap-1">
				<span class="text-xs opacity-70">{m.inspector.text}</span>
				<textarea
					class="textarea textarea-sm"
					rows="3"
					value={o.text}
					oninput={(e) => setTextBox({ text: e.currentTarget.value }, 'text')}
					onchange={end}
				></textarea>
			</label>
			{@render pixels(m.inspector.fontSize, o.size, 4 / editor.project.height, 1, (v) => setOverlay({ size: v }, 'size'))}
			<div class="flex flex-col gap-1">
				<span class="text-xs opacity-70">{m.inspector.align}</span>
				<div class="flex items-center gap-2">
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
					{#if o.boxWidth !== undefined}
						<button
							class="btn btn-xs btn-ghost ml-auto"
							onclick={() => {
								setTextBox({ boxWidth: undefined }, 'boxWidth');
								end();
							}}
							title={m.inspector.autoWidthHint}
						>
							{m.inspector.autoWidth}
						</button>
					{/if}
				</div>
			</div>
			<label class="flex flex-col gap-1">
				<span class="text-xs opacity-70">{m.inspector.font}</span>
				<!-- Load all fonts once the list opens, so every option shows in its own font -->
				<select
					class="select select-sm"
					style="font-family: {FONTS[o.font].family}"
					value={o.font}
					onfocus={() => FONT_IDS.forEach(loadFont)}
					onchange={(e) => {
						setTextBox({ font: e.currentTarget.value as FontId }, 'font');
						end();
					}}
				>
					{#each FONT_IDS as id (id)}<option value={id} style="font-family: {FONTS[id].family}">{FONTS[id].label}</option>{/each}
				</select>
			</label>
			<div class="flex flex-col gap-1">
				<span class="text-xs opacity-70">{m.inspector.background}</span>
				<ColorField
					value={o.background}
					allowNone={o.kind === 'text'}
					projectColors={editor.colors}
					onchange={(v, final) => setColor('background', v, final)}
				/>
			</div>
		{/if}

		{#if o.kind === 'step'}
			<NumberField
				label={m.inspector.stepNumber}
				value={o.number}
				min={1}
				max={999}
				oninput={(v) => setOverlay({ number: v }, 'number')}
				oncommit={end}
			/>
			{@render pixels(m.inspector.size, o.size, 8 / editor.project.height, 1, (v) => setOverlay({ size: v }, 'size'))}
		{/if}

		{#if 'color' in o}
			<div class="flex flex-col gap-1">
				<span class="text-xs opacity-70">{m.inspector.color}</span>
				<ColorField value={o.color} projectColors={editor.colors} onchange={(v, final) => setColor('color', v ?? o.color, final)} />
			</div>
		{/if}

		{#if o.kind === 'arrow' || o.kind === 'rect' || o.kind === 'ellipse' || o.kind === 'line'}
			{@render pixels(m.inspector.lineWidth, o.width, 0.002, 0.02, (v) => setOverlay({ width: v }, 'width'))}
		{/if}
		{#if o.kind === 'line'}
			{@render checkbox(m.inspector.dashed, o.dashed, (v) => setOverlay({ dashed: v }, 'dashed'))}
		{/if}
		{#if o.kind === 'image'}
			{@const image = editor.image(o.imageId)}
			{#if image}
				<div class="flex flex-col gap-1">
					<span class="text-xs opacity-70">{m.inspector.placement}</span>
					<div class="join">
						{#each [false, true] as cover (cover)}
							<button
								class="btn btn-sm join-item flex-1"
								onclick={() => {
									setOverlay({ rect: fitRect(image, editor.project.width, editor.project.height, cover) }, 'rect');
									end();
								}}
							>
								{#if cover}
									<span class="icon-[material-symbols-light--fullscreen] size-5" aria-hidden="true"></span> {m.inspector.fill}
								{:else}
									<span class="icon-[material-symbols-light--fit-screen-outline] size-5" aria-hidden="true"></span> {m.inspector.fit}
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}
			{@render pixels(m.inspector.radius, o.radius, 0, 0.1, (v) => setOverlay({ radius: v }, 'radius'))}
		{/if}
		{#if o.kind === 'rect'}
			{@render pixels(m.inspector.radius, o.radius, 0, 0.05, (v) => setOverlay({ radius: v }, 'radius'))}
		{/if}
		{#if o.kind === 'blur'}
			<div class="flex flex-col gap-1">
				<span class="text-xs opacity-70">{m.inspector.blurArea}</span>
				<div class="join">
					{#each [{ value: 'inside', label: m.inspector.blurInside, icon: 'icon-[material-symbols-light--crop-free]' }, { value: 'outside', label: m.inspector.blurOutside, icon: 'icon-[material-symbols-light--filter-center-focus]' }] as option (option.value)}
						<button
							class="btn btn-sm join-item flex-1 {o.area === option.value ? 'btn-primary' : ''}"
							onclick={() => {
								setOverlay({ area: option.value as 'inside' | 'outside' }, 'area');
								end();
							}}
						>
							<span class="{option.icon} size-5" aria-hidden="true"></span>
							{option.label}
						</button>
					{/each}
				</div>
			</div>
			{@render pixels(m.inspector.strength, o.strength, 0.002, 0.05, (v) => setOverlay({ strength: v }, 'strength'))}
		{/if}

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
		{#if hasShadow(o)}
			{@render checkbox(m.inspector.shadow, o.shadow, (v) => setOverlay({ shadow: v }, 'shadow'))}
		{/if}
	{:else if zoom}
		{@const z = zoom}
		<h3 class="flex items-center gap-2 font-semibold">
			<span class="{ZOOM_ICON} size-5" aria-hidden="true"></span> {m.inspector.zoomSegment}
		</h3>
		<p class="text-xs opacity-70">{m.inspector.zoomHint}</p>
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
		{@render inOut(
			m.inspector.ease,
			[
				{ label: m.inspector.zoomIn, value: z.easeIn, onset: (v) => setZoom({ easeIn: v }, 'easeIn') },
				{ label: m.inspector.zoomOut, value: z.easeOut, onset: (v) => setZoom({ easeOut: v }, 'easeOut') }
			],
			z.start,
			z.end
		)}
		{@render timing(z.start, z.end)}
	{:else if clip}
		{@const c = clip}
		{@const source = editor.source(c.sourceId)}
		<h3 class="flex items-center gap-2 font-semibold">
			{#if c.type === 'freeze'}
				<span class="{FREEZE_ICON} size-5" aria-hidden="true"></span> {m.inspector.freeze}
			{:else if source && !source.hasVideo}
				<span class="icon-[material-symbols-light--music-note] size-5" aria-hidden="true"></span> {m.inspector.audioClip}
			{:else}
				<span class="icon-[material-symbols-light--movie-outline] size-5" aria-hidden="true"></span> {m.inspector.clip}
			{/if}
		</h3>
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
		{#if source?.hasVideo}
			<div class="flex flex-col gap-1">
				<span class="text-xs opacity-70">{m.inspector.placement}</span>
				<div class="join">
					<button class="btn btn-sm join-item flex-1" onclick={() => place(c, false)}>
						<span class="icon-[material-symbols-light--fit-screen-outline] size-5" aria-hidden="true"></span> {m.inspector.fit}
					</button>
					<button class="btn btn-sm join-item flex-1" onclick={() => place(c, true)}>
						<span class="icon-[material-symbols-light--fullscreen] size-5" aria-hidden="true"></span> {m.inspector.fill}
					</button>
				</div>
				<p class="text-xs opacity-60">{m.inspector.placementHint}</p>
			</div>
			<div class="flex flex-col gap-1">
				<span class="text-xs opacity-70">{m.inspector.shape}</span>
				<div class="join">
					{#each SHAPES as shape (shape.value)}
						<button
							class="btn btn-sm join-item flex-1 {(c.shape ?? 'rect') === shape.value ? 'btn-primary' : ''}"
							onclick={() => editor.update((t) => updateItem(t, c.id, { shape: shape.value }))}
							title={shape.label}
							aria-label={shape.label}
						>
							<span class="{shape.icon} size-5" aria-hidden="true"></span>
						</button>
					{/each}
				</div>
			</div>
			{#if source.sizes}
				<!-- Recorded window was resized: where it sits while it is smaller -->
				<div class="flex flex-col gap-1">
					<span class="text-xs opacity-70">{m.inspector.windowPosition}</span>
					<div class="grid w-fit grid-cols-3 gap-1">
						{#each ANCHORS as anchor (anchor)}
							<button
								class="btn btn-xs btn-square {(c.anchor ?? 'center') === anchor ? 'btn-primary' : ''}"
								onclick={() => editor.update((t) => updateItem(t, c.id, { anchor }))}
								title={m.inspector.anchors[anchor]}
								aria-label={m.inspector.anchors[anchor]}
							>
								<span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>
							</button>
						{/each}
					</div>
					<p class="text-xs opacity-60">{m.inspector.windowPositionHint}</p>
				</div>
			{/if}
		{/if}
		{#if c.type === 'video' && source?.hasAudio}
			{@const volume = c.volume ?? 1}
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
					class="btn btn-xs btn-square {volume === 0 ? 'btn-warning' : 'btn-ghost'}"
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
		{#if c.type === 'freeze'}
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
		{/if}
	{:else}
		<h3 class="flex items-center gap-2 font-semibold">
			<span class="icon-[material-symbols-light--movie-edit-outline] size-5" aria-hidden="true"></span> {m.inspector.project}
		</h3>
		<div class="flex flex-col gap-1">
			<span class="flex items-center justify-between text-xs">
				<span class="opacity-70">{m.inspector.canvas}</span>
				<span class="flex items-center gap-1">
					<span class="tabular-nums">{editor.project.width} × {editor.project.height}</span>
					<button
						class="btn btn-ghost btn-xs"
						onclick={() => (canvasDraft = canvasDraft ? null : { width: editor.project.width, height: editor.project.height })}
						aria-expanded={!!canvasDraft}
					>
						{m.inspector.changeCanvas}
					</button>
				</span>
			</span>
			{#if canvasDraft}
				{@const draft = canvasDraft}
				<CanvasSizeField value={draft} onchange={(s) => (canvasDraft = s)} />
				<p class="text-xs opacity-60">{m.inspector.changeCanvasHint}</p>
				<button
					class="btn btn-sm btn-primary"
					onclick={() => {
						editor.resizeCanvas(draft);
						canvasDraft = null;
					}}
				>
					{m.inspector.applyCanvas}
				</button>
			{/if}
			{#if largerCanvas}
				{@const size = largerCanvas}
				<button class="btn btn-sm" onclick={() => editor.resizeCanvas(size)}>
					<span class="icon-[material-symbols-light--open-in-full] size-5" aria-hidden="true"></span>
					{m.editor.growCanvas} ({size.width} × {size.height})
				</button>
				<p class="text-xs opacity-60">{m.inspector.growCanvasHint}</p>
			{/if}
		</div>
		<div class="flex flex-col gap-1">
			<span class="text-xs opacity-70">{m.inspector.background}</span>
			<ColorField value={editor.project.background} opaque projectColors={editor.colors} onchange={(v) => v && editor.setBackground(v)} />
		</div>
		<div class="flex flex-col gap-2 text-xs opacity-70">
			<p>{m.inspector.nothing}</p>
			<p>{m.inspector.nothingHint}</p>
			<p>
				<kbd class="kbd kbd-xs">S</kbd> {m.inspector.shortcuts.split} · <kbd class="kbd kbd-xs">F</kbd>
				{m.inspector.shortcuts.hold} · <kbd class="kbd kbd-xs">{m.keys.del}</kbd>
				{m.inspector.shortcuts.delete} · <kbd class="kbd kbd-xs">⇧</kbd>+<kbd class="kbd kbd-xs">{m.keys.del}</kbd>
				{m.inspector.shortcuts.deleteGap} · <kbd class="kbd kbd-xs">{m.keys.ctrl}</kbd>+<kbd class="kbd kbd-xs">G</kbd>
				{m.inspector.shortcuts.link} · <kbd class="kbd kbd-xs">Esc</kbd>
				{m.inspector.shortcuts.deselect}
			</p>
		</div>
	{/if}

	{#if others > 0}
		<p class="text-xs opacity-70">{m.inspector.alsoSelected(others)}</p>
	{/if}
	{#if editor.canLink}
		<button class="btn btn-sm btn-outline" onclick={() => editor.link()} title={m.inspector.linkTitle}>
			<span class="icon-[material-symbols-light--link] size-5" aria-hidden="true"></span> {m.inspector.link}
		</button>
	{/if}
	{#if grouped}
		<button class="btn btn-sm btn-outline" onclick={() => editor.unlink()} title={m.inspector.unlinkTitle}>
			<span class="icon-[material-symbols-light--link-off] size-5" aria-hidden="true"></span> {m.inspector.unlink}
		</button>
	{/if}
	{#if multiple || overlay || zoom || clip}
		<button class="btn btn-sm btn-outline btn-error" onclick={removeSelected}>
			<span class="icon-[material-symbols-light--delete-outline] size-5" aria-hidden="true"></span> {m.common.delete}
		</button>
	{/if}
</div>
