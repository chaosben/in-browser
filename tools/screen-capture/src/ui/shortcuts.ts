// Keyboard shortcuts of the editor page (listed in the help topic “Keyboard shortcuts”)

import type { Player } from '#lib/preview/player.svelte.js';
import type { Editor } from '#lib/project/editor.svelte.js';
import type { Timeline } from '#lib/project/types.js';
import { bringForward, bringToFront, sendBackward, sendToBack } from '#lib/timeline/ops.js';
import { inTextField } from '@in-browser/brand/ui/typing.js';

/** Step of ←/→ */
const FRAME = 1 / 30;

/** Changes the stacking order (track) of one item */
export type Arrange = (timeline: Timeline, id: string) => Timeline;

/** Editor actions the shortcuts trigger */
export interface ShortcutActions {
	copy(): void;
	cut(): void;
	paste(): void;
	arrange(op: Arrange): void;
	split(): void;
	holdFrame(): void;
	/** `gap`: leave a gap instead of closing it */
	remove(gap: boolean): void;
}

/** Handles a `keydown` of the window; nothing while typing in a text field */
export function editorShortcut(e: KeyboardEvent, editor: Editor, player: Player, actions: ShortcutActions) {
	if (inTextField(e.target)) return;
	const mod = e.ctrlKey || e.metaKey;
	const key = e.key.toLowerCase();
	if (mod && key === 'z') {
		e.preventDefault();
		if (e.shiftKey) editor.redo();
		else editor.undo();
	} else if (mod && key === 'y') {
		e.preventDefault();
		editor.redo();
	} else if (mod && key === 'g') {
		e.preventDefault();
		if (e.shiftKey) editor.unlink();
		else editor.link();
	} else if ((key === 'c' || key === 'x') && mod && window.getSelection()?.toString()) {
		// Selected text (e.g. in the help): the browser copies it
		return;
	} else if (mod && key === 'c') {
		e.preventDefault();
		actions.copy();
	} else if (mod && key === 'x') {
		e.preventDefault();
		actions.cut();
	} else if (mod && key === 'v') {
		e.preventDefault();
		actions.paste();
	} else if (mod && key === 'a') {
		e.preventDefault();
		editor.selectItems(editor.project.timeline.items.map((item) => item.id));
	} else if (mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && editor.selectedItem) {
		// Track of the selected item (stacking order)
		e.preventDefault();
		const up = e.key === 'ArrowUp';
		actions.arrange(e.shiftKey ? (up ? bringToFront : sendToBack) : up ? bringForward : sendBackward);
	} else if (mod) {
		return;
	} else if (e.key === ' ' || key === 'k') {
		e.preventDefault();
		player.toggle();
	} else if (key === 's') {
		actions.split();
	} else if (key === 'f') {
		actions.holdFrame();
	} else if (e.key === 'Escape') {
		// Ends crop mode first, the clip stays selected
		if (editor.croppingClip) editor.endCrop();
		else editor.selection = null;
	} else if (e.key === 'Delete' || e.key === 'Backspace') {
		actions.remove(e.shiftKey);
	} else if (e.key === 'ArrowLeft') {
		e.preventDefault();
		player.seek(player.time - (e.shiftKey ? 1 : FRAME));
	} else if (e.key === 'ArrowRight') {
		e.preventDefault();
		player.seek(player.time + (e.shiftKey ? 1 : FRAME));
	} else if (e.key === 'Home') {
		player.seek(0);
	} else if (e.key === 'End') {
		player.seek(player.duration);
	}
}
