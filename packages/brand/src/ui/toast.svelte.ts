// Short messages at the bottom right; shown by `Toasts.svelte`, placed once for the suite (`Suite.svelte`). They
// belong to the tab: a message and its action (“Undo”) stay when the page changes.

export interface ToastAction {
	label: string;
	run: () => void | Promise<void>;
}

export interface Toast {
	id: number;
	kind: 'info' | 'success' | 'warning' | 'error';
	text: string;
	/** A button in the message (e.g. “Undo”); the message closes when it is used */
	action?: ToastAction;
}

let nextId = 1;

export const toasts = $state<Toast[]>([]);

export function dismissToast(id: number) {
	const i = toasts.findIndex((t) => t.id === id);
	if (i >= 0) toasts.splice(i, 1);
}

export function toast(text: string, kind: Toast['kind'] = 'info', ms = 4000, action?: ToastAction) {
	const id = nextId++;
	toasts.push({ id, kind, text, action });
	setTimeout(() => dismissToast(id), ms);
}
