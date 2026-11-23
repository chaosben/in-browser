// Barcodes for every tool: what a code is made of (`BarcodeSpec` – what a tool keeps), the kinds on offer, and the
// code as a vector drawing (an SVG of plain paths – what the PDF Editor embeds as vectors, its text included).
// The codes are made by `bwip-js`, loaded when the first one is asked for.

import { parseColor } from './color.js';

/** What a barcode is made of – a tool keeps this to make the code again or change it */
export interface BarcodeSpec {
	/** The kind's id (`BarcodeType.id`) */
	kind: string;
	text: string;
	/** Color of the bars or modules, `#rrggbb` */
	dark: string;
	/** Color behind them, `#rrggbb`; null: none (see-through) */
	light: string | null;
	/** Error correction, for the kinds that have a choice (`BarcodeType.ecc`); missing: the kind's own */
	ecc?: string;
	/** The content as text below the bars (line codes) */
	showText: boolean;
	/** The light margin a scanner needs around the code */
	quiet: boolean;
}

export const BARCODE_GROUPS = ['matrix', 'retail', 'industry', 'post', 'more'] as const;
export type BarcodeGroup = (typeof BARCODE_GROUPS)[number];

export interface BarcodeType {
	id: string;
	/** Its name – a standard's name, the same in every language unless the texts have one */
	name: string;
	group: BarcodeGroup;
	/** A code of modules in two directions (no text below it) */
	matrix?: true;
	/** The error correction levels to choose from, the first is the default */
	ecc?: readonly string[];
	/** Digits only: phones show the number pad */
	digits?: true;
}

const QR_LEVELS = ['M', 'L', 'Q', 'H'] as const;

/** The kinds with a place in the list; everything else the library draws comes after them (`barcodeTypes`) */
export const BARCODE_TYPES: readonly BarcodeType[] = [
	{ id: 'qrcode', name: 'QR code', group: 'matrix', matrix: true, ecc: QR_LEVELS },
	{ id: 'microqrcode', name: 'Micro QR code', group: 'matrix', matrix: true, ecc: ['L', 'M', 'Q'] },
	{ id: 'datamatrix', name: 'Data Matrix', group: 'matrix', matrix: true },
	{ id: 'datamatrixrectangular', name: 'Data Matrix (rectangular)', group: 'matrix', matrix: true },
	{ id: 'pdf417', name: 'PDF417', group: 'matrix', matrix: true, ecc: ['2', '3', '4', '5', '6', '7', '8'] },
	{ id: 'azteccode', name: 'Aztec', group: 'matrix', matrix: true },
	{ id: 'maxicode', name: 'MaxiCode', group: 'matrix', matrix: true },
	{ id: 'swissqrcode', name: 'Swiss QR code', group: 'matrix', matrix: true },
	{ id: 'ean13', name: 'EAN-13', group: 'retail', digits: true },
	{ id: 'ean8', name: 'EAN-8', group: 'retail', digits: true },
	{ id: 'upca', name: 'UPC-A', group: 'retail', digits: true },
	{ id: 'upce', name: 'UPC-E', group: 'retail', digits: true },
	{ id: 'isbn', name: 'ISBN', group: 'retail' },
	{ id: 'issn', name: 'ISSN', group: 'retail' },
	{ id: 'databaromni', name: 'GS1 DataBar', group: 'retail' },
	{ id: 'databarexpanded', name: 'GS1 DataBar Expanded', group: 'retail' },
	{ id: 'code128', name: 'Code 128', group: 'industry' },
	{ id: 'gs1-128', name: 'GS1-128', group: 'industry' },
	{ id: 'code39', name: 'Code 39', group: 'industry' },
	{ id: 'code39ext', name: 'Code 39 (full ASCII)', group: 'industry' },
	{ id: 'code93', name: 'Code 93', group: 'industry' },
	{ id: 'interleaved2of5', name: 'Interleaved 2 of 5 (ITF)', group: 'industry', digits: true },
	{ id: 'itf14', name: 'ITF-14', group: 'industry', digits: true },
	{ id: 'sscc18', name: 'SSCC-18', group: 'industry' },
	{ id: 'rationalizedCodabar', name: 'Codabar', group: 'industry' },
	{ id: 'code11', name: 'Code 11', group: 'industry' },
	{ id: 'msi', name: 'MSI', group: 'industry', digits: true },
	{ id: 'pzn', name: 'PZN', group: 'industry', digits: true },
	{ id: 'gs1datamatrix', name: 'GS1 Data Matrix', group: 'industry', matrix: true },
	{ id: 'gs1qrcode', name: 'GS1 QR code', group: 'industry', matrix: true, ecc: QR_LEVELS },
	{ id: 'identcode', name: 'Deutsche Post Identcode', group: 'post', digits: true },
	{ id: 'leitcode', name: 'Deutsche Post Leitcode', group: 'post', digits: true },
	{ id: 'onecode', name: 'USPS Intelligent Mail', group: 'post', digits: true },
	{ id: 'postnet', name: 'USPS POSTNET', group: 'post', digits: true },
	{ id: 'royalmail', name: 'Royal Mail 4-State', group: 'post' },
	{ id: 'kix', name: 'KIX (PostNL)', group: 'post' },
	{ id: 'auspost', name: 'Australia Post', group: 'post', digits: true },
	{ id: 'japanpost', name: 'Japan Post', group: 'post' }
];

