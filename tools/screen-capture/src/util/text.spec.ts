import { describe, expect, it } from 'vitest';
import { oneLine } from './text';

describe('oneLine', () => {
	it('joins lines and collapses whitespace', () => {
		expect(oneLine('  Line 1\n\nLine 2\t end ')).toBe('Line 1 Line 2 end');
	});
	it('cuts long texts', () => {
		expect(oneLine('abcdef ghij', 8)).toBe('abcdef…');
		expect(oneLine('abcdefgh', 8)).toBe('abcdefgh');
	});
});
