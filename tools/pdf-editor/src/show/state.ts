// Where a presentation stands: the page, which of its steps is shown, and whether the screen is black.
// The display holds it and is the only one that decides; controls (the presenter view, a phone) send where to go –
// always as a place, never as “one further” – so a command sent twice or again after a reconnect never skips
// anything. Pure, no DOM.

export interface ShowState {
	/** The page shown (its place, from 0) */
	page: number;
	/** The step shown (0: the page as it comes) */
	step: number;
	/** The screen is black (B): the audience looks at the speaker */
	blank: boolean;
}

/** What the state needs of the PDF: how many pages, and how many steps each takes */
export interface ShowDeck {
	pages: number;
	steps(page: number): number;
}

export const START: ShowState = { page: 0, step: 0, blank: false };

/** A place made valid for the deck (pages and steps within their bounds) */
export function clamp(deck: ShowDeck, to: { page: number; step: number }): { page: number; step: number } {
	if (deck.pages <= 0) return { page: 0, step: 0 };
	const page = Math.min(deck.pages - 1, Math.max(0, Math.floor(to.page)));
	const step = Math.min(deck.steps(page), Math.max(0, Math.floor(to.step)));
	return { page, step };
}

/** Goes to a place (black ends: the audience should see where the speaker went) */
export function go(deck: ShowDeck, state: ShowState, to: { page: number; step: number }): ShowState {
	const place = clamp(deck, to);
	return { ...place, blank: false };
}

/** The place after this one: the next step, else the next page at its start; at the end the same */
export function nextOf(deck: ShowDeck, at: { page: number; step: number }): { page: number; step: number } {
	if (at.step < deck.steps(at.page)) return { page: at.page, step: at.step + 1 };
	if (at.page < deck.pages - 1) return { page: at.page + 1, step: 0 };
	return { page: at.page, step: at.step };
}

/** The place before this one: one step back, else the previous page with all its steps shown */
export function previousOf(deck: ShowDeck, at: { page: number; step: number }): { page: number; step: number } {
	if (at.step > 0) return { page: at.page, step: at.step - 1 };
	if (at.page > 0) return { page: at.page - 1, step: deck.steps(at.page - 1) };
	return { page: at.page, step: at.step };
}

/** Is this the last place of the presentation? */
export const atEnd = (deck: ShowDeck, at: { page: number; step: number }) => at.page >= deck.pages - 1 && at.step >= deck.steps(at.page);

export const sameState = (a: ShowState, b: ShowState) => a.page === b.page && a.step === b.step && a.blank === b.blank;
