// The ZIP around a JW Library database, for the workers: written as JW Library writes it (every entry DEFLATE) and
// handed out piece by piece – the page acknowledges each piece, so a video never lies in memory whole – and read
// entry by entry into blobs.

import { Unzip, UnzipInflate, Zip, ZipDeflate } from 'fflate';

/** Sends a piece to the page and waits until it is written */
export type Send = (chunk: Uint8Array) => Promise<void>;

export class ZipOut {
	private out: Uint8Array[] = [];
	private failure: Error | null = null;
	private zip = new Zip((error, chunk) => {
		if (error) this.failure = error;
		else this.out.push(chunk);
	});

	constructor(
		private send: Send,
		private time = new Date()
	) {}

	private async flush() {
		if (this.failure) throw this.failure;
		// A copy of its own: fflate's pieces may be views into a buffer it keeps using
		for (const chunk of this.out.splice(0)) await this.send(chunk.slice());
	}

	private entry(name: string, level: 1 | 6) {
		const file = new ZipDeflate(name, { level });
		file.mtime = this.time;
		this.zip.add(file);
		return file;
	}

	/** An entry held in memory (manifest, database, thumbnails) */
	async whole(name: string, data: Uint8Array) {
		this.entry(name, 6).push(data, true);
		await this.flush();
	}

	/** A file read in pieces – already compressed pictures and videos: the fastest level, still DEFLATE */
	async stream(name: string, blob: Blob, progress?: (bytes: number) => void) {
		const file = this.entry(name, 1);
		// One piece ahead, so the last one is pushed as the file's end
		const reader = blob.stream().getReader();
		let next = await reader.read();
		if (next.done) file.push(new Uint8Array(0), true);
		while (!next.done) {
			const piece = next.value;
			next = await reader.read();
			file.push(piece, next.done);
			progress?.(piece.byteLength);
			await this.flush();
		}
		await this.flush();
	}

	async end() {
		this.zip.end();
		await this.flush();
	}
}

/**
 * What a backup unpacks to at most: a file made to exhaust memory (a few kilobytes unpacking to gigabytes, or
 * millions of entries) is refused instead of taking the tab down. Real backups are far below both – media in them
 * barely shrinks, and their database to about a tenth.
 */
const MAX_ENTRIES = 100_000;
const maxUnpacked = (packed: number) => Math.max(1024 ** 3, packed * 200);

/** Every entry of a ZIP as a blob, read in pieces (names as stored) */
export async function unzipBlob(file: Blob): Promise<Map<string, Blob>> {
	const entries = new Map<string, Blob>();
	const pending: Promise<void>[] = [];
	let failure: Error | null = null;
	const limit = maxUnpacked(file.size);
	let unpacked = 0;
	let count = 0;
	const unzip = new Unzip((entry) => {
		if (++count > MAX_ENTRIES) {
			failure ??= new Error('Too many entries in the archive');
			return;
		}
		const parts: Uint8Array[] = [];
		pending.push(
			new Promise<void>((resolve) => {
				entry.ondata = (error, data, final) => {
					const problem: Error | null = error ?? ((unpacked += data.length) > limit ? new Error('The archive unpacks to too much') : null);
					if (problem) {
						failure ??= problem;
						// Nothing more of it is kept or unpacked
						parts.length = 0;
						entry.terminate();
					} else parts.push(data);
					if (final || problem) {
						entries.set(entry.name, new Blob(parts as BlobPart[]));
						resolve();
					}
				};
			})
		);
		entry.start();
	});
	unzip.register(UnzipInflate);
	const reader = file.stream().getReader();
	for (let next = await reader.read(); ; next = await reader.read()) {
		if (next.done) {
			unzip.push(new Uint8Array(0), true);
			break;
		}
		unzip.push(next.value);
		if (failure) throw failure;
	}
	await Promise.all(pending);
	if (failure) throw failure;
	return entries;
}

/** `2026-11-23T02:15:47.045+01:00` – local time with its offset, as JW Library writes `creationDate` */
export function localIso(date: Date): string {
	const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, '0');
	const offset = -date.getTimezoneOffset();
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:` +
		`${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}${offset < 0 ? '-' : '+'}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
	);
}

/** The plain grey picture JW Library falls back to where an item has no thumbnail */
export async function defaultThumbnail(): Promise<Uint8Array> {
	const canvas = new OffscreenCanvas(128, 128);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('No canvas');
	ctx.fillStyle = '#d4d4d4';
	ctx.fillRect(0, 0, 128, 128);
	return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
}
