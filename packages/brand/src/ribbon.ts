// The ribbon (`Ribbon.svelte`): tabs with labeled groups of commands, modeled on the ribbon of Microsoft Office and
// the tabbed notebook bar of LibreOffice. Here the parts without UI: its description, how groups shrink when room
// runs out, and the access keys shown with Alt.

import type { Snippet } from 'svelte';
import type { Command } from './commands.js';

/** How a group is shown: large buttons (icon over label), medium (icon and label in rows), small (icons in rows), collapsed (one button opening the group) */
export type GroupSize = 0 | 1 | 2 | 3;
export const LARGE: GroupSize = 0;
export const MEDIUM: GroupSize = 1;
export const SMALL: GroupSize = 2;
export const COLLAPSED: GroupSize = 3;

/** Something else than a button in a group (a zoom field, a color field); `size` is the group's */
export interface RibbonCustom {
	id: string;
	/** Name, for the collapsed group and assistive technology */
	label: string;
	custom: Snippet<[GroupSize]>;
}

export type RibbonItem = Command | RibbonCustom;

export interface RibbonGroup {
	id: string;
	label: string;
	items: RibbonItem[];
	/** The small arrow in the group's corner: opens what belongs to the group (a panel, a dialog) */
	launcher?: Command;
}

export interface RibbonTab {
	id: string;
	label: string;
	groups: RibbonGroup[];
	/** Shown only for the current object (e.g. a selected shape), set off in color, after the other tabs */
	contextual?: boolean;
	/** Contextual tabs: is there something to show it for? (read reactively) */
	visible?: () => boolean;
	/** Contextual tabs: the ribbon switches to it when it comes (default); false while it isn't there for an object
	 * (it shows a tool's settings, nothing is picked) – it switches once this turns true */
	follow?: () => boolean;
}

/** How the ribbon shows its commands: groups with labels, one compact row, or one row of icons only */
export type RibbonMode = 'classic' | 'simplified' | 'minimal';
export const RIBBON_MODES: readonly RibbonMode[] = ['classic', 'simplified', 'minimal'];

/**
 * What is kept of the ribbon's display – for all tools of this device (`RIBBON_KEY`). `mode` only once the user
 * chose one: until then it follows the device (`defaultMode`). `collapsed` is apart from it: everything but the
 * tabs is hidden, a tab opens its commands over the page.
 */
export interface RibbonSettings {
	mode?: RibbonMode;
	collapsed?: boolean;
}
export const RIBBON_KEY = 'brand:ribbon';

/** Without a choice: icons only where fingers point or room is short, the full ribbon elsewhere */
export const defaultMode = (compact: boolean): RibbonMode => (compact ? 'minimal' : 'classic');

/**
 * The kept display: `suite` is what is stored under `RIBBON_KEY`; without it, once, what `tool` kept under its own
 * key before the display became the suite's (its display “tabs only” was the collapsed ribbon).
 */
export function ribbonSettings(suite: unknown, tool: unknown): RibbonSettings {
	const from = (suite && typeof suite === 'object' ? suite : tool && typeof tool === 'object' ? tool : {}) as { mode?: unknown; collapsed?: unknown };
	const mode = RIBBON_MODES.find((m) => m === from.mode);
	return { ...(mode ? { mode } : {}), collapsed: from.collapsed === true || from.mode === 'tabs' };
}

export const isCustom = (item: RibbonItem): item is RibbonCustom => 'custom' in item;

/**
 * Sizes of the groups so they fit into `available` pixels: in rounds, every group in `order` one size smaller
 * (large → medium → small → collapsed) until it fits – a size only where it saves room (a group of a few icons can
 * be narrower than its collapsed button). `widths[g][size]` are the measured widths; `gap` is the room between two
 * groups. What doesn't fit even then scrolls.
 */
export function fitGroups(widths: readonly (readonly number[])[], available: number, order: readonly number[], gap = 0): GroupSize[] {
	const sizes = widths.map(() => LARGE) as GroupSize[];
	const total = () => sizes.reduce<number>((sum, size, g) => sum + widths[g][size], 0) + gap * Math.max(0, widths.length - 1);
	for (let size = MEDIUM; size <= COLLAPSED; size++) {
		for (const g of order) {
			if (total() <= available) return sizes;
			if (widths[g][size] < widths[g][sizes[g]]) sizes[g] = size as GroupSize;
		}
	}
	return sizes;
}

/** Order in which groups shrink: from the right (the first groups hold what is used most) */
export const shrinkOrder = (count: number): number[] => Array.from({ length: count }, (_, i) => count - 1 - i);

/**
 * Access keys for labels (shown while Alt is held or after F10): the first letter where it is free, else another
 * letter of the label, else two letters. Unique within the list; `taken` are keys already in use.
 */
export function keyTips(labels: readonly string[], taken: Iterable<string> = []): string[] {
	const used = new Set([...taken].map((k) => k.toUpperCase()));
	const tips: string[] = [];
	for (const label of labels) {
		const letters = [...label.toUpperCase()].filter((c) => /[\p{L}\p{N}]/u.test(c));
		let tip = letters.find((c) => !used.has(c));
		if (!tip) {
			const first = letters[0] ?? 'X';
			for (let i = 1; !tip; i++) {
				const second = letters[i] ?? String(i);
				if (!used.has(first + second)) tip = first + second;
			}
		}
		used.add(tip);
		tips.push(tip);
	}
	return tips;
}
