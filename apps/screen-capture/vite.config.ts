import { appConfig } from '@in-browser/vite/vite.js';

export default appConfig({
	fallback: 'index.html',
	// Registration is handled by pwa.svelte.ts from @in-browser/brand (with update notice)
	kit: { serviceWorker: { register: false } }
});
