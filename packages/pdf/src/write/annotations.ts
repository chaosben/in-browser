// Annotations as PDF objects (source text): the annotation dictionary and its appearance (a form XObject whose box is
// the annotation's `/Rect`, drawn in user space). The appearance decides how every viewer shows it; the other entries
// (`/InkList`, `/L`, `/QuadPoints` …) let viewers edit it and keep its meaning. `ExistingAnnotation` is what an
// annotation of the file says (read by `IncrementalPdf.annotations`), so a tool can edit it and write it back.

/** RGB 0…1 */
export type Rgb = [number, number, number];

export interface NewAnnotation {
	subtype: 'Ink' | 'Square' | 'Circle' | 'Line' | 'Polygon' | 'PolyLine' | 'Highlight' | 'Underline' | 'StrikeOut' | 'Squiggly' | 'Text' | 'FreeText';
	/** Unique name (`/NM`) – how the annotation is found again */
	name: string;
	/** User space [x0, y0, x1, y1] */
	rect: [number, number, number, number];
	color?: Rgb;
	/** Fill of closed shapes (`/IC`) */
	interior?: Rgb;
	/** `/CA` 0…1 */
	opacity?: number;
	/** `/RD` of boxes and ellipses: how far the shape (the middle of its line less half its width) lies inside
	 * `/Rect` – left, top, right, bottom */
	inset?: [number, number, number, number];
	/** Line width and dash pattern (`/BS`) */
	width?: number;
	dash?: number[];
	author?: string;
	/** `/Subj`: what the comment is about (viewers show it as its title; tools write its kind) */
	subject?: string;
	contents?: string;
	modified?: Date;
	/** A review state set on `replyTo` (`/State … /StateModel (Review)`): hidden, an empty appearance */
	state?: ReviewState;
	/** Ink: polylines in user space */
	inkList?: number[][];
	/** Line: x1 y1 x2 y2, its endings (`/None`, `/OpenArrow` …) */
	line?: [number, number, number, number];
	lineEndings?: [string, string];
	/** Polygon, PolyLine: x/y pairs */
	vertices?: number[];
	/** Text markup: 8 numbers per quadrilateral */
	quadPoints?: number[];
	/** Text: the icon (`/Note`, `/Comment` …) and whether its popup is open */
	icon?: string;
	open?: boolean;
	/** FreeText: `/DA` */
	defaultAppearance?: string;
	/** A reply (`/IRT`): the annotation it answers – a ref of the file (`12 0 R`) or the `name` of one written in the
	 * same update before it */
	replyTo?: string;
	/** JSON of what the tool needs to edit it again exactly (`/InBrowser`, other viewers ignore it; non-ASCII is
	 * written as `\u` escapes) */
	data?: string;
	appearance: {
		/** Content stream in user space */
		content: string;
		/** Graphics states it uses by name (`/G0 gs`) */
		states?: Record<string, { alpha?: number; multiply?: boolean }>;
		/** Fonts it uses by name: standard 14 font names (`/Helv` → Helvetica) */
		fonts?: Record<string, string>;
		/** Contents of transparency groups, drawn by the content as `/X0 Do`, `/X1 Do` … (with an opacity set before,
		 * a group is see-through as a whole: overlapping lines in it don't get darker) */
		groups?: string[];
	};
}

/** A number in PDF source: at most 3 decimals, no exponent */
export const num = (n: number): string => {
	const r = Math.round(n * 1000) / 1000;
	return Object.is(r, -0) ? '0' : String(r);
};

const arr = (values: readonly number[]) => `[${values.map(num).join(' ')}]`;

/** A text string: UTF-16BE with byte order mark, in hex (any language) */
export function textString(s: string): string {
	let hex = 'FEFF';
	for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
	return `<${hex}>`;
}

/** Unicode → WinAnsiEncoding of the code points 0x80…0x9F (the rest of 0x20…0xFF is Latin-1) */
const WIN_ANSI: Record<number, number> = {
	0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89,
	0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
	0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f
};

/** Whether a character can be shown in a standard font (WinAnsiEncoding) */
export function inWinAnsi(char: string): boolean {
	const c = char.codePointAt(0) ?? 0;
	return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || c in WIN_ANSI;
}

