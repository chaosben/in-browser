import { BRAND } from '@in-browser/brand/brand.js';

/**
 * What a PDF written here names as its producer (`/Producer`; `/Creator` too for a PDF made here): the suite and the
 * address it runs at – so a file says where it was written, also from a test or a local server.
 */
export function pdfProducer(): string {
	const origin = typeof location !== 'undefined' && location.origin && location.origin !== 'null' ? location.origin : BRAND.suiteUrl;
	return `${BRAND.suite} (${origin})`;
}
