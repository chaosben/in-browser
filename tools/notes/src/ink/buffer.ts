// Points of the stroke being drawn: a growing Float32Array (x, y, pressure per point), so the hot path allocates
// nothing per event. Grows by doubling; `reset()` keeps the memory for the next stroke.

export class PointBuffer {
	private data = new Float32Array(3 * 1024);
	/** Number of points */
	length = 0;

	reset() {
		this.length = 0;
	}

	push(x: number, y: number, p: number) {
		const i = this.length * 3;
		if (i + 3 > this.data.length) {
			const bigger = new Float32Array(this.data.length * 2);
			bigger.set(this.data);
			this.data = bigger;
		}
		this.data[i] = x;
		this.data[i + 1] = y;
		this.data[i + 2] = p;
		this.length++;
	}

	x(i: number) {
		return this.data[i * 3];
	}
	y(i: number) {
		return this.data[i * 3 + 1];
	}
	p(i: number) {
		return this.data[i * 3 + 2];
	}

	/** Copy of the points (for the finished stroke) */
	toArray(): Float32Array {
		return this.data.slice(0, this.length * 3);
	}
}
