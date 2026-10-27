import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

type KitConfig = NonNullable<Parameters<typeof sveltekit>[0]>;

interface AppOptions {
	/** SPA shell for paths without a prerendered page (see `not_found_handling` in wrangler.jsonc) */
	fallback: string;
	/** Additional SvelteKit options of the app (e.g. `serviceWorker`) */
	kit?: Omit<KitConfig, 'adapter' | 'compilerOptions'>;
}

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

// Shared setup of all in-browser.de apps: static build, Tailwind, runes, Vitest for pure logic.
export function appConfig({ fallback, kit }: AppOptions) {
	return defineConfig(({ command }) => ({
		define: { __COMMIT__: JSON.stringify(command === 'build' ? commit() : 'dev') },
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					// Shared packages are linked via workspaces outside node_modules and therefore run with runes.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				adapter: adapter({ fallback }),
				...kit
			})
		],
		test: {
			expect: { requireAssertions: true },
			projects: [
				{
					extends: true,
					test: {
						name: 'server',
						environment: 'node',
						include: ['src/**/*.{test,spec}.{js,ts}'],
						exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
					}
				}
			]
		}
	}));
}
