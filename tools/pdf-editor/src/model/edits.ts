// What the user changed in a PDF, as steps that undo and redo (page rotations as `Op`s that know their inverse, the
// page list – moved, deleted, inserted – as before/after, ink as the ink core's commands); the state is the original plus the steps done. Saving writes the state, never the
// steps (`IncrementalPdf.update`), so undoing everything gives the original file back byte for byte.

/** One change: pages (ids) turned by a quarter, half or three quarters clockwise */
export interface RotateOp {
	kind: 'rotate';
	pages: string[];
	/** Degrees clockwise (negative: counter-clockwise) */
	by: number;
}

export type Op = RotateOp;

/** The step that takes `op` back */
export function invert(op: Op): Op {
	return { ...op, by: -op.by };
}

/** Rotation in degrees, normalized to 0, 90, 180 or 270 */
export const normalizeAngle = (angle: number) => (((Math.round(angle / 90) * 90) % 360) + 360) % 360;

/** The pages' rotations (degrees, in their order) after `op` */
export function applyOp(pages: readonly { id: string; rotate: number }[], op: Op): number[] {
	const turned = new Set(op.pages);
	return pages.map((p) => (turned.has(p.id) ? normalizeAngle(p.rotate + op.by) : p.rotate));
}

/** Moves the pages `ids` (in their order) so they stand before the page that was at `to` (`length`: to the end) */
export function movePages<T extends { id: string }>(pages: readonly T[], ids: ReadonlySet<string>, to: number): T[] {
	const moving = pages.filter((p) => ids.has(p.id));
	const before = pages.slice(0, to).filter((p) => !ids.has(p.id));
	const after = pages.slice(to).filter((p) => !ids.has(p.id));
	return [...before, ...moving, ...after];
}

// Undo and redo are the suite's (`History` of `@in-browser/graphics`)
export { History, type HistoryStep as Step } from '@in-browser/graphics/history.js';
