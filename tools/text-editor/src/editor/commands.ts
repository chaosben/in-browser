import { EditorSelection, Prec, type EditorState, type StateCommand, type TransactionSpec } from '@codemirror/state';
import { keymap, type EditorView } from '@codemirror/view';
import { openSearchPanel } from '@codemirror/search';

// Commands of the toolbar and their shortcuts. Markdown formatting works on the state only (testable without a view).

function apply(state: EditorState, dispatch: (tr: ReturnType<EditorState['update']>) => void, spec: TransactionSpec) {
	dispatch(state.update(spec, { scrollIntoView: true, userEvent: 'input.format' }));
	return true;
}

/** `*` must not mistake bold (`**`) for italic */
function hasMarker(text: string, marker: string, atStart: boolean) {
	if (atStart ? !text.startsWith(marker) : !text.endsWith(marker)) return false;
	if (marker !== '*') return true;
	const double = atStart ? text.startsWith('**') : text.endsWith('**');
	const triple = atStart ? text.startsWith('***') : text.endsWith('***');
	return !double || triple;
}

/** Wraps each selection in `marker` (bold `**`, italic `*`, code `` ` ``); already wrapped → unwraps. */
export function toggleInline(marker: string): StateCommand {
	const n = marker.length;
	return ({ state, dispatch }) =>
		apply(
			state,
			dispatch,
			state.changeByRange((range) => {
				const { from, to } = range;
				const text = state.sliceDoc(from, to);
				const before = state.sliceDoc(Math.max(0, from - 3), from);
				const after = state.sliceDoc(to, to + 3);
				// Selected including the markers
				if (text.length >= 2 * n && hasMarker(text, marker, true) && hasMarker(text, marker, false)) {
					return {
						changes: [
							{ from, to: from + n },
							{ from: to - n, to }
						],
						range: EditorSelection.range(from, to - 2 * n)
					};
				}
				// Markers right around the selection (or around the cursor of an empty pair)
				if (hasMarker(before, marker, false) && hasMarker(after, marker, true)) {
					return {
						changes: [
							{ from: from - n, to: from },
							{ from: to, to: to + n }
						],
						range: EditorSelection.range(from - n, to - n)
					};
				}
				return {
					changes: [
						{ from, insert: marker },
						{ from: to, insert: marker }
					],
					range: EditorSelection.range(from + n, to + n)
				};
			})
		);
}

export type LineKind = 'h1' | 'h2' | 'h3' | 'bullet' | 'number' | 'task' | 'quote';

const PATTERNS = {
	heading: /^#{1,6} /,
	list: /^(?:[-*+] \[[ xX]\] |[-*+] |\d+[.)] )/,
	quote: /^> ?/
};

const SAME: Record<LineKind, RegExp> = {
	h1: /^# /,
	h2: /^## /,
	h3: /^### /,
	bullet: /^[-*+] (?!\[[ xX]\] )/,
	number: /^\d+[.)] /,
	task: /^[-*+] \[[ xX]\] /,
	quote: PATTERNS.quote
};

/** What a new prefix of this kind replaces (other heading levels, other list types) */
const REPLACES: Record<LineKind, RegExp> = {
	h1: PATTERNS.heading,
	h2: PATTERNS.heading,
	h3: PATTERNS.heading,
	bullet: PATTERNS.list,
	number: PATTERNS.list,
	task: PATTERNS.list,
	quote: PATTERNS.quote
};

function prefix(kind: LineKind, index: number) {
	return { h1: '# ', h2: '## ', h3: '### ', bullet: '- ', number: `${index + 1}. `, task: '- [ ] ', quote: '> ' }[kind];
}

/**
 * Heading, list, task or quote for every line touched by the selection; if they all have it already, it is
 * removed. Other heading levels and list types are replaced, numbered lists are counted up.
 */
export function toggleLinePrefix(kind: LineKind): StateCommand {
	return ({ state, dispatch }) => {
		const lines = new Map<number, { from: number; text: string }>();
		for (const range of state.selection.ranges) {
			for (let pos = range.from; pos <= range.to; ) {
				const line = state.doc.lineAt(pos);
				lines.set(line.number, { from: line.from, text: line.text });
				pos = line.to + 1;
			}
		}
		const all = [...lines.values()];
		// Empty lines in a multi-line selection are left alone
		const targets = all.length > 1 ? all.filter((l) => l.text.trim()) : all;
		const split = (text: string) => {
			const indent = /^\s*/.exec(text)![0];
			return { indent, rest: text.slice(indent.length) };
		};
		const remove = targets.length > 0 && targets.every((l) => SAME[kind].test(split(l.text).rest));
		const changes = targets.map((line, i) => {
			const { indent, rest } = split(line.text);
			const start = line.from + indent.length;
			const old = (remove ? SAME[kind] : REPLACES[kind]).exec(rest)?.[0] ?? '';
			return { from: start, to: start + old.length, insert: remove ? '' : prefix(kind, i) };
		});
		return apply(state, dispatch, { changes });
	};
}

/** Link around the selection: `[text](|)`; a selected address becomes `[|](address)` */
export const insertLink: StateCommand = ({ state, dispatch }) =>
	apply(
		state,
		dispatch,
		state.changeByRange(({ from, to }) => {
			const text = state.sliceDoc(from, to);
			if (/^https?:\/\/\S+$/.test(text)) {
				return { changes: { from, to, insert: `[](${text})` }, range: EditorSelection.cursor(from + 1) };
			}
			const cursor = text ? from + text.length + 3 : from + 1;
			return { changes: { from, to, insert: `[${text}]()` }, range: EditorSelection.cursor(cursor) };
		})
	);

/** Fenced code block around the lines of the main selection */
export const codeBlock: StateCommand = ({ state, dispatch }) => {
	const range = state.selection.main;
	const first = state.doc.lineAt(range.from);
	const last = state.doc.lineAt(range.to);
	return apply(state, dispatch, {
		changes: [
			{ from: first.from, insert: '```\n' },
			{ from: last.to, insert: '\n```' }
		],
		selection: range.empty ? EditorSelection.cursor(range.from + 4) : EditorSelection.range(first.from + 4, last.to + 4)
	});
};

export const bold = toggleInline('**');
export const italic = toggleInline('*');
export const inlineCode = toggleInline('`');

/** Search panel with the focus in the replace field */
export function openReplace(view: EditorView) {
	openSearchPanel(view);
	requestAnimationFrame(() => view.dom.querySelector<HTMLInputElement>('.cm-search [name=replace]')?.focus());
	return true;
}

/** Shortcuts of the Markdown formatting (before the default ones: Ctrl+I would select the syntax parent) */
export const markdownKeymap = Prec.high(
	keymap.of([
		{ key: 'Mod-b', run: bold },
		{ key: 'Mod-i', run: italic },
		{ key: 'Mod-k', run: insertLink, preventDefault: true }
	])
);
