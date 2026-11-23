// JW Library playlists (`.jwlplaylist`): a ZIP of `manifest.json`, the media, a thumbnail per item, a fallback
// thumbnail and `userData.db` – JW Library's SQLite database (schema 16) holding one playlist (a `Tag` of type 2)
// whose items show the media. Built in a worker (SQLite is WebAssembly, which pages may not compile) and streamed
// out piece by piece, so large videos never lie in memory whole. The format: .claude/rules/jwl.md.

import { BRAND } from '@in-browser/brand/brand.js';

/** What happens at an item's end, in JW Library's order – the index is the stored `EndAction` */
export const END_ACTIONS = ['continue', 'stop', 'freeze', 'repeat'] as const;
export type EndAction = (typeof END_ACTIONS)[number];

/** How long JW Library shows a picture when nobody changes it */
export const DEFAULT_PICTURE_SECONDS = 4;
/** Size of the thumbnails JW Library writes for its items */
export const THUMBNAIL = { width: 250, height: 140 } as const;

export interface PlaylistItem {
	/** The item's title in the playlist (not empty) */
	label: string;
	/** The picture or video as it goes into the playlist (its `type` is stored as the MIME type) */
	media: Blob;
	/** File name of the media as the user knows it (`OriginalFilename`), with its extension */
	name: string;
	kind: 'image' | 'video';
	/** A picture: how long it is shown; a video: its length */
	seconds: number;
	endAction: EndAction;
	/** JPEG of `THUMBNAIL` size (`playlistThumbnail`) */
	thumbnail: Blob;
}

export interface Playlist {
	/** The playlist's name in JW Library */
	name: string;
	items: PlaylistItem[];
}

export interface PlaylistOptions {
	signal?: AbortSignal;
	/** Called with the media written so far (in bytes) and in all */
	onprogress?: (done: number, total: number) => void;
}

/** Messages between `writePlaylist` and its worker */
export type PlaylistRequest = { type: 'start'; playlist: Playlist; deviceName: string } | { type: 'ack' };
export type PlaylistReply =
	| { type: 'chunk'; data: Uint8Array }
	| { type: 'progress'; done: number; total: number }
	| { type: 'done' }
	| { type: 'error'; message: string };

/** Writes `playlist` as a `.jwlplaylist` into `out` (closed when done, aborted on errors or `signal`) */
export async function writePlaylist(playlist: Playlist, out: WritableStream<Uint8Array> | WritableStream<FileSystemWriteChunkType>, options: PlaylistOptions = {}): Promise<void> {
	if (!playlist.items.length) throw new Error('A playlist needs at least one item');
	const writer = (out as WritableStream<Uint8Array>).getWriter();
	const worker = new Worker(new URL('./playlist.worker.ts', import.meta.url), { type: 'module' });
	const { signal, onprogress } = options;
	try {
		await new Promise<void>((resolve, reject) => {
			const abort = () => reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
			if (signal?.aborted) return abort();
			signal?.addEventListener('abort', abort, { once: true });
			worker.onerror = (e) => reject(new Error(e.message || 'The playlist worker failed'));
			worker.onmessage = async ({ data: reply }: MessageEvent<PlaylistReply>) => {
				try {
					if (reply.type === 'chunk') {
						// One piece at a time: the worker waits for the answer, so the file is written as fast as it is made
						await writer.write(reply.data);
						worker.postMessage({ type: 'ack' } satisfies PlaylistRequest);
					} else if (reply.type === 'progress') onprogress?.(reply.done, reply.total);
					else if (reply.type === 'done') resolve();
					else reject(new Error(reply.message));
				} catch (error) {
					reject(error);
				}
			};
			worker.postMessage({ type: 'start', playlist, deviceName: BRAND.suite } satisfies PlaylistRequest);
		});
		await writer.close();
	} catch (error) {
		await writer.abort(error).catch(() => {});
		throw error;
	} finally {
		worker.terminate();
	}
}

/** `writePlaylist` into memory, for a download */
export async function playlistBlob(playlist: Playlist, options: PlaylistOptions = {}): Promise<Blob> {
	const parts: Uint8Array[] = [];
	await writePlaylist(playlist, new WritableStream<Uint8Array>({ write: (chunk) => void parts.push(chunk) }), options);
	return new Blob(parts as BlobPart[], { type: 'application/zip' });
}

/** A thumbnail for an item: `source` (`width`×`height` pixels) fitted whole into `THUMBNAIL`, the rest `background` */
export async function playlistThumbnail(source: CanvasImageSource, width: number, height: number, background = '#ffffff'): Promise<Blob> {
	const canvas = new OffscreenCanvas(THUMBNAIL.width, THUMBNAIL.height);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('No canvas');
	ctx.fillStyle = background;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	const scale = Math.min(canvas.width / width, canvas.height / height);
	const w = width * scale;
	const h = height * scale;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(source, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
	return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
}
