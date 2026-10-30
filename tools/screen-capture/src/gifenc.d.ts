// gifenc ships without types; only what the GIF export uses.
declare module 'gifenc' {
	export type Palette = number[][];
	export type ColorFormat = 'rgb565' | 'rgb444' | 'rgba4444';

	export interface GIFEncoderInstance {
		writeFrame(
			index: Uint8Array,
			width: number,
			height: number,
			opts?: {
				palette?: Palette;
				delay?: number;
				repeat?: number;
				transparent?: boolean;
				transparentIndex?: number;
				dispose?: number;
			}
		): void;
		finish(): void;
		bytes(): Uint8Array<ArrayBuffer>;
		readonly stream: { reset(): void };
	}

	export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): GIFEncoderInstance;
	export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: { format?: ColorFormat }): Palette;
	export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: ColorFormat): Uint8Array;
}
