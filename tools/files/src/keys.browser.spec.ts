import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installFilesKeys } from './keys.js';

// Regression: Enter, Space or Del on a focused button or menu entry pressed it and also ran a file action (opened,
// previewed or deleted the selection).

let area: HTMLElement;
let button: HTMLButtonElement;
let entry: HTMLButtonElement;
let uninstall: () => void;
const run = vi.fn();

beforeEach(() => {
	document.body.innerHTML = `
		<button id="ribbon">New folder</button>
		<div id="area" tabindex="-1"><ul role="listbox"><li role="option">a.txt</li></ul></div>
		<div role="menu" popover="manual"><button id="entry" role="menuitem">Rename</button></div>`;
	area = document.querySelector('#area')!;
	button = document.querySelector('#ribbon')!;
	entry = document.querySelector('#entry')!;
	run.mockReset();
	const keys = (['Enter', ' ', 'Delete'] as const).map((key) => ({ id: key, label: key, icon: '', shortcut: { key }, run }));
	uninstall = installFilesKeys(() => area, () => [], () => keys);
});

afterEach(() => uninstall());

const press = (target: HTMLElement, key: string) =>
	target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

it.each(['Enter', ' ', 'Delete'])('%j acts on the list only while it has the focus', (key) => {
	button.focus();
	expect(press(button, key)).toBe(true); // not prevented: the button gets pressed
	(entry.parentElement as HTMLElement).showPopover();
	entry.focus();
	expect(press(entry, key)).toBe(true);
	expect(run).not.toHaveBeenCalled();
	(entry.parentElement as HTMLElement).hidePopover();
	area.focus();
	expect(press(area, key)).toBe(false);
	expect(run).toHaveBeenCalledOnce();
});
