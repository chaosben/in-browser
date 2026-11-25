import type { ToolSlug } from '@in-browser/brand/i18n/index.svelte.js';
import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { chooseFile, chooseSaveTarget } from './dialog.svelte.js';
import { showError } from './errors.js';
import { filesUrl, formatsOf, openUrl } from './formats.js';
import { list, write } from './fs.js';
import { filesMessages } from './i18n/index.svelte.js';
import { dropIncoming, incomingTool, readIncoming, receivedUrl, storeIncoming, type Incoming } from './incoming.js';
import { canMerge, lastMergeTarget, mergeInto } from './merge.js';
import { basename, extname, join, parent, uniqueName } from './path.js';
import { recentDocuments } from './sources/recent.js';

// Files from other apps (shared to the installed suite, opened with it, or picked from the computer) are kept in
// the suite – always a copy, where the user says (decided by the user, 2026-11-24) – and then opened in their tool.
// `ToolLayout` hands a page's `?received=<id>` to `takeReceived`; a tool that takes it another way (the Text
// Editor: a draft without a place) registers a `receiver`.

/**
 * Keeps one file from outside: asks where (starting in the folder last used by its tool), writes it and returns
 * its path; `null` when canceled. A file of a format that merges (`merge.ts`) may be merged into one there instead –
 * the dialog suggests the file merged into last. `folder` is where the dialog starts otherwise (an upload: the
 * folder uploaded into).
 */
export async function keepFile(file: File, { title, folder }: { title?: string; folder?: string } = {}): Promise<string | null> {
	const format = formatsOf(file.name, 'file')[0];
	const recent = recentDocuments(format?.tool ?? 'files');
	const mergeable = canMerge(file.name);
	const target = mergeable ? lastMergeTarget(extname(file.name)) : null;
	const choice = await chooseSaveTarget({
		mode: 'save',
		folder: target ? parent(target) : (folder ?? recent.lastFolder()),
		accept: format ? [format.ext] : [],
		name: target ? basename(target) : file.name,
		title: title ?? filesMessages().receive.saveTitle,
		overwrite: mergeable,
		merge: mergeable
	});
	if (!choice) return null;
	if (choice.merge) {
		if (!(await mergeInto(choice.path, file))) return null;
	} else await write(choice.path, file);
	recent.usedFolderOf(choice.path);
	return choice.path;
}

/** Keeps several files in a folder the user picks (numbered on clashes); the folder, `null` when canceled */
export async function keepFiles(files: File[]): Promise<string | null> {
	const recent = recentDocuments('files');
	const folder = await chooseFile({ mode: 'folder', folder: recent.lastFolder(), accept: [], title: filesMessages().receive.folderTitle(files.length) });
	if (!folder) return null;
	const taken = (await list(folder)).map((e) => e.name);
	for (const file of files) {
		const name = uniqueName(file.name, taken);
		taken.push(name);
		await write(join(folder, name), file);
	}
	recent.usedFolderOf(join(folder, files[0].name));
	return folder;
}

type Receiver = (incoming: Incoming) => Promise<void>;
let receiver: Receiver | null = null;

/** A page that takes what arrived in its own way (registered while it is shown); returns the cleanup */
export function setReceiver(take: Receiver): () => void {
	receiver = take;
	return () => {
		if (receiver === take) receiver = null;
	};
}

/**
 * Takes what the address names (`?received=<id>`) on the start page of `tool`: hands it to the tool that should
 * have it, to the page's `receiver`, or keeps it and opens it in its tool.
 */
export async function takeReceived(tool: ToolSlug): Promise<void> {
	const address = new URL(location.href);
	const id = address.searchParams.get('received');
	if (!id) return;
	address.searchParams.delete('received');
	history.replaceState(history.state, '', address);
	const incoming = await readIncoming(id);
	if (!incoming) return;
	const target = incomingTool(incoming);
	if (target !== tool) return location.replace(receivedUrl(target, id));
	// The files read from where they are kept: removed only once taken (or not)
	try {
		if (receiver) return await receiver(incoming);
		if (incoming.files.length === 1) {
			const file = incoming.files[0];
			const path = await keepFile(file);
			if (!path) return toast(filesMessages().receive.notSaved, 'info');
			const format = formatsOf(file.name, 'file')[0];
			location.assign(format ? openUrl(format, path) : filesUrl(path));
		} else if (incoming.files.length > 1) {
			const folder = await keepFiles(incoming.files);
			if (!folder) return toast(filesMessages().receive.notSaved, 'info');
			location.assign(`/files?path=${encodeURIComponent(folder)}`);
		}
	} catch (e) {
		showError(e, { context: '[files] receive' });
	} finally {
		await dropIncoming(id);
	}
}

/**
 * “Open with” of the operating system (File Handling, Chromium on the computer): every page of the suite takes
 * files opened with it – an open window gets them too (`launch_handler`) – and hands them on like shared ones.
 */
export function installLaunchHandler() {
	const queue = (window as { launchQueue?: { setConsumer(consumer: (params: { files?: readonly FileSystemHandle[] }) => void): void } }).launchQueue;
	queue?.setConsumer(async (params) => {
		const handles = (params.files ?? []).filter((h): h is FileSystemFileHandle => h.kind === 'file');
		if (handles.length === 0) return;
		try {
			const incoming: Incoming = { files: await Promise.all(handles.map((h) => h.getFile())) };
			location.assign(receivedUrl(incomingTool(incoming), await storeIncoming(incoming)));
		} catch (e) {
			showError(e, { context: '[files] open with' });
		}
	});
}
