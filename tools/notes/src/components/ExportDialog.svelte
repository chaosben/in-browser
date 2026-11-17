<script lang="ts">
	// Export of the open notebook: all pages as PDF or the current page as PNG, then download or keep in Files
	// (next to the notebook by default).
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { chooseFile } from '@in-browser/files/dialog.svelte.js';
	import { write } from '@in-browser/files/fs.js';
	import { filesErrorText, formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { parent, safeName } from '@in-browser/files/path.js';
	import { exportPdf } from '#lib/export/pdf.js';
	import { exportPng } from '#lib/export/png.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import type { NotebookDoc } from '#lib/model/notebook.svelte.js';
	import { notebookName } from '#lib/model/store.js';

	interface Props {
		doc: NotebookDoc;
		/** Current page (index) for the PNG export */
		page: number;
		onclose: () => void;
	}

	let { doc, page, onclose }: Props = $props();

	let format = $state<'pdf' | 'png'>('pdf');
	let phase = $state<'settings' | 'running' | 'done'>('settings');
	let progress = $state(0);
	let error = $state<string | null>(null);
	let result = $state<{ blob: Blob; name: string; url: string } | null>(null);

	function show(dialog: HTMLDialogElement) {
		dialog.showModal();
		return () => {
			if (result) URL.revokeObjectURL(result.url);
		};
	}

	async function run() {
		phase = 'running';
		progress = 0;
		error = null;
		try {
			await doc.loadAll();
			const name = notebookName(doc.path);
			const meta = doc.pages[page] ?? doc.pages[0];
			const blob = format === 'pdf' ? await exportPdf(doc, (p) => (progress = p)) : await exportPng(doc, meta);
			const file = format === 'pdf' ? `${safeName(name, 'Notes')}.pdf` : `${safeName(m.export.pageFile(name, page + 1), 'Notes')}.png`;
			if (result) URL.revokeObjectURL(result.url);
			result = { blob, name: file, url: URL.createObjectURL(blob) };
			phase = 'done';
		} catch (e) {
			console.error('[notes] export', e);
			error = m.export.failed(e instanceof Error ? e.message : String(e));
			phase = 'settings';
		}
	}

	function download() {
		if (!result) return;
		const a = document.createElement('a');
		a.href = result.url;
		a.download = result.name;
		a.click();
	}

	async function saveToFiles() {
		if (!result) return;
		const ext = result.name.slice(result.name.lastIndexOf('.'));
		const path = await chooseFile({ mode: 'save', folder: parent(doc.path), accept: [ext], name: result.name, overwrite: true });
		if (!path) return;
		try {
			await write(path, result.blob);
			toast(m.export.savedToFiles(path), 'success');
		} catch (e) {
			toast(filesErrorText(e), 'error', 8000);
		}
	}
</script>

<dialog
	{@attach show}
	class="modal"
	aria-labelledby="export-title"
	oncancel={(e) => {
		e.preventDefault();
		if (phase !== 'running') onclose();
	}}
>
	<div class="modal-box max-w-lg">
		<h3 id="export-title" class="text-lg font-bold">{m.export.title}</h3>

		{#if phase === 'done' && result}
			<p class="mt-3">{m.export.done(result.name, formatSize(result.blob.size, intlLocale))}</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={onclose}>{m.export.close}</button>
				<button class="btn" onclick={saveToFiles}>
					<span class="icon-[material-symbols-light--folder-open-outline] size-5" aria-hidden="true"></span>{m.export.saveToFiles}
				</button>
				<button class="btn btn-primary" onclick={download}>
					<span class="icon-[material-symbols-light--download] size-5" aria-hidden="true"></span>{m.export.download}
				</button>
			</div>
		{:else}
			<div class="mt-3 flex flex-col gap-2" role="radiogroup" aria-label={m.export.format}>
				{#each ['pdf', 'png'] as const as f (f)}
					<label class="border-base-300 rounded-box flex cursor-pointer items-start gap-3 border p-3 {format === f ? 'border-primary' : ''}">
						<input type="radio" class="radio radio-sm mt-0.5" name="export-format" value={f} bind:group={format} disabled={phase === 'running'} />
						<span class="flex flex-col">
							<span class="font-medium">{m.export[f]}</span>
							<span class="text-xs opacity-70">{f === 'pdf' ? m.export.pdfHint : m.export.pngHint(page + 1)}</span>
						</span>
					</label>
				{/each}
			</div>
			{#if phase === 'running'}
				<progress class="progress mt-4 w-full" value={format === 'pdf' ? progress : undefined} max="1" aria-label={m.export.running}></progress>
			{/if}
			{#if error}<div role="alert" class="alert alert-error mt-3">{error}</div>{/if}
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={onclose} disabled={phase === 'running'}>{m.export.close}</button>
				<button class="btn btn-primary" onclick={run} disabled={phase === 'running'}>
					{#if phase === 'running'}
						<span class="loading loading-spinner loading-sm"></span>{m.export.running}
					{:else}
						<span class="icon-[material-symbols-light--ios-share] size-5" aria-hidden="true"></span>{m.export.export}
					{/if}
				</button>
			</div>
		{/if}
	</div>
</dialog>
