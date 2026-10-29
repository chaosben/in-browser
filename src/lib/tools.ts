// Directory of all in-browser.de tools. A new tool needs an entry here and texts under
// `tools.<id>` in de.ts/en.ts; the card icon is the tool's favicon (static/<tool>/favicon.svg).

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
		url: '/screen-capture',
		icon: '/screen-capture/favicon.svg',
		requires: 'desktopBrowser'
	}
];
