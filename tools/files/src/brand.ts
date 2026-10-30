import { BRAND as SUITE } from '@in-browser/brand/brand.js';

// Central brand: the tool belongs to the in-browser family (served under /files).
export const BRAND = {
	...SUITE,
	tool: 'Files'
} as const;