/** Not kinds of their own: parts of other codes and the library's drawing helpers */
const NOT_OFFERED = new Set(['raw', 'daft', 'symbol', 'flattermarken', 'ean5', 'ean2', 'gs1-cc']);

type Library = typeof import('bwip-js/browser');
let loading: Promise<Library> | null = null;
const library = () => (loading ??= import('bwip-js/browser'));

/** Every kind there is: the listed ones, then what else the library draws (group “more”, by name) */
export async function barcodeTypes(): Promise<BarcodeType[]> {
	const { symbolList } = await library();
	const listed = new Set(BARCODE_TYPES.map((t) => t.id));
	const more = symbolList
		.filter((s) => !listed.has(s.bcid) && !NOT_OFFERED.has(s.bcid))
		.map((s): BarcodeType => ({ id: s.bcid, name: s.desc, group: 'more' }))
		.sort((a, b) => a.name.localeCompare(b.name));
	return [...BARCODE_TYPES, ...more];
}

export const barcodeType = (kind: string): BarcodeType | undefined => BARCODE_TYPES.find((t) => t.id === kind);

export const DEFAULT_BARCODE: BarcodeSpec = { kind: 'qrcode', text: '', dark: '#000000', light: '#ffffff', showText: true, quiet: true };

/** A spec out of something kept (storage, a file): what is valid of it, the rest as the default has it */
export function barcodeSpec(value: unknown): BarcodeSpec {
	const v = (typeof value === 'object' && value ? value : {}) as Record<string, unknown>;
	const hex = (c: unknown) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null);
	return {
		kind: typeof v.kind === 'string' && /^[\w-]{1,40}$/.test(v.kind) ? v.kind : DEFAULT_BARCODE.kind,
		text: typeof v.text === 'string' ? v.text : '',
		dark: hex(v.dark) ?? DEFAULT_BARCODE.dark,
		light: v.light === null ? null : (hex(v.light) ?? DEFAULT_BARCODE.light),
		...(typeof v.ecc === 'string' && /^\w{1,2}$/.test(v.ecc) && { ecc: v.ecc }),
		showText: typeof v.showText === 'boolean' ? v.showText : DEFAULT_BARCODE.showText,
		quiet: typeof v.quiet === 'boolean' ? v.quiet : DEFAULT_BARCODE.quiet
	};
}

/** Why a text can't be a code of a kind; `invalid` with what the library says about it (English) */
export type BarcodeProblem = 'empty' | 'characters' | 'length' | 'checkDigit' | 'invalid';

export interface BarcodePath {
	d: string;
	/** Filled (modules, text) or a line of this width (bars) */
	stroke?: number;
}

