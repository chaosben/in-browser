// Directory of all in-browser.de tools. A new tool needs an entry here and texts under
// `tools.<id>` in de.ts/en.ts; the card icon lives in static/tools/.

import type { Messages } from './i18n/index.svelte.js';

export interface Tool {
	id: keyof Messages['tools'];
	url: string;
	icon: string;
	requires: keyof Messages['requires'];
}

export const TOOLS: readonly Tool[] = [
	{
		id: 'screenCapture',
		url: 'https://screen-capture.in-browser.de',
		icon: '/tools/screen-capture.svg',
		requires: 'desktopBrowser'
	}
];
