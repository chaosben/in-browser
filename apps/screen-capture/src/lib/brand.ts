import { BRAND as SUITE } from '@in-browser/brand/brand.js';

// Central brand: the tool belongs to the in-browser.de family (each tool on its own subdomain).
export const BRAND = {
	...SUITE,
	tool: 'Screen Capture'
} as const;