export interface BarcodeDrawing {
	/** Size of the whole drawing, the quiet zone included */
	width: number;
	height: number;
	/** Where the code itself starts in it */
	x: number;
	y: number;
	paths: BarcodePath[];
	dark: string;
	light: string | null;
	/** The drawing as an SVG of plain paths */
	svg: string;
}

/** Quiet zone in the library's units (at its scale 2 a bar's module is 2 wide, a matrix module 4): four modules
 * around a matrix code, ten beside a line code and a little above and below */
const QUIET_MATRIX = 16;
const QUIET_LINE = { x: 20, y: 8 };

function problemOf(message: string): { problem: BarcodeProblem; detail?: string } {
	if (/checkdigit|check digit|checksum/i.test(message)) return { problem: 'checkDigit' };
	if (/badlength|toolong|too long|too short|must be \d|digits? long|maximum length/i.test(message)) return { problem: 'length' };
	if (/badcharacter|must contain only|invalid character/i.test(message)) return { problem: 'characters' };
	return { problem: 'invalid', detail: message.replace(/^[\w.-]*#\d+:\s*/, '').replace(/^bwip-js:\s*/, '') };
}

/** The code of a spec as a drawing, or why there is none */
export async function barcodeSvg(spec: BarcodeSpec): Promise<BarcodeDrawing | { problem: BarcodeProblem; detail?: string }> {
	if (!spec.text) return { problem: 'empty' };
	const { toSVG } = await library();
	const type = barcodeType(spec.kind);
	const dark = parseColor(spec.dark).hex;
	const light = spec.light === null ? null : parseColor(spec.light).hex;
	let made: string;
	try {
		made = toSVG({
			bcid: spec.kind,
			text: spec.text,
			scale: 2,
			barcolor: dark.slice(1),
			textcolor: dark.slice(1),
			includetext: spec.showText && !type?.matrix,
			textxalign: 'center',
			...(spec.ecc && type?.ecc?.includes(spec.ecc) && { eclevel: spec.ecc })
		} as Parameters<Library['toSVG']>[0]);
	} catch (e) {
		return problemOf(e instanceof Error ? e.message : String(e));
	}
	const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(made);
	if (!box) return { problem: 'invalid' };
	const paths: BarcodePath[] = [];
	for (const [tag] of made.matchAll(/<path\b[^>]*>/g)) {
		const d = /\sd="([^"]*)"/.exec(tag)?.[1];
		const stroke = /\sstroke-width="([\d.]+)"/.exec(tag)?.[1];
		if (d) paths.push({ d, ...(stroke && { stroke: Number(stroke) }) });
	}
	if (!paths.length) return { problem: 'invalid' };
	const [x, y] = !spec.quiet ? [0, 0] : type?.matrix ? [QUIET_MATRIX, QUIET_MATRIX] : [QUIET_LINE.x, QUIET_LINE.y];
	const width = Number(box[1]) + 2 * x;
	const height = Number(box[2]) + 2 * y;
	const background = light ? `<path d="M0 0h${width}v${height}h${-width}z" fill="${light}"/>` : '';
	const drawn = paths.map((p) => (p.stroke ? `<path d="${p.d}" fill="none" stroke="${dark}" stroke-width="${p.stroke}"/>` : `<path d="${p.d}" fill="${dark}"/>`)).join('');
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${background}<g transform="translate(${x} ${y})">${drawn}</g></svg>`;
	return { width, height, x, y, paths, dark, light, svg };
}

/** How bright a color is (relative luminance, 0…1) */
function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** What may keep a scanner from reading the code as it is set: light on dark, too little contrast, no quiet zone.
 * Without a background the paper counts as white */
export function scanRisk(spec: Pick<BarcodeSpec, 'dark' | 'light' | 'quiet'>): 'inverted' | 'contrast' | 'quiet' | null {
	const dark = luminance(parseColor(spec.dark).hex);
	const light = spec.light === null ? 1 : luminance(parseColor(spec.light).hex);
	if (dark > light) return 'inverted';
	if ((light + 0.05) / (dark + 0.05) < 4) return 'contrast';
	return spec.quiet ? null : 'quiet';
}
