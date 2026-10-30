import { BRAND as SUITE } from '@in-browser/brand/brand.js';

// Central brand: the tool belongs to the in-browser.de family (served under /text-editor).
export const BRAND = {
	...SUITE,
	tool: 'Text Editor'
} as const;
