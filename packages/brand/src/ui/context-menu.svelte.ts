// One context menu per page (`ContextMenu.svelte` placed once); the places that open it fill it with entries.
// New functions are new entries, the menu itself stays unchanged.

export interface MenuAction {
	label: string;
	/** Full icon class, e.g. `icon-[material-symbols-light--content-copy]` */
	icon?: string;
	/** A small drawing instead of an icon: the points of a line in a 24 × 24 box (`x,y x,y …`), e.g. a shape – or
	 * several lines */
	glyph?: string | readonly string[];
	/** The current choice (a check at the right) */
	checked?: boolean;
	/** Shortcut shown on the right, e.g. `Ctrl+C` */
	keys?: string;
	disabled?: boolean;
	run: () => void;
	/** Where the entry leads (opening a folder or document): the middle mouse button or Ctrl/⌘+click opens it in a
	 * new tab instead of running it, like a link */
	href?: string;
	/** A small mark (!) after the label, saying something to keep in mind about the choice (its tooltip) */
	note?: string;
	/** Pointer or focus on the entry (e.g. to highlight what it stands for), `false` when it leaves */
	onhover?: (on: boolean) => void;
}

export type MenuEntry = MenuAction | { separator: true } | { heading: string };

class ContextMenuState {
	entries = $state.raw<MenuEntry[]>([]);
	x = $state(0);
	y = $state(0);
	/** `y` is the bottom edge of the menu (opened above a button) instead of its top edge */
	above = $state(false);

	get open() {
		return this.entries.length > 0;
	}

	close() {
		this.entries = [];
	}
}

export const contextMenu = new ContextMenuState();

function show(x: number, y: number, entries: MenuEntry[], above = false) {
	contextMenu.x = x;
	contextMenu.y = y;
	contextMenu.above = above;
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

/** Opens the menu above a button (in the footer); it stays inside the window */
export function openMenuAbove(e: MouseEvent, entries: MenuEntry[]) {
	e.preventDefault();
	e.stopPropagation();
	const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
	show(rect.left, rect.top - 2, entries, true);
}

/** Hold time of a touch press that opens the context menu */
export const LONG_PRESS_MS = 500;
/** Movement (px) that turns a press into a scroll or drag */
const LONG_PRESS_SLOP = 10;

/**
 * Long press with a finger fires `contextmenu` at the pressed element, so every `oncontextmenu` handler also works
 * on touch screens (iOS Safari fires none on its own). When Android fires its own `contextmenu` first, that one is
 * used; when ours comes first, the native one and the click on release are swallowed. A press nobody handles
 * (`preventDefault`) changes nothing, so text selection etc. stay as they are. Installed once by `ContextMenu.svelte`.
 */
export function installLongPress(target: Window = window): () => void {
	let press: { id: number; x: number; y: number; el: Element; timer: ReturnType<typeof setTimeout> } | undefined;
	/** The press opened a menu: swallow further `contextmenu` and the click until the next press */
	let handled = false;
	/** Our own `contextmenu` events (the others come from the browser) */
	const ours = new WeakSet<Event>();

	const cancel = () => {
		if (press) clearTimeout(press.timer);
		press = undefined;
	};

	const fire = () => {
		if (!press) return;
		const { x, y, el } = press;
		press = undefined;
		const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 2 });
		ours.add(event);
		if (!el.dispatchEvent(event)) {
			handled = true;
			target.getSelection()?.removeAllRanges();
		}
	};

	const down = (e: PointerEvent) => {
		cancel();
		handled = false;
		if (e.pointerType !== 'touch' || !e.isPrimary || !(e.target instanceof Element)) return;
		press = { id: e.pointerId, x: e.clientX, y: e.clientY, el: e.target, timer: setTimeout(fire, LONG_PRESS_MS) };
	};

	const move = (e: PointerEvent) => {
		if (press?.id === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) > LONG_PRESS_SLOP) cancel();
	};

	const end = (e: PointerEvent) => {
		if (press?.id === e.pointerId) cancel();
	};

	const native = (e: MouseEvent) => {
		if (ours.has(e)) return;
		if (handled) {
			e.preventDefault();
			e.stopImmediatePropagation();
		} else cancel(); // the browser's own long press came first
	};

	const click = (e: MouseEvent) => {
		if (!handled) return;
		handled = false;
		e.preventDefault();
		e.stopImmediatePropagation();
	};

	const options = { capture: true };
	target.addEventListener('pointerdown', down, options);
	target.addEventListener('pointermove', move, options);
	target.addEventListener('pointerup', end, options);
	target.addEventListener('pointercancel', end, options);
	target.addEventListener('contextmenu', native, options);
	target.addEventListener('click', click, options);
	return () => {
		cancel();
		target.removeEventListener('pointerdown', down, options);
		target.removeEventListener('pointermove', move, options);
		target.removeEventListener('pointerup', end, options);
		target.removeEventListener('pointercancel', end, options);
		target.removeEventListener('contextmenu', native, options);
		target.removeEventListener('click', click, options);
	};
}