/** Text for a standard font (`/WinAnsiEncoding`) as a literal string; other characters become `?` */
export function winAnsi(text: string): string {
	let out = '(';
	for (const char of text) {
		const c = char.codePointAt(0) ?? 0;
		const byte = (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) ? c : (WIN_ANSI[c] ?? 0x3f);
		out += byte === 0x28 || byte === 0x29 || byte === 0x5c ? `\\${String.fromCharCode(byte)}` : byte < 0x80 ? String.fromCharCode(byte) : `\\${byte.toString(8)}`;
	}
	return out + ')';
}

/** A PDF date (`D:YYYYMMDDHHmmSSOHH'mm`, any tail missing) as a `Date`; null when it isn't one */
export function parsePdfDate(s: string | undefined): Date | null {
	const m = /^(?:D:)?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Zz+-])?(\d{2})?'?(\d{2})?/.exec(s?.trim() ?? '');
	if (!m) return null;
	const n = (i: number, d: number) => (m[i] ? Number(m[i]) : d);
	const utc = Date.UTC(n(1, 0), n(2, 1) - 1, n(3, 1), n(4, 0), n(5, 0), n(6, 0));
	const sign = m[7] === '+' ? 1 : m[7] === '-' ? -1 : 0;
	const date = new Date(utc - sign * (n(8, 0) * 60 + n(9, 0)) * 60_000);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** A date: `(D:YYYYMMDDHHmmSSZ)` */
export function pdfDate(d: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `(D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z)`;
}

/** An annotation of the file as it is (user space; colors as RGB) */
/** Opacities (0…1) an appearance paints with: its first fill outside text, first stroke, first text */
export interface PaintOpacity {
	fill?: number;
	stroke?: number;
	text?: number;
}

/** A reply of the file: a `/Text` note answering another annotation (`/IRT`) */
export interface ExistingReply {
	ref: string;
	/** The annotation it answers (its ref) */
	parent: string;
	name?: string;
	author?: string;
	subject?: string;
	contents?: string;
	/** `/M` as written */
	modified?: string;
}

/** Review states (the `Review` state model; Acrobat's and PDF-XChange's “Set status”) */
export const REVIEW_STATES = ['None', 'Accepted', 'Rejected', 'Cancelled', 'Completed'] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

/** A review state of the file: a hidden `/Text` with `/State` answering an annotation or a reply (`/IRT`) */
export interface ExistingState {
	ref: string;
	/** What it is set on (its ref) */
	parent: string;
	name?: string;
	author?: string;
	state: ReviewState;
	/** `/M` as written */
	modified?: string;
}

export interface ExistingAnnotation {
	/** Its object (`12 0 R`): where it is written back */
	ref: string;
	/** Its id in PDF.js (`12R`): how it is hidden there while a tool shows it */
	id: string;
	subtype: string;
	rect: [number, number, number, number];
	/** `/RD`: how far the drawn shape lies inside `/Rect` (left, top, right, bottom) */
	inset?: [number, number, number, number];
	/** Missing: none (transparent) */
	color?: Rgb;
	interior?: Rgb;
	opacity: number;
	/** Line width (`/BS` or `/Border`; 1 when missing) and dashes */
	width: number;
	dash?: number[];
	name?: string;
	author?: string;
	subject?: string;
	contents?: string;
	/** `/M` as written */
	modified?: string;
	/** Text: its icon (`/Name`) */
	icon?: string;
	inkList?: number[][];
	line?: [number, number, number, number];
	lineEndings?: string[];
	vertices?: number[];
	quadPoints?: number[];
	/** `/DA` (FreeText: font size and color) */
	/** Opacities its appearance paints with (first fill, stroke, text) – how PDF-XChange & co. keep a see-through
	 * background apart from text and border; on top of them comes `/CA` (`opacity`) */
	paint?: PaintOpacity;
	defaultAppearance?: string;
	/** `/InBrowser`, when the file has it */
	data?: string;
}

/** Keys of an annotation that `annotationObjects` writes or that describe its look: dropped from the old dictionary
 * when an annotation is written anew (whatever else it has – popup, replies, creation date … – stays) */
export const REPLACED_KEYS = [
	'Type', 'Subtype', 'Rect', 'P', 'NM', 'M', 'F', 'AP', 'AS', 'C', 'IC', 'CA', 'ca', 'BS', 'Border', 'BE', 'RD', 'InkList', 'L', 'LE',
	'Vertices', 'QuadPoints', 'Name', 'Open', 'DA', 'InBrowser'
];

/** A literal string of JSON text (other characters than printable ASCII as JSON's `\u` escapes) */
const literal = (s: string) => `(${s.replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).replace(/[()\\]/g, '\\$&')})`;

const NAME = /^[A-Za-z0-9]+$/;

