import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from '@codemirror/language';
import { gotoLine, highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
	crosshairCursor,
	drawSelection,
	dropCursor,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	highlightSpecialChars,
	keymap,
	lineNumbers,
	rectangularSelection
} from '@codemirror/view';
import { m } from '#lib/i18n/index.js';
import { openReplace } from './commands.js';
import { editorHighlighting, editorTheme } from './theme.js';

// The editor's extensions: one state per tab, all with the same setup. Language and word wrap sit in compartments
// so they can change later.

export const languageSlot = new Compartment();
export const wrapSlot = new Compartment();

const base: Extension = [
	lineNumbers(),
	highlightActiveLineGutter(),
	foldGutter(),
	highlightSpecialChars(),
	history(),
	drawSelection(),
	dropCursor(),
	EditorState.allowMultipleSelections.of(true),
	indentOnInput(),
	bracketMatching(),
	closeBrackets(),
	rectangularSelection(),
	crosshairCursor(),
	highlightActiveLine(),
	highlightSelectionMatches(),
	search({ top: true }),
	keymap.of([
		...closeBracketsKeymap,
		...defaultKeymap,
		// Before the search keymap: Ctrl+G goes to a line here (find next is Enter/F3)
		{ key: 'Mod-h', run: openReplace, preventDefault: true },
		{ key: 'Mod-g', run: gotoLine, preventDefault: true },
		...searchKeymap,
		...historyKeymap,
		...foldKeymap,
		indentWithTab
	]),
	EditorState.phrases.of(m.phrases),
	editorTheme,
	editorHighlighting
];

export function wrapping(wrap: boolean): Extension {
	return wrap ? EditorView.lineWrapping : [];
}

export function createState(doc: string, wrap: boolean): EditorState {
	return EditorState.create({ doc, extensions: [base, languageSlot.of([]), wrapSlot.of(wrapping(wrap))] });
}
