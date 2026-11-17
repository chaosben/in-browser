// Shapes of drawable annotations as strokes in canvas pixels: the geometry comes from `@in-browser/graphics`, this
// maps the annotation (coordinates relative to the frame, line width relative to its height) onto it.
import type { DrawableAnnotation } from '#lib/project/types.js';
import { arrowHead as headSize, strokesOf as shapeStrokes, type Shape, type Stroke } from '@in-browser/graphics/shapes.js';

export { partialStrokes, seeded, strokesLength, type Stroke } from '@in-browser/graphics/shapes.js';

/** Arrowhead size for a line width and shaft length (pixels); at least 2 % of the frame height `H` */
export const arrowHead = (lineWidth: number, length: number, H: number) => headSize(lineWidth, length, 0.02 * H);

/** The annotation as a shape in pixels of a `W`×`H` frame */
function shapeOf(a: DrawableAnnotation, W: number, H: number): Shape {
	const base = { seed: a.id, sketch: a.sketch };
	const at = (p: { x: number; y: number }) => ({ x: p.x * W, y: p.y * H });
	switch (a.kind) {
		case 'line':
			return { ...base, kind: 'line', from: at(a.from), to: at(a.to) };
		case 'arrow':
			return { ...base, kind: 'arrow', from: at(a.from), to: at(a.to), width: a.width * H, minHead: 0.02 * H };
		case 'rect':
			return { ...base, kind: 'rect', x: a.rect.x * W, y: a.rect.y * H, w: a.rect.w * W, h: a.rect.h * H, radius: a.radius * H };
		case 'ellipse':
			return { ...base, kind: 'ellipse', x: a.rect.x * W, y: a.rect.y * H, w: a.rect.w * W, h: a.rect.h * H };
	}
}

/** The shape's strokes in drawing order; for an exact arrow only the shaft (its filled head is drawn separately) */
export const strokesOf = (a: DrawableAnnotation, W: number, H: number): Stroke[] => shapeStrokes(shapeOf(a, W, H));
