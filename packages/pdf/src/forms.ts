// The form fields of a PDF as PDF.js reads them (its widget annotations), and their values in its
// `annotationStorage`: what is set there is how PDF.js draws the pages (`ENABLE_STORAGE`), so a tool shows filled-in
// values without writing the file first. Saving goes through PDF.js too (`filledForm`): it writes the fields as it
// draws them – in the form's own font (`/DA`, `/DR`), sized and placed alike – and `IncrementalPdf` takes its objects
// into the one section (`PdfEdits.form`). So the page on screen and the saved file agree, as in Firefox and Acrobat.

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdf } from './load.js';
import { pdfLib } from './pdf-lib.js';
import { openPdf } from './pdfjs.js';

export type FieldKind = 'text' | 'checkbox' | 'radio' | 'combo' | 'list' | 'button' | 'signature';

/** A field's value: text (text fields, combo boxes: the export value), the state name of the box switched on
 * (check boxes and radio buttons, `Off`: none), the chosen export values (list boxes) */
export type FieldValue = string | readonly string[];

/** One widget of a field (a field may have several: radio buttons, the same field on several pages) */
export interface FormWidget {
	/** PDF.js's annotation id (`12R`) */
	id: string;
	/** Its ref in the file (`12 0 R`) */
	ref: string;
	/** Page of the file (from 0) */
	page: number;
	/** User space [x0, y0, x1, y1] */
	rect: [number, number, number, number];
	/** `/MK /R`: the field turned counter-clockwise (degrees) */
	rotation: number;
	/** Check box and radio button: the state name that switches it on */
	on?: string;
	hidden: boolean;
}

export interface FormField {
	/** Full name (`a.b.c`) – the key of its value */
	name: string;
	kind: FieldKind;
	/** What it asks for (`/TU`, else its name) */
	label: string;
	readOnly: boolean;
	required: boolean;
	value: FieldValue;
	/** Text: several lines, characters in cells (`comb`), at most `maxLen` characters, hidden as typed */
	multiLine: boolean;
	comb: boolean;
	maxLen: number;
	password: boolean;
	/** 0 left, 1 center, 2 right */
	align: 0 | 1 | 2;
	/** Font size (0: fit to the box), the font's name in `/DR` (`Helv` …) and color 0…1 */
	fontSize: number;
	fontName: string;
	color: [number, number, number];
	/** Border width (0: none) */
	border: number;
	/** Combo and list boxes: what can be chosen (`value` is what is written, `label` what is shown) */
	options: { value: string; label: string }[];
	multiSelect: boolean;
	widgets: FormWidget[];
}

interface WidgetData {
	annotationType: number;
	id: string;
	rect: number[];
	rotation?: number;
	fieldType?: string | null;
	fieldName?: string;
	fieldValue?: unknown;
	alternativeText?: string;
	readOnly?: boolean;
	required?: boolean;
	hidden?: boolean;
	checkBox?: boolean;
	radioButton?: boolean;
	pushButton?: boolean;
	exportValue?: string;
	buttonValue?: string;
	multiLine?: boolean;
	comb?: boolean;
	maxLen?: number;
	password?: boolean;
	textAlignment?: number | null;
	defaultAppearanceData?: { fontSize?: number; fontName?: string; fontColor?: ArrayLike<number> };
	borderStyle?: { width?: number };
	options?: { exportValue?: string; displayValue?: string }[];
	combo?: boolean;
	multiSelect?: boolean;
}

const WIDGET = 20;

/** The document's form fields in the order of their first widget (pages, then each page's annotation order); none
 * without a form */
export async function readFields(pdf: PDFDocumentProxy): Promise<FormField[]> {
	const objects = await pdf.getFieldObjects().catch(() => null);
	if (!objects) return [];
	// Pages that hold widgets
	const pages = new Set<number>();
	const lists = (objects instanceof Map ? [...objects.values()] : Object.values(objects)) as { page?: number }[][];
	for (const list of lists) for (const o of list) if (typeof o.page === 'number' && o.page >= 0) pages.add(o.page);
	const fields = new Map<string, FormField>();
	for (const page of [...pages].sort((a, b) => a - b)) {
		const annotations = (await (await pdf.getPage(page + 1)).getAnnotations({ intent: 'display' })) as WidgetData[];
		for (const a of annotations) {
			if (a.annotationType !== WIDGET || !a.fieldName) continue;
			const kind = kindOf(a);
			const on = a.checkBox ? a.exportValue : a.radioButton ? a.buttonValue : undefined;
			const widget: FormWidget = {
				id: a.id,
				ref: refOf(a.id),
				page,
				rect: a.rect as FormWidget['rect'],
				rotation: a.rotation ?? 0,
				on,
				hidden: !!a.hidden
			};
			const known = fields.get(a.fieldName);
			if (known) {
				known.widgets.push(widget);
				// Radio buttons (and check boxes sharing a name): the state of the one switched on
				if ((kind === 'radio' || kind === 'checkbox') && known.value === 'Off' && on && a.fieldValue === on) known.value = on;
				continue;
			}
			const color = a.defaultAppearanceData?.fontColor;
			fields.set(a.fieldName, {
				name: a.fieldName,
				kind,
				label: a.alternativeText || a.fieldName,
				readOnly: !!a.readOnly,
				required: !!a.required,
				value: valueOf(a, kind),
				multiLine: !!a.multiLine,
				comb: !!a.comb,
				maxLen: a.maxLen ?? 0,
				password: !!a.password,
				align: (a.textAlignment ?? 0) === 1 ? 1 : a.textAlignment === 2 ? 2 : 0,
				fontSize: a.defaultAppearanceData?.fontSize ?? 0,
				fontName: a.defaultAppearanceData?.fontName ?? '',
				color: color && color.length >= 3 ? [color[0] / 255, color[1] / 255, color[2] / 255] : [0, 0, 0],
				border: a.borderStyle?.width ?? 1,
				options: (a.options ?? []).map((o) => ({ value: o.exportValue ?? o.displayValue ?? '', label: o.displayValue ?? o.exportValue ?? '' })),
				multiSelect: !!a.multiSelect,
				widgets: [widget]
			});
		}
	}
	return [...fields.values()];
}

