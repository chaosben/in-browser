import { open, read, type RandomAccess } from './fs.js';

// URLs for media elements (`<video>`, `<audio>`, `<img>`) that read a file in pieces – the same for every place
// (My files, connected folders, other devices): the Service Worker answers `/_live/<token>/<name>` with range
// responses and asks this tab for exactly the bytes the browser wants. A video from another device plays without
// being downloaded first. Without an active Service Worker (first visit, some private windows) a blob URL is used.

/** Message from the Service Worker (see `src/service-worker/index.ts`) */
export interface LiveRequest {
	type: 'in-browser-live';
	token: string;
	/** `meta`: size and type; `read`: bytes `start`–`end` */
	op: 'meta' | 'read';
	start?: number;
	end?: number;
}

export type LiveAnswer = { size: number; type: string } | { bytes: Uint8Array } | { unknown: true } | { error: string };

const served = new Map<string, { path: string; access: Promise<RandomAccess> | null }>();
let listening = false;

function listen() {
	if (listening || !('serviceWorker' in navigator)) return;
	listening = true;
	navigator.serviceWorker.addEventListener('message', (event: MessageEvent<LiveRequest>) => {
		if (event.data?.type !== 'in-browser-live') return;
		const port = event.ports[0];
		void answer(event.data).then(
			(result) => port?.postMessage(result, 'bytes' in result ? [result.bytes.buffer as ArrayBuffer] : []),
			(e: unknown) => port?.postMessage({ error: e instanceof Error ? e.message : String(e) } satisfies LiveAnswer)
		);
	});
	navigator.serviceWorker.startMessages();
}

async function answer(request: LiveRequest): Promise<LiveAnswer> {
	const entry = served.get(request.token);
	if (!entry) return { unknown: true };
	entry.access ??= open(entry.path);
	const access = await entry.access;
	if (request.op === 'meta') return { size: access.size, type: access.type };
	return { bytes: await access.read(request.start ?? 0, request.end ?? access.size) };
}

export interface MediaUrl {
	url: string;
	/** The URL stops working (call when the element goes) */
	release: () => void;
}

/** A URL for media elements that reads `path` in pieces (from wherever it lives) */
export async function mediaUrl(path: string): Promise<MediaUrl> {
	if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
		listen();
		const token = crypto.randomUUID();
		served.set(token, { path, access: null });
		const name = encodeURIComponent(path.split('/').pop() ?? 'file');
		return { url: `/_live/${token}/${name}`, release: () => served.delete(token) };
	}
	const url = URL.createObjectURL(await read(path));
	return { url, release: () => URL.revokeObjectURL(url) };
}
