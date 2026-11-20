// Side panels of a tool (`PanelRail.svelte`): each one a component loaded when first opened.

import type { Component } from 'svelte';
import type { Command } from './commands.js';

/** What a panel component gets */
export interface PanelProps<T> {
	/** The tool's state the panels work on (e.g. the open document) */
	context: T;
	/** Closes the panel (e.g. after jumping to a page on a phone) */
	close: () => void;
}

export interface PanelSpec<T> {
	id: string;
	/** Full icon class */
	icon: string;
	label: string;
	load: () => Promise<Component<PanelProps<T>>>;
	/** Offered for this document? (read reactively; e.g. no outline → no outline panel) */
	available?: () => boolean;
}

/** The command that opens or closes a panel (View → Panels; on phones the only way to a panel) */
export function panelCommand<T>(spec: PanelSpec<T>, open: { get(): string | null; set(id: string | null): void }): Command {
	return {
		id: `panel:${spec.id}`,
		label: spec.label,
		icon: spec.icon,
		enabled: () => spec.available?.() !== false,
		active: () => open.get() === spec.id,
		run: () => open.set(open.get() === spec.id ? null : spec.id)
	};
}
