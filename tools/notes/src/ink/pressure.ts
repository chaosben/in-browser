// Pressure. Pens report it; mouse and touch report 0.5 while pressed (Pointer Events spec), and some pens without
// a sensor do too. Then pressure is simulated from the speed: fast = thinner, like a real pen.

/** Does the device deliver real pressure? `pressure` of the down event and the pointer type decide. */
export function hasRealPressure(pointerType: string, pressure: number): boolean {
	return pointerType === 'pen' && pressure !== 0.5 && pressure > 0;
}

/** Pressure of a pen event: a contact without force still counts a little */
export const penPressure = (pressure: number) => Math.min(1, Math.max(0.05, pressure));

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
