// Directory of the help pages (`/help/…`): the pages of the whole suite (texts in `i18n/help.*.ts`) and one page
// per tool (texts from the tool package, the same as its help window). Every page needs a route
// `src/routes/help/<path>/+page.svelte` and an entry in `static/sitemap.xml` (`help.spec.ts` checks both).

import type { HelpContent } from '@in-browser/brand/help.js';
import filesDe from '@in-browser/files-app/i18n/help.de.js';
import filesEn from '@in-browser/files-app/i18n/help.en.js';
import notesDe from '@in-browser/notes/i18n/help.de.js';
import notesEn from '@in-browser/notes/i18n/help.en.js';
import screenCaptureDe from '@in-browser/screen-capture/i18n/help.de.js';
import screenCaptureEn from '@in-browser/screen-capture/i18n/help.en.js';
import textEditorDe from '@in-browser/text-editor/i18n/help.de.js';
import textEditorEn from '@in-browser/text-editor/i18n/help.en.js';
import type { Locale, Messages } from './i18n/index.svelte.js';
import { TOOLS, type Tool } from './tools.js';

export type SuitePage = keyof Messages['help']['pages'];

/** Pages of the whole suite in the order shown, with their address */
export const SUITE_PAGES: readonly { id: SuitePage; path: string; icon: string }[] = [
	{ id: 'storage', path: '/help/storage', icon: 'icon-[material-symbols-light--folder-outline]' },
	{ id: 'sync', path: '/help/sync', icon: 'icon-[material-symbols-light--sync]' },
	{ id: 'connected', path: '/help/connected', icon: 'icon-[material-symbols-light--link]' },
	{ id: 'p2pNode', path: '/help/p2p-node', icon: 'icon-[material-symbols-light--dns-outline]' },
	{ id: 'install', path: '/help/install', icon: 'icon-[material-symbols-light--install-desktop]' }
];

/** Help of each tool in both languages (tools without help have no entry) */
export const TOOL_HELP: Record<Tool['id'], Record<Locale, HelpContent>> = {
	screenCapture: { en: screenCaptureEn, de: screenCaptureDe },
	files: { en: filesEn, de: filesDe },
	textEditor: { en: textEditorEn, de: textEditorDe },
	notes: { en: notesEn, de: notesDe }
};

/** Address of a tool's help page: `/help/<tool>` */
export function toolHelpPath(tool: Tool): string {
	return `/help${tool.url}`;
}

/** Every help page, for the sitemap check */
export function helpPaths(): string[] {
	return ['/help', ...SUITE_PAGES.map((page) => page.path), ...TOOLS.map(toolHelpPath)];
}
