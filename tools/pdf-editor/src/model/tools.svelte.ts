// The tools of the PDF Editor and their settings, remembered for the next PDF (`pdf-editor:tools`): the ink core's
// (pen, shapes, eraser, select – the same settings and behaviour as in Notes) plus its own: "Hand" (drag to move the
// pages), "Select text" and three tools that mark the text dragged over – highlight, underline, strike out – each in
// a color of its own with an opacity (`pdf-editor:markup`). The core's freehand highlighter isn't offered here.
// Every color may be see-through (`#rrggbbaa`): marked text, pen strokes, shapes, notes and text boxes. "Note" places
// sticky notes and "Text box" types onto the page (their colors – and the text's size, background and border –
// remembered with the markers').

import { loadJson, storeJson } from '@in-browser/brand/storage.js';
import type { Tool } from '@in-browser/ink/input/controller.js';
import { InkTools } from '@in-browser/ink/tools.svelte.js';
import type { MarkKind } from '#lib/render/markup.js';
import { BORDER_WIDTHS } from '#lib/render/textbox.js';
import { NOTE_ICONS, type NoteIcon } from '#lib/render/note.js';

export const MARK_TOOLS: readonly MarkKind[] = ['highlight', 'underline', 'strikeout'];

/** Tools of the PDF Editor that the ink core doesn't know */
export type EditorTool = 'hand' | 'text' | 'note' | 'textbox' | MarkKind;

export const isMarkTool = (tool: string): tool is MarkKind => (MARK_TOOLS as readonly string[]).includes(tool);

export const tools = new InkTools<EditorTool>('pdf-editor:tools', ['hand', 'text', 'note', 'textbox', ...MARK_TOOLS], 'hand', true);
if (tools.tool === 'highlighter') tools.tool = 'highlight';

const COLOR = /^#[0-9a-f]{8}$/;
const DEFAULT_COLORS: Record<MarkKind, string> = { highlight: '#facc1580', underline: '#2563ebff', strikeout: '#dc2626ff' };
const stored = loadJson<{
	colors?: Partial<Record<MarkKind, unknown>>;
	note?: unknown;
	noteIcon?: unknown;
	text?: { color?: unknown; size?: unknown; fill?: unknown; border?: unknown; borderWidth?: unknown };
}>('pdf-editor:markup', {});
/** A color, optionally with its opacity */
const ANY = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;
const colorOr = <T>(v: unknown, fallback: T): string | T => (typeof v === 'string' && ANY.test(v) ? v : fallback);

/** Colors (with opacity) of the tools that mark text */
export const markColors = $state(
	Object.fromEntries(MARK_TOOLS.map((kind) => [kind, typeof stored.colors?.[kind] === 'string' && COLOR.test(stored.colors[kind] as string) ? stored.colors[kind] : DEFAULT_COLORS[kind]])) as Record<
		MarkKind,
		string
	>
);

/** Color and icon of new notes */
export const noteColor = $state({ value: colorOr(stored.note, '#fcd34d') });
export const noteIcon = $state<{ value: NoteIcon }>({ value: NOTE_ICONS.includes(stored.noteIcon as NoteIcon) ? (stored.noteIcon as NoteIcon) : 'Comment' });

/** Icon of new notes (remembered) */
export function setNoteIcon(icon: NoteIcon) {
	noteIcon.value = icon;
	storeMarkup();
}

/** Text color, font size, background and border of new text boxes */
export const TEXT_SIZES = [8, 10, 12, 14, 18, 24, 32, 48];
export const textStyle = $state<{ color: string; size: number; fill: string | null; border: string | null; borderWidth: number }>({
	color: colorOr(stored.text?.color, '#000000'),
	size: TEXT_SIZES.includes(stored.text?.size as number) ? (stored.text!.size as number) : 12,
	fill: colorOr(stored.text?.fill, null),
	border: colorOr(stored.text?.border, null),
	borderWidth: BORDER_WIDTHS.includes(stored.text?.borderWidth as number) ? (stored.text!.borderWidth as number) : 1
});

function storeMarkup() {
	storeJson('pdf-editor:markup', { colors: { ...markColors }, note: noteColor.value, noteIcon: noteIcon.value, text: { ...textStyle } });
}

/** Font size of new text boxes (remembered) */
export function setTextSize(size: number) {
	textStyle.size = size;
	storeMarkup();
}

/** Background and border of new text boxes (remembered) */
export function setTextBoxStyle(style: Partial<Pick<typeof textStyle, 'fill' | 'border' | 'borderWidth'>>) {
	Object.assign(textStyle, style);
	storeMarkup();
}

/** Picks a tool (remembered) */
export function choose(tool: Tool | EditorTool) {
	tools.tool = tool;
	tools.store();
}

/** The color of what the chosen tool draws next (with its opacity): the marking tool's, the note's, the text box's, else
 * the pen's or the shapes' (each remembered) */
export const inkColor = (): string =>
	isMarkTool(tools.tool) ? markColors[tools.tool] : tools.tool === 'note' ? noteColor.value : tools.tool === 'textbox' ? textStyle.color : tools.ink.color;

/** Sets that color (with its opacity) and remembers it */
export function setInkColor(color: string) {
	if (isMarkTool(tools.tool) || tools.tool === 'note' || tools.tool === 'textbox') {
		if (tools.tool === 'note') noteColor.value = color;
		else if (tools.tool === 'textbox') textStyle.color = color;
		else if (isMarkTool(tools.tool)) markColors[tools.tool] = color.length > 7 ? color : `${color}ff`;
		storeMarkup();
	} else {
		tools.ink.color = color;
		tools.store();
	}
}
