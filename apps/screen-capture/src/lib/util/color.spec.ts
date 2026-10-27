import { describe, expect, it } from 'vitest';
import { formatColor, parseColor, withAlpha } from './color';

describe('parseColor', () => {
	it('reads hex formats', () => {
		expect(parseColor('#FFF')).toEqual({ hex: '#ffffff', alpha: 1 });
		expect(parseColor('#ef4444')).toEqual({ hex: '#ef4444', alpha: 1 });
		expect(parseColor('#00000080').alpha).toBeCloseTo(0.502, 3);
	});
	it('reads rgb()/rgba() from older projects', () => {
		expect(parseColor('rgba(0, 0, 0, 0.65)')).toEqual({ hex: '#000000', alpha: 0.65 });
		expect(parseColor('rgb(255 128 0 / 50%)')).toEqual({ hex: '#ff8000', alpha: 0.5 });
	});
	it('falls back to black on garbage', () => {
		expect(parseColor('banane')).toEqual({ hex: '#000000', alpha: 1 });
		expect(parseColor(null)).toEqual({ hex: '#000000', alpha: 1 });
	});
});

describe('formatColor / withAlpha', () => {
	it('writes alpha only when needed', () => {
		expect(formatColor('#EF4444', 1)).toBe('#ef4444');
		expect(formatColor('#ef4444', 0.4)).toBe('#ef444466');
		expect(formatColor('#ef4444', 0)).toBe('#ef444400');
		expect(formatColor('#ef4444', 2)).toBe('#ef4444');
	});
	it('round trip', () => {
		const c = formatColor('#3b82f6', 0.3);
		expect(parseColor(c).hex).toBe('#3b82f6');
		expect(parseColor(c).alpha).toBeCloseTo(0.3, 2);
	});
	it('withAlpha replaces the opacity', () => {
		expect(withAlpha('rgba(255, 255, 255, 0.85)', 0.5)).toBe('#ffffff80');
		expect(withAlpha('#facc15', 0.4)).toBe('#facc1566');
	});
});
