import { EditorSelection, EditorState, type StateCommand } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { bold, codeBlock, insertLink, italic, toggleLinePrefix } from './commands';

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
	it('inserts an empty pair at the cursor', () => {
		expect(run(bold, 'a | b')).toBe('a **|** b');
		expect(run(bold, 'a **|** b')).toBe('a | b');
	});
	it('does not take bold for italic', () => {
		expect(run(italic, '**[word]**')).toBe('***[word]***');
		expect(run(italic, '*[word]*')).toBe('[word]');
	});
});

describe('toggleLinePrefix', () => {
	it('adds and removes headings, replacing another level', () => {
		expect(run(toggleLinePrefix('h1'), 'Ti|tle')).toBe('# Ti|tle');
		expect(run(toggleLinePrefix('h1'), '# Ti|tle')).toBe('Ti|tle');
		expect(run(toggleLinePrefix('h2'), '# Ti|tle')).toBe('## Ti|tle');
	});
	it('works on every selected line and skips empty ones', () => {
		expect(run(toggleLinePrefix('bullet'), '[a\n\nb]')).toBe('- [a\n\n- b]');
		expect(run(toggleLinePrefix('bullet'), '[- a\n- b]')).toBe('[a\nb]');
	});
	it('numbers lists and switches list types', () => {
		expect(run(toggleLinePrefix('number'), '[a\nb\nc]')).toBe('1. [a\n2. b\n3. c]');
		expect(run(toggleLinePrefix('task'), '[- a\n1. b]')).toBe('[- [ ] a\n- [ ] b]');
		expect(run(toggleLinePrefix('bullet'), '- [ ] t|ask')).toBe('- t|ask');
	});
	it('keeps the indentation', () => {
		expect(run(toggleLinePrefix('bullet'), '  it|em')).toBe('  - it|em');
	});
});

describe('insertLink and codeBlock', () => {
	it('links the selection or a selected address', () => {
		expect(run(insertLink, 'see [docs] now')).toBe('see [docs](|) now');
		expect(run(insertLink, '[https://example.com]')).toBe('[|](https://example.com)');
		expect(run(insertLink, 'a | b')).toBe('a [|]() b');
	});
	it('fences the selected lines', () => {
		expect(run(codeBlock, '[x = 1\ny = 2]')).toBe('```\n[x = 1\ny = 2]\n```');
	});
});
