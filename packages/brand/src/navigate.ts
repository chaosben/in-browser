// Going to another page of the suite. Pages change without reloading (decided by the user, 2026-11-27): what lives
// as long as the tab – the syncs and their connections above all – stays, where a full page load would start it
// anew. The app sets the way up once (`setNavigation` in the root layout: SvelteKit's `goto`/`replaceState`);
// packages and tools only call `navigate`. Without the app (specs) it is a plain page load.

export interface Navigation {
	/** Shows the page at `url`; `replace`: instead of the current one in the history */
	go(url: string, options?: { replace?: boolean }): void | Promise<void>;
	/** Changes the address of the page shown and nothing else (e.g. takes a parameter away that was handled) */
	readdress(url: URL): void;
}

let navigation: Navigation = {
	go: (url, options) => (options?.replace ? location.replace(url) : location.assign(url)),
	readdress: (url) => history.replaceState(history.state, '', url)
};

export function setNavigation(app: Navigation) {
	navigation = app;
}

/** Goes to a page of the suite – never `location.assign`, which loads everything anew */
export function navigate(url: string, options?: { replace?: boolean }): void {
	void navigation.go(url, options);
}

export function readdress(url: URL): void {
	navigation.readdress(url);
}
