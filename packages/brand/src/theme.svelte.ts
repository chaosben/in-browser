// Theme choice: “System” (no data-theme, daisyUI follows prefers-color-scheme) or fixed light/dark.
// The inline script from hooks.server.ts applies the stored choice before the first paint.

export type ThemeChoice = 'system' | 'light' | 'dark';

/** Key in `localStorage` (separate per subdomain) */
export const THEME_KEY = 'theme';

function read(): ThemeChoice {
	// No stored choice when prerendering (Node 26 would otherwise warn on accessing localStorage)
	if (typeof document === 'undefined') return 'system';
	try {
		const value = localStorage.getItem(THEME_KEY);
		return value === 'light' || value === 'dark' ? value : 'system';
	} catch {
		return 'system';
	}
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
	try {
		if (choice === 'system') localStorage.removeItem(THEME_KEY);
		else localStorage.setItem(THEME_KEY, choice);
	} catch {
		// Storage blocked: choice applies to this session only
	}
}
