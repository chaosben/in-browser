// The navigation a page of a tool shows in the BrandBar after "in-browser / Tool": where you are (folder path,
// document name). Only that – the BrandBar holds no actions (decided by the user); they are in the ribbon.

export interface Crumb {
	label: string;
	/** Link to this level (levels before the current one) … */
	href?: string;
	/** … or a click */
	onclick?: () => void;
}

export const brandBar = $state<{ crumbs: Crumb[] }>({ crumbs: [] });

/** Fills the path; call from an `$effect` of the page and return the result, which empties it again. */
export function setBrandBar({ crumbs = [] }: { crumbs?: Crumb[] }): () => void {
	brandBar.crumbs = crumbs;
	return () => {
		brandBar.crumbs = [];
	};
}
