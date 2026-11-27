// Confirmation questions as our own modal instead of the browser's `confirm()`; shown by `ConfirmDialog.svelte`,
// placed once for the suite (`Suite.svelte`).

import { onLeavePage } from './page-scope.js';

export interface Question {
	title: string;
	message: string;
	/** Label of the confirm button */
	confirm: string;
	/** Label of the other button (default: “Cancel”) */
	cancel?: string;
	/** Destructive action: red confirm button */
	danger?: boolean;
	/** A checkbox below the message (e.g. “Don't ask again”), unchecked at first; its state comes with the answer */
	option?: string;
}

interface Open extends Question {
	resolve: (ok: boolean, checked: boolean) => void;
}

export const confirmState = $state<{ current: Open | null }>({ current: null });

/** Asks the question; `true` if confirmed. A question still open is answered with `false`. */
export function ask(question: Question): Promise<boolean> {
	return askWithOption(question).then((a) => a.ok);
}

/** Asks the question with its `option` checkbox; the answer and whether the box was checked */
export function askWithOption(question: Question): Promise<{ ok: boolean; checked: boolean }> {
	answer(false);
	return new Promise((resolve) => {
		confirmState.current = { ...question, resolve: (ok, checked) => resolve({ ok, checked }) };
	});
}

/** `checked`: the option's checkbox (ignored without one) */
export function answer(ok: boolean, checked = false) {
	const open = confirmState.current;
	confirmState.current = null;
	open?.resolve(ok, checked);
}

// A question belongs to the page that asked: leaving it answers “no”
onLeavePage(() => answer(false));
