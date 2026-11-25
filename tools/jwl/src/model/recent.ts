// Files opened here, newest first, and the folder dialogs start in – the suite's list (`jwl:recent`, `jwl:folder`)

import { recentDocuments } from '@in-browser/files/sources/recent.js';

export const recent = recentDocuments('jwl');

/** The kinds of files this tool opens */
export const EXTENSIONS = ['.jwlibrary', '.jwlplaylist'];
