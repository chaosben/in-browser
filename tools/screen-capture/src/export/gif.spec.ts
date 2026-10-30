import { describe, expect, it } from 'vitest';
import { changedPixels, GifWriter, PIXEL_TOLERANCE } from './gif';

const W = 4;
const H = 2;

function frame(color: [number, number, number], changes: Record<number, [number, number, number]> = {}) {
	const rgba = new Uint8ClampedArray(W * H * 4);
	for (let p = 0; p < W * H; p++) rgba.set([...(changes[p] ?? color), 255], p * 4);
	return rgba;
}

function gifOf(writer: GifWriter, frames: [Uint8ClampedArray, number][]) {
	const parts = frames.map(([rgba, delay]) => writer.add(rgba, delay)).filter((b) => b !== null);
	parts.push(writer.finish());
	const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let offset = 0;
	for (const p of parts) {
		bytes.set(p, offset);
		offset += p.length;
	}
	return bytes;
}

/** Delays (1/100 s) of all graphic control extensions */
function delays(bytes: Uint8Array) {
	const result: number[] = [];
	for (let i = 0; i < bytes.length - 7; i++) {
		if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 4 && bytes[i + 7] === 0) {
			result.push(bytes[i + 4] | (bytes[i + 5] << 8));
		}
	}
	return result;
}

describe('changedPixels', () => {
	it('ignores differences within the tolerance', () => {
		const a = frame([100, 100, 100]);
		expect(changedPixels(a, frame([100 + PIXEL_TOLERANCE, 100, 100 - PIXEL_TOLERANCE]))).toEqual([]);
		expect(changedPixels(a, frame([100, 100, 100], { 3: [100, 100 + PIXEL_TOLERANCE + 1, 100] }))).toEqual([3]);
	});
});

describe('GifWriter', () => {
	it('writes a GIF89a with header and trailer', () => {
		const bytes = gifOf(new GifWriter(W, H, true), [[frame([255, 0, 0]), 10]]);
		expect(new TextDecoder().decode(bytes.subarray(0, 6))).toBe('GIF89a');
		expect(bytes[6] | (bytes[7] << 8)).toBe(W);
		expect(bytes[8] | (bytes[9] << 8)).toBe(H);
		expect(bytes.at(-1)).toBe(0x3b);
	});
	it('merges unchanged frames into the previous one', () => {
		const red = frame([255, 0, 0]);
		const bytes = gifOf(new GifWriter(W, H, true), [
			[red, 7],
			[red.slice(), 6],
			[frame([255, 0, 0], { 0: [0, 0, 255] }), 7]
		]);
		expect(delays(bytes)).toEqual([13, 7]);
	});
	it('splits display times beyond the 16-bit field', () => {
		const bytes = gifOf(new GifWriter(W, H, true), [
			[frame([0, 0, 0]), 10],
			[frame([0, 0, 0], { 1: [255, 255, 255] }), 70_000]
		]);
		expect(delays(bytes)).toEqual([10, 0xffff, 70_000 - 0xffff]);
	});
	it('loops only when asked to', () => {
		const netscape = (bytes: Uint8Array) => new TextDecoder().decode(bytes).includes('NETSCAPE2.0');
		expect(netscape(gifOf(new GifWriter(W, H, true), [[frame([0, 0, 0]), 10]]))).toBe(true);
		expect(netscape(gifOf(new GifWriter(W, H, false), [[frame([0, 0, 0]), 10]]))).toBe(false);
	});
	it('rejects frames of the wrong size', () => {
		expect(() => new GifWriter(W, H, true).add(new Uint8ClampedArray(4), 10)).toThrow();
	});
});
