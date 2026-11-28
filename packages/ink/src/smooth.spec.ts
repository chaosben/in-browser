import { describe, expect, it } from 'vitest';
import { Smoother } from './smooth';

/** Draws a line along x at `speed` screen px per ms with ±`jitter` px across it at 490 points/s; returns the
 * largest distance of the smoothed points from the line and how far the last one lags behind the pen */
function draw(level: number, speed: number, jitter: number) {
	const s = new Smoother();
	s.reset(level, 1);
	const out = { x: 0, y: 0 };
	let wobble = 0;
	let x = 0;
	for (let i = 0; i < 245; i++) {
		const t = i * (1000 / 490);
		x = t * speed;
		s.next(x, i % 2 ? jitter : -jitter, t, out);
		if (i > 120) wobble = Math.max(wobble, Math.abs(out.y));
	}
	return { wobble, lag: x - out.x };
}

describe('smoothing', () => {
	it('off follows the pen exactly', () => {
		const { wobble, lag } = draw(0, 0.2, 0.5);
		expect(wobble).toBe(0.5);
		expect(lag).toBe(0);
	});
	it('takes the jitter out of slow handwriting, more with stronger levels', () => {
		const light = draw(0.3, 0.2, 0.5);
		const strong = draw(0.7, 0.2, 0.5);
		expect(light.wobble).toBeLessThan(0.1);
		expect(strong.wobble).toBeLessThan(light.wobble);
		expect(strong.lag).toBeGreaterThan(light.lag);
	});
	it('follows fast strokes with less delay than slow ones would get', () => {
		// At rest the cutoff of "Strong" would lag ~59 ms; fast, it lags far less
		const fast = draw(0.7, 2, 0);
		expect(fast.lag / 2).toBeLessThan(25);
	});
});
