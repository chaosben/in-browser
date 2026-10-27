<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CommitLink from '@in-browser/brand/CommitLink.svelte';
	import { BRAND } from '#lib/brand.js';
	import NewProjectDialog from '#lib/components/NewProjectDialog.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import { importFile, isMediaFile, MEDIA_ACCEPT } from '#lib/media/media.js';
	import { createProject, defaultProjectName, newId, projectDuration, type Recording } from '#lib/project/project.js';
	import type { Size } from '#lib/project/canvas.js';
	import type { Project, Source } from '#lib/project/types.js';
	import { folderSupported, openFromFolder } from '#lib/storage/folder.js';
	import { deleteProject, listProjects, requestPersistence, storageEstimate } from '#lib/storage/opfs.js';
	import { ask } from '#lib/ui/confirm.svelte.js';
	import { toast } from '#lib/ui/toast.svelte.js';
	import { formatDateTime, m } from '#lib/i18n/index.js';
	import { errorMessage, formatTime, isAbort } from '#lib/util/format.js';

	const missing = [
		!('VideoEncoder' in window) && 'WebCodecs',
		!navigator.storage?.getDirectory && 'Origin Private File System',
		!navigator.mediaDevices?.getDisplayMedia && m.home.screenCapture
	].filter(Boolean);

	let projects = $state<Project[] | null>(null);
	let usage = $state<string | null>(null);
	let recordingFor = $state<string | null>(null);
	let creating = $state(false);
	let importing = $state<{ name: string; progress: number } | null>(null);
	let fileInput = $state<HTMLInputElement>();

	async function refresh() {
		projects = await listProjects();
		const { usage: used = 0, quota = 0 } = await storageEstimate();
		usage = m.home.storage((used / 1024 ** 3).toFixed(2), (quota / 1024 ** 3).toFixed(0));
	}

	$effect(() => {
		if (missing.length === 0) refresh().catch((e) => toast(errorMessage(e), 'error'));
	});

	function startRecording() {
		requestPersistence();
		recordingFor = newId();
	}

	async function recorded(recording: Recording) {
		const id = recordingFor!;
		recordingFor = null;
		await createProject(id, defaultProjectName(), recording);
		await goto(resolve('/editor/[id]', { id }));
	}

	function cancelRecording() {
		// Remove the directory of the project that was never created
		deleteProject(recordingFor!).catch(() => {});
		recordingFor = null;
	}

	async function createEmpty(name: string, size: Size) {
		creating = false;
		requestPersistence();
		const id = newId();
		try {
			await createProject(id, name, [], size);
			await goto(resolve('/editor/[id]', { id }));
		} catch (e) {
			toast(errorMessage(e), 'error', 8000);
		}
	}

	let draggingFiles = $state(false);

	async function importFiles(fileList: FileList | null | undefined) {
		const files = Array.from(fileList ?? []).filter(isMediaFile);
		if (!files.length || importing) return;
		requestPersistence();
		const id = newId();
		const sources: Source[] = [];
		try {
			for (const file of files) {
				importing = { name: file.name, progress: 0 };
				sources.push(await importFile(id, file, (p) => (importing!.progress = p)));
			}
			const name = files[0].name.replace(/\.\w+$/, '');
			await createProject(id, name, sources);
			await goto(resolve('/editor/[id]', { id }));
		} catch (e) {
			toast(errorMessage(e), 'error', 8000);
			if (sources.length === 0) await deleteProject(id).catch(() => {});
		} finally {
			importing = null;
			if (fileInput) fileInput.value = '';
		}
	}

	async function openFolder() {
		try {
			const id = await openFromFolder();
			await goto(resolve('/editor/[id]', { id }));
		} catch (e) {
			if (!isAbort(e)) toast(errorMessage(e), 'error', 8000);
		}
	}

	async function remove(project: Project) {
		const ok = await ask({
			title: m.home.deleteTitle,
			message: m.home.confirmDelete(project.name),
			confirm: m.common.delete,
			danger: true
		});
		if (!ok) return;
		await deleteProject(project.id);
		await refresh();
	}
</script>

