// Commands: every action of a tool described once – its name, icon, shortcut, when it is possible – and placed in the
// ribbon, menus and keyboard handling from there. A new function is a new command plus its place in the ribbon.

import { inTextField } from './ui/typing.js';
import type { MenuEntry } from './ui/context-menu.svelte.js';

/** A key with modifiers; `ctrl` means Ctrl, or ⌘ on Apple devices */
export interface Shortcut {
	/** `KeyboardEvent.key`, compared without case for letters (e.g. `z`, `Delete`, `F2`, `+`) */
	key: string;
	ctrl?: boolean;
	shift?: boolean;
	alt?: boolean;
	/** Also while typing in a text field or editor (commands on the file: save, open, close) */
	inText?: boolean;
}

export interface Command {
	id: string;
	/** Visible name (from the tool's texts) */
	label: string;
	/** Full icon class, e.g. `icon-[material-symbols-light--undo]` */
	icon: string;
	/** Longer explanation for the tooltip */
	tip?: string;
	shortcut?: Shortcut;
	/** Possible now? (read reactively) */
	enabled?: () => boolean;
	/** A switch that is on now (tools, view options) */
	active?: () => boolean;
	/** Without `run` but with `menu`: a button that only opens its menu */
	run?: () => void;
	/** Choices: with `run` a split button (the button runs, the arrow opens), without one a menu button */
	menu?: () => MenuEntry[];
}

const APPLE = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Does a key event press this shortcut? */
export function matches(e: KeyboardEvent, s: Shortcut): boolean {
	const ctrl = APPLE ? e.metaKey : e.ctrlKey;
	if (!!s.ctrl !== ctrl || !!s.alt !== e.altKey) return false;
	// Shifted characters (`+`, `?`) come with Shift on some layouts: only letters and named keys compare it
	const letter = s.key.length === 1 && /\p{L}/u.test(s.key);
	if ((letter || s.key.length > 1) && !!s.shift !== e.shiftKey) return false;
	if (!letter) return e.key === s.key;
	if (e.key.toLowerCase() === s.key.toLowerCase()) return true;
	// Option+letter on a Mac types another character (Option+N: a dead key): the key's place decides then
	return APPLE && e.altKey && /^[a-z]$/i.test(s.key) && e.code === `Key${s.key.toUpperCase()}`;
}

/** Names of keys in the user's language (`keys` of the brand texts) */
export interface KeyNames {
	ctrl: string;
	shift: string;
	alt: string;
	named: Record<string, string>;
}

/** How a shortcut is shown, e.g. `Ctrl+Shift+Z` / `Strg+Umschalt+Z` (⌘ on Apple devices) */
export function shortcutLabel(s: Shortcut, names: KeyNames): string {
	const parts: string[] = [];
	if (s.ctrl) parts.push(APPLE ? '⌘' : names.ctrl);
	if (s.alt) parts.push(APPLE ? '⌥' : names.alt);
	if (s.shift) parts.push(APPLE ? '⇧' : names.shift);
	parts.push(names.named[s.key] ?? (s.key.length === 1 ? s.key.toUpperCase() : s.key));
	return parts.join(APPLE ? '' : '+');
}

/**
 * Runs commands by their shortcuts (outside text fields unless `inText`, never while a modal dialog is open). `commands` is read on
 * every key press, so it may change (e.g. contextual commands). Returns the cleanup.
 */
export function installCommandKeys(commands: () => readonly Command[], target: Window = window): () => void {
	const onKey = (e: KeyboardEvent) => {
		if (e.defaultPrevented || e.repeat && !e.ctrlKey) return;
		if (document.querySelector('dialog[open]:modal')) return;
		const typing = inTextField(e.target);
		for (const c of commands()) {
			if (!c.shortcut || !c.run || (typing && !c.shortcut.inText) || !matches(e, c.shortcut)) continue;
			e.preventDefault();
			if (c.enabled?.() !== false) c.run();
			return;
		}
	};
	target.addEventListener('keydown', onKey);
	return () => target.removeEventListener('keydown', onKey);
}
