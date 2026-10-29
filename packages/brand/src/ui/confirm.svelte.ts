// Confirmation questions as our own modal instead of the browser's `confirm()`; shown by `ConfirmDialog.svelte`,
// which each tool places once in its layout.

export interface Question {
	title: string;
	message: string;
	/** Label of the confirm button */
	confirm: string;
	/** Destructive action: red confirm button */
	danger?: boolean;
}

interface Open extends Question {
	resolve: (ok: boolean) => void;
}

export const confirmState = $state<{ current: Open | null }>({ current: null });

/** Asks the question; `true` if confirmed. A question still open is answered with `false`. */
export function ask(question: Question): Promise<boolean> {
	answer(false);
	return new Promise((resolve) => {
		confirmState.current = { ...question, resolve };
	});
}

export function answer(ok: boolean) {
	const open = confirmState.current;
	confirmState.current = null;
	open?.resolve(ok);
}
