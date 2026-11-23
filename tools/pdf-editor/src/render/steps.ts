// Showing and hiding comments while the PDF is presented. A page is shown in steps: 0 with the page, then one more
// per “Next”. An item starts visible and changes at the steps listed in `flips` (ascending; 0: it starts hidden) –
// `[0, 2]` appears at step 2, `[3]` is there and goes at step 3, `[0, 1, 3, 5]` comes, goes and comes again. Kept on
// the item, so it is saved with it (`/InBrowser`) and travels with every copy; other programs show every comment.

import type { Box } from '@in-browser/ink/geometry.js';
import type { Ctx } from '@in-browser/ink/render/kit.js';

/** The highest step a page can have */
export const MAX_STEP = 99;

/** The steps at which an item changes between shown and hidden (ascending; none: always shown). Reads the earlier
 * `step` (“appears at step n”) too */
export function flipsOf(item: object): number[] {
	const { flips, step } = item as { flips?: unknown; step?: unknown };
	if (Array.isArray(flips)) return tidy(flips);
	return typeof step === 'number' && step >= 1 ? tidy([0, step]) : [];
}

/** Whole steps within the range, ascending; a step named twice changes nothing (it cancels out) */
function tidy(flips: readonly unknown[]): number[] {
	const odd = new Set<number>();
	for (const f of flips) {
		if (typeof f !== 'number' || !Number.isFinite(f)) continue;
		const n = Math.min(MAX_STEP, Math.max(0, Math.floor(f)));
		if (!odd.delete(n)) odd.add(n);
	}
	return [...odd].sort((a, b) => a - b);
}

/** The item changing at these steps (none drops the field) */
export function withFlips<T extends object>(item: T, flips: readonly number[]): T {
	const { step: _, flips: __, ...rest } = item as T & { step?: unknown; flips?: unknown };
	const list = tidy(flips);
	return (list.length ? { ...rest, flips: list } : rest) as T;
}

/** Whether the item shows at `step` of its page */
export function visibleAt(item: object, step: number): boolean {
	let visible = true;
	for (const f of flipsOf(item)) if (f <= step) visible = !visible;
	return visible;
}

/** The item shown or hidden from `step` on, until it changes the next time (the change that came next moves here):
 * an item coming late takes two switches – off with the page, on at its step. One step alone: switch back at the
 * next one */
export function withVisibility<T extends object>(item: T, step: number, visible: boolean): T {
	if (visibleAt(item, step) === visible) return item;
	const flips = flipsOf(item);
	const next = flips.find((f) => f > step);
	return withFlips(item, [...flips.filter((f) => f !== next), step]);
}

/** How many “Next” a page takes: the last step at which one of its items changes */
export function stepsOf(items: readonly object[]): number {
	let most = 0;
	for (const item of items) most = Math.max(most, flipsOf(item).at(-1) ?? 0);
	return most;
}

/**
 * The item on a page whose steps are put in another order: `order` names, for each step of the page from now on,
 * the step it showed until now (`[0, 2, 1]` swaps the steps 1 and 2, `[0, 2]` drops step 1, `[0, 1, 1, 2]` puts a
 * step showing the same before step 2). After the last one the item stays as it is there. The same object when
 * nothing changes for it.
 */
export function withSteps<T extends object>(item: T, order: readonly number[]): T {
	const before = flipsOf(item);
	if (!before.length) return item;
	const flips: number[] = [];
	let visible = true;
	order.forEach((from, step) => {
		const now = visibleAt(item, from);
		if (now !== visible) flips.push(step);
		visible = now;
	});
	return flips.length === before.length && flips.every((f, i) => f === before[i]) ? item : withFlips(item, flips);
}

const upTo = (steps: number) => Array.from({ length: steps + 1 }, (_, i) => i);

/** The orders (`withSteps`) of a page of `steps` steps: without step `n`, with a step showing the same before step
 * `n`, with step `from` at the place `to`. Step 0 – the page as it comes – stays where it is */
export const stepsWithout = (steps: number, n: number) => upTo(steps).filter((i) => i !== n || n < 1);
export const stepsWithOneBefore = (steps: number, n: number) => (n < 1 ? upTo(steps) : upTo(steps).flatMap((i) => (i === n ? [n - 1, n] : [i])));
export function stepsMoved(steps: number, from: number, to: number): number[] {
	const order = upTo(steps);
	if (from < 1 || to < 1 || from > steps || to > steps) return order;
	order.splice(to, 0, ...order.splice(from, 1));
	return order;
}

/** The items that come and that go at `step` of their page (at 0: none come, those hidden from the start go) */
export function changesAt<T extends object>(items: readonly T[], step: number): { come: T[]; go: T[] } {
	const changing = items.filter((item) => flipsOf(item).includes(step));
	return { come: changing.filter((item) => visibleAt(item, step)), go: changing.filter((item) => !visibleAt(item, step)) };
}

/** The items shown at `step` of their page */
export const shownAt = <T extends object>(items: readonly T[], step: number): T[] => items.filter((item) => visibleAt(item, step));

/** An item's steps in short, for its mark: “2” appears at step 2, “–3” goes at step 3, “1–3 · 5” is there from 1
 * to 3 and from 5 on, “–” never; empty when it always shows */
export function stepLabel(item: object): string {
	const flips = flipsOf(item);
	if (!flips.length) return '';
	const spans: string[] = [];
	// Pairs of “from” and “until”; an item starting visible has its first span from the page on
	const at = flips[0] === 0 ? flips.slice(1) : [-1, ...flips];
	for (let i = 0; i < at.length; i += 2) {
		const from = at[i] < 0 ? '' : String(at[i]);
		spans.push(i + 1 < at.length ? `${from}–${at[i + 1]}` : from);
	}
	return spans.length ? spans.join(' · ') : '–';
}

/** Whether the editor marks the steps on the pages (while the panel of the steps is open); never in pictures, print or the presentation */
export const stepView = { shown: false };

/** The mark of an item's steps: a small badge with them in short in the item's top left corner */
export function drawStepMark(ctx: Ctx, label: string, box: Box) {
	if (!stepView.shown || !label) return;
	const h = 14;
	ctx.save();
	ctx.globalCompositeOperation = 'source-over';
	ctx.globalAlpha = 1;
	ctx.setLineDash([]);
	ctx.font = 'bold 9px sans-serif';
	const w = Math.max(h, ctx.measureText(label).width + 8);
	ctx.fillStyle = STEP_COLOR;
	ctx.beginPath();
	ctx.roundRect(box.x0, box.y0, w, h, h / 2);
	ctx.fill();
	ctx.fillStyle = '#ffffff';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(label, box.x0 + w / 2, box.y0 + h / 2 + 0.5);
	ctx.restore();
}

/** The badge's color: a mark of the editor, not of the document (like the boxes of links) */
const STEP_COLOR = '#7c3aed';
