// The tools of the PDF Editor and their settings, remembered for the next PDF (`pdf-editor:tools`): the ink core's
// (pen, shapes, eraser, select) plus its own: "Hand" (drag to move the
// pages), "Select text" and four tools that mark the text dragged over – highlight, underline, wavy underline, strike
// out – each in a color of its own with an opacity (`pdf-editor:markup`); "Highlight area" drags a box in the
// highlight's color. The core's freehand highlighter ("Highlighter") paints freely, see-through.
// Every color may be see-through (`#rrggbbaa`): marked text, pen strokes, shapes, notes and text boxes. "Note" places
// sticky notes and "Text box" types onto the page (their colors – and the text's size, background and border –
// remembered with the markers').

import { loadJson, storeJson } from '@in-browser/brand/storage.js';
import type { Tool } from '@in-browser/ink/input/controller.js';
import type { MeasureKind, MeasureUnit } from '@in-browser/ink/items.js';
import type { ShapeKind } from '@in-browser/ink/shapes.js';
import { InkTools } from '@in-browser/ink/tools.svelte.js';
import type { MarkKind } from '#lib/render/markup.js';
import { BORDER_WIDTHS, TEXT_ALIGNS, type TextAlign } from '#lib/render/textbox.js';
import { NOTE_ICONS, type NoteIcon } from '#lib/render/note.js';
import { STAMP_NAMES, type StampName, stampEvents } from '#lib/render/stamp.js';

export const MARK_TOOLS: readonly MarkKind[] = ['highlight', 'underline', 'squiggly', 'strikeout'];

/** Tools of the PDF Editor that the ink core doesn't know */
export type EditorTool = 'hand' | 'text' | 'note' | 'textbox' | 'callout' | 'attach' | 'area' | 'stamp' | 'capture' | 'link' | 'insert' | 'replace' | 'content' | MarkKind;

/** The tools that type text onto the page: a text box, or one with a line to what it is about */
export const isTextTool = (tool: string): tool is 'textbox' | 'callout' => tool === 'textbox' || tool === 'callout';

export const isMarkTool = (tool: string): tool is MarkKind => (MARK_TOOLS as readonly string[]).includes(tool);

export const tools = new InkTools<EditorTool>('pdf-editor:tools', ['hand', 'text', 'note', 'textbox', 'callout', 'attach', 'area', 'stamp', 'capture', 'link', 'insert', 'replace', 'content', ...MARK_TOOLS], 'hand', true);

