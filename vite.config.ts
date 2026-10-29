import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

/** Commit being built (`abc1234`, `-dirty` with uncommitted changes), `dev` without git – shown in the footer */
function commit() {
	try {
		const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
		const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
		return dirty ? `${sha}-dirty` : sha;
	} catch {
		return 'dev';
	}
}

// One static app for the whole suite: the overview and every tool (under /<tool>) are prerendered;
// unknown paths get the shell 404.html (see wrangler.jsonc).
export default defineConfig(({ command }) => ({
	define: { __COMMIT__: JSON.stringify(command === 'build' ? commit() : 'dev') },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				// Packages and tools are linked via workspaces outside node_modules and therefore run with runes.
				runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
			},
			adapter: adapter({ fallback: '404.html' }),
			// Registration is handled by pwa.svelte.ts from @in-browser/brand (with update notice)
			serviceWorker: { register: false }
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					// Let Vite handle `icons.json?url` imports of the tools (Node would load the JSON itself)
					server: { deps: { inline: [/@iconify-json/] } },
					environment: 'node',
					include: ['{src,packages/*/src,tools/*/src}/**/*.{test,spec}.{js,ts}'],
					exclude: ['**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
}));
