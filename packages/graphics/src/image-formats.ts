// The picture formats a tool exports to (PNG, JPEG, WebP), the same in every tool: their MIME type and extension,
// and whether this browser can write WebP (others hand back PNG for it).

export const IMAGE_FORMATS = {
	png: { type: 'image/png', ext: 'png' },
	jpeg: { type: 'image/jpeg', ext: 'jpg' },
	webp: { type: 'image/webp', ext: 'webp' }
} as const;
export type ImageFormat = keyof typeof IMAGE_FORMATS;
export const IMAGE_FORMAT_IDS = Object.keys(IMAGE_FORMATS) as ImageFormat[];

/** Whether the format keeps see-through pixels (JPEG doesn't) */
export const keepsAlpha = (format: ImageFormat) => format !== 'jpeg';

let webp: Promise<boolean> | null = null;
/** Whether this browser writes WebP */
export function canWriteWebp(): Promise<boolean> {
	webp ??= new Promise((resolve) => {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 1;
		canvas.toBlob((blob) => resolve(blob?.type === 'image/webp'), 'image/webp');
	});
	return webp;
}
