<script lang="ts">
	// Files embedded in the PDF: download each one, or save it in the files.
	import { downloadBlob } from '@in-browser/brand/download.js';
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { chooseFile } from '@in-browser/files/dialog.svelte.js';
	import FileIcon from '@in-browser/files/FileIcon.svelte';
	import { write } from '@in-browser/files/fs.js';
	import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
	import { extname, parent } from '@in-browser/files/path.js';
	import { m } from '#lib/i18n/index.js';
	import type { Attachment } from '#lib/model/document.svelte.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';

	let { context }: PanelProps<EditorState> = $props();

	async function download(a: Attachment) {
		try {
			downloadBlob(await context.doc!.attachmentContent(a), a.name);
		} catch (e) {
			toast(m.home.failed(filesErrorText(e)), 'error', 8000);
		}
	}

	async function save(a: Attachment) {
		const doc = context.doc;
		if (!doc) return;
		const ext = extname(a.name);
		const path = await chooseFile({ mode: 'save', folder: parent(doc.path), accept: ext ? [ext] : [], name: a.name, title: m.panels.saveInFiles(a.name) });
		if (!path) return;
		try {
			await write(path, await doc.attachmentContent(a));
		} catch (e) {
			toast(m.home.failed(filesErrorText(e)), 'error', 8000);
		}
	}
</script>

<div class="p-2">
	{#if context.doc?.attachments.length}
		<ul class="flex flex-col gap-1">
			{#each context.doc.attachments as a (a.id)}
				<li class="flex items-center gap-2 rounded p-1.5">
					<FileIcon name={a.name} kind="file" />
					<span class="min-w-0 flex-1 truncate text-sm" title={a.description || a.name}>{a.name}</span>
					<button class="btn btn-ghost btn-sm btn-square" onclick={() => download(a)} title={m.panels.download(a.name)} aria-label={m.panels.download(a.name)}>
						<span class="icon-[material-symbols-light--download] size-5" aria-hidden="true"></span>
					</button>
					<button class="btn btn-ghost btn-sm btn-square" onclick={() => save(a)} title={m.panels.saveInFiles(a.name)} aria-label={m.panels.saveInFiles(a.name)}>
						<span class="icon-[material-symbols-light--save-outline] size-5" aria-hidden="true"></span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="p-2 text-sm opacity-70">{m.panels.noAttachments}</p>
	{/if}
</div>