/**
 * The objects of an annotation: [annotation, appearance, its groups …]; the appearance is object `appearance`, the
 * groups follow it. `extra` holds entries
 * of an annotation written anew that stay (PDF source); `T` and `Contents` of it stay when `a` has none.
 */
export function annotationObjects(a: NewAnnotation, appearance: number, pageRef: string, extra = ''): string[] {
	const entries: string[] = [
		'/Type /Annot',
		`/Subtype /${a.subtype}`,
		`/Rect ${arr(a.rect)}`,
		`/P ${pageRef}`,
		`/NM ${textString(a.name)}`,
		`/M ${pdfDate(a.modified ?? new Date())}`,
		// Print; a state is never shown (hidden, not viewed)
		a.state ? '/F 34' : '/F 4',
		`/AP << /N ${appearance} 0 R >>`
	];
	if (a.color) entries.push(`/C ${arr(a.color)}`);
	if (a.interior) entries.push(`/IC ${arr(a.interior)}`);
	if (a.inset) entries.push(`/RD ${arr(a.inset.map((v) => Math.max(0, v)))}`);
	if (a.opacity !== undefined && a.opacity < 1) entries.push(`/CA ${num(a.opacity)}`);
	if (a.width !== undefined) entries.push(`/BS << /W ${num(a.width)}${a.dash?.length ? ` /S /D /D ${arr(a.dash)}` : ''} >>`);
	if (a.author) entries.push(`/T ${textString(a.author)}`);
	if (a.subject) entries.push(`/Subj ${textString(a.subject)}`);
	if (a.state) entries.push(`/State ${textString(a.state)} /StateModel (Review)`);
	if (a.contents) entries.push(`/Contents ${textString(a.contents)}`);
	if (a.inkList) entries.push(`/InkList [${a.inkList.map(arr).join(' ')}]`);
	if (a.line) entries.push(`/L ${arr(a.line)}`);
	if (a.lineEndings) entries.push(`/LE [/${a.lineEndings.filter((e) => NAME.test(e)).join(' /')}]`);
	if (a.vertices) entries.push(`/Vertices ${arr(a.vertices)}`);
	if (a.quadPoints) entries.push(`/QuadPoints ${arr(a.quadPoints)}`);
	if (a.icon && NAME.test(a.icon)) entries.push(`/Name /${a.icon}`);
	if (a.open !== undefined) entries.push(`/Open ${a.open}`);
	if (a.defaultAppearance) entries.push(`/DA (${a.defaultAppearance.replace(/[()\\]/g, '\\$&')})`);
	if (a.data) entries.push(`/InBrowser ${literal(a.data)}`);
	if (extra) entries.push(extra);

	const { content, states = {}, fonts = {}, groups = [] } = a.appearance;
	const resources: string[] = [];
	const gs = Object.entries(states).filter(([name]) => NAME.test(name));
	if (gs.length) {
		resources.push(
			`/ExtGState << ${gs
				.map(
					([name, s]) =>
						`/${name} << /Type /ExtGState${s.alpha !== undefined ? ` /CA ${num(s.alpha)} /ca ${num(s.alpha)}` : ''}${s.multiply ? ' /BM /Multiply' : ''} >>`
				)
				.join(' ')} >>`
		);
	}
	// Standard fonts by name; an embedded one (`unicode.ts`) by its object
	const fs = Object.entries(fonts).filter(([name, base]) => NAME.test(name) && /^([A-Za-z-]+|\d+ \d+ R)$/.test(base));
	if (fs.length) {
		resources.push(
			`/Font << ${fs.map(([name, base]) => (/ R$/.test(base) ? `/${name} ${base}` : `/${name} << /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`)).join(' ')} >>`
		);
	}
	if (groups.length) resources.push(`/XObject << ${groups.map((_, i) => `/X${i} ${appearance + 1 + i} 0 R`).join(' ')} >>`);
	const forms = groups.map(
		(group) =>
			`<< /Type /XObject /Subtype /Form /BBox ${arr(a.rect)} /Group << /S /Transparency >> /Resources << >> /Length ${group.length} >>\n` +
			`stream\n${group}\nendstream`
	);
	const stream = new TextEncoder().encode(content);
	const form =
		`<< /Type /XObject /Subtype /Form /BBox ${arr(a.rect)} /Resources << ${resources.join(' ')} >> /Length ${stream.length} >>\n` +
		`stream\n${content}\nendstream`;
	return [`<< ${entries.join(' ')} >>`, form, ...forms];
}
