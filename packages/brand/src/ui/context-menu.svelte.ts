// One context menu per page (`ContextMenu.svelte` placed once); the places that open it fill it with entries.
// New functions are new entries, the menu itself stays unchanged.

export interface MenuAction {
	label: string;
	/** Full icon class, e.g. `icon-[material-symbols-light--content-copy]` */
	icon?: string;
	/** Shortcut shown on the right, e.g. `Ctrl+C` */
	keys?: string;
	disabled?: boolean;
	run: () => void;
	/** Pointer or focus on the entry (e.g. to highlight what it stands for), `false` when it leaves */
	onhover?: (on: boolean) => void;
}

export type MenuEntry = MenuAction | { separator: true } | { heading: string };

class ContextMenuState {
	entries = $state.raw<MenuEntry[]>([]);
	x = $state(0);
	y = $state(0);

	get open() {
		return this.entries.length > 0;
	}

	close() {
		this.entries = [];
	}
}

export const contextMenu = new ContextMenuState();

function show(x: number, y: number, entries: MenuEntry[]) {
	contextMenu.x = x;
	contextMenu.y = y;
	contextMenu.entries = entries.filter((entry, i, all) => !('separator' in entry) || (i > 0 && i < all.length - 1));
}

/** Opens the menu at the mouse position instead of the browser's; nothing happens without entries */
export function openContextMenu(e: MouseEvent, entries: MenuEntry[]) {
	e.preventDefault();
	e.stopPropagation();
	show(e.clientX, e.clientY, entries);
}

/** Opens the menu below a button (also when it was pressed with the keyboard); it stays inside the window */
export function openMenuBelow(e: MouseEvent, entries: MenuEntry[]) {
	e.preventDefault();
	e.stopPropagation();
	const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
	show(rect.left, rect.bottom + 2, entries);
}
