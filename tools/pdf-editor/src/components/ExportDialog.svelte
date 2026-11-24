<script lang="ts">
	// "Export …": pages as pictures (PNG, JPEG, WebP) named by a template, or as a JW Library playlist. The pages are
	// rendered one after the other (progress, "Cancel") and saved into the files or downloaded.
	import { onMount } from 'svelte';
	import { zipSync } from 'fflate';
	import Modal from '@in-browser/brand/Modal.svelte';
	import { downloadBlob } from '@in-browser/brand/download.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import ColorField from '@in-browser/graphics/ColorField.svelte';
	import NumberField from '@in-browser/graphics/NumberField.svelte';
	import { chooseFile } from '@in-browser/files/dialog.svelte.js';
	import { showError } from '@in-browser/files/errors.js';
	import { filesUrl } from '@in-browser/files/formats.js';
	import { list, write, writable } from '@in-browser/files/fs.js';
	import { filesMessages } from '@in-browser/files/i18n/index.svelte.js';
	import { basename, join, nameProblem, parent } from '@in-browser/files/path.js';
	import { canSend, sendWhenReady } from '@in-browser/files/send.js';
	import { END_ACTIONS, playlistBlob, playlistThumbnail, writePlaylist, type PlaylistItem } from '@in-browser/jwl/playlist.js';
	import { m } from '#lib/i18n/index.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';
	import {
		backgroundOf,
		canWriteWebp,
		DPI_MAX,
		DPI_MIN,
		EXPORT_FORMATS,
		exportScale,
		IMAGE_FORMATS,
		loadExportSettings,
		pictureNames,
		PLACEHOLDERS,
		seeThrough,
		storeExportSettings,
		type Placeholder
	} from '#lib/model/export.js';
	import { canvasBlob, freeCanvas, pageCanvas } from '#lib/model/print.js';
	import PageChoice, { type PageWhich } from './PageChoice.svelte';

	let { ed, which, onclose }: { ed: EditorState; which: PageWhich; onclose: () => void } = $props();

	const s = $state(loadExportSettings());
	let places = $state<number[] | null>(null);
	let pageProblem = $state<string | null>(null);
	let webp = $state(true);
	/** Pages exported so far, or `-1` while the playlist is written */
	let progress = $state<number | null>(null);
	let cancelled = false;
	let abort: AbortController | null = null;
	let nameField = $state<HTMLInputElement>();
	let placeholderMenu = $state<HTMLDetailsElement>();
	let backgroundButton = $state<HTMLButtonElement>();

	// A checkerboard behind the background swatch shows what is see-through
	const CHECKER = 'background-image: repeating-conic-gradient(#9ca3af 0 25%, #f3f4f6 0 50%); background-size: 6px 6px';
	/** The background as the chosen format takes it: opaque, and white for none, where it has no transparency */
	const shownBackground = $derived(seeThrough(s.format) ? s.background : (s.background?.slice(0, 7) ?? '#ffffff'));

	/** Popovers live in the top layer: placed below their button, right-aligned, inside the window */
	function placeBelow(e: ToggleEvent) {
		const popover = e.currentTarget as HTMLElement;
		if (e.newState !== 'open' || !backgroundButton) return;
		const rect = backgroundButton.getBoundingClientRect();
		popover.style.top = `${Math.min(rect.bottom + 4, innerHeight - popover.offsetHeight - 4)}px`;
		popover.style.left = `${Math.max(4, rect.right - popover.offsetWidth)}px`;
	}

	onMount(() => {
		void canWriteWebp().then((ok) => {
			webp = ok;
			if (!ok && s.format === 'webp') s.format = 'png';
		});
	});

	const playlist = $derived(s.format === 'playlist');
	type Target = 'save' | 'download' | 'send';
	const stem = $derived((ed.doc?.name ?? 'PDF').replace(/\.pdf$/i, ''));
	const ext = $derived(playlist ? 'jpg' : IMAGE_FORMATS[s.format as keyof typeof IMAGE_FORMATS].ext);
	/** “Send …” to another app: only types this browser hands over (Chromium: pictures yes, playlists no) */
	const sendable = $derived(canSend([`x.${playlist ? 'jwlplaylist' : ext}`]));
	const first = $derived(places?.length && ed.doc ? ed.doc.pages[places[0]] : null);
	const size = $derived.by(() => {
		if (!first) return '';
		const { scale, reduced } = exportScale(first.w, first.h, s.dpi);
		const w = Math.ceil(first.w * scale);
		const h = Math.ceil(first.h * scale);
		return reduced ? m.export.reduced(w, h) : m.export.size(w, h);
	});
	const example = $derived(
		first && places ? pictureNames(s.template, ext, [places[0] + 1], { name: stem, pages: ed.pageCount, date: new Date() }, [])[0] : ''
	);
	const nameIssue = $derived(playlist || !example ? null : nameProblem(example));
	const problem = $derived(pageProblem ?? (nameIssue ? filesMessages().names[nameIssue] : null));
	const ready = $derived(progress === null && !!places?.length && !problem);

	function insert(key: Placeholder) {
		placeholderMenu?.removeAttribute('open');
		const field = nameField;
		const text = `{${key}}`;
		const from = field?.selectionStart ?? s.template.length;
		const to = field?.selectionEnd ?? from;
		s.template = s.template.slice(0, from) + text + s.template.slice(to);
		requestAnimationFrame(() => {
			field?.focus();
			field?.setSelectionRange(from + text.length, from + text.length);
		});
	}

	/** Steps of the page at `place` (0: everything shows at once) – as the presentation counts them */
	const stepsAt = (place: number) => ed.doc?.stepsOf(ed.doc.pages[place]?.id ?? '') ?? 0;
	/** Whether a chosen page has presentation steps: only then can they be exported one by one */
	const hasSteps = $derived(!!places?.some((place) => stepsAt(place) > 0));
	const bySteps = $derived(playlist && s.comments && s.steps && hasSteps);

	/** What is drawn: a picture per page, or with `bySteps` one per step of each page (`step` from 0, of `steps`) */
	interface Shot {
		place: number;
		step?: number;
		steps: number;
	}
	const shots = $derived<Shot[]>(
		(places ?? []).flatMap((place) => {
			const steps = bySteps ? stepsAt(place) : 0;
			return bySteps ? Array.from({ length: steps + 1 }, (_, step) => ({ place, step, steps })) : [{ place, steps }];
		})
	);

	/** A shot as a canvas at the chosen resolution (free it when done) */
	function render({ place, step }: Shot) {
		const doc = ed.doc!;
		const page = doc.pages[place];
		return pageCanvas(doc, page, { comments: s.comments, scale: exportScale(page.w, page.h, s.dpi).scale, background: backgroundOf(s), step });
	}

	/** Renders the shots one after the other; `use` takes each picture and its shot */
	async function eachPage(use: (canvas: HTMLCanvasElement, shot: Shot, i: number) => Promise<void>): Promise<boolean> {
		progress = 0;
		for (const [i, shot] of shots.entries()) {
			const canvas = await render(shot);
			try {
				await use(canvas, shot, i);
			} finally {
				freeCanvas(canvas);
			}
			if (cancelled) return false;
			progress++;
		}
		return true;
	}

	async function run(target: Target) {
		const doc = ed.doc;
		if (!doc || !places?.length || !ready) return;
		storeExportSettings($state.snapshot(s));
		cancelled = false;
		try {
			if (playlist) await exportPlaylist(target);
			else await exportPictures(target);
		} catch (error) {
			if (!cancelled) showError(error, { text: m.export.failed });
		} finally {
			progress = null;
			abort = null;
		}
	}

	async function exportPictures(target: Target) {
		const doc = ed.doc!;
		const format = IMAGE_FORMATS[s.format as keyof typeof IMAGE_FORMATS];
		const quality = s.format === 'png' ? undefined : s.quality / 100;
		const pages = places!.map((p) => p + 1);
		const values = { name: stem, pages: ed.pageCount, date: new Date() };
		if (target === 'save') {
			// Where first – then the pages, each written as soon as it is drawn (never all in memory)
			const folder = await chooseFile({ mode: 'folder', folder: parent(doc.path), accept: [], title: m.export.folderTitle, confirmLabel: m.export.folderConfirm });
			if (!folder) return;
			const names = pictureNames(s.template, format.ext, pages, values, (await list(folder)).map((e) => e.name));
			if (!(await eachPage(async (canvas, _, i) => write(join(folder, names[i]), await canvasBlob(canvas, format.type, quality))))) return;
			onclose();
			toast(m.export.savedPictures(names.length, basename(folder) || '/'), 'success', 8000, {
				label: m.editor.showInFiles,
				run: () => void window.open(filesUrl(join(folder, names[0])), '_blank')
			});
			return;
		}
		const names = pictureNames(s.template, format.ext, pages, values, []);
		const blobs: Blob[] = [];
		if (!(await eachPage(async (canvas) => void blobs.push(await canvasBlob(canvas, format.type, quality))))) return;
		if (target === 'send') {
			onclose();
			return sendWhenReady(blobs, names);
		}
		else if (blobs.length === 1) downloadBlob(blobs[0], names[0]);
		else {
			// Pictures are compressed already: stored as they are
			const files = Object.fromEntries(await Promise.all(blobs.map(async (b, i) => [names[i], new Uint8Array(await b.arrayBuffer())] as const)));
			downloadBlob(new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), `${stem}.zip`);
		}
		onclose();
	}

	async function exportPlaylist(target: Target) {
		const doc = ed.doc!;
		const name = `${stem}.jwlplaylist`;
		let path: string | null = null;
		if (target === 'save') {
			path = await chooseFile({ mode: 'save', folder: parent(doc.path), accept: ['.jwlplaylist'], name, title: m.export.saveTitle });
			if (!path) return;
		}
		const items: PlaylistItem[] = [];
		const drawn = await eachPage(async (canvas, { place, step, steps }) => {
			const number = place + 1;
			const stepped = step !== undefined && steps > 0;
			const pictureName = pictureNames('{name}_{page}', 'jpg', [number], { name: stem, pages: ed.pageCount, date: new Date() }, [])[0];
			items.push({
				label: stepped ? m.export.stepLabel(stem, number, step + 1, steps + 1) : m.export.itemLabel(stem, number),
				media: await canvasBlob(canvas, 'image/jpeg', s.quality / 100),
				name: stepped ? pictureName.replace(/\.jpg$/, `_${step + 1}.jpg`) : pictureName,
				kind: 'image',
				seconds: s.seconds,
				endAction: s.endAction,
				thumbnail: await playlistThumbnail(canvas, canvas.width, canvas.height)
			});
		});
		if (!drawn) return;
		progress = -1;
		abort = new AbortController();
		const playlist = { name: stem, items };
		if (path) {
			await writePlaylist(playlist, await writable(path), { signal: abort.signal });
			onclose();
			const saved = path;
			toast(m.export.savedPlaylist(basename(saved)), 'success', 8000, { label: m.editor.showInFiles, run: () => void window.open(filesUrl(saved), '_blank') });
		} else {
			const blob = await playlistBlob(playlist, { signal: abort.signal });
			onclose();
			if (target === 'send') await sendWhenReady([blob], [name]);
			else downloadBlob(blob, name);
		}
	}

	function cancel() {
		if (progress === null) onclose();
		else {
			cancelled = true;
			abort?.abort();
		}
	}


	/** The one message line: progress, else what is wrong, else what will be written */
	const status = $derived(
		progress !== null
			? progress < 0
				? m.export.packing
				: (bySteps ? m.export.preparingSteps : m.export.preparing)(Math.min(progress + 1, shots.length), shots.length)
			: (problem ?? [playlist || !example ? '' : m.export.example(example), size].filter(Boolean).join(' · '))
	);
