import { BRAND } from './brand.js';

// Injected at build time via Vite `define` (see vite.config.ts); missing in tests and tools.
declare const __COMMIT__: string | undefined;

/** Commit the app was built from (`abc1234`, `abc1234-dirty` with uncommitted changes), otherwise `dev` */
export const COMMIT: string = typeof __COMMIT__ === 'string' ? __COMMIT__ : 'dev';

/** The repository, or one of its files, as of this build (`dev`: the default branch) */
export function sourceUrl(file?: string): string {
	const ref = COMMIT === 'dev' ? 'HEAD' : COMMIT.replace(/-dirty$/, '');
	if (file) return `${BRAND.repoUrl}/blob/${ref}/${file}`;
	return COMMIT === 'dev' ? BRAND.repoUrl : `${BRAND.repoUrl}/tree/${ref}`;
}
