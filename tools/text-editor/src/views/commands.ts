import { matches, shortcutLabel, type Command, type Shortcut } from '@in-browser/brand/commands.js';
import { brandMessages } from '@in-browser/brand/i18n/index.svelte.js';
import type { MenuAction, MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
import { m } from '#lib/i18n/index.js';
import type { ViewAction, ViewUi } from './types.js';

// The commands of the table and the tree: name, icon and key once, for the contextual ribbon tabs (`Home.svelte`),
// the menus of rows, columns and nodes and the keys of the views. What they do comes from the view that is shown
// (`ViewUi.actions`), so the ribbon's tabs stay the same while views come and go.

export interface ViewCommandSpec {
	id: string;
	label: string;
	icon: string;
	/** Handled by the view while it has the focus (never page-wide) */
	shortcut?: Shortcut;
	/** A switch (pressed while on) */
	toggle?: boolean;
	/** Opens a menu of choices */
	menu?: boolean;
}

const selectAll: ViewCommandSpec = { id: 'selectAll', label: m.views.selectAll, icon: 'icon-[material-symbols-light--select-all]', shortcut: { key: 'a', ctrl: true } };
const clearSelection: ViewCommandSpec = { id: 'clearSelection', label: m.views.clearSelection, icon: 'icon-[material-symbols-light--deselect]', shortcut: { key: 'Escape' } };

export const TABLE = {
	editCell: { id: 'editCell', label: m.table.edit, icon: 'icon-[material-symbols-light--edit-outline]', shortcut: { key: 'F2' } },
	clearCells: { id: 'clearCells', label: m.table.clearCells, icon: 'icon-[material-symbols-light--backspace-outline]', shortcut: { key: 'Delete' } },
	insertAbove: { id: 'insertAbove', label: m.table.insertAbove, icon: 'icon-[material-symbols-light--add-row-above-outline]' },
	insertBelow: { id: 'insertBelow', label: m.table.insertBelow, icon: 'icon-[material-symbols-light--add-row-below-outline]' },
	moveUp: { id: 'moveRowsUp', label: m.table.moveUp, icon: 'icon-[material-symbols-light--arrow-upward]', shortcut: { key: 'ArrowUp', alt: true } },
	moveDown: { id: 'moveRowsDown', label: m.table.moveDown, icon: 'icon-[material-symbols-light--arrow-downward]', shortcut: { key: 'ArrowDown', alt: true } },
	removeRows: { id: 'removeRows', label: m.table.removeRows, icon: 'icon-[material-symbols-light--delete-outline]' },
	insertLeft: { id: 'insertLeft', label: m.table.insertLeft, icon: 'icon-[material-symbols-light--add-column-left-outline]' },
	insertRight: { id: 'insertRight', label: m.table.insertRight, icon: 'icon-[material-symbols-light--add-column-right-outline]' },
	renameColumn: { id: 'renameColumn', label: m.table.rename, icon: 'icon-[material-symbols-light--text-fields]' },
	moveLeft: { id: 'moveLeft', label: m.table.moveLeft, icon: 'icon-[material-symbols-light--arrow-back]' },
	moveRight: { id: 'moveRight', label: m.table.moveRight, icon: 'icon-[material-symbols-light--arrow-forward]' },
	removeColumn: { id: 'removeColumn', label: m.table.removeColumn, icon: 'icon-[material-symbols-light--delete-outline]' },
	sortUp: { id: 'sortUp', label: m.table.sortUp, icon: 'icon-[material-symbols-light--arrow-upward]' },
	sortDown: { id: 'sortDown', label: m.table.sortDown, icon: 'icon-[material-symbols-light--arrow-downward]' },
	filter: { id: 'filter', label: m.table.filter, icon: 'icon-[material-symbols-light--filter-alt-outline]' },
	removeFilters: { id: 'removeFilters', label: m.table.removeFilters, icon: 'icon-[material-symbols-light--filter-alt-off-outline]' },
	header: { id: 'header', label: m.table.header, icon: 'icon-[material-symbols-light--table-rows-narrow-outline]', toggle: true },
	delimiter: { id: 'delimiter', label: m.table.delimiter, icon: 'icon-[material-symbols-light--splitscreen-vertical-add-outline]', menu: true },
	selectAll,
	clearSelection
} satisfies Record<string, ViewCommandSpec>;

export const TREE = {
	editValue: { id: 'editValue', label: m.tree.edit, icon: 'icon-[material-symbols-light--edit-outline]', shortcut: { key: 'Enter' } },
	rename: { id: 'rename', label: m.tree.rename, icon: 'icon-[material-symbols-light--text-fields]', shortcut: { key: 'F2' } },
	duplicate: { id: 'duplicate', label: m.tree.duplicate, icon: 'icon-[material-symbols-light--content-copy-outline]' },
	remove: { id: 'remove', label: m.tree.remove, icon: 'icon-[material-symbols-light--delete-outline]', shortcut: { key: 'Delete' } },
	insert: { id: 'insert', label: m.tree.insert, icon: 'icon-[material-symbols-light--add]', menu: true },
	moveUp: { id: 'moveUp', label: m.tree.moveUp, icon: 'icon-[material-symbols-light--arrow-upward]', shortcut: { key: 'ArrowUp', alt: true } },
	moveDown: { id: 'moveDown', label: m.tree.moveDown, icon: 'icon-[material-symbols-light--arrow-downward]', shortcut: { key: 'ArrowDown', alt: true } },
	type: { id: 'type', label: m.tree.type, icon: 'icon-[material-symbols-light--data-object]', menu: true },
	expandAll: { id: 'expandAll', label: m.tree.expandAll, icon: 'icon-[material-symbols-light--unfold-more]' },
	collapseAll: { id: 'collapseAll', label: m.tree.collapseAll, icon: 'icon-[material-symbols-light--unfold-less]' },
	filter: { id: 'filter', label: m.tree.filter, icon: 'icon-[material-symbols-light--filter-alt-outline]' },
	selectAll,
	clearSelection
} satisfies Record<string, ViewCommandSpec>;

export const keysOf = (spec: ViewCommandSpec) => (spec.shortcut ? shortcutLabel(spec.shortcut, brandMessages().keys) : undefined);

/** A command as a menu entry of the view (disabled where the view can't do it now); menu commands list their choices */
export function entryOf(spec: ViewCommandSpec, action: ViewAction | undefined): MenuEntry[] {
	const off = !action || action.enabled?.() === false;
	if (spec.menu) {
		const choices = off ? [] : (action?.menu?.() ?? []);
		return choices.length ? [{ separator: true }, { heading: spec.label }, ...choices, { separator: true }] : [];
	}
	const entry: MenuAction = { label: spec.label, icon: spec.icon, keys: keysOf(spec), disabled: off, run: () => action?.run?.() };
	if (spec.toggle) entry.checked = action?.active?.() ?? false;
	return [entry];
}

/** Runs the command whose key this is; true when one took it */
export function viewKey(e: KeyboardEvent, specs: Record<string, ViewCommandSpec>, actions: ViewUi['actions']): boolean {
	for (const spec of Object.values(specs)) {
		if (!spec.shortcut || !matches(e, spec.shortcut)) continue;
		const action = actions[spec.id];
		if (!action?.run) return false;
		e.preventDefault();
		if (action.enabled?.() !== false) action.run();
		return true;
	}
	return false;
}

/** The ribbon's side of a view command: it asks the view that is shown (`ui`), disabled without one */
export function viewCommand(spec: ViewCommandSpec, ui: () => ViewUi | null): Command {
	const action = () => ui()?.actions[spec.id];
	return {
		id: `view.${spec.id}`,
		label: spec.label,
		icon: spec.icon,
		shortcut: spec.shortcut,
		enabled: () => {
			const a = action();
			return !!a && a.enabled?.() !== false;
		},
		active: spec.toggle ? () => action()?.active?.() ?? false : undefined,
		run: spec.menu ? undefined : () => action()?.run?.(),
		menu: spec.menu ? () => action()?.menu?.() ?? [] : undefined
	};
}
