import { watch } from 'node:fs';
import { sep } from 'node:path';
import { ignored } from '@in-browser/files/sync/plan.js';

// Changes in the folder (edited by hand or by other programs) → paths of the sync, collected for a moment. Watching
// is only a hint: every sync scans the whole folder, so a missed event delays a sync at most until the next round.

export function watchTree(root: string, onPaths: (paths: string[]) => void, delay = 1000): () => void {
	let pending = new Set<string>();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const watcher = watch(root, { recursive: true }, (_event, name) => {
		if (!name) return;
		const path = `/${name.split(sep).join('/')}`;
		if (ignored(path)) return;
		pending.add(path);
		clearTimeout(timer);
		timer = setTimeout(() => {
			const paths = [...pending];
			pending = new Set();
			onPaths(paths);
		}, delay);
	});
	watcher.on('error', (e) => console.error('Watching the folder failed:', e.message));
	return () => {
		clearTimeout(timer);
		watcher.close();
	};
}
