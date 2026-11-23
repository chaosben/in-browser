// Giving a page another size: where what is on it goes.

/** How pages get another size (`PdfDocument.resizePages`): the size as shown in points, whether the content is
 * scaled to fit (never distorted) or keeps its size, and where it lies on the new page (0 start, 0.5 middle, 1 end) */
export interface PageResize {
	w: number;
	h: number;
	fit: boolean;
	anchor: readonly [number, number];
}

/** Where the content of a page of `w0` × `h0` goes on one resized so: its scale and shift, as shown */
export function resizePlace(w0: number, h0: number, to: PageResize): { scale: number; dx: number; dy: number } {
	const scale = to.fit ? Math.min(to.w / w0, to.h / h0) : 1;
	return { scale, dx: to.anchor[0] * (to.w - scale * w0), dy: to.anchor[1] * (to.h - scale * h0) };
}
