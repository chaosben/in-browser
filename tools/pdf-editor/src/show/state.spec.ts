import { describe, expect, it } from 'vitest';
import { go, nextOf, previousOf, START, type ShowDeck } from './state.js';

// The display decides where a presentation stands; controls send places. A place sent twice (a control that didn't
// hear the answer, one that reconnected) must never skip a step or a slide.

/** Three slides: the second reveals two steps */
const deck: ShowDeck = { pages: 3, steps: (page) => (page === 1 ? 2 : 0) };

describe('where a presentation stands', () => {
	it('goes through every step before the next slide, and back the same way', () => {
		const places = [{ page: 0, step: 0 }];
		for (let i = 0; i < 5; i++) places.push(nextOf(deck, places.at(-1)!));
		expect(places).toEqual([
			{ page: 0, step: 0 },
			{ page: 1, step: 0 },
			{ page: 1, step: 1 },
			{ page: 1, step: 2 },
			{ page: 2, step: 0 },
			// The end stays the end
			{ page: 2, step: 0 }
		]);
		// Back onto a slide shows it with all its steps
		expect(previousOf(deck, { page: 2, step: 0 })).toEqual({ page: 1, step: 2 });
	});

	it('takes a place sent twice as one: nothing is skipped', () => {
		const once = go(deck, START, nextOf(deck, START));
		const twice = go(deck, once, nextOf(deck, START));
		expect(twice).toEqual({ page: 1, step: 0, blank: false });
	});

	it('keeps places within the slides and their steps, and ends a black screen', () => {
		expect(go(deck, { ...START, blank: true }, { page: 7, step: 9 })).toEqual({ page: 2, step: 0, blank: false });
		expect(go(deck, START, { page: 1, step: 9 })).toEqual({ page: 1, step: 2, blank: false });
	});
});
