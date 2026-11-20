// Arrow keys move the selection (`ui.md`): 1 page point, with Shift 10, without snapping; a key sequence – from the
// first arrow pressed until the last one is let go – is one undo step. Held keys repeat (unlike command shortcuts).

import { inTextField } from '@in-browser/brand/ui/typing.js';

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export interface Nudgeable {
	readonly active: boolean;
	nudge(dx: number, dy: number): void;
	endNudge(): void;
}

/** Moves the selection with the arrow keys (outside text fields, never while a modal dialog is open); returns the cleanup */
export function installNudgeKeys(selection: () => Nudgeable | null | undefined, target: Window = window): () => void {
	const held = new Set<string>();
	const end = () => {
		held.clear();
		selection()?.endNudge();
	};
	const keydown = (e: KeyboardEvent) => {
		const step = ARROWS[e.key];
		if (!step) {
			// Anything else (undo, delete …) works on the items put down
			if (held.size) end();
			return;
		}
		const s = selection();
		if (!s?.active || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
		if (inTextField(e.target) || document.querySelector('dialog[open]:modal')) return;
		e.preventDefault();
		held.add(e.key);
		const by = e.shiftKey ? 10 : 1;
		s.nudge(step[0] * by, step[1] * by);
	};
	const keyup = (e: KeyboardEvent) => {
		if (!held.delete(e.key) || held.size) return;
		selection()?.endNudge();
	};
	target.addEventListener('keydown', keydown);
	target.addEventListener('keyup', keyup);
	target.addEventListener('blur', end);
	return () => {
		target.removeEventListener('keydown', keydown);
		target.removeEventListener('keyup', keyup);
		target.removeEventListener('blur', end);
		end();
	};
}
