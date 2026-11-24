import type { ToolSlug } from '@in-browser/brand/i18n/index.svelte.js';
import { cacheDir } from './cache.js';
import { formatsOf } from './formats.js';

// What another app hands the installed suite (shared to it, or opened with it), kept until a page takes it:
// `cache/files/incoming/<id>/` holds the files as `0`, `1` … and `meta.json`. The Service Worker writes the same
// layout for the share target (`src/service-worker/index.ts`), so a POST becomes a page address `?received=<id>`.

export interface Incoming {
	files: File[];
	title?: string;
	text?: string;
	url?: string;
}

interface Meta {
	title?: string;
	text?: string;
	url?: string;
	files: { name: string; type: string }[];
	/** When it arrived (ms), so leftovers can be removed */
	at: number;
}

const DIR = 'incoming';
/** Leftovers nobody took (a closed tab, a canceled dialog) */
const KEEP_MS = 24 * 3600_000;

const isId = (id: string) => /^[\w-]{1,64}$/.test(id);

/** Keeps what arrived; its id for `?received=<id>` */
export async function storeIncoming(incoming: Incoming): Promise<string> {
	const id = crypto.randomUUID();
	const dir = await cacheDir('files', DIR, id);
	for (const [i, file] of incoming.files.entries()) {
		const out = await (await dir.getFileHandle(String(i), { create: true })).createWritable();
		await file.stream().pipeTo(out);
	}
	const meta: Meta = { title: incoming.title, text: incoming.text, url: incoming.url, files: incoming.files.map((f) => ({ name: f.name, type: f.type })), at: Date.now() };
	const out = await (await dir.getFileHandle('meta.json', { create: true })).createWritable();
	await out.write(JSON.stringify(meta));
	await out.close();
	return id;
}

/** What arrived under `id` (left in place until `dropIncoming`); `null` if it is gone */
export async function readIncoming(id: string): Promise<Incoming | null> {
	if (!isId(id)) return null;
	try {
		const dir = await (await cacheDir('files', DIR)).getDirectoryHandle(id);
		const meta = JSON.parse(await (await (await dir.getFileHandle('meta.json')).getFile()).text()) as Meta;
		const files = await Promise.all(
			meta.files.map(async ({ name, type }, i) => {
				const file = await (await dir.getFileHandle(String(i))).getFile();
				return new File([file], name, { type: type || file.type });
			})
		);
		const text = (s: unknown) => (typeof s === 'string' && s.trim() ? s : undefined);
		return { files, title: text(meta.title), text: text(meta.text), url: text(meta.url) };
	} catch {
		return null;
	}
}

export async function dropIncoming(id: string): Promise<void> {
	if (!isId(id)) return;
	await (await cacheDir('files', DIR)).removeEntry(id, { recursive: true }).catch(() => {});
}

/** Removes what nobody took within a day */
export async function pruneIncoming(): Promise<void> {
	const root = await cacheDir('files', DIR);
	for await (const [id, handle] of root.entries()) {
		if (handle.kind !== 'directory') continue;
		let at = 0;
		try {
			at = (JSON.parse(await (await (await (handle as FileSystemDirectoryHandle).getFileHandle('meta.json')).getFile()).text()) as Meta).at;
		} catch {
			// unreadable (written halfway): old enough
		}
		if (!(Date.now() - at < KEEP_MS)) await root.removeEntry(id, { recursive: true }).catch(() => {});
	}
}

/**
 * The tool that takes what arrived: shared text or a link is a new text in the Text Editor; one file of a tool's
 * format goes to that tool (its start page keeps it where the user says, `takeReceived`); everything else to Files.
 * A new tool with a file format in `FORMATS` gets its files without code of its own.
 */
export function incomingTool(incoming: Incoming): ToolSlug {
	if (incoming.files.length === 0) return 'text-editor';
	return (incoming.files.length === 1 && formatsOf(incoming.files[0].name, 'file')[0]?.tool) || 'files';
}

/** The address of the tool that takes `id` */
export const receivedUrl = (tool: ToolSlug, id: string) => `/${tool}?received=${encodeURIComponent(id)}`;
