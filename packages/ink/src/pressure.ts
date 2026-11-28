// Pressure. Pens report it; mouse and touch report 0.5 while pressed (Pointer Events spec), and some pens without
// a sensor do too. Then pressure is simulated from the speed: fast = thinner, like a real pen.

/** Does the device deliver real pressure? `pressure` of the down event and the pointer type decide. */
export function hasRealPressure(pointerType: string, pressure: number): boolean {
	return pointerType === 'pen' && pressure !== 0.5 && pressure > 0;
}

/**
 * Pressure of a pen event, curved: pens report light handwriting as 0.05–0.4 (measured on a S Pen), which made
 * thin, uneven lines – lifted so that writing comes near the chosen thickness (0.3 → 0.49) and pressing hard still
 * reaches the full width. A contact without force still counts a little.
 */
export const penPressure = (pressure: number) => Math.pow(Math.min(1, Math.max(0.05, pressure)), 0.6);

/** Evens out a pen's pressure over time (sensor noise would make the line's edge bumpy), ~8 ms */
export class PressureFilter {
	private value = 0;
	private t = 0;
	private started = false;

	reset() {
		this.started = false;
	}

	next(pressure: number, t: number): number {
		if (!this.started) {
			this.started = true;
			this.value = pressure;
		} else {
			const dt = Math.max(t - this.t, 0.5);
			this.value += (pressure - this.value) * (dt / (dt + 8));
		}
		this.t = t;
		return this.value;
	}
}

/**
 * Simulated pressure from speed. Smoothed, so single fast events don't make the line jump.
 * `scale`: screen pixels per unit of x/y (1 for screen coordinates), so the feel doesn't depend on the zoom.
 */
export class PressureSimulator {
	private last: { x: number; y: number; t: number } | null = null;
	private value = 0.5;

	reset() {
		this.last = null;
		this.value = 0.6;
	}

	next(x: number, y: number, t: number, scale: number): number {
		const last = this.last;
		this.last = { x, y, t };
		if (!last) return this.value;
		const dt = Math.max(1, t - last.t);
		// Screen pixels per millisecond
		const speed = (Math.hypot(x - last.x, y - last.y) * scale) / dt;
		const target = Math.min(1, Math.max(0.25, 0.75 - speed * 0.12));
		this.value += (target - this.value) * 0.3;
		return this.value;
	}
}
