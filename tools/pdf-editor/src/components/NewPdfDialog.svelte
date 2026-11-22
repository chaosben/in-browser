<script lang="ts">
	// "New PDF …": an empty PDF to write on – its page size (paper sizes upright or across, media sizes, or one typed
	// in millimeters) and its paper. It is saved where the user says and opened right away.
	import Modal from '@in-browser/brand/Modal.svelte';
	import { loadJson, storeJson } from '@in-browser/brand/storage.js';
	import { chooseFile } from '@in-browser/files/dialog.svelte.js';
	import { showError } from '@in-browser/files/errors.js';
	import { write } from '@in-browser/files/fs.js';
	import NumberField from '@in-browser/graphics/NumberField.svelte';
	import { PAGE_FORMAT_IDS, PAGE_FORMATS, PAGE_SIDE, PAPERS, paperPdf, type PageFormat, type Paper } from '@in-browser/pdf/write/paper-page.js';
	import { m } from '#lib/i18n/index.js';

	let { folder, oncreated, onclose }: { folder: string; oncreated: (path: string) => void; onclose: () => void } = $props();

	const STORE = 'pdf-editor:new';
	const stored = loadJson<{ format?: unknown; landscape?: unknown; paper?: unknown; width?: unknown; height?: unknown }>(STORE, {});
	const MM = 72 / 25.4;
	const side = (v: unknown, fallback: number) => (typeof v === 'number' && v >= PAGE_SIDE.min / MM && v <= PAGE_SIDE.max / MM ? v : fallback);

	let format = $state<PageFormat | 'custom'>(stored.format === 'custom' || PAGE_FORMAT_IDS.includes(stored.format as PageFormat) ? (stored.format as PageFormat | 'custom') : 'a4');
	let landscape = $state(stored.landscape === true);
	let paper = $state<Paper>(PAPERS.includes(stored.paper as Paper) ? (stored.paper as Paper) : 'blank');
	/** A size of one's own, in millimeters */
	let width = $state(side(stored.width, 210));
	let height = $state(side(stored.height, 297));
	let busy = $state(false);

	/** Only paper sizes are turned; media sizes have their shape, a typed size says it itself */
	const turnable = $derived(format !== 'custom' && PAGE_FORMATS[format].kind === 'paper');
	const size = $derived.by(() => {
		if (format === 'custom') return { w: width * MM, h: height * MM };
		const { w, h } = PAGE_FORMATS[format];
		return turnable && landscape ? { w: h, h: w } : { w, h };
	});
	const mm = (pt: number) => Math.round(pt / MM);

	/** A small drawing of a paper */
	const PREVIEW: Record<Paper, string> = {
		blank: '',
		lined: 'M2 8h28M2 14h28M2 20h28M2 26h28',
		grid: 'M2 8h28M2 14h28M2 20h28M2 26h28M8 2v28M14 2v28M20 2v28M26 2v28',
		dotted: 'M8 8h.01M14 8h.01M20 8h.01M26 8h.01M8 14h.01M14 14h.01M20 14h.01M26 14h.01M8 20h.01M14 20h.01M20 20h.01M26 20h.01M8 26h.01M14 26h.01M20 26h.01M26 26h.01'
	};

	async function create(e: SubmitEvent) {
		e.preventDefault();
		const path = await chooseFile({ mode: 'save', folder, accept: ['.pdf'], name: m.newPdf.name, title: m.newPdf.saveTitle });
		if (!path) return;
		busy = true;
		try {
			storeJson(STORE, { format, landscape, paper, width, height });
			await write(path, new Blob([(await paperPdf({ width: size.w, height: size.h, paper })) as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
			oncreated(path);
		} catch (error) {
			showError(error, { context: '[pdf-editor] new' });
		} finally {
			busy = false;
		}
	}
</script>

<Modal {onclose} {busy} labelledby="new-pdf-title">
	<form class="modal-box flex max-w-md flex-col gap-4" onsubmit={create}>
		<h3 id="new-pdf-title" class="flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--note-add-outline] size-6" aria-hidden="true"></span>
			{m.newPdf.title}
		</h3>
		<label class="flex flex-col gap-1">
			<span class="text-sm opacity-70">{m.newPdf.format}</span>
			<select class="select select-sm w-full" bind:value={format}>
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
		<fieldset class="flex flex-wrap items-center gap-x-4 gap-y-2" disabled={!turnable}>
			<legend class="mb-1 text-sm opacity-70">{m.newPdf.orientation}</legend>
			<label class="flex items-center gap-2"><input type="radio" class="radio radio-sm" bind:group={landscape} value={false} /><span class={[!turnable && 'opacity-50']}>{m.newPdf.portrait}</span></label>
			<label class="flex items-center gap-2"><input type="radio" class="radio radio-sm" bind:group={landscape} value={true} /><span class={[!turnable && 'opacity-50']}>{m.newPdf.landscape}</span></label>
		</fieldset>
		<fieldset class="flex flex-col gap-2" disabled={format !== 'custom'}>
			<legend class="mb-1 text-sm opacity-70">{m.newPdf.size(mm(size.w), mm(size.h))}</legend>
			<div class={['flex flex-col gap-1', format !== 'custom' && 'opacity-50']}>
				<NumberField label={m.newPdf.width} unit="mm" value={width} min={mm(PAGE_SIDE.min)} max={mm(PAGE_SIDE.max)} oninput={(v) => (width = v)} />
				<NumberField label={m.newPdf.height} unit="mm" value={height} min={mm(PAGE_SIDE.min)} max={mm(PAGE_SIDE.max)} oninput={(v) => (height = v)} />
			</div>
		</fieldset>
		<fieldset>
			<legend class="mb-1 text-sm opacity-70">{m.newPdf.paper}</legend>
			<div class="grid grid-cols-4 gap-2">
				{#each PAPERS as kind (kind)}
					<label class={['flex cursor-pointer flex-col items-center gap-1 rounded border p-2 text-sm', paper === kind ? 'border-selection bg-selection/20' : 'border-base-300']}>
						<input type="radio" class="sr-only" bind:group={paper} value={kind} />
						<!-- Paper is a document color: white, whatever the theme -->
						<svg viewBox="0 0 32 32" class="size-10 rounded-sm bg-white" aria-hidden="true">
							<path d={PREVIEW[kind]} fill="none" stroke="#94a3b8" stroke-width={kind === 'dotted' ? 2 : 1} stroke-linecap="round" />
						</svg>
						{m.newPdf.papers[kind]}
					</label>
				{/each}
			</div>
		</fieldset>
		<div class="modal-action mt-0">
			<button type="button" class="btn btn-ghost" onclick={onclose} disabled={busy}>{m.common.cancel}</button>
			<button type="submit" class="btn btn-primary" disabled={busy}>
				{#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
				{m.newPdf.create}
			</button>
		</div>
	</form>
</Modal>
