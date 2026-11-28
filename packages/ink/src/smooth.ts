// Smoothing while drawing: a low-pass filter over time whose cutoff rises with the pen's speed. Slow movement –
// handwriting – loses the digitizer's jitter; fast movement follows with little delay. Over time, not per point:
// pens send several hundred points a second (a S Pen ~490), where a fixed share per point smoothed nothing.
// Applied live (in page points; speed in screen pixels, so it feels the same at every zoom) and stored that way:
// the line on screen while drawing is the stroke that gets saved.

/** Smoothing levels to choose from (0 = off) */
export const SMOOTHING_LEVELS = [0, 0.3, 0.5, 0.7] as const;

/** Cutoff when the pen rests (Hz) and how much it rises per screen pixel per millisecond: lower = smoother */
function cutoffs(level: number): { min: number; beta: number } {
	const l = Math.min(Math.max(level, 0), 1);
	// Light 0.3 → 9 Hz, Medium 0.5 → 5 Hz, Strong 0.7 → 2.7 Hz at rest
	return { min: 30 * Math.pow(0.05, l), beta: 60 * Math.pow(0.1, l) };
}

/** Cutoff of the speed estimate (Hz) */
const SPEED_CUTOFF = 5;

const alpha = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));

export class Smoother {
	private x = 0;
	private y = 0;
	private t = 0;
	/** The pen's last position (unsmoothed) */
	private px = 0;
	private py = 0;
	/** Filtered speed, screen pixels per millisecond */
	private speed = 0;
	private started = false;
	private on = false;
	private min = 0;
	private beta = 0;
	private zoom = 1;

	/** `zoom`: screen pixels per page point */
	reset(level: number, zoom = 1) {
		this.started = false;
		this.on = level > 0;
		const c = cutoffs(level);
		this.min = c.min;
		this.beta = c.beta;
		this.zoom = zoom;
		this.speed = 0;
	}

	/** Smoothed position for a pen position at time `t` (ms); written to `out` (no allocation) */
	next(x: number, y: number, t: number, out: { x: number; y: number }) {
		if (!this.started || !this.on) {
			this.started = true;
			this.x = x;
			this.y = y;
			this.t = t;
			this.px = x;
			this.py = y;
		} else {
			// Points with the same time stamp still count a little
			const dt = Math.max(t - this.t, 0.5) / 1000;
			this.t = t;
			const v = (Math.hypot(x - this.px, y - this.py) * this.zoom) / (dt * 1000);
			this.px = x;
			this.py = y;
			this.speed += (v - this.speed) * alpha(SPEED_CUTOFF, dt);
			const a = alpha(this.min + this.beta * this.speed, dt);
			this.x += (x - this.x) * a;
			this.y += (y - this.y) * a;
		}
		out.x = this.x;
		out.y = this.y;
	}
}
