// Theme choice: “System” (no data-theme, daisyUI follows prefers-color-scheme) or fixed light/dark.
// The inline script from hooks.server.ts applies the stored choice before the first paint.

import { readStored, writeStored } from './storage.js';

export type ThemeChoice = 'system' | 'light' | 'dark';

/** Key in `localStorage` (separate per subdomain) */
export const THEME_KEY = 'theme';

function read(): ThemeChoice {
	// No stored choice when prerendering (Node 26 would otherwise warn on accessing localStorage)
	if (typeof document === 'undefined') return 'system';
	const value = readStored(THEME_KEY);
	return value === 'light' || value === 'dark' ? value : 'system';
}

export const theme = $state({ choice: read() });

export function setTheme(choice: ThemeChoice) {
	theme.choice = choice;
	const root = document.documentElement;
	if (choice === 'system') {
		root.removeAttribute('data-theme');
		root.style.colorScheme = '';
	} else {
		root.setAttribute('data-theme', choice);
		// Color native elements (scrollbars, form fields) to match
		root.style.colorScheme = choice;
	}
	writeStored(THEME_KEY, choice === 'system' ? null : choice);
}
