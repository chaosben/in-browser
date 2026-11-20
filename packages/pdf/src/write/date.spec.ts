import { describe, expect, it } from 'vitest';
import { parsePdfDate, pdfDate } from './annotations.js';

describe('parsePdfDate', () => {
	it('reads full dates with their offset, and short ones', () => {
		expect(parsePdfDate("D:20261120143000+01'00")?.toISOString()).toBe('2026-11-20T13:30:00.000Z');
		expect(parsePdfDate('D:20261120143000Z')?.toISOString()).toBe('2026-11-20T14:30:00.000Z');
		expect(parsePdfDate('D:2026')?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
		expect(parsePdfDate('yesterday')).toBeNull();
	});

	it('reads what pdfDate writes', () => {
		const d = new Date('2026-03-04T05:06:07Z');
		expect(parsePdfDate(pdfDate(d).slice(1, -1))?.getTime()).toBe(d.getTime());
	});
});
