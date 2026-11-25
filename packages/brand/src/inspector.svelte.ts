// The inspector of a tool (`Inspector.svelte`): the properties of the selection, else of the document, on the right –
// the counterpart of the panels on the left (`PanelRail`). Shown or hidden, its width and its folded sections are
// kept as `<tool>:inspector`. Its fields can be searched: `InspectorSection` and `InspectorField` register whether
// they match (`InspectorSearchField` is the search box).

import { createContext } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Command } from './commands.js';
import { brandMessages } from './i18n/index.svelte.js';
import { loadJson, storeJson } from './storage.js';

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

export const MIN_WIDTH = 240;

/** Phones (and narrow windows) show the inspector as a full-screen sheet, opened only on demand */
const onPhone = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse), (max-width: 639px)').matches;

/** Shown or not, width, folded sections (one per tool; the same section id folds for every kind of selection) */
export class InspectorState {
	/** Shown beside the content (desktop; kept) */
	open = $state(true);
	/** Shown as a sheet (phones; never kept, so a phone starts without it) */
	sheet = $state(false);
	width = $state(320);
	readonly search = new InspectorSearch();
	readonly #collapsed: SvelteSet<string>;
	readonly #key: string;
	/** Fields shown elsewhere (a ribbon popover with one section): sections without their foldable title, always open */
	readonly plain: boolean;

	constructor(storage: string, options: { plain?: boolean } = {}) {
		this.plain = !!options.plain;
		this.#key = `${storage}:inspector`;
		const stored = this.plain ? {} : loadJson<{ open?: unknown; width?: unknown; collapsed?: unknown }>(this.#key, {});
		this.open = stored.open !== false;
		if (typeof stored.width === 'number') this.width = Math.max(MIN_WIDTH, stored.width);
		this.#collapsed = new SvelteSet(Array.isArray(stored.collapsed) ? stored.collapsed.filter((id): id is string => typeof id === 'string') : []);
	}

	isOpen(section: string) {
		return !this.#collapsed.has(section);
	}

	toggleSection(section: string) {
		if (this.#collapsed.has(section)) this.#collapsed.delete(section);
		else this.#collapsed.add(section);
		this.store();
	}

	/** Shown now (beside the content, or as a sheet on a phone)? */
	get shown() {
		return onPhone() ? this.sheet : this.open;
	}

	toggle() {
		if (onPhone()) {
			this.sheet = !this.sheet;
			return;
		}
		this.open = !this.open;
		this.store();
	}

	/** Shows it (e.g. “Properties …” in a context menu) */
	show() {
		if (!this.shown) this.toggle();
	}

	store() {
		storeJson(this.#key, { open: this.open, width: Math.round(this.width), collapsed: [...this.#collapsed] });
	}

	/** The command “Properties” (View → Panels, Alt+Enter) */
	command(): Command {
		const t = brandMessages().inspector;
		return {
			id: 'inspector',
			label: t.label,
			icon: 'icon-[material-symbols-light--tune]',
			shortcut: { key: 'Enter', alt: true },
			active: () => this.shown,
			run: () => this.toggle()
		};
	}
}

export const [getInspector, setInspector] = createContext<InspectorState>();
export const [getSectionScope, setSectionScope] = createContext<SectionScope>();
