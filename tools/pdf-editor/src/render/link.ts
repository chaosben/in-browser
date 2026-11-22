// Links: a box on the page that leads somewhere when clicked – to a web address or to a page of this PDF. Saved as
// `/Link` annotations. On the page a link is nothing to see: its box is drawn only while links are worked on (the
// tool "Link" or "Select"), never on paper.

import type { Box } from '@in-browser/ink/geometry.js';
import type { Ctx } from '@in-browser/ink/render/kit.js';

export interface LinkItem {
	id: string;
	type: 'link';
	/** Its box (page points as shown) */
	x: number;
	y: number;
	w: number;
	h: number;
	/** Where it leads: a web address … */
	url?: string;
	/** … or a page of this PDF (its id, so the link follows the page when pages move) */
	page?: string;
}

export const isLink = (item: { readonly id: string }): item is LinkItem => (item as LinkItem).type === 'link';

export const linkBounds = (l: LinkItem): Box => ({ x0: l.x, y0: l.y, x1: l.x + l.w, y1: l.y + l.h });

/** Whether the boxes of links are drawn (set by the editor with the tool; the pages are drawn again then) */
export const linkView = { shown: false };

/** The color of a link's box while links are worked on (a mark of the editor, not of the document) */
const LINK_COLOR = '#2563eb';

export function drawLink(ctx: Ctx, l: LinkItem) {
	if (!linkView.shown) return;
	ctx.save();
	ctx.fillStyle = LINK_COLOR;
	ctx.strokeStyle = LINK_COLOR;
	ctx.globalAlpha *= 0.12;
	ctx.fillRect(l.x, l.y, l.w, l.h);
	ctx.globalAlpha /= 0.12;
	ctx.lineWidth = 0.75;
	ctx.setLineDash([3, 2]);
	ctx.strokeRect(l.x, l.y, l.w, l.h);
	ctx.restore();
}

/** Addresses a link may open: the web and mail – never a script or a file of the device */
export function safeUrl(url: string): string | null {
	const typed = url.trim();
	if (!typed) return null;
	// Typed without a scheme: the web
	const full = /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`;
	try {
		const parsed = new URL(full);
		return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : null;
	} catch {
		return null;
	}
}
