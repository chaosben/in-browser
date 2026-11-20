// Where a highlight lies over the text it marks (pure, so it is tested without PDF.js).

import type { Box } from '@in-browser/ink/geometry.js';

/** A highlight's reach above and below the baseline (× the font size) when the font doesn't tell */
const ASCENT = 0.9;
const DESCENT = 0.2;
/** Beyond the first and last letter (× the font size), for letters reaching past their advance */
const OVERHANG = 0.06;

/** A box of marked text: from the baseline a font size up, with its font's metrics (`boxesOf` of `@in-browser/pdf`) */
type TextBox = Box & { ascent?: number; descent?: number };

/**
 * The boxes a highlight covers for the text's boxes (page points as shown, text in direction `dir`): from the
 * font's descent to its ascent – derived from the text, so descenders lie inside – and a little past the first and
 * last letter. Where lines lie so close that their highlights would overlap, they meet halfway (an overlap would
 * show darker). Underline and strike-out keep the text's boxes (their lines are placed by them).
 */
export function highlightBoxes(boxes: readonly TextBox[], dir: number): Box[] {
	const d = ((dir % 360) + 360) % 360;
	const vertical = d % 180 !== 0;
	const out = boxes.map((b, i): Box => {
		const size = vertical ? b.x1 - b.x0 : b.y1 - b.y0;
		const up = size * (b.ascent ?? ASCENT);
		const down = size * -(b.descent ?? -DESCENT);
		const first = i === 0 ? size * OVERHANG : 0;
		const last = i === boxes.length - 1 ? size * OVERHANG : 0;
		// The baseline lies on the side the letters stand on; the text starts on the reading direction's back side
		if (d === 90) return { x0: b.x0 - down, y0: b.y0 - first, x1: b.x0 + up, y1: b.y1 + last };
		if (d === 180) return { x0: b.x0 - last, y0: b.y0 - down, x1: b.x1 + first, y1: b.y0 + up };
		if (d === 270) return { x0: b.x1 - up, y0: b.y0 - last, x1: b.x1 + down, y1: b.y1 + first };
		return { x0: b.x0 - first, y0: b.y1 - up, x1: b.x1 + last, y1: b.y1 + down };
	});
	// Lines that would overlap meet halfway
	const [lo, hi] = vertical ? (['x0', 'x1'] as const) : (['y0', 'y1'] as const);
	const [alo, ahi] = vertical ? (['y0', 'y1'] as const) : (['x0', 'x1'] as const);
	for (let i = 0; i < out.length; i++)
		for (let j = i + 1; j < out.length; j++) {
			const a = out[i];
			const b = out[j];
			if (Math.min(a[ahi], b[ahi]) <= Math.max(a[alo], b[alo])) continue;
			const [first, second] = a[lo] + a[hi] <= b[lo] + b[hi] ? [a, b] : [b, a];
			// Another line (not a neighbour on the same line): across, they overlap less than half
			if (first[hi] <= second[lo] || first[hi] - second[lo] > (first[hi] - first[lo]) / 2) continue;
			const mid = (first[hi] + second[lo]) / 2;
			first[hi] = mid;
			second[lo] = mid;
		}
	return out;
}
