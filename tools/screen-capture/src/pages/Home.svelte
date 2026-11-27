<script lang="ts">
	import { navigate } from '@in-browser/brand/navigate.js';
	import { showError } from '@in-browser/files/errors.js';
	import { filesUrl } from '@in-browser/files/formats.js';
	import { deleteToTrash } from '@in-browser/files/trash-browser.js';
	import { goto } from '$app/navigation';
	import StartPage, { type StartEntry } from '@in-browser/files/StartPage.svelte';
	import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { shortcutLabel } from '@in-browser/brand/commands.js';
	import { brandMessages } from '@in-browser/brand/i18n/index.svelte.js';
	import { filesMessages } from '@in-browser/files/i18n/index.svelte.js';
	import { stem } from '@in-browser/files/path.js';
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
		requestPersistence
	} from '#lib/storage/store.js';
	import { formatDateTime, m } from '#lib/i18n/index.js';
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
	/** Package the running recording goes into, with the name of the project */
	let recordingFor = $state<{ path: string; name: string } | null>(null);
	let creating = $state(false);
	let importing = $state<{ name: string; progress: number } | null>(null);
	let fileInput = $state<HTMLInputElement>();

	/** An error as a toast and in the console */
	function failed(what: string, e: unknown) {
		showError(e, { context: `[screen-capture] ${what}`, text: errorMessage(e) });
	}

	async function refresh() {
		projects = await listProjects();
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

	// --- The card's menu (right click, long press, ⋯); Del on a focused card. Renaming is Files' job. ---

	/** Into the trash (the message offers to undo it) */
	async function remove(path: string) {
		try {
			await deleteToTrash([path], () => void refresh().catch((err) => failed('list projects', err)));
		} catch (e) {
			failed('delete project', e);
		}
	}

	/** The complete menu of a project */
	function menu(entry: StartEntry): MenuEntry[] {
		return [
			{ label: filesMessages().start.open, icon: 'icon-[material-symbols-light--folder-open-outline]', href: editorUrl(entry.path), run: () => void goto(editorUrl(entry.path)) },
			{ label: m.editor.showInFiles, icon: 'icon-[material-symbols-light--open-in-new]', href: filesUrl(entry.path), run: () => navigate(filesUrl(entry.path)) },
			{ separator: true },
			{
				label: m.common.delete,
				icon: 'icon-[material-symbols-light--delete-outline]',
				keys: shortcutLabel({ key: 'Delete' }, brandMessages().keys),
				run: () => void remove(entry.path)
			}
		];
	}

	const entries = $derived<StartEntry[] | null>(
		projects?.map((p: Project) => ({
			path: p.id,
			name: p.name,
			modified: p.updatedAt,
			kind: 'directory',
			// Only the length: with the canvas size the date no longer fits a card
			detail: formatTime(projectDuration(p), 0)
		})) ?? null
	);
</script>

<svelte:head><title>{toolName('screen-capture')} · {BRAND.suite}</title></svelte:head>

<!-- The whole page is a drop zone for video files -->
<div
	class="flex min-h-0 flex-1 flex-col"
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
	<StartPage
		tagline={m.home.tagline}
		available={!desktopOnly && missing.length === 0}
		unsupported={desktopOnly ? m.home.desktopOnly : m.home.unsupported(missing.join(', '))}
		heading={m.home.projects}
		{entries}
		href={(entry) => editorUrl(entry.path)}
		{menu}
		empty={m.home.empty}
		tool="screen-capture"
		onallowed={() => refresh().catch((e) => failed('list projects', e))}
		formatDate={formatDateTime}
		ondelete={(entry) => void remove(entry.path)}
	>
		{#snippet actions()}
			<button class="btn btn-primary" onclick={startRecording}>
				<span class="icon-[material-symbols-light--screen-record-outline] size-6" aria-hidden="true"></span>{m.home.newRecording}
			</button>
			<button class="btn" onclick={() => fileInput?.click()} disabled={!!importing}>
				<span class="icon-[material-symbols-light--upload-file] size-6" aria-hidden="true"></span>{m.home.importMedia}
			</button>
			<button class="btn" onclick={importFromFiles} disabled={!!importing}>
				<span class="icon-[material-symbols-light--folder-open-outline] size-6" aria-hidden="true"></span>{m.home.importFromFiles}
			</button>
			<button class="btn" onclick={() => (creating = true)}>
				<span class="icon-[material-symbols-light--add-box-outline] size-6" aria-hidden="true"></span>{m.home.emptyProject}
			</button>
			<button class="btn" onclick={openProject}>
				<span class="icon-[material-symbols-light--folder-open-outline] size-6" aria-hidden="true"></span>{m.home.openProject}
			</button>
			<input bind:this={fileInput} type="file" accept={`${MEDIA_ACCEPT},${IMAGE_ACCEPT}`} multiple hidden onchange={(e) => importFiles(e.currentTarget.files)} />
		{/snippet}
		{#snippet extra()}
			<!-- A fixed place for the progress of an import, so nothing below moves when it starts or ends -->
			<div class="flex h-6 items-center gap-3" role="status">
				{#if importing}
					<span class="truncate text-sm">{m.common.importing(importing.name)}</span>
					<progress class="progress progress-primary w-64 shrink-0" value={importing.progress} max="1"></progress>
				{/if}
			</div>
		{/snippet}
	</StartPage>
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
