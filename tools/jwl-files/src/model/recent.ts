// Files opened here, newest first, and the folder dialogs start in – the suite's list (`jwl-files:recent`, `jwl-files:folder`)

import { recentDocuments } from '@in-browser/files/sources/recent.js';

export const recent = recentDocuments('jwl-files');

/** The kinds of files this tool opens */
export const EXTENSIONS = ['.jwlibrary', '.jwlplaylist'];
