import type { Snippet } from 'svelte';
import type { MenuEntry } from './ui/context-menu.svelte.js';

// Places in the BrandBar a page of a tool fills: on the left after "in-browser.de / Tool" the navigation inside the
// tool (where am I, with the actions of the current object) and right after it the main actions as buttons; on the
// right the less important actions of the tool.

export interface Crumb {
	label: string;
	/** Link to this level (levels before the current one) … */
	href?: string;
	/** … or a click */
	onclick?: () => void;
	/** Small status after the name, e.g. "Saved" */
	status?: string;
	/** The name can be changed inline (click on it or `startRename()`) */
	rename?: (name: string) => void;
	/** Actions of the object: menu behind the name (same entries as a context menu) */
	menu?: MenuEntry[];
}

export const brandBar = $state<{
	crumbs: Crumb[];
	menu: MenuEntry[] | null;
	primary: Snippet | null;
	actions: Snippet | null;
	renaming: boolean;
}>({
	crumbs: [],
	menu: null,
	primary: null,
	actions: null,
	renaming: false
});

interface Slots {
	crumbs?: Crumb[];
	/** Actions at the tool name when there are no crumbs (the tool's top level is the current object) */
	menu?: MenuEntry[] | null;
	/**
	 * Main actions of the current object as buttons, right after the crumbs (hidden on narrow screens: the menu of
	 * the current object must contain them too)
	 */
	primary?: Snippet | null;
	/** Less important actions of the tool, on the right */
	actions?: Snippet | null;
}

/** Fills the bar; call from an `$effect` of the page and return the result, which empties the bar again. */
export function setBrandBar({ crumbs = [], menu = null, primary = null, actions = null }: Slots): () => void {
	brandBar.crumbs = crumbs;
	brandBar.menu = menu;
	brandBar.primary = primary;
	brandBar.actions = actions;
	return () => {
		brandBar.crumbs = [];
		brandBar.menu = null;
		brandBar.primary = null;
		brandBar.actions = null;
		brandBar.renaming = false;
	};
}

/** Turns the name of the current object (last level with `rename`) into an input field. */
export function startRename() {
	brandBar.renaming = true;
}