<!-- The whole page is a drop zone for video files; the footer stays at the bottom -->
<div
	class="flex min-h-full flex-col"
	role="region"
	aria-label={m.home.projects}
	ondragover={(e) => {
		if (missing.length || !e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		draggingFiles = true;
	}}
	ondragleave={(e) => {
		if (e.currentTarget === e.target) draggingFiles = false;
	}}
	ondrop={(e) => {
		draggingFiles = false;
		if (!e.dataTransfer?.files.length) return;
		e.preventDefault();
		importFiles(e.dataTransfer.files);
	}}
>
<main class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
	<header class="flex flex-col gap-2">
		<h1 class="text-4xl font-bold">{BRAND.tool}</h1>
		<p class="opacity-70">{m.home.tagline}</p>
	</header>

	{#if missing.length > 0}
		<div role="alert" class="alert alert-error">
			<span>{m.home.unsupported(missing.join(', '))}</span>
		</div>
	{:else}
		<section class="flex flex-wrap gap-3">
			<button class="btn btn-primary btn-lg" onclick={startRecording}><span class="icon-[material-symbols-light--screen-record-outline] size-6" aria-hidden="true"></span> {m.home.newRecording}</button>
			<button class="btn btn-lg" onclick={() => fileInput?.click()} disabled={!!importing}><span class="icon-[material-symbols-light--upload-file] size-6" aria-hidden="true"></span> {m.home.importMedia}</button>
			<button class="btn btn-lg" onclick={() => (creating = true)}><span class="icon-[material-symbols-light--add-box-outline] size-6" aria-hidden="true"></span> {m.home.emptyProject}</button>
			{#if folderSupported()}
				<button class="btn btn-lg btn-ghost" onclick={openFolder}><span class="icon-[material-symbols-light--folder-open-outline] size-6" aria-hidden="true"></span> {m.home.openFolder}</button>
			{/if}
			<input
				bind:this={fileInput}
				type="file"
				accept={MEDIA_ACCEPT}
				multiple
				hidden
				onchange={(e) => importFiles(e.currentTarget.files)}
			/>
		</section>

		{#if importing}
			<div class="flex items-center gap-3">
				<span class="text-sm">{m.common.importing(importing.name)}</span>
				<progress class="progress progress-primary w-64" value={importing.progress} max="1"></progress>
			</div>
		{/if}

		<section class="flex flex-col gap-3">
			<div class="flex items-baseline justify-between">
				<h2 class="text-xl font-semibold">{m.home.projects}</h2>
				{#if usage}<span class="text-xs opacity-60">{usage}</span>{/if}
			</div>
			{#if projects === null}
				<span class="loading loading-dots"></span>
			{:else if projects.length === 0}
				<p class="opacity-60">{m.home.empty}</p>
			{:else}
				<ul class="list bg-base-200 rounded-box">
					{#each projects as project (project.id)}
						<li class="list-row items-center">
							<div class="list-col-grow">
								<a class="link link-hover font-semibold" href={resolve('/editor/[id]', { id: project.id })}>{project.name}</a>
								<div class="text-xs opacity-60">
									{formatTime(projectDuration(project), 0)} · {project.width}×{project.height} ·
									{m.home.changed(formatDateTime(project.updatedAt))}
								</div>
							</div>
							<a class="btn btn-sm" href={resolve('/editor/[id]', { id: project.id })}>{m.common.open}</a>
							<button class="btn btn-sm btn-ghost text-error" onclick={() => remove(project)} aria-label={m.common.delete}><span class="icon-[material-symbols-light--delete-outline] size-5" aria-hidden="true"></span></button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<p class="text-xs opacity-50">{m.home.footer}</p>
	{/if}
</main>

<footer
	class="border-base-300 mx-auto flex w-full max-w-5xl flex-wrap items-baseline gap-x-4 border-t px-4 py-6 text-sm opacity-70"
>
	<span>
		{m.brand.partOf}
		<a class="link link-hover font-semibold" href={BRAND.suiteUrl}>{BRAND.suite}</a> – {m.brand.suiteClaim}
	</span>
	<span class="ml-auto"><CommitLink /></span>
</footer>
</div>

{#if draggingFiles}
	<div
		class="border-primary bg-base-300/80 rounded-box pointer-events-none fixed inset-4 z-40 grid place-items-center border-4 border-dashed"
	>
		<div class="flex flex-col items-center gap-2 text-lg font-semibold">
			<span class="icon-[material-symbols-light--upload-file] size-12" aria-hidden="true"></span>
			{m.home.dropToCreate}
		</div>
	</div>
{/if}

{#if recordingFor}
	<RecordDialog projectId={recordingFor} ondone={recorded} oncancel={cancelRecording} />
{/if}

{#if creating}
	<NewProjectDialog oncreate={createEmpty} oncancel={() => (creating = false)} />
{/if}
