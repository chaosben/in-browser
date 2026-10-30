import { applyPalette, GIFEncoder, quantize, type Palette } from 'gifenc';

/** Largest difference per color channel up to which a pixel counts as unchanged (decoder noise). */
export const PIXEL_TOLERANCE = 4;
/** Longest display time of one GIF frame in 1/100 s (16-bit field). */
const MAX_DELAY = 0xffff;
/** Disposal "do not dispose": the next frame draws over this one. */
const KEEP = 1;

interface PendingFrame {
	index: Uint8Array;
	palette: Palette;
	transparentIndex: number;
	delay: number;
}

/**
 * Builds a GIF frame by frame. Only pixels that changed since the last written frame are
 * encoded (the rest is transparent and keeps the previous picture), each frame with its own
 * palette from those pixels. Frames without changes extend the previous one, so still images
 * cost almost nothing.
 */
export class GifWriter {
	#encoder = GIFEncoder();
	/** What the GIF shows after the frames written so far (RGBA) */
	#shown: Uint8ClampedArray | null = null;
	#pending: PendingFrame | null = null;

	constructor(
		readonly width: number,
		readonly height: number,
		readonly loop: boolean
	) {}

	/** Adds a frame (RGBA, `width × height`) shown for `delay` 1/100 s. Returns bytes ready to be written. */
	add(rgba: Uint8ClampedArray, delay: number): Uint8Array<ArrayBuffer> | null {
		if (rgba.length !== this.width * this.height * 4) throw new Error('Frame size does not match the GIF.');
		if (!this.#shown) {
			this.#shown = rgba.slice();
			const palette = quantize(rgba, 256);
			this.#pending = { index: applyPalette(rgba, palette), palette, transparentIndex: -1, delay };
			return null;
		}
		const changed = changedPixels(this.#shown, rgba);
		if (changed.length === 0) {
			this.#pending!.delay += delay;
			return null;
		}
		// Palette only from the changed pixels; one slot stays free for "transparent"
		const colors = new Uint8ClampedArray(changed.length * 4);
		changed.forEach((p, i) => colors.set(rgba.subarray(p * 4, p * 4 + 4), i * 4));
		const palette = quantize(colors, 255);
		const transparentIndex = palette.length;
		const mapped = applyPalette(colors, palette);
		const index = new Uint8Array(this.width * this.height).fill(transparentIndex);
		changed.forEach((p, i) => {
			index[p] = mapped[i];
			this.#shown!.set(rgba.subarray(p * 4, p * 4 + 4), p * 4);
		});
		this.#write();
		this.#pending = { index, palette: [...palette, [0, 0, 0]], transparentIndex, delay };
		return this.#take();
	}

	/** Writes the last frame and the end of the file. */
	finish(): Uint8Array<ArrayBuffer> {
		this.#write();
		this.#encoder.finish();
		return this.#take();
	}

	/** Encodes the frame held back so far. */
	#write() {
		const frame = this.#pending;
		if (frame) {
			// Longer than the field allows: continue with fully transparent frames (the first frame has no
			// free palette slot, it is cut off – after 11 minutes)
			const transparent = frame.transparentIndex >= 0;
			let { index, delay: rest } = frame;
			for (;;) {
				const delay = Math.min(rest, MAX_DELAY);
				this.#encoder.writeFrame(index, this.width, this.height, {
					palette: frame.palette,
					delay: delay * 10,
					repeat: this.loop ? 0 : -1,
					transparent,
					transparentIndex: Math.max(frame.transparentIndex, 0),
					dispose: KEEP
				});
				rest -= delay;
				if (rest <= 0 || !transparent) break;
				index = new Uint8Array(index.length).fill(frame.transparentIndex);
			}
			this.#pending = null;
		}
	}

	/** Bytes written since the last call */
	#take(): Uint8Array<ArrayBuffer> {
		const bytes = this.#encoder.bytes();
		this.#encoder.stream.reset();
		return bytes;
	}
}

/** Indices of the pixels that differ from `shown` by more than `PIXEL_TOLERANCE` in a channel. */
export function changedPixels(shown: Uint8ClampedArray, next: Uint8ClampedArray): number[] {
	const changed: number[] = [];
	for (let i = 0; i < next.length; i += 4) {
		if (
			Math.abs(next[i] - shown[i]) > PIXEL_TOLERANCE ||
			Math.abs(next[i + 1] - shown[i + 1]) > PIXEL_TOLERANCE ||
			Math.abs(next[i + 2] - shown[i + 2]) > PIXEL_TOLERANCE
		) {
			changed.push(i / 4);
		}
	}
	return changed;
}

/** Messages to the GIF worker; it answers each one in order with a `GifReply`. */
export type GifRequest =
	| { type: 'start'; width: number; height: number; loop: boolean }
	| { type: 'frame'; rgba: ArrayBuffer; delay: number }
	| { type: 'finish' };

export type GifReply = { type: 'bytes'; bytes: Uint8Array<ArrayBuffer> | null } | { type: 'error'; message: string };
