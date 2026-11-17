import { resolve } from '$app/paths';
import { BRAND as SUITE } from '@in-browser/brand/brand.js';

// Central brand: the tool belongs to the in-browser family (served under /notes).
export const BRAND = {
	...SUITE,
	tool: 'Notes'
} as const;

/** Link to the editor of a notebook (path of its package) */
export function editorUrl(path: string) {
	return `${resolve('/notes/editor')}?path=${encodeURIComponent(path)}`;
}
