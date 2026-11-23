import { describe, expect, it } from 'vitest';
import { changesAt, flipsOf, shownAt, stepLabel, stepsMoved, stepsOf, stepsWithOneBefore, stepsWithout, visibleAt, withFlips, withSteps, withVisibility } from './steps.js';

// When a comment shows while presenting is saved with it: a wrong reading shows the audience what should still be
// hidden (or never shows it).

/** Whether the item shows at the steps 0 … 5 */
const shown = (item: object) => [0, 1, 2, 3, 4, 5].map((s) => visibleAt(item, s));

describe('showing and hiding at steps', () => {
	it.each([
		['appears at step 2', { flips: [0, 2] }, [false, false, true, true, true, true], '2'],
		['is there and goes at step 3', { flips: [3] }, [true, true, true, false, false, false], '–3'],
		['comes, goes and comes again', { flips: [0, 1, 3, 5] }, [false, true, true, false, false, true], '1–3 · 5'],
		['always shows without steps', {}, [true, true, true, true, true, true], ''],
		['reads the earlier “appears at step n”', { step: 2 }, [false, false, true, true, true, true], '2']
	])('%s', (_, item, expected, label) => {
		expect(shown(item)).toEqual(expected);
		expect(stepLabel(item)).toBe(label);
	});

	it('switches from a step on until the next change: coming late takes two switches', () => {
		// Always there → off with the page (off everywhere) → on at step 4: it appears at step 4
		const hidden = withVisibility({ id: 'a' }, 0, false);
		expect(hidden).toEqual({ id: 'a', flips: [0] });
		expect(withVisibility(hidden, 4, true)).toEqual({ id: 'a', flips: [0, 4] });
		// Appearing at 2, shown with the page too: nothing changes any more, the field goes
		expect(withVisibility({ id: 'a', step: 2 }, 0, true)).toEqual({ id: 'a' });
		// Off in the middle reaches to the next change only; one step alone is switched back at the next one
		expect(flipsOf(withVisibility({ id: 'b', flips: [0, 1, 4] }, 2, false))).toEqual([0, 1, 2]);
		expect(flipsOf(withVisibility(withVisibility({ id: 'b' }, 2, false), 3, true))).toEqual([2, 3]);
		expect(withVisibility(hidden, 3, false)).toBe(hidden);
	});

	it('counts a page’s steps by the last change and filters what shows', () => {
		const items = [{ id: 'a' }, { id: 'b', flips: [0, 1] }, { id: 'c', flips: [3] }];
		expect(stepsOf(items)).toBe(3);
		expect(shownAt(items, 0).map((i) => i.id)).toEqual(['a', 'c']);
		expect(shownAt(items, 3).map((i) => i.id)).toEqual(['a', 'b']);
		// Stored lists are tidied: unsorted, a step twice (cancels out), no numbers
		expect(flipsOf({ flips: [4, 1, 1, 'x', 2.7] })).toEqual([2, 4]);
		expect(withFlips({ id: 'a', step: 3, flips: [1] }, [])).toEqual({ id: 'a' });
	});

	// A page of three steps: `a` comes at 1, `b` is there and goes at 2, `c` comes at 2 and goes at 3
	const page = [
		{ id: 'a', flips: [0, 1] },
		{ id: 'b', flips: [2] },
		{ id: 'c', flips: [0, 2, 3] },
		{ id: 'd' }
	];
	const after = (order: number[]) => page.map((item) => flipsOf(withSteps(item, order)));

	it.each([
		['deleting a step moves the later ones up', stepsWithout(3, 1), [[0, 1], [1], [0, 1, 2], []]],
		['deleting the last step drops what changed there', stepsWithout(3, 3), [[0, 1], [2], [0, 2], []]],
		['a step put before another shows the same as the one before it', stepsWithOneBefore(3, 2), [[0, 1], [3], [0, 3, 4], []]],
		['moving a step takes what shows at it along', stepsMoved(3, 1, 2), [[0, 1], [1, 2, 3], [0, 1, 2], []]]
	])('%s', (_, order, expected) => {
		expect(after(order)).toEqual(expected);
	});

	it('never deletes or moves the page as it comes', () => {
		for (const order of [stepsWithout(3, 0), stepsWithOneBefore(3, 0), stepsMoved(3, 0, 2), stepsMoved(3, 2, 0)]) expect(order).toEqual([0, 1, 2, 3]);
	});

	it('names what comes and goes at a step, and keeps an item nothing changes for', () => {
		expect(changesAt(page, 2)).toEqual({ come: [page[2]], go: [page[1]] });
		expect(changesAt(page, 0)).toEqual({ come: [], go: [page[0], page[2]] });
		expect(withSteps(page[3], stepsWithout(3, 1))).toBe(page[3]);
		expect(withSteps(page[1], stepsWithout(3, 3))).toBe(page[1]);
	});
});
