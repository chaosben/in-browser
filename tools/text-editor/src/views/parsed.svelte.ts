import { untrack } from 'svelte';
import type { ChangeSpec } from '@codemirror/state';
import type { Tab } from '#lib/tab.svelte.js';
import { follow } from './follow.svelte.js';
import type { ViewHost } from './types.js';

/**
 * The parsed text behind a table or tree view. `shown` is the current result, or the last one without errors
 * while the text doesn't parse (then read-only). Create it while a component initializes.
 */
export function parsedView<T extends { error: number | null }>(tab: () => Tab, host: () => ViewHost, read: (text: string) => T) {
	const parsed = follow(tab, read);
	/** Last result without errors */
	let good = $state.raw<T>(untrack(() => parsed.current));
	$effect(() => {
		if (parsed.current.error === null) good = parsed.current;
	});
	const error = $derived(parsed.current.error);
	const shown = $derived(error === null ? parsed.current : good);

	return {
		/** Position of the first syntax error of the current text */
		get error() {
			return error;
		},
		get shown() {
			return shown;
		},
		/** A result older than the text is shown */
		get stale() {
			return good !== parsed.current;
		},
		get editable() {
			return error === null;
		},
		now: () => parsed.now(),
		refresh: () => parsed.refresh(),
		/** Applies an edit made on the current text (never on positions of an older one) */
		apply(make: (doc: string, current: T) => ChangeSpec | null): boolean {
			if (error !== null) return false;
			const current = parsed.now();
			if (current.error !== null) return false;
			const spec = make(tab().state.doc.toString(), current);
			if (!spec || (Array.isArray(spec) && !spec.length)) return false;
			parsed.soon();
			host().edit(spec);
			return true;
		}
	};
}

/** Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y in a view: undo and redo of the text; true when handled */
export function undoKeys(e: KeyboardEvent, host: ViewHost): boolean {
	if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
	if (e.code === 'KeyZ') {
		e.preventDefault();
		if (e.shiftKey) host.redo();
		else host.undo();
		return true;
	}
	if (e.code === 'KeyY') {
		e.preventDefault();
		host.redo();
		return true;
	}
	return false;
}
