// Merging instead of replacing (decided by the user, 2026-11-25): a format may bring a merger – then a file of it that
// would replace an existing one of the same format can be merged into it instead. The frame is the same for every
// such format: the save dialog offers “Merge” next to “Replace”, Files' menu and the tool's tab “File” have
// “Merge with …”, the result replaces the file only when it is complete, a toast names what changed with “Undo”.
// The format's merger decides what merging means; the frame keeps what it wants for later merges (its “bases”).
// Not part of the syncs: they stay blind to contents (conflict copies, `files.md`).

import type { Command } from '@in-browser/brand/commands.js';
import { loadJson, storeJson } from '@in-browser/brand/storage.js';
import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { chooseFile } from './dialog.svelte.js';
import { showError } from './errors.js';
import { list, mkdir, read, remove, stat, write } from './fs.js';
import { filesMessages } from './i18n/index.svelte.js';
import { basename, extname, join, parent } from './path.js';

/** What a merge gives: the merged file, and what the frame keeps or asks */
export interface MergeOutcome {
	result: Blob;
	/** Entries new, changed and gone in the result compared with the existing file */
	counts: { added: number; changed: number; removed: number };
	/** So much would be lost that the user is asked first (entries removed of all) */
	loss: { removed: number; of: number } | null;
	/** Nothing to do: the existing file has everything already */
	unchanged: boolean;
	/** Kept for later merges under its id (the format names it in the result) */
	keep: { id: string; text: string } | null;
}

export interface Merger {
	/** Merges `incoming` into `mine`; `bases` gives what earlier merges kept */
	merge(mine: Blob, incoming: Blob, bases: { get(id: string): Promise<string | null> }): Promise<MergeOutcome>;
}

/** The formats that merge (extension → its merger, loaded on first use) */
const MERGERS: Record<string, () => Promise<Merger>> = {
	'.jwlibrary': async () => (await import('@in-browser/jwl/merger.js')).merger
};

export const canMerge = (name: string) => extname(name) in MERGERS;

/** Kept results of earlier merges, synced like all tool data; the newest `KEEP` per format */
const BASES = '/.apps/files/merge';
const KEEP = 10;
const basesOf = (ext: string) => join(BASES, ext.slice(1));

async function gzip(text: string): Promise<Blob> {
	return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
}

async function gunzip(blob: Blob): Promise<string> {
	return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

function baseStore(ext: string) {
	return {
		get: async (id: string) => {
			try {
				return await gunzip(await read(join(basesOf(ext), `${safeId(id)}.json.gz`)));
			} catch {
				return null;
			}
		}
	};
}

const safeId = (id: string) => id.replace(/[^\w-]/g, '_');

async function keepBase(ext: string, keep: { id: string; text: string }) {
	const folder = basesOf(ext);
	await mkdir(folder);
	await write(join(folder, `${safeId(keep.id)}.json.gz`), await gzip(keep.text));
	const kept = (await list(folder)).filter((e) => e.kind === 'file').sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0));
	for (const old of kept.slice(KEEP)) await remove(old.path).catch(() => {});
}

/** The file merged into last (per format), suggested when a file of it arrives */
const TARGETS = 'files:merge-targets';
export const lastMergeTarget = (ext: string): string | null => loadJson<Record<string, string>>(TARGETS, {})[ext] ?? null;
const rememberTarget = (path: string) => storeJson(TARGETS, { ...loadJson<Record<string, string>>(TARGETS, {}), [extname(path)]: path });

/**
 * Merges `incoming` into the file at `path` (asked first when much would be lost) and says what changed, with
 * “Undo”. `merged` when the file changed, `unchanged` when it had everything, null when not merged.
 */
export async function mergeInto(path: string, incoming: Blob, tries = 0): Promise<'merged' | 'unchanged' | null> {
	const t = filesMessages().merge;
	const name = basename(path);
	const loader = MERGERS[extname(path)];
	if (!loader) throw new Error(`no merger for ${name}`);
	const before = await stat(path);
	// A copy of its own: the file read from the storage can't be read anymore once it is replaced
	const previous = new Blob([await (await read(path)).arrayBuffer()]);
	const outcome = await (await loader()).merge(previous, incoming, baseStore(extname(path)));
	rememberTarget(path);
	if (outcome.unchanged) {
		toast(t.unchanged(name), 'info', 6000);
		return 'unchanged';
	}
	if (outcome.loss && !(await ask({ title: t.lossTitle, message: t.loss(name, outcome.loss.removed, outcome.loss.of), confirm: t.anyway, danger: true }))) {
		toast(t.notMerged, 'info');
		return null;
	}
	// Changed meanwhile (another tab, the sync): merged again from the start rather than losing that change
	const now = await stat(path);
	if (now?.modified !== before?.modified || now?.size !== before?.size) {
		if (tries < 2) return mergeInto(path, incoming, tries + 1);
		throw new Error(`${name} keeps changing`);
	}
	await write(path, outcome.result);
	if (outcome.keep) await keepBase(extname(path), outcome.keep).catch((e) => console.error('[files] merge base', e));
	toast(t.done(name, outcome.counts), 'success', 10000, {
		label: t.undo,
		run: async () => {
			try {
				await write(path, previous);
				toast(t.undone(name), 'info');
			} catch (e) {
				showError(e, { context: '[files] undo merge' });
			}
		}
	});
	return 'merged';
}

/**
 * “Merge with …” for the open document of a tool (tab “File”) – and Files' menu: picks another file of the same
 * format and merges it into this one. `before` saves what is unsaved, `after` reads the file again.
 */
export function mergeCommand(path: () => string | null | undefined, { before, after }: { before?: () => Promise<void>; after?: () => void } = {}): Command {
	const t = filesMessages().merge;
	return {
		id: 'merge',
		label: t.action,
		tip: t.tip,
		icon: 'icon-[material-symbols-light--merge]',
		enabled: () => {
			const p = path();
			return !!p && canMerge(p);
		},
		run: () => void mergeWith(path(), { before, after })
	};
}

export async function mergeWith(target: string | null | undefined, { before, after }: { before?: () => Promise<void>; after?: () => void } = {}) {
	if (!target || !canMerge(target)) return;
	const t = filesMessages().merge;
	const other = await chooseFile({ mode: 'open', folder: parent(target), accept: [extname(target)], title: t.chooseTitle(basename(target)) });
	if (!other) return;
	if (other === target) return toast(t.same, 'info');
	try {
		await before?.();
		if ((await mergeInto(target, await read(other))) === 'merged') after?.();
	} catch (e) {
		showError(e, { text: t.failed(basename(target)), context: '[files] merge' });
	}
}
