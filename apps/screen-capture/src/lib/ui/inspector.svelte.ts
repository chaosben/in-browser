// Shared state of the inspector's sections and fields (see `InspectorSection.svelte`, `InspectorField.svelte`)

import { createContext } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { loadCollapsed, storeCollapsed } from './inspector-search.js';

/** Which registered fields match the search; every field stays registered while its section is shown */
export class FieldMatches {
	readonly #fields = new SvelteMap<symbol, boolean>();

	set(id: symbol, matched: boolean) {
		this.#fields.set(id, matched);
	}

	delete(id: symbol) {
		this.#fields.delete(id);
	}

	get any() {
		for (const matched of this.#fields.values()) if (matched) return true;
		return false;
	}
}

/** Search of the whole inspector */
export class InspectorSearch {
	query = $state('');
	readonly matches = new FieldMatches();

	get active() {
		return this.query.trim() !== '';
	}
}

/** One section: its fields and whether its title matches (then all its fields are shown) */
export interface SectionScope {
	readonly matches: FieldMatches;
	readonly titleMatches: boolean;
}

export const [getInspectorSearch, setInspectorSearch] = createContext<InspectorSearch>();
export const [getSectionScope, setSectionScope] = createContext<SectionScope>();

/** Open or collapsed sections, the same for all element types (persisted) */
class SectionState {
	readonly #collapsed = new SvelteSet(loadCollapsed());

	isOpen(id: string) {
		return !this.#collapsed.has(id);
	}

	toggle(id: string) {
		if (this.#collapsed.has(id)) this.#collapsed.delete(id);
		else this.#collapsed.add(id);
		storeCollapsed(this.#collapsed);
	}
}

export const sectionState = new SectionState();
