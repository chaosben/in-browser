import type { Handle } from '@sveltejs/kit/hooks';
import { THEME_KEY } from './theme.svelte.js';

// Applies the stored theme choice before the first paint (prevents a flash of the wrong theme).
// Apps include it via `export { handle } from '@in-browser/brand/hooks.server.js'`; app.html contains
// the placeholder `%in-browser.theme%` for it.
const THEME_SCRIPT = `<script>
			try {
				const theme = localStorage.getItem('${THEME_KEY}');
				if (theme === 'light' || theme === 'dark') {
					document.documentElement.setAttribute('data-theme', theme);
					document.documentElement.style.colorScheme = theme;
				}
			} catch {}
		</script>`;

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, { transformPageChunk: ({ html }) => html.replace('%in-browser.theme%', THEME_SCRIPT) });
