import { describe, expect, it } from 'vitest';
import { follow, Smoother } from './smooth';

describe('smoothing', () => {
	it('off follows the pen exactly', () => {
		const s = new Smoother();
		s.reset(0);
		const p = { x: 0, y: 0 };
		s.next(0, 0, p);
		s.next(10, 5, p);
		expect(p).toEqual({ x: 10, y: 5 });
	});
	it('stronger levels lag further behind the pen', () => {
		const lag = (level: number) => {
			const s = new Smoother();
			s.reset(level);
			const p = { x: 0, y: 0 };
			s.next(0, 0, p);
			s.next(10, 0, p);
			return 10 - p.x;
		};
		expect(lag(0.3)).toBeGreaterThan(0);
		expect(lag(0.7)).toBeGreaterThan(lag(0.3));
		expect(follow(1)).toBeCloseTo(0.15);
	});
});
