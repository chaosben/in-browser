// Smoothing while drawing ("lazy brush"): each point moves only part of the way from the previous smoothed point
// towards the pen. Applied live (in page points, so it doesn't
// depend on the zoom) and stored that way: the line on screen while drawing is the stroke that gets saved.

/** Smoothing levels to choose from (0 = off) */
export const SMOOTHING_LEVELS = [0, 0.3, 0.5, 0.7] as const;

/** Share of the way a point moves towards the pen (at most 85 % less at level 1) */
export const follow = (level: number) => 0.15 + (1 - Math.min(Math.max(level, 0), 1)) * 0.85;

export class Smoother {
	private x = 0;
	private y = 0;
	private started = false;
	private t = 1;

	reset(level: number) {
		this.started = false;
		this.t = level > 0 ? follow(level) : 1;
	}

	/** Smoothed position for a pen position; written to `out` (no allocation) */
	next(x: number, y: number, out: { x: number; y: number }) {
		if (!this.started) {
			this.started = true;
			this.x = x;
			this.y = y;
		} else {
			this.x += (x - this.x) * this.t;
			this.y += (y - this.y) * this.t;
		}
		out.x = this.x;
		out.y = this.y;
	}
}
