import { EditorSelection, EditorState, type StateCommand } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { bold, italic } from './commands';

/** Runs the command on `doc` with the selection marked by `[` and `]` (or a cursor `|`); returns the result the same way */
function run(command: StateCommand, marked: string): string {
	let doc = marked;
	let anchor: number;
	let head: number;
	if (marked.includes('|')) {
		anchor = head = marked.indexOf('|');
		doc = marked.replace('|', '');
	} else {
		anchor = marked.indexOf('[');
		head = marked.indexOf(']') - 1;
		doc = marked.replace('[', '').replace(']', '');
	}
	let state = EditorState.create({ doc, selection: EditorSelection.single(anchor, head), extensions: EditorState.allowMultipleSelections.of(true) });
	command({ state, dispatch: (tr) => (state = tr.state) });
	const { from, to } = state.selection.main;
	const text = state.doc.toString();
	return from === to ? text.slice(0, from) + '|' + text.slice(from) : text.slice(0, from) + '[' + text.slice(from, to) + ']' + text.slice(to);
}

describe('toggleInline', () => {
	it('wraps and unwraps the selection', () => {
		expect(run(bold, 'a [word] b')).toBe('a **[word]** b');
		expect(run(bold, 'a **[word]** b')).toBe('a [word] b');
		expect(run(bold, 'a [**word**] b')).toBe('a [word] b');
	});
	it('does not take bold for italic', () => {
		expect(run(italic, '**[word]**')).toBe('***[word]***');
		expect(run(italic, '*[word]*')).toBe('[word]');
	});
});