</script>

<Modal onclose={cancel} labelledby="export-title">
	<form
		class="modal-box flex max-w-lg flex-col gap-2.5"
		onsubmit={(e) => {
			e.preventDefault();
			void run('save');
		}}
	>
		<h3 id="export-title" class="mb-1 flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--photo-library-outline] size-6" aria-hidden="true"></span>
			{m.export.title}
		</h3>
		<PageChoice {ed} {which} small disabled={progress !== null} bind:places bind:problem={pageProblem} />
		<fieldset class="flex flex-col gap-2.5" disabled={progress !== null}>
			<label class="flex items-center gap-2 text-xs">
				<span class="w-28 shrink-0 opacity-70">{m.export.format}</span>
				<select class="select select-xs min-w-0 flex-1" bind:value={s.format}>
					{#each EXPORT_FORMATS as format (format)}
						<option value={format} disabled={format === 'webp' && !webp}>{m.export.formats[format]}{format === 'webp' && !webp ? ` – ${m.export.noWebp}` : ''}</option>
					{/each}
				</select>
			</label>
			<div class="grid grid-cols-2 gap-x-6">
				<NumberField label={m.export.resolution} value={s.dpi} unit={m.export.dpi} min={DPI_MIN} max={DPI_MAX} oninput={(v) => (s.dpi = Math.round(v))} />
				<fieldset disabled={s.format === 'png'} class={[s.format === 'png' && 'opacity-50']}>
					<NumberField label={m.export.quality} value={s.quality} unit="%" min={1} max={100} oninput={(v) => (s.quality = Math.round(v))} />
				</fieldset>
			</div>
			<div class="grid grid-cols-2 items-center gap-x-6">
				<div class="flex flex-col gap-1.5">
					<label class="flex items-center gap-2 text-xs"><input type="checkbox" class="checkbox checkbox-xs" bind:checked={s.comments} />{m.export.comments}</label>
					<!-- Always there (the playlist's option): off where it means nothing -->
					<label class={['flex items-center gap-2 text-xs', !(playlist && s.comments && hasSteps) && 'opacity-50']}>
						<input type="checkbox" class="checkbox checkbox-xs" bind:checked={s.steps} disabled={!(playlist && s.comments && hasSteps)} />{m.export.steps}
					</label>
				</div>
				<div class="flex items-center gap-1 text-xs">
					<span class="min-w-0 flex-1 truncate opacity-70">{m.export.background}</span>
					<!-- A swatch opening the suite's color field (palette, own colors, opacity) in the top layer -->
					<button
						type="button"
						class="btn btn-xs btn-square"
						popovertarget="export-background"
						title={m.export.background}
						aria-label={m.export.background}
						bind:this={backgroundButton}
					>
						<span class="border-base-content/30 relative size-4 overflow-hidden rounded-sm border" style={CHECKER} aria-hidden="true">
							{#if shownBackground}
								<span class="absolute inset-0" style:background={shownBackground}></span>
							{:else}
								<!-- Struck through = none -->
								<span class="bg-error absolute top-1/2 left-1/2 h-0.5 w-6 -translate-x-1/2 -translate-y-1/2 -rotate-45"></span>
							{/if}
						</span>
					</button>
				</div>
			</div>
			<!-- One row for what only one kind has: the pictures' names, or the playlist's timing – the same height -->
			{#if playlist}
				<div class="grid grid-cols-2 gap-x-6">
					<NumberField label={m.export.seconds} value={s.seconds} unit={m.export.secondsUnit} min={1} max={3600} oninput={(v) => (s.seconds = Math.round(v))} />
					<label class="flex items-center gap-1 text-xs">
						<span class="min-w-0 flex-1 truncate opacity-70">{m.export.endAction}</span>
						<select class="select select-xs w-28" bind:value={s.endAction}>
							{#each END_ACTIONS as action (action)}
								<option value={action}>{m.export.endActions[action]}</option>
							{/each}
						</select>
					</label>
				</div>
			{:else}
				<div class="flex items-center gap-2 text-xs">
					<span class="w-28 shrink-0 opacity-70">{m.export.fileName}</span>
					<div class="join min-w-0 flex-1">
						<input
							class={['input input-xs join-item min-w-0 flex-1', nameIssue && 'input-error']}
							aria-label={m.export.fileName}
							bind:value={s.template}
							bind:this={nameField}
						/>
						<details class="dropdown dropdown-end join-item" bind:this={placeholderMenu}>
							<summary class="btn btn-xs join-item" title={m.export.placeholders} aria-label={m.export.placeholders}>
								<span class="icon-[material-symbols-light--data-object] size-4" aria-hidden="true"></span>
							</summary>
							<ul class="menu menu-sm dropdown-content bg-base-100 rounded-box z-10 w-60 p-1 shadow">
								{#each PLACEHOLDERS as key (key)}
									<li>
										<button type="button" onclick={() => insert(key)}>
											<span class="flex-1">{m.export.placeholder[key]}</span><code class="opacity-70">{`{${key}}`}</code>
										</button>
									</li>
								{/each}
							</ul>
						</details>
					</div>
				</div>
			{/if}
		</fieldset>
		<!-- Always there, so the buttons never jump -->
		<p class={['min-h-5 truncate text-xs', problem && progress === null ? 'text-error' : 'opacity-70']} role="status" title={status}>{status}</p>
		<div class="modal-action mt-0 flex-wrap">
			<button type="button" class="btn btn-ghost" onclick={cancel}>{m.common.cancel}</button>
			<button type="button" class="btn" disabled={!ready} onclick={() => void run('download')}>
				<span class="icon-[material-symbols-light--download] size-5" aria-hidden="true"></span>
				{m.export.download}
			</button>
			<button type="button" class="btn" disabled={!ready || !sendable} onclick={() => void run('send')}>
				<span class="icon-[material-symbols-light--send-outline] size-5" aria-hidden="true"></span>
				{filesMessages().send.action}
			</button>
			<button type="submit" class="btn btn-primary" disabled={!ready}>
				{#if progress !== null}<span class="loading loading-spinner loading-sm"></span>{/if}
				{m.export.save}
			</button>
		</div>
	</form>
	<!-- Outside the form: the color field's buttons would submit it -->
	<div
		id="export-background"
		popover
		class="bg-base-100 text-base-content border-base-300 rounded-box m-0 w-72 border p-3 shadow"
		ontoggle={placeBelow}
	>
		<!-- JPEG has no transparency: there the field offers opaque colors only, and "None" is white -->
		{#key seeThrough(s.format)}
			<ColorField
				value={shownBackground}
				allowNone={seeThrough(s.format)}
				opaque={!seeThrough(s.format)}
				onchange={(value) => (s.background = value)}
			/>
		{/key}
	</div>
</Modal>
