import { resolve } from '$app/paths';
import { BRAND as SUITE } from '@in-browser/brand/brand.js';

// Central brand: the tool belongs to the in-browser family (served under /screen-capture).
export const BRAND = {
	...SUITE,
	tool: 'Screen Capture'
} as const;

/** Link to the editor of a project (path of its package) */
export function editorUrl(path: string) {
	return `${resolve('/screen-capture/editor')}?path=${encodeURIComponent(path)}`;
}
