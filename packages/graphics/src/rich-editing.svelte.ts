// The text box being typed into, for the format commands of a tool: while there is one, bold, a font, a list … act on
// what is selected in it (`RichTextEditor.svelte` sets it); without one the tool applies them to its selected boxes.

import type { FullStyle, ListKind, TextStyle } from './rich-text.js';

export interface RichEditing {
	/** What the selected text has in common (a key it differs in is null); for a caret: what typing there takes */
	readonly marks: { [K in keyof FullStyle]: FullStyle[K] | null };
	/** The kind of list all selected paragraphs are items of, else null */
	readonly list: ListKind | null;
	/** Sets formats on the selected text, or for what is typed next at the caret */
	apply(patch: TextStyle): void;
	/** Makes the selected paragraphs items of a list, or plain paragraphs again when they all are of that kind */
	setList(kind: ListKind): void;
	/** Moves the selected paragraphs a level in (1) or out (-1) */
	setLevel(by: number): void;
}

class Editing {
	/** Kept as it is (not made reactive inside: it is compared to tell whose it is) */
	current = $state.raw<RichEditing | null>(null);
}

export const richEditing = new Editing();
