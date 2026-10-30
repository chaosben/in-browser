import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

// Look of the editor from the theme's CSS variables only, so light and dark (and switching) just work.
// Syntax colors are the `code-*` roles of packages/brand/theme.css.

const color = (name: string) => `var(--color-${name})`;
const soft = (name: string, percent: number) => `color-mix(in oklch, var(--color-${name}) ${percent}%, transparent)`;

export const editorTheme = EditorView.theme({
	'&': { height: '100%', color: color('base-content'), backgroundColor: color('base-100'), fontSize: 'var(--editor-font-size, 0.875rem)' },
	'&.cm-focused': { outline: 'none' },
	'.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace', lineHeight: '1.5' },
	'.cm-content': { caretColor: color('base-content') },
	'.cm-cursor, .cm-dropCursor': { borderLeftColor: color('base-content') },
	'&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
		{ backgroundColor: soft('selection', 28) },
	'.cm-activeLine': { backgroundColor: soft('base-content', 5) },
	'.cm-selectionMatch': { backgroundColor: soft('selection', 14) },
	'.cm-searchMatch': { backgroundColor: soft('hint', 35), outline: `1px solid ${soft('hint', 70)}` },
	'.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: soft('selection', 40) },
	'&.cm-focused .cm-matchingBracket': { backgroundColor: soft('selection', 22) },
	'&.cm-focused .cm-nonmatchingBracket': { backgroundColor: soft('error', 30) },
	'.cm-gutters': { backgroundColor: color('base-100'), color: soft('base-content', 45), border: 'none' },
	'.cm-activeLineGutter': { backgroundColor: soft('base-content', 5), color: color('base-content') },
	'.cm-foldPlaceholder': { backgroundColor: color('base-200'), border: 'none', color: soft('base-content', 70) },
	'.cm-panels': { backgroundColor: color('base-200'), color: color('base-content') },
	'.cm-panels.cm-panels-top': { borderBottom: `1px solid ${color('base-300')}` },
	'.cm-panels.cm-panels-bottom': { borderTop: `1px solid ${color('base-300')}` },
	'.cm-panel.cm-search': { padding: '0.375rem 2rem 0.375rem 0.5rem', fontSize: '0.8125rem' },
	'.cm-panel.cm-search label': { fontSize: '0.8125rem' },
	'.cm-textfield': {
		backgroundColor: color('base-100'),
		color: color('base-content'),
		border: `1px solid ${color('base-300')}`,
		borderRadius: 'var(--radius-field)',
		padding: '0.125rem 0.375rem',
		fontSize: '0.8125rem'
	},
	'.cm-textfield:focus': { outline: `2px solid ${color('primary')}`, outlineOffset: '-1px' },
	'.cm-button': {
		backgroundImage: 'none',
		backgroundColor: color('base-100'),
		color: color('base-content'),
		border: `1px solid ${color('base-300')}`,
		borderRadius: 'var(--radius-field)',
		padding: '0.125rem 0.5rem',
		fontSize: '0.8125rem'
	},
	'.cm-button:hover': { backgroundColor: color('base-300') },
	'.cm-panel button[name=close]': { color: color('base-content'), fontSize: '1.25rem', right: '0.5rem' },
	'.cm-tooltip': { backgroundColor: color('base-100'), color: color('base-content'), border: `1px solid ${color('base-300')}` }
});

const highlight = HighlightStyle.define([
	{ tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: color('code-keyword') },
	{ tag: [t.string, t.special(t.string), t.regexp, t.character, t.url], color: color('code-string') },
	{ tag: [t.number, t.bool, t.null, t.atom, t.unit], color: color('code-number') },
	{ tag: [t.comment, t.lineComment, t.blockComment, t.docComment, t.meta, t.processingInstruction], color: color('code-comment'), fontStyle: 'italic' },
	{ tag: [t.typeName, t.className, t.namespace, t.tagName, t.standard(t.tagName)], color: color('code-type') },
	{ tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName, t.labelName], color: color('code-function') },
	{ tag: [t.propertyName, t.attributeName, t.definition(t.propertyName)], color: color('code-property') },
	{ tag: t.invalid, color: color('error') },
	// Markdown
	{ tag: t.heading, color: color('code-keyword'), fontWeight: 'bold' },
	{ tag: t.strong, fontWeight: 'bold' },
	{ tag: t.emphasis, fontStyle: 'italic' },
	{ tag: t.strikethrough, textDecoration: 'line-through' },
	{ tag: t.link, color: color('code-function'), textDecoration: 'underline' },
	{ tag: t.monospace, color: color('code-string') },
	{ tag: [t.quote, t.contentSeparator], color: color('code-comment') },
	{ tag: t.list, color: color('code-number') }
]);

export const editorHighlighting = syntaxHighlighting(highlight);
