import { canEncodeVideo, getFirstEncodableVideoCodec, type VideoCodec } from 'mediabunny';
import type { ScreenEncoderMode } from './settings.js';

export interface Encoder {
	codec: VideoCodec;
	/** Runs on the graphics chip (almost no CPU load) */
	hardware: boolean;
	/** Passed on to the encoder; missing: browser default */
	acceleration?: 'prefer-hardware' | 'prefer-software';
}

/** What the browser can encode at a size, per codec – shown in the record dialog */
export interface EncoderSupport {
	codec: VideoCodec;
	hardware: boolean;
	software: boolean;
}

const options = (acceleration: 'prefer-hardware' | 'prefer-software') =>
	({ hardwareAcceleration: acceleration, latencyMode: 'realtime' }) as const;

/**
 * Encoder for the screen. `auto`: a hardware encoder costs almost no CPU – AV1/VP9 first, then H.264 (no
 * screen-content tools, so text needs a higher quality, see `screenQuality`). `sharp`: software VP9, whose
 * screen-content tools keep text sharpest, at the cost of CPU load.
 */
export async function pickScreenEncoder(width: number, height: number, mode: ScreenEncoderMode): Promise<Encoder | null> {
	if (mode === 'auto') {
		for (const codec of ['av1', 'vp9', 'avc'] as const) {
			if (await canEncodeVideo(codec, { width, height, ...options('prefer-hardware') })) {
				return { codec, hardware: true, acceleration: 'prefer-hardware' };
			}
		}
	}
	for (const codec of ['vp9', 'av1', 'avc'] as const) {
		if (await canEncodeVideo(codec, { width, height, ...options('prefer-software') })) {
			return { codec, hardware: false, acceleration: 'prefer-software' };
		}
	}
	return pickEncoder(['vp9', 'avc', 'av1'], width, height);
}

export async function pickEncoder(codecs: VideoCodec[], width: number, height: number): Promise<Encoder | null> {
	const codec = await getFirstEncodableVideoCodec(codecs, { width, height });
	return codec && { codec, hardware: false };
}

export function probeEncoders(width: number, height: number): Promise<EncoderSupport[]> {
	return Promise.all(
		(['av1', 'vp9', 'avc'] as const).map(async (codec) => ({
			codec,
			hardware: await canEncodeVideo(codec, { width, height, ...options('prefer-hardware') }),
			software: await canEncodeVideo(codec, { width, height, ...options('prefer-software') })
		}))
	);
}
