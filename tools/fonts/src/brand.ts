import { resolve } from '$app/paths';

/** The page of one family */
export const familyUrl = (family: string) => `${resolve('/fonts/family')}?name=${encodeURIComponent(family)}`;

/** The page of a font file of the user's files (opened with “Open with”) */
export const fileUrl = (path: string) => `${resolve('/fonts/file')}?path=${encodeURIComponent(path)}`;