function kindOf(a: WidgetData): FieldKind {
	if (a.fieldType === 'Tx') return 'text';
	if (a.fieldType === 'Ch') return a.combo ? 'combo' : 'list';
	if (a.fieldType === 'Sig') return 'signature';
	if (a.checkBox) return 'checkbox';
	if (a.radioButton) return 'radio';
	return 'button';
}

function valueOf(a: WidgetData, kind: FieldKind): FieldValue {
	const v = a.fieldValue;
	if (kind === 'checkbox') return v && v === a.exportValue ? String(v) : 'Off';
	if (kind === 'radio') return v && v === a.buttonValue ? String(v) : 'Off';
	if (kind === 'list') return Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? [v] : [];
	if (Array.isArray(v)) return String(v[0] ?? '');
	return typeof v === 'string' ? v : '';
}

/** `12R` → `12 0 R`, `12R3` → `12 3 R` */
export function refOf(id: string): string {
	const m = /^(\d+)R(\d*)$/.exec(id);
	return m ? `${m[1]} ${m[2] || 0} R` : id;
}

/** What PDF.js draws a widget with for a field's value (`annotationStorage.setValue(widget.id, …)`) */
export function storageValue(
	field: FormField,
	widget: FormWidget,
	value: FieldValue,
	/** The text a form script shows for the value (a number format): PDF.js draws and saves it */
	formatted?: string | null
): { value: string | boolean | string[]; formattedValue?: string } {
	if (field.kind === 'checkbox' || field.kind === 'radio') return { value: typeof value === 'string' && value !== 'Off' && value === widget.on };
	if (field.kind === 'list') return { value: typeof value === 'string' ? [value] : [...value] };
	const text = typeof value === 'string' ? value : (value[0] ?? '');
	return typeof formatted === 'string' ? { value: text, formattedValue: formatted } : { value: text };
}

/**
 * The file as PDF.js saves it with these widgets' values (`storageValue`s by widget id): the original plus PDF.js's
 * update – fields with `/V`, widgets with `/AS` or a new appearance in the form's font, `/NeedAppearances` where the
 * font can't write a value. A document of its own, so nothing else a tool keeps in its storage is saved.
 */
export async function filledForm(base: Uint8Array, values: ReadonlyMap<string, ReturnType<typeof storageValue>>): Promise<Uint8Array> {
	const pdf = await openPdf(base.slice());
	try {
		for (const [id, value] of values) pdf.annotationStorage.setValue(id, value);
		return await pdf.saveDocument();
	} finally {
		await pdf.loadingTask.destroy();
	}
}

/** The form's fonts by their name in `/DR` → `/BaseFont` (without a subset prefix), to show typing in a like font */
export async function formFonts(bytes: Uint8Array): Promise<Map<string, string>> {
	const { PDFDict, PDFName } = await pdfLib();
	const { doc } = await loadPdf(bytes, true);
	const out = new Map<string, string>();
	const form = doc.catalog.lookup(PDFName.of('AcroForm'));
	const dr = form instanceof PDFDict ? form.lookup(PDFName.of('DR')) : undefined;
	const fonts = dr instanceof PDFDict ? dr.lookup(PDFName.of('Font')) : undefined;
	if (!(fonts instanceof PDFDict)) return out;
	for (const [name, ref] of fonts.entries()) {
		const font = doc.context.lookup(ref);
		const base = font instanceof PDFDict ? font.get(PDFName.of('BaseFont')) : undefined;
		if (base instanceof PDFName) out.set(name.decodeText(), base.decodeText().replace(/^[A-Z]{6}\+/, ''));
	}
	return out;
}
