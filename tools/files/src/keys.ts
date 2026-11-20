import { installCommandKeys, shortcutLabel, type Command, type Shortcut } from '@in-browser/brand/commands.js';
import { brandMessages } from '@in-browser/brand/i18n/index.svelte.js';

// Shortcuts of Files: defined once, run as commands, shown in menus and tooltips.

export const KEYS = {
	open: { key: 'Enter' },
	preview: { key: ' ' },
	rename: { key: 'F2' },
	delete: { key: 'Delete' },
	copy: { key: 'c', ctrl: true },
	cut: { key: 'x', ctrl: true },
	paste: { key: 'v', ctrl: true },
	selectAll: { key: 'a', ctrl: true },
	clear: { key: 'Escape' },
	up: { key: 'Backspace' },
	upAlt: { key: 'ArrowUp', alt: true },
	undo: { key: 'z', ctrl: true }
} satisfies Record<string, Shortcut>;

/** How a shortcut is shown in a menu (per language) */
export const keyLabel = (s: Shortcut) => shortcutLabel(s, brandMessages().keys);

/**
 * Whether keys meant for the list may act now: the focus is in the list area (`area`) or nowhere in particular –
 * never on a button, link, field or menu (Enter or Space there press it), never with a menu or dialog open.
 */
export function listHasFocus(area: Element | undefined): boolean {
	if (document.querySelector(':popover-open, dialog[open]')) return false;
	const active = document.activeElement;
	if (!active || active === document.body || active === document.documentElement) return true;
	if (!area?.contains(active)) return false;
	return !active.closest('button, a[href], input, select, textarea, [contenteditable], [role="menu"], [role="menuitem"]');
}

/**
 * Runs `global` commands by their shortcuts everywhere (outside text fields) and `list` commands only while the
 * list has the focus (`listHasFocus`). Returns the cleanup.
 */
export function installFilesKeys(area: () => Element | undefined, global: () => readonly Command[], list: () => readonly Command[], target: Window = window) {
	return installCommandKeys(() => (listHasFocus(area()) ? [...global(), ...list()] : global()), target);
}
