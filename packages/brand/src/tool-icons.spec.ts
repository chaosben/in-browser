import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { BRAND } from './brand.js';
import en from './i18n/en.js';
import { iconFiles, TOOL_ICONS } from './tool-icons.js';

const require = createRequire(import.meta.url);
const set = (name: string) => JSON.parse(readFileSync(require.resolve(`@iconify-json/${name}/icons.json`), 'utf8'));

describe('tool icons', () => {
	// `npm run icons` (vitest -u) rewrites the files after a change in tool-icons.ts
	it('static favicons and app icons match tool-icons.ts', async () => {
		const files = iconFiles(set('material-symbols'), en.tools, BRAND.suite);
		for (const [path, content] of Object.entries(files)) await expect(content).toMatchFileSnapshot(`../../../static/${path}`);
	});

	it('the UI glyph exists in the Light set', () => {
		const light = set('material-symbols-light');
		for (const icon of Object.values(TOOL_ICONS)) {
			expect(light.icons[icon.glyph] ?? light.aliases?.[icon.glyph]).toBeDefined();
			expect(icon.class).toBe(`icon-[material-symbols-light--${icon.glyph}]`);
		}
	});
});
