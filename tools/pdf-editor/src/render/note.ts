// Sticky notes: a small icon on the page carrying a comment – saved as `/Text` annotations (the icon as `/Name`, one
// of the PDF standard's seven, the comment as `/Contents`). It stays upright when the page is turned (only where it lies turns along).

import type { Box } from '@in-browser/ink/geometry.js';
import type { Ctx } from '@in-browser/ink/render/kit.js';

export interface NoteItem {
	id: string;
	type: 'note';
	/** Top left corner of the bubble (page points as shown) */
	x: number;
	y: number;
	/** `#rrggbb` */
	color: string;
	/** The comment */
	text: string;
	/** Its icon (missing: `Comment`) */
	icon?: NoteIcon;
	/** A file attached here instead of a note's icon: its key in `attachedFiles`, its name and size in bytes */
	file?: { key: string; name: string; size: number };
}

/** The files of attachment comments by key, as they are written into the PDF (kept apart from the items) */
export const attachedFiles = new Map<string, Uint8Array>();

/** Edge of a note's bubble (points) */
export const NOTE_SIZE = 20;

export const isNote = (item: { readonly id: string }): item is NoteItem => (item as NoteItem).type === 'note';

export const noteBounds = (n: NoteItem): Box => ({ x0: n.x, y0: n.y, x1: n.x + NOTE_SIZE, y1: n.y + NOTE_SIZE });

/** The icons of the PDF standard for notes (`/Name` of a `/Text` annotation); `Comment` is the default */
export const NOTE_ICONS = ['Comment', 'Note', 'Key', 'Help', 'NewParagraph', 'Paragraph', 'Insert'] as const;
export type NoteIcon = (typeof NOTE_ICONS)[number];
export const noteIconOf = (n: NoteItem): NoteIcon => n.icon ?? 'Comment';

/** An icon in a 20 × 20 box: `bodies` filled in the note's color and outlined, `marks` filled with the ink, `lines`
 * stroked with it (x/y pairs each) – the same for the screen and the saved appearance */
export interface IconShape {
	bodies: number[][];
	marks: number[][];
	lines: number[][];
}

/** A circle as a closed polygon */
function circle(cx: number, cy: number, r: number, n = 20): number[] {
	const out: number[] = [];
	for (let i = 0; i < n; i++) out.push(Math.round((cx + r * Math.cos((2 * Math.PI * i) / n)) * 100) / 100, Math.round((cy + r * Math.sin((2 * Math.PI * i) / n)) * 100) / 100);
	return out;
}
const closed = (points: number[]) => [...points, points[0], points[1]];

/** The bubble with its tail (corners cut) */
const BUBBLE = [2, 0, 18, 0, 20, 2, 20, 13, 18, 15, 10, 15, 4, 20, 5, 15, 2, 15, 0, 13, 0, 2];
const SQUARE = [2, 0, 18, 0, 20, 2, 20, 18, 18, 20, 2, 20, 0, 18, 0, 2];

export const NOTE_SHAPES: Record<NoteIcon, IconShape> = {
	Comment: { bodies: [BUBBLE], marks: [], lines: [[4, 4.5, 16, 4.5], [4, 8, 16, 8], [4, 11.5, 12, 11.5]] },
	Note: {
		bodies: [[3, 0, 13, 0, 17, 4, 17, 20, 3, 20]],
		marks: [],
		lines: [[13, 0, 13, 4, 17, 4], [6, 8, 14, 8], [6, 11, 14, 11], [6, 14, 14, 14], [6, 17, 11, 17]]
	},
	Key: {
		bodies: [circle(6, 10, 5.5), [11.2, 8.5, 19.5, 8.5, 19.5, 11.5, 18, 11.5, 18, 14.5, 15.5, 14.5, 15.5, 11.5, 11.2, 11.5]],
		marks: [],
		lines: [closed(circle(4.8, 10, 1.5, 12))]
	},
	Help: {
		bodies: [circle(10, 10, 9.5, 28)],
		marks: [circle(10, 15.2, 1.1, 10)],
		lines: [[6.8, 7.5, 7.4, 5.3, 9, 4.2, 11, 4.2, 12.6, 5.2, 13.2, 7.2, 12.2, 9, 10, 10.4, 10, 12.4]]
	},
	NewParagraph: {
		bodies: [[10, 0.5, 19, 14, 1, 14]],
		marks: [],
		lines: [[4, 19.5, 4, 16, 7.5, 19.5, 7.5, 16], [10, 19.5, 10, 16, 12.2, 16, 13.2, 16.9, 12.2, 17.8, 10, 17.8]]
	},
	Paragraph: {
		bodies: [SQUARE],
		marks: [[10.5, 4, 8, 4, 6, 5.5, 5.5, 7.5, 6, 9.5, 8, 11, 10.5, 11]],
		lines: [[10.5, 4, 10.5, 16.5], [13.5, 4, 13.5, 16.5], [10.5, 4, 15, 4]]
	},
	Insert: { bodies: [[10, 2, 19.5, 17, 15, 17, 10, 9, 5, 17, 0.5, 17]], marks: [], lines: [] }
};

/** A file attachment: a tag with a paper clip */
const PAPERCLIP: IconShape = {
	bodies: [SQUARE],
	marks: [],
	lines: [[12.8, 7.5, 12.8, 13.5, 11.8, 15.5, 9.8, 16.2, 7.8, 15.2, 7, 13.2, 7, 6, 8, 4.4, 9.6, 4, 10.7, 5, 10.7, 12, 10, 12.8, 9.2, 12, 9.2, 7.5]]
};

/** What a note draws: its icon, or the paper clip of a file attachment */
export const noteShape = (n: NoteItem): IconShape => (n.file ? PAPERCLIP : NOTE_SHAPES[noteIconOf(n)]);

/** The icon as polylines in a 24 × 24 box (menus: `MenuAction.glyph`) */
export function noteGlyph(icon: NoteIcon): string[] {
	const { bodies, marks, lines } = NOTE_SHAPES[icon];
	const pts = (p: number[]) => {
		const out: string[] = [];
		for (let i = 0; i < p.length; i += 2) out.push(`${(p[i] + 2).toFixed(1)},${(p[i + 1] + 2).toFixed(1)}`);
		return out.join(' ');
	};
	return [...bodies.map((b) => pts(closed(b))), ...marks.map((b) => pts(closed(b))), ...lines.map(pts)];
}

/** Color of its outline and lines */
export const NOTE_INK = '#1f2937';

/** Draws a note (page points) */
export function drawNote(ctx: Ctx, n: NoteItem) {
	const k = NOTE_SIZE / 20;
	const { bodies, marks, lines } = noteShape(n);
	const path = (p: number[], close: boolean) => {
		ctx.moveTo(n.x + p[0] * k, n.y + p[1] * k);
		for (let i = 2; i < p.length; i += 2) ctx.lineTo(n.x + p[i] * k, n.y + p[i + 1] * k);
		if (close) ctx.closePath();
	};
	ctx.lineWidth = 0.75;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	ctx.strokeStyle = NOTE_INK;
	// Its color (see-through when it says so); the outline stays opaque
	ctx.fillStyle = n.color;
	for (const body of bodies) {
		ctx.beginPath();
		path(body, true);
		ctx.fill();
		ctx.stroke();
	}
	ctx.fillStyle = NOTE_INK;
	for (const mark of marks) {
		ctx.beginPath();
		path(mark, true);
		ctx.fill();
	}
	ctx.beginPath();
	for (const line of lines) path(line, false);
	ctx.stroke();
}
