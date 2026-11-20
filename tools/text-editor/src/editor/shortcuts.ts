import type { Shortcut } from '@in-browser/brand/commands.js';

// The keys of the editor's commands, in one place: the commands of the page (ribbon, menus, `installCommandKeys`)
// and the keymaps of CodeMirror (`setup.ts`, `markdownKeymap`) both take them from here.

export const SHORTCUTS = {
	// Commands on the file also run while typing in the text
	save: { key: 's', ctrl: true, inText: true },
	saveAs: { key: 's', ctrl: true, shift: true, inText: true },
	open: { key: 'o', ctrl: true, inText: true },
	// Ctrl+N and Ctrl+W belong to the browser
	new: { key: 'n', alt: true, inText: true },
	close: { key: 'w', alt: true, inText: true },
	undo: { key: 'z', ctrl: true },
	redo: { key: 'z', ctrl: true, shift: true },
	redoAlt: { key: 'y', ctrl: true },
	find: { key: 'f', ctrl: true },
	replace: { key: 'h', ctrl: true },
	gotoLine: { key: 'g', ctrl: true },
	selectAll: { key: 'a', ctrl: true },
	toggleComment: { key: '/', ctrl: true },
	indent: { key: ']', ctrl: true },
	outdent: { key: '[', ctrl: true },
	lineUp: { key: 'ArrowUp', alt: true },
	lineDown: { key: 'ArrowDown', alt: true },
	bold: { key: 'b', ctrl: true },
	italic: { key: 'i', ctrl: true },
	link: { key: 'k', ctrl: true }
} satisfies Record<string, Shortcut>;

/** The same key in CodeMirror's notation (`Mod-Shift-z`; `Mod` is Ctrl, or ⌘ on Apple devices, as in `matches`) */
export function toCmKey(s: Shortcut): string {
	return [s.ctrl && 'Mod', s.alt && 'Alt', s.shift && 'Shift', s.key].filter(Boolean).join('-');
}
