import type { Tab } from '#lib/tab.svelte.js';

/**
 * Follows the text of a tab: `current` is `read(text)`, recomputed shortly after typing pauses, at once when the
 * tab changes or after `soon()` (the view's own edits show without delay). Create it while a component initializes.
 */
export function follow<T>(tab: () => Tab, read: (text: string) => T, delay = 250) {
	let current = $state.raw<T>(read(tab().state.doc.toString()));
	let shown = tab().id;
	let version = tab().version;
	let immediate = false;

	$effect(() => {
		const t = tab();
		if (t.id === shown && t.version === version) return;
		const wait = shown === t.id && !immediate ? delay : 0;
		immediate = false;
		const timer = setTimeout(() => {
			shown = t.id;
			version = t.version;
			current = read(t.state.doc.toString());
		}, wait);
		return () => clearTimeout(timer);
	});

	return {
		get current() {
			return current;
		},
		/** The next change of the text is shown right away */
		soon() {
			immediate = true;
		},
		/** Reads again now (e.g. after an option changed) */
		refresh() {
			shown = tab().id;
			version = tab().version;
			current = read(tab().state.doc.toString());
		},
		/** The result for the text as it is now (edits must never use positions of an older text) */
		now(): T {
			if (tab().id !== shown || tab().version !== version) this.refresh();
			return current;
		}
	};
}
