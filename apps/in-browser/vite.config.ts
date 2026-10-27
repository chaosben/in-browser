import { appConfig } from '@in-browser/vite/vite.js';

// The home page is prerendered; unknown paths get the SPA shell 404.html (see wrangler.jsonc)
export default appConfig({ fallback: '404.html' });
