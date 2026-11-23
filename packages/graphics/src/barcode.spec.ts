import { describe, expect, it } from 'vitest';
import { barcodeSpec, barcodeSvg, barcodeTypes, DEFAULT_BARCODE, scanRisk, type BarcodeDrawing, type BarcodeSpec } from './barcode.js';

// A barcode that can't be scanned, or that is drawn although its content is wrong, is worse than none.

const spec = (kind: string, text: string, more: Partial<BarcodeSpec> = {}): BarcodeSpec => ({ ...DEFAULT_BARCODE, kind, text, ...more });

describe('barcodes', () => {
	it('draws codes as plain paths in the chosen colors, with the quiet zone around them', async () => {
		const qr = (await barcodeSvg(spec('qrcode', 'https://example.org/', { dark: '#112233', light: '#ffeedd' }))) as BarcodeDrawing;
		// Version 2 (25 modules of 4 units) and four modules of quiet zone on every side
		expect([qr.width, qr.height, qr.x, qr.y]).toEqual([132, 132, 16, 16]);
		expect(qr.svg).toContain('<path d="M0 0h132v132h-132z" fill="#ffeedd"/>');
		expect(qr.svg).toContain('fill="#112233"');
		expect(qr.svg.match(/<(?!\/)(\w+)/g)?.every((tag) => ['<svg', '<path', '<g'].includes(tag))).toBe(true);
		// A higher error correction needs more modules; no background, no quiet zone: only the code
		const high = (await barcodeSvg(spec('qrcode', 'https://example.org/', { ecc: 'H', light: null, quiet: false }))) as BarcodeDrawing;
		expect(high.width).toBeGreaterThan(qr.width - 32);
		expect([high.x, high.svg.includes('h-')]).toEqual([0, false]);
		// A line code: bars as lines, its text below as paths too
		const plain = (await barcodeSvg(spec('code128', 'PJJ123C', { showText: false }))) as BarcodeDrawing;
		const texted = (await barcodeSvg(spec('code128', 'PJJ123C'))) as BarcodeDrawing;
		expect(plain.paths.every((p) => p.stroke)).toBe(true);
		expect(texted.paths.some((p) => !p.stroke)).toBe(true);
		expect(texted.height).toBeGreaterThan(plain.height);
		expect(texted.svg).not.toContain('<text');
	});

	it('says why a content is no code of a kind', async () => {
		expect(await barcodeSvg(spec('qrcode', ''))).toEqual({ problem: 'empty' });
		expect(await barcodeSvg(spec('ean13', '4006381333932'))).toEqual({ problem: 'checkDigit' });
		expect(await barcodeSvg(spec('ean13', '40063813'))).toEqual({ problem: 'length' });
		expect(await barcodeSvg(spec('code39', 'abc'))).toEqual({ problem: 'characters' });
		expect(await barcodeSvg(spec('qrcode', 'x'.repeat(8000)))).toEqual({ problem: 'length' });
		expect('svg' in (await barcodeSvg(spec('ean13', '400638133393')))).toBe(true);
	});

	it('offers every kind once and reads a kept choice safely', async () => {
		const types = await barcodeTypes();
		expect(new Set(types.map((t) => t.id)).size).toBe(types.length);
		expect(types.length).toBeGreaterThan(90);
		expect(barcodeSpec({ kind: 'ean13', dark: 'red', light: null, quiet: false, ecc: '<x>' })).toEqual({ ...DEFAULT_BARCODE, kind: 'ean13', light: null, quiet: false });
		expect(scanRisk({ dark: '#ffffff', light: '#000000', quiet: true })).toBe('inverted');
		expect(scanRisk({ dark: '#888888', light: null, quiet: true })).toBe('contrast');
		expect(scanRisk({ dark: '#000000', light: null, quiet: false })).toBe('quiet');
		expect(scanRisk(DEFAULT_BARCODE)).toBeNull();
	});
});
