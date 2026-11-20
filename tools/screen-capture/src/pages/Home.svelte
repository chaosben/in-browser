<script lang="ts">
	import { deleteToTrash } from '@in-browser/files/trash-browser.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AccessNotice from '@in-browser/files/AccessNotice.svelte';
	import { filesMessages, formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { displayPath } from '@in-browser/files/sources/registry.js';
	import { parent, stem } from '@in-browser/files/path.js';
	import { supported, watchSettled } from '@in-browser/files/fs.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { editorUrl } from '#lib/brand.js';
	import { BRAND } from '@in-browser/brand/brand.js';
	import { toolName } from '@in-browser/brand/i18n/index.svelte.js';
	import NewProjectDialog from '#lib/components/NewProjectDialog.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import { IMAGE_ACCEPT, importImage, isImageFile } from '#lib/media/images.js';
	import { importFile, isMediaFile, MEDIA_ACCEPT } from '#lib/media/media.js';
	import { createProject, defaultProjectName, projectDuration, type Recording } from '#lib/project/project.js';
	import type { Size } from '#lib/project/canvas.js';
	import type { ImageAsset, Project, Source } from '#lib/project/types.js';
	import {
		deleteProject,
		listProjects,
		chooseMediaFromFiles,
		chooseNewProject,
		chooseProject,
		lastFolder,
		PROJECT_EXT,
		projectName,
		requestPersistence,
		storageEstimate
	} from '#lib/storage/store.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { formatDateTime, intlLocale, m } from '#lib/i18n/index.js';
	import { errorMessage, formatTime } from '#lib/util/format.js';
	import DropOverlay from '@in-browser/brand/DropOverlay.svelte';

	const missing = [
		!('VideoEncoder' in window) && 'WebCodecs',
		!supported() && 'Origin Private File System',
		!navigator.mediaDevices?.getDisplayMedia && m.home.screenCapture
	].filter(Boolean);
	/** Phones and tablets: no screen capture in any mobile browser, the tool is for computers */
	const desktopOnly = !navigator.mediaDevices?.getDisplayMedia && coarsePointer.current;

	let projects = $state<Project[] | null>(null);
	let usage = $state<string | null>(null);
	/** Package the running recording goes into, with the name of the project */
	let recordingFor = $state<{ path: string; name: string } | null>(null);
	let creating = $state(false);
	let importing = $state<{ name: string; progress: number } | null>(null);
	let fileInput = $state<HTMLInputElement>();

	/** An error as a toast and in the console */
	function failed(what: string, e: unknown) {
		console.error(`[screen-capture] ${what}`, e);
		toast(errorMessage(e), 'error', 8000);
	}

	async function refresh() {
		projects = await listProjects();
		const { usage: used = 0, quota = 0 } = await storageEstimate();
		usage = m.home.storage(formatSize(used, intlLocale), formatSize(quota, intlLocale));
	}

	$effect(() => {
		if (missing.length) return;
		const update = () => refresh().catch((e) => failed('list projects', e));
		update();
		// Projects appear, change or go (also by sync): list again
		return watchSettled((paths) => paths.some((p) => p.includes(PROJECT_EXT)), 300, update);
	});

	async function startRecording() {
		requestPersistence();
		try {
			const path = await chooseNewProject(defaultProjectName());
			// The name typed in the save dialog wins over the suggestion
			if (path) recordingFor = { path, name: projectName(path) };
		} catch (e) {
			failed('new recording', e);
		}
	}

	async function recorded(recording: Recording) {
		const { path, name } = recordingFor!;
		recordingFor = null;
		try {
			await createProject(path, name, recording);
			await goto(editorUrl(path));
		} catch (e) {
			failed('create project', e);
		}
	}

	function cancelRecording() {
		// Remove the package of the project that was never created
		deleteProject(recordingFor!.path).catch((e) => console.warn('[screen-capture] remove unused project', e));
		recordingFor = null;
	}

	async function createEmpty(name: string, size: Size) {
		creating = false;
		requestPersistence();
		try {
			const path = await chooseNewProject(name);
			if (!path) return;
			await createProject(path, projectName(path), [], size);
			await goto(editorUrl(path));
		} catch (e) {
			failed('empty project', e);
		}
	}

	let draggingFiles = $state(false);

	async function importFiles(list: FileList | File[] | null | undefined) {
		// Video and audio become clips, images follow them (e.g. a slideshow)
		const files = Array.from(list ?? []).filter((f) => isMediaFile(f) || isImageFile(f));
		if (!files.length || importing) return;
		requestPersistence();
		const name = stem(files[0].name);
		let path: string | null = null;
		const sources: Source[] = [];
		const images: ImageAsset[] = [];
		try {
			path = await chooseNewProject(name);
			if (!path) return;
			for (const file of files) {
				importing = { name: file.name, progress: 0 };
				if (isImageFile(file)) images.push(await importImage(path, file));
				else sources.push(await importFile(path, file, (p) => (importing!.progress = p)));
			}
			await createProject(path, projectName(path), sources, undefined, images);
			await goto(editorUrl(path));
		} catch (e) {
			failed('import', e);
			if (path && sources.length + images.length === 0) await deleteProject(path).catch((err) => console.warn('[screen-capture] remove unused project', err));
		} finally {
			importing = null;
			if (fileInput) fileInput.value = '';
		}
	}

	/** New project from media in the shared file system (copied into it, like an import from the computer) */
	async function importFromFiles() {
		try {
			await importFiles(await chooseMediaFromFiles(lastFolder()));
		} catch (e) {
			failed('import from Files', e);
		}
	}

	/** Any project in the shared file system */
	async function openProject() {
		try {
			const path = await chooseProject();
			if (path) await goto(editorUrl(path));
		} catch (e) {
			failed('open project', e);
		}
	}

	/** Into the trash (the message offers to undo it) */
	async function remove(project: Project) {
		try {
			await deleteToTrash([project.id], () => void refresh().catch((err) => failed('list projects', err)));
		} catch (e) {
			failed('delete project', e);
		}
	}
</script>

<svelte:head><title>{toolName('screen-capture')} · {BRAND.suite}</title></svelte:head>

<!-- The whole page is a drop zone for video files -->
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
		<h1 class="text-4xl font-bold">{toolName('screen-capture')}</h1>
		<p class="opacity-70">{m.home.tagline}</p>
	</header>

	{#if desktopOnly}
		<div role="alert" class="alert alert-info alert-vertical sm:alert-horizontal">
			<span class="icon-[material-symbols-light--computer-outline] size-6 shrink-0" aria-hidden="true"></span>
			<span class="flex-1">{m.home.desktopOnly}</span>
			<a class="btn btn-sm" href={resolve('/')} data-sveltekit-reload>{m.home.allTools}</a>
		</div>
	{:else if missing.length > 0}
		<div role="alert" class="alert alert-error">
			<span>{m.home.unsupported(missing.join(', '))}</span>
		</div>
	{:else}
		<section class="flex flex-wrap gap-3">
			<button class="btn btn-primary btn-lg" onclick={startRecording}><span class="icon-[material-symbols-light--screen-record-outline] size-6" aria-hidden="true"></span> {m.home.newRecording}</button>
			<button class="btn btn-lg" onclick={() => fileInput?.click()} disabled={!!importing}><span class="icon-[material-symbols-light--upload-file] size-6" aria-hidden="true"></span> {m.home.importMedia}</button>
			<button class="btn btn-lg" onclick={importFromFiles} disabled={!!importing}><span class="icon-[material-symbols-light--folder-open-outline] size-6" aria-hidden="true"></span> {m.home.importFromFiles}</button>
			<button class="btn btn-lg" onclick={() => (creating = true)}><span class="icon-[material-symbols-light--add-box-outline] size-6" aria-hidden="true"></span> {m.home.emptyProject}</button>
			<button class="btn btn-lg btn-ghost" onclick={openProject}><span class="icon-[material-symbols-light--folder-open-outline] size-6" aria-hidden="true"></span> {m.home.openProject}</button>
			<input
				bind:this={fileInput}
				type="file"
				accept={`${MEDIA_ACCEPT},${IMAGE_ACCEPT}`}
				multiple
				hidden
				onchange={(e) => importFiles(e.currentTarget.files)}
			/>
		</section>

		<!-- A fixed place for the progress of an import, so nothing below moves when it starts or ends -->
		<div class="flex h-6 items-center gap-3" role="status">
			{#if importing}
				<span class="truncate text-sm">{m.common.importing(importing.name)}</span>
				<progress class="progress progress-primary w-64 shrink-0" value={importing.progress} max="1"></progress>
			{/if}
		</div>

		<section class="flex flex-col gap-3">
			<div class="flex items-baseline justify-between">
				<h2 class="text-xl font-semibold">{m.home.projects}</h2>
				{#if usage}<span class="text-xs opacity-60">{usage}</span>{/if}
			</div>
			<AccessNotice tool="screen-capture" onallowed={() => refresh().catch((e) => failed('list projects', e))} />
			{#if projects === null}
				<span class="loading loading-dots"></span>
			{:else if projects.length === 0}
				<p class="opacity-60">{m.home.empty}</p>
			{:else}
				<ul class="list bg-base-200 rounded-box">
					{#each projects as project (project.id)}
						<li class="list-row items-center">
							<div class="list-col-grow">
								<a class="link link-hover font-semibold" href={editorUrl(project.id)}>{project.name}</a>
								<div class="text-xs opacity-60">
									{formatTime(projectDuration(project), 0)} · {project.width}×{project.height} ·
									{m.home.changed(formatDateTime(project.updatedAt))}
									·
									<a
										class="link link-hover"
										href="{resolve('/files')}?path={encodeURIComponent(parent(project.id))}"
										data-sveltekit-reload>{m.home.inFolder(displayPath(parent(project.id), filesMessages().root))}</a
									>
								</div>
							</div>
							<a class="btn btn-sm" href={editorUrl(project.id)}>{m.common.open}</a>
							<button class="btn btn-sm btn-ghost btn-square" onclick={() => remove(project)} title={m.common.delete} aria-label={m.common.delete}><span class="icon-[material-symbols-light--delete-outline] size-5" aria-hidden="true"></span></button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<p class="text-xs opacity-50">{m.home.footer}</p>
	{/if}
</main>

</div>

{#if draggingFiles}
	<DropOverlay label={m.home.dropToCreate} fixed />
{/if}

{#if recordingFor}
	<RecordDialog projectId={recordingFor.path} ondone={recorded} oncancel={cancelRecording} />
{/if}

{#if creating}
	<NewProjectDialog oncreate={createEmpty} oncancel={() => (creating = false)} />
{/if}
