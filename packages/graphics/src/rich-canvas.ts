// Drawing formatted text on a canvas: the lines `layoutRich` laid out, run by run in their style – the same in every
// tool (the PDF Editor's text boxes, Screen Capture's text and callouts).

import { fontCss } from './fonts.js';
import type { RichLine } from './rich-text.js';

/** Where an underline lies below the baseline and how thick it is (× font size) */
export const UNDERLINE = { offset: 0.1, width: 0.06 };

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Draws `lines` with the top left corner of their room at (x, y), in the context's units */
export function drawRichLines(ctx: Ctx, lines: readonly RichLine[], x: number, y: number) {
	ctx.textBaseline = 'alphabetic';
	ctx.textAlign = 'left';
	for (const line of lines) {
		const baseline = y + line.y + line.baseline;
		for (const run of line.runs) {
			ctx.font = fontCss(run.style, run.style.size);
			ctx.fillStyle = run.style.color;
			ctx.fillText(run.text, x + run.x, baseline);
			if (run.style.underline && !run.marker) ctx.fillRect(x + run.x, baseline + run.style.size * UNDERLINE.offset, run.width, run.style.size * UNDERLINE.width);
		}
	}
}
