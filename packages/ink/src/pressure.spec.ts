import { describe, expect, it } from 'vitest';
import { hasRealPressure, penPressure, PressureSimulator } from './pressure';

describe('pressure', () => {
	it('treats 0.5 as "no sensor" (spec value for devices without pressure)', () => {
		expect(hasRealPressure('pen', 0.31)).toBe(true);
		expect(hasRealPressure('pen', 0.5)).toBe(false);
		expect(hasRealPressure('touch', 0.8)).toBe(false);
		expect(hasRealPressure('mouse', 0.5)).toBe(false);
	});
	it('keeps a light pen contact visible', () => {
		expect(penPressure(0)).toBeCloseTo(0.166, 3);
		expect(penPressure(0.3)).toBeCloseTo(0.486, 3);
		expect(penPressure(1.2)).toBe(1);
	});
	it('simulates thinner lines for fast movement', () => {
		const slow = new PressureSimulator();
		const fast = new PressureSimulator();
		slow.reset();
		fast.reset();
		let ps = 0;
		let pf = 0;
		for (let i = 0; i < 20; i++) {
			ps = slow.next(i * 0.5, 0, i * 8, 1);
			pf = fast.next(i * 40, 0, i * 8, 1);
		}
		expect(pf).toBeLessThan(ps);
		expect(pf).toBeGreaterThanOrEqual(0.25);
	});
});
