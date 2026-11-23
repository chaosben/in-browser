<script lang="ts">
	// "Page size …": gives pages another format – larger (a margin appears), smaller, or another shape. The content
	// keeps its size or is fitted in (never distorted) and lies where the nine places say; comments go along.
	import { untrack } from 'svelte';
	import Modal from '@in-browser/brand/Modal.svelte';
	import { loadJson, storeJson } from '@in-browser/brand/storage.js';
	import { m } from '#lib/i18n/index.js';
	import type { PdfPage } from '#lib/model/document.svelte.js';
	import { resizePlace, type PageResize } from '#lib/model/page-size.js';
	import PageFormatFields, { pageFormatOf, pageSizeOf } from './PageFormatFields.svelte';

	let {
		pages,
		picked,
		onapply,
		onclose
	}: {
		/** The document's pages */
		pages: readonly PdfPage[];
		/** The pages to change unless all are (ids: the picked ones, else the current one) */
		picked: readonly string[];
		onapply: (to: PageResize, pages: string[]) => Promise<void>;
		onclose: () => void;
	} = $props();

	const STORE = 'pdf-editor:pagesize';
	const stored = loadJson<{ fit?: unknown; anchor?: unknown }>(STORE, {});
	const ANCHORS = [0, 0.5, 1] as const;
	const first = $derived(pages.find((p) => picked.includes(p.id)) ?? pages[0]);

	// Starts with the size the first page has: changing it is the point
	let choice = $state(untrack(() => pageFormatOf(first.w, first.h)));
	let fit = $state(stored.fit === true);
	const kept = Array.isArray(stored.anchor) && stored.anchor.every((v) => ANCHORS.includes(v as 0)) && stored.anchor.length === 2 ? (stored.anchor as [number, number]) : [0.5, 0.5];
	let ax = $state(kept[0]);
	let ay = $state(kept[1]);
	let all = $state(false);
	let busy = $state(false);

	const size = $derived(pageSizeOf(choice));
	const to = $derived<PageResize>({ w: size.w, h: size.h, fit, anchor: [ax, ay] });
	const ids = $derived(all ? pages.map((p) => p.id) : [...picked]);
	const changes = $derived(pages.some((p) => ids.includes(p.id) && (Math.abs(p.w - size.w) >= 0.01 || Math.abs(p.h - size.h) >= 0.01)));
	/** The first page on its new sheet, for the small drawing */
	const place = $derived(resizePlace(first.w, first.h, to));
	const frame = $derived(Math.max(size.w, size.h));

	async function apply(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		storeJson(STORE, { fit, anchor: [ax, ay] });
		try {
			await onapply(to, ids);
			onclose();
		} finally {
			busy = false;
		}
	}
</script>

<Modal {onclose} {busy} labelledby="page-size-title">
	<form class="modal-box flex max-w-md flex-col gap-4" onsubmit={apply}>
		<h3 id="page-size-title" class="flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--aspect-ratio-outline] size-6" aria-hidden="true"></span>
			{m.pageSize.title}
		</h3>
		<PageFormatFields bind:choice />
		<div class="flex gap-4">
			<div class="flex flex-1 flex-col gap-4">
				<fieldset class="flex flex-col gap-2">
					<legend class="mb-1 text-sm opacity-70">{m.pageSize.content}</legend>
					<label class="flex items-center gap-2"><input type="radio" class="radio radio-sm" bind:group={fit} value={false} />{m.pageSize.keep}</label>
					<label class="flex items-center gap-2"><input type="radio" class="radio radio-sm" bind:group={fit} value={true} />{m.pageSize.fit}</label>
				</fieldset>
				<fieldset class="flex flex-col gap-2">
					<legend class="mb-1 text-sm opacity-70">{m.pageSize.pages}</legend>
					<label class="flex items-center gap-2"><input type="radio" class="radio radio-sm" bind:group={all} value={false} />{m.pageSize.picked(picked.length)}</label>
					<label class="flex items-center gap-2"><input type="radio" class="radio radio-sm" bind:group={all} value={true} />{m.pageSize.all(pages.length)}</label>
				</fieldset>
			</div>
			<div class="flex flex-col items-center gap-3">
				<fieldset>
					<legend class="mb-1 text-sm opacity-70">{m.pageSize.place}</legend>
					<div class="grid grid-cols-3 gap-1">
						{#each ANCHORS as y, row (y)}
							{#each ANCHORS as x, column (x)}
								<label class={['flex size-8 cursor-pointer items-center justify-center rounded border', ax === x && ay === y ? 'border-selection bg-selection/20' : 'border-base-300']} title={m.pageSize.places[row][column]}>
									<input type="radio" class="sr-only" name="page-size-place" checked={ax === x && ay === y} aria-label={m.pageSize.places[row][column]} onchange={() => ((ax = x), (ay = y))} />
									<span class={['size-2 rounded-full', ax === x && ay === y ? 'bg-selection' : 'bg-base-content/30']} aria-hidden="true"></span>
								</label>
							{/each}
						{/each}
					</div>
				</fieldset>
				<!-- The first page on its new sheet: paper is a document color, white whatever the theme -->
				<svg viewBox="0 0 {frame} {frame}" class="size-24" role="img" aria-label={m.pageSize.preview}>
					<g transform="translate({(frame - size.w) / 2} {(frame - size.h) / 2})">
						<clipPath id="page-size-sheet"><rect width={size.w} height={size.h} /></clipPath>
						<rect width={size.w} height={size.h} fill="#ffffff" stroke="#94a3b8" stroke-width={frame / 96} />
						<rect
							x={place.dx}
							y={place.dy}
							width={first.w * place.scale}
							height={first.h * place.scale}
							class="fill-selection/30 stroke-selection"
							stroke-width={frame / 96}
							clip-path="url(#page-size-sheet)"
						/>
					</g>
				</svg>
			</div>
		</div>
		<div class="modal-action mt-0">
			<button type="button" class="btn btn-ghost" onclick={onclose} disabled={busy}>{m.common.cancel}</button>
			<button type="submit" class="btn btn-primary" disabled={busy || !changes}>
				{#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
				{m.pageSize.apply}
			</button>
		</div>
	</form>
</Modal>
