// Change notifications of the shared file system: every change is announced to all tabs of the origin
// (BroadcastChannel `files:changes`); `watch` listens.

type Listener = (paths: string[]) => void;
const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;

function ensureChannel() {
	if (channel || typeof BroadcastChannel === 'undefined') return;
	channel = new BroadcastChannel('files:changes');
	channel.onmessage = (e) => listeners.forEach((l) => l(e.data as string[]));
}

/** Announces changed paths (files or folders) to this and every other tab. */
export function changed(...paths: string[]) {
	ensureChannel();
	channel?.postMessage(paths);
	listeners.forEach((l) => l(paths));
}

/** Announces changes this tab noticed on its own (each tab watches connected folders and devices itself) */
export function noticed(...paths: string[]) {
	listeners.forEach((l) => l(paths));
}

/** Calls `listener` with the paths of every change (also from other tabs); returns the unsubscribe function. */
export function watch(listener: Listener): () => void {
	ensureChannel();
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/**
 * Calls `refresh` once changes that `concerns` settle (bursts of sync or copy changes come together after `delay`
 * ms); returns the unsubscribe function, which also drops a pending call.
 */
export function watchSettled(concerns: (paths: string[]) => boolean, delay: number, refresh: () => void): () => void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const stop = watch((paths) => {
		if (!concerns(paths)) return;
		clearTimeout(timer);
		timer = setTimeout(refresh, delay);
	});
	return () => {
		stop();
		clearTimeout(timer);
	};
}
