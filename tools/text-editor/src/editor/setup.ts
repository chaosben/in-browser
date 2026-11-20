import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import {
	defaultKeymap,
	history,
	historyKeymap,
	indentLess,
	indentMore,
	indentWithTab,
	moveLineDown,
	moveLineUp,
	redo,
	selectAll,
	toggleComment,
	undo
} from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from '@codemirror/language';
import { gotoLine, highlightSelectionMatches, openSearchPanel, search, searchKeymap } from '@codemirror/search';
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
import { SHORTCUTS as S, toCmKey } from './shortcuts.js';
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
		// The keys of the page's commands, before CodeMirror's own (Ctrl+G goes to a line here, find next is Enter/F3)
		...(
			[
				[S.undo, undo],
				[S.redo, redo],
				[S.redoAlt, redo],
				[S.find, openSearchPanel],
				[S.replace, openReplace],
				[S.gotoLine, gotoLine],
				[S.selectAll, selectAll],
				[S.toggleComment, toggleComment],
				[S.indent, indentMore],
				[S.outdent, indentLess],
				[S.lineUp, moveLineUp],
				[S.lineDown, moveLineDown]
			] as const
		).map(([shortcut, run]) => ({ key: toCmKey(shortcut), run, preventDefault: true })),
		...defaultKeymap,
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
