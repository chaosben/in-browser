// What the inputs over form fields need to look like the field: its box upright, the font size PDF.js gives its text
// (`/DA`'s, or fitted like PDF.js's `_computeFontSize` – the page and the saved file show it so), a CSS font like the
// form's (`/DR`), and the box on its page as shown.

import type { FieldValue, FormField, FormWidget } from '@in-browser/pdf/forms.js';
import { pageTransform, toShown } from '@in-browser/pdf/geometry.js';
import { textWidth } from '#lib/render/textbox.js';

/** PDF.js's space around a field's text: 1 point top and bottom, 2 left and right; its line height factor */
export const FIELD_PAD_V = 1;
export const FIELD_PAD_H = 2;
const LINE_FACTOR = 1.35;
/** Font size of multi-line fields set to fit until the text needs less (PDF.js starts there too) */
const AUTO_MULTILINE = 12;

/** The widget's own box (upright as its text runs: `/MK /R` turned back) */
export function boxOf(widget: FormWidget): { w: number; h: number } {
	const [x0, y0, x1, y1] = widget.rect;
	const [w, h] = [Math.abs(x1 - x0), Math.abs(y1 - y0)];
	return widget.rotation % 180 ? { w: h, h: w } : { w, h };
}

/** The text a field shows for a value (a combo box: its option's label; a password: stars) */
export function shownText(field: FormField, value: FieldValue): string {
	const v = typeof value === 'string' ? value : (value[0] ?? '');
	if (field.kind === 'combo') return field.options.find((o) => o.value === v)?.label ?? v;
	if (field.password) return '*'.repeat(v.length);
	return field.multiLine ? v : v.replace(/[\r\n]+/g, ' ');
}

/** The font size of a widget's text: `/DA`'s, else fitted like PDF.js does (one line: height and width; several:
 * as many lines of 12 points as fit, smaller when there are more) */
export function fontSizeOf(field: FormField, widget: FormWidget, text: string): number {
	if (field.fontSize > 0) return field.fontSize;
	const { w, h } = boxOf(widget);
	const height = h - 2 * FIELD_PAD_V;
	if (field.multiLine) {
		const lines = Math.max(Math.round(height / (AUTO_MULTILINE * LINE_FACTOR)), text.split(/\r\n?|\n/).length, 1);
		return Math.max(1, Math.floor((height / lines / LINE_FACTOR) * 100) / 100);
	}
	const size = height / LINE_FACTOR;
	const width = text ? textWidth(text, size) : 0;
	const fit = width > 0 ? (size * (w - 2 * FIELD_PAD_H)) / width : size;
	return Math.max(1, Math.floor(Math.min(size, fit) * 100) / 100);
}

/** A CSS font family like the form's font (its `/BaseFont`): Helvetica and Arial in the editor's sans (their metrics),
 * Times and Courier as serif and monospace, others by their name if the device has them */
export function cssFontOf(base: string | undefined): string {
	const sans = 'PdfEditorSans, Arial, Helvetica, sans-serif';
	if (!base) return sans;
	const name = base.replace(/[,-].*$/, '');
	if (/helv|arial|sans/i.test(base) && !/serif/i.test(base.replace(/sans/i, ''))) return sans;
	if (/times|roman|serif|tiro/i.test(base)) return `"Times New Roman", Times, serif`;
	if (/cour|mono/i.test(base)) return `"Courier New", Courier, monospace`;
	return `"${name.replace(/(?<=[a-z])(?=[A-Z])/g, ' ')}", "${name}", ${sans}`;
}

/** The widget's box on its page as shown (page points, rotation applied) */
export function shownBox(widget: FormWidget, page: { view: readonly number[]; rotate: number }): { x: number; y: number; w: number; h: number } {
	const t = toShown(pageTransform(page.view, page.rotate));
	const [x0, y0, x1, y1] = widget.rect;
	const [ax, ay] = t(x0, y0);
	const [bx, by] = t(x1, y1);
	return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
}

/** Equal values (lists in order) */
export const sameValue = (a: FieldValue, b: FieldValue) => (typeof a === 'string' || typeof b === 'string' ? a === b : a.length === b.length && a.every((v, i) => v === b[i]));