const COLOR = /^#[0-9a-f]{8}$/;
const DEFAULT_COLORS: Record<MarkKind, string> = { highlight: '#facc1580', underline: '#2563ebff', squiggly: '#16a34aff', strikeout: '#dc2626ff' };
const stored = loadJson<{
	colors?: Partial<Record<MarkKind, unknown>>;
	note?: unknown;
	noteIcon?: unknown;
	text?: { color?: unknown; size?: unknown; fill?: unknown; border?: unknown; borderWidth?: unknown; align?: unknown };
	stamp?: { word?: unknown; name?: unknown; custom?: unknown; page?: unknown; info?: unknown; withName?: unknown; withDate?: unknown; withTime?: unknown };
	caret?: unknown;
	icon?: unknown;
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

/** The tools that mark where text should be inserted ("Replace text" strikes out what it replaces) */
export const isCaretTool = (tool: string): tool is 'insert' | 'replace' => tool === 'insert' || tool === 'replace';
/** Color of new insertion marks (and of the strike-out of "Replace text") */
export const caretColor = $state({ value: typeof stored.caret === 'string' && COLOR.test(stored.caret) ? stored.caret : '#2563ebff' });

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
export const textStyle = $state<{ color: string; size: number; fill: string | null; border: string | null; borderWidth: number; align: TextAlign }>({
	color: colorOr(stored.text?.color, '#000000'),
	size: TEXT_SIZES.includes(stored.text?.size as number) ? (stored.text!.size as number) : 12,
	fill: colorOr(stored.text?.fill, null),
	border: colorOr(stored.text?.border, null),
	borderWidth: BORDER_WIDTHS.includes(stored.text?.borderWidth as number) ? (stored.text!.borderWidth as number) : 1,
	align: TEXT_ALIGNS.includes(stored.text?.align as TextAlign) ? (stored.text!.align as TextAlign) : 'left'
});

/** The stamp placed next: a word of the list (`word`: its id, `stamp-words.ts`; a choice remembered before the
 * list existed is a standard name, which is that word's id) – or, with `custom`, a picture file (its path; `page`
 * of a PDF) – and what a text stamp's second line says: the user's name, today's date, the time now (each
 * chosen on its own; none: no second line). A choice remembered as `info` was name and date */
export const stampChoice = $state<{ word: string; custom: string | null; page: number; withName: boolean; withDate: boolean; withTime: boolean }>({
	word: typeof stored.stamp?.word === 'string' ? stored.stamp.word : STAMP_NAMES.includes(stored.stamp?.name as StampName) ? (stored.stamp!.name as StampName) : 'Approved',
	custom: typeof stored.stamp?.custom === 'string' ? stored.stamp.custom : null,
	page: Number.isInteger(stored.stamp?.page) && (stored.stamp!.page as number) > 0 ? (stored.stamp!.page as number) : 0,
	withName: typeof stored.stamp?.withName === 'boolean' ? stored.stamp.withName : stored.stamp?.info === true,
	withDate: typeof stored.stamp?.withDate === 'boolean' ? stored.stamp.withDate : stored.stamp?.info === true,
	withTime: stored.stamp?.withTime === true
});

/** What the shape tool draws while measuring; `calibrate`: a distance that is asked for its real length and not kept */
export type MeasureTool = MeasureKind | 'calibrate';

/** The measuring tool chosen (drawn with the shape tool: a line, an open path, an outline); null: plain shapes.
 * `shape`: the shape that was chosen before, back when measuring ends */
export const measureTool = $state<{ kind: MeasureTool | null; shape: ShapeKind | null }>({ kind: null, shape: null });

const MEASURE_SHAPES: Record<MeasureTool, ShapeKind> = { distance: 'line', perimeter: 'polyline', area: 'freePolygon', calibrate: 'line' };

/** Chooses a measuring tool */
export function measureWith(kind: MeasureTool) {
	measureTool.shape ??= tools.shape;
	measureTool.kind = kind;
	tools.shape = MEASURE_SHAPES[kind];
	choose('shape');
}

/** Ends measuring: the shape tool draws plain shapes again, the kind it drew before */
export function endMeasuring() {
	if (measureTool.shape) tools.shape = measureTool.shape;
	measureTool.kind = measureTool.shape = null;
}

const storedMeasure = loadJson<{ scale?: unknown; unit?: unknown }>('pdf-editor:measure', {});
/** Scale and unit of a PDF that has no measurements yet: the ones used last */
export const measureDefault = $state<{ scale: number; unit: MeasureUnit }>({
	scale: typeof storedMeasure.scale === 'number' && storedMeasure.scale > 0 && Number.isFinite(storedMeasure.scale) ? storedMeasure.scale : 1,
	unit: (['mm', 'cm', 'm', 'in', 'pt'] as const).includes(storedMeasure.unit as MeasureUnit) ? (storedMeasure.unit as MeasureUnit) : 'mm'
});
export function setMeasureDefault(scale: number, unit: MeasureUnit) {
	Object.assign(measureDefault, { scale, unit });
	storeJson('pdf-editor:measure', { scale, unit });
}

/** Chooses the stamp placed next (remembered) */
export function setStamp(choice: Partial<typeof stampChoice>) {
	// Another file starts at its first page unless the choice names one
	if (choice.custom !== undefined && choice.page === undefined) choice = { ...choice, page: 0 };
	Object.assign(stampChoice, choice);
	storeMarkup();
}

/** Color of the next icon: the one an icon was given last (remembered; decided by the user – it used to be the
 * pen's every time). Null until one was set: then the pen's. */
export const iconColor = $state<{ value: string | null }>({ value: colorOr(stored.icon, null) });
stampEvents.recolored = (color) => {
	if (iconColor.value === color) return;
	iconColor.value = color;
	storeMarkup();
};

function storeMarkup() {
	storeJson('pdf-editor:markup', { colors: { ...markColors }, note: noteColor.value, noteIcon: noteIcon.value, text: { ...textStyle }, stamp: { ...stampChoice }, caret: caretColor.value, ...(iconColor.value && { icon: iconColor.value }) });
}

/** Font size of new text boxes (remembered) */
export function setTextSize(size: number) {
	textStyle.size = size;
	storeMarkup();
}

/** How the lines of new text boxes are aligned (remembered) */
export function setTextAlign(align: TextAlign) {
	textStyle.align = align;
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
	isCaretTool(tools.tool) ? caretColor.value : tools.tool === 'area' ? markColors.highlight : isMarkTool(tools.tool) ? markColors[tools.tool] : tools.tool === 'note' ? noteColor.value : isTextTool(tools.tool) ? textStyle.color : tools.ink.color;

/** Sets that color (with its opacity) and remembers it */
export function setInkColor(color: string) {
	if (isMarkTool(tools.tool) || isCaretTool(tools.tool) || tools.tool === 'area' || tools.tool === 'note' || isTextTool(tools.tool)) {
		if (isCaretTool(tools.tool)) caretColor.value = color.length > 7 ? color : `${color}ff`;
		else if (tools.tool === 'area') markColors.highlight = color.length > 7 ? color : `${color}ff`;
		else if (tools.tool === 'note') noteColor.value = color;
		else if (isTextTool(tools.tool)) textStyle.color = color;
		else if (isMarkTool(tools.tool)) markColors[tools.tool] = color.length > 7 ? color : `${color}ff`;
		storeMarkup();
	} else {
		tools.ink.color = color;
		tools.store();
	}
}
