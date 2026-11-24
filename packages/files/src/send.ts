import type { Command } from '@in-browser/brand/commands.js';
import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { showError } from './errors.js';
import { read } from './fs.js';
import { filesMessages } from './i18n/index.svelte.js';
import { basename, extname } from './path.js';

// “Send …”: hands files to another app of the device (mail, messenger …) through the operating system's share sheet
// (`navigator.share`; phones, Windows, macOS). Named apart from “Share …”, the guest shares (decided by the user,
// 2026-11-24). Browsers send only the types they allow (Chromium: pictures, video, audio, PDF, plain text …), so
// commands ask with the file's name and stay disabled for others.

const TYPES: Record<string, string> = {
	'.pdf': 'application/pdf',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.bmp': 'image/bmp',
	'.svg': 'image/svg+xml',
	'.mp4': 'video/mp4',
	'.m4v': 'video/mp4',
	'.webm': 'video/webm',
	'.mov': 'video/quicktime',
	'.mp3': 'audio/mpeg',
	'.m4a': 'audio/mp4',
	'.wav': 'audio/wav',
	'.ogg': 'audio/ogg',
	'.opus': 'audio/ogg',
	'.flac': 'audio/flac',
	'.txt': 'text/plain',
	'.md': 'text/markdown',
	'.csv': 'text/csv',
	'.html': 'text/html',
	'.htm': 'text/html',
	'.css': 'text/css',
	'.json': 'application/json',
	'.xml': 'application/xml',
	'.zip': 'application/zip'
};

/** The MIME type the share sheet gets for a file name (`application/octet-stream` when unknown) */
export const sendType = (name: string) => TYPES[extname(name)] ?? 'application/octet-stream';

/** Whether this browser can send files of these names at all */
export function canSend(names: string[]): boolean {
	if (names.length === 0 || typeof navigator === 'undefined' || !navigator.canShare) return false;
	try {
		return navigator.canShare({ files: names.map((name) => new File([], name, { type: sendType(name) })) });
	} catch {
		return false;
	}
}

/** Opens the share sheet with these files; canceling it is no error */
export async function sendFiles(files: Blob[], names: string[]): Promise<void> {
	try {
		await navigator.share({ files: files.map((f, i) => new File([f], names[i], { type: sendType(names[i]) })) });
	} catch (e) {
		if (e instanceof DOMException && e.name === 'AbortError') return;
		showError(e, { text: filesMessages().send.failed, context: '[files] send' });
	}
}

/**
 * Sends what took a while to make (an export): the share sheet needs a recent click, so once that has run out a
 * toast offers “Send” to click
 */
export async function sendWhenReady(files: Blob[], names: string[]): Promise<void> {
	if (navigator.userActivation?.isActive ?? true) return sendFiles(files, names);
	const t = filesMessages().send;
	toast(t.ready(names.length), 'success', 60_000, { label: t.now, run: () => sendFiles(files, names) });
}

/** Sends files of the file system (Files' selection) */
export async function sendPaths(paths: string[]): Promise<void> {
	let files: File[];
	try {
		files = await Promise.all(paths.map((p) => read(p)));
	} catch (e) {
		return showError(e, { context: '[files] send' });
	}
	await sendFiles(files, paths.map(basename));
}

/**
 * The command “Send …” of a document tool (tab “File”, after “Share …”): sends the open document (`path()`), or
 * what `file()` gives under `name()` (a text not saved yet)
 */
export function sendCommand(path: () => string | null | undefined, own?: { name: () => string | null | undefined; file: () => Promise<Blob> }): Command {
	const name = () => (own ? own.name() : path() ? basename(path()!) : null);
	return {
		id: 'send',
		label: filesMessages().send.action,
		tip: filesMessages().send.tip,
		icon: 'icon-[material-symbols-light--send-outline]',
		enabled: () => {
			const n = name();
			return !!n && canSend([n]);
		},
		run: async () => {
			const n = name();
			const p = path();
			if (!n) return;
			// The share sheet needs the click's activation, which lasts a few seconds – reading from the storage is quicker
			const file = own ? await own.file() : p ? await read(p) : null;
			if (file) await sendFiles([file], [n]);
		}
	};
}
