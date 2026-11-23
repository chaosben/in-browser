<script lang="ts" module>
	import { PAGE_FORMAT_IDS, PAGE_FORMATS, PAGE_SIDE, type PageFormat } from '@in-browser/pdf/write/paper-page.js';

	/** A page size as it is chosen: a format (paper sizes upright or across, media sizes), or one typed in millimeters */
	export interface PageFormatChoice {
		format: PageFormat | 'custom';
		landscape: boolean;
		/** A size of one's own, in millimeters */
		width: number;
		height: number;
	}

	const MM = 72 / 25.4;

	/** Only paper sizes are turned; media sizes have their shape, a typed size says it itself */
	const turnable = (c: PageFormatChoice) => c.format !== 'custom' && PAGE_FORMATS[c.format].kind === 'paper';

	/** The chosen size in points */
	export function pageSizeOf(c: PageFormatChoice): { w: number; h: number } {
		if (c.format === 'custom') return { w: c.width * MM, h: c.height * MM };
		const { w, h } = PAGE_FORMATS[c.format];
		return turnable(c) && c.landscape ? { w: h, h: w } : { w, h };
	}

	/** A stored choice, checked (anything else: A4 upright) */
	export function pageFormatChoice(stored: { format?: unknown; landscape?: unknown; width?: unknown; height?: unknown }): PageFormatChoice {
		const side = (v: unknown, fallback: number) => (typeof v === 'number' && v >= PAGE_SIDE.min / MM && v <= PAGE_SIDE.max / MM ? v : fallback);
		return {
			format: stored.format === 'custom' || PAGE_FORMAT_IDS.includes(stored.format as PageFormat) ? (stored.format as PageFormat | 'custom') : 'a4',
			landscape: stored.landscape === true,
			width: side(stored.width, 210),
			height: side(stored.height, 297)
		};
	}

	/** The choice that gives a page of `w` × `h` points: its format where it is one, else its size typed in */
	export function pageFormatOf(w: number, h: number): PageFormatChoice {
		const near = (a: number, b: number) => Math.abs(a - b) < 1;
		const custom = { width: Math.round((w / MM) * 10) / 10, height: Math.round((h / MM) * 10) / 10 };
		for (const id of PAGE_FORMAT_IDS) {
			const f = PAGE_FORMATS[id];
			if (near(f.w, w) && near(f.h, h)) return { format: id, landscape: false, ...custom };
			if (f.kind === 'paper' && near(f.h, w) && near(f.w, h)) return { format: id, landscape: true, ...custom };
		}
		return { format: 'custom', landscape: w > h, ...custom };
	}
</script>

<script lang="ts">
	// The fields a page size is chosen with – the same for a new PDF and for pages given another size
	import NumberField from '@in-browser/graphics/NumberField.svelte';
	import { m } from '#lib/i18n/index.js';

	let { choice = $bindable() }: { choice: PageFormatChoice } = $props();

	const size = $derived(pageSizeOf(choice));
	const mm = (pt: number) => Math.round(pt / MM);
</script>

<label class="flex flex-col gap-1">
	<span class="text-sm opacity-70">{m.newPdf.format}</span>
	<select class="select select-sm w-full" bind:value={choice.format}>
		<optgroup label={m.newPdf.paperFormats}>
			{#each PAGE_FORMAT_IDS.filter((id) => PAGE_FORMATS[id].kind === 'paper') as id (id)}<option value={id}>{m.newPdf.formats[id]}</option>{/each}
		</optgroup>
		<optgroup label={m.newPdf.mediaFormats}>
			{#each PAGE_FORMAT_IDS.filter((id) => PAGE_FORMATS[id].kind === 'media') as id (id)}<option value={id}>{m.newPdf.formats[id]}</option>{/each}
		</optgroup>
		<option value="custom">{m.newPdf.custom}</option>
	</select>
</label>
<!-- Always there (disabled where they don't apply), so nothing jumps -->
<fieldset class="flex flex-wrap items-center gap-x-4 gap-y-2" disabled={!turnable(choice)}>
	<legend class="mb-1 text-sm opacity-70">{m.newPdf.orientation}</legend>
	<label class="flex items-center gap-2"><input type="radio" class="radio radio-sm" bind:group={choice.landscape} value={false} /><span class={[!turnable(choice) && 'opacity-50']}>{m.newPdf.portrait}</span></label>
	<label class="flex items-center gap-2"><input type="radio" class="radio radio-sm" bind:group={choice.landscape} value={true} /><span class={[!turnable(choice) && 'opacity-50']}>{m.newPdf.landscape}</span></label>
</fieldset>
<fieldset class="flex flex-col gap-2" disabled={choice.format !== 'custom'}>
	<legend class="mb-1 text-sm opacity-70">{m.newPdf.size(mm(size.w), mm(size.h))}</legend>
	<div class={['flex flex-col gap-1', choice.format !== 'custom' && 'opacity-50']}>
		<NumberField label={m.newPdf.width} unit="mm" value={choice.width} min={mm(PAGE_SIDE.min)} max={mm(PAGE_SIDE.max)} oninput={(v) => (choice.width = v)} />
		<NumberField label={m.newPdf.height} unit="mm" value={choice.height} min={mm(PAGE_SIDE.min)} max={mm(PAGE_SIDE.max)} oninput={(v) => (choice.height = v)} />
	</div>
</fieldset>
