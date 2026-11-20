import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { helpSearchTexts, type HelpContent } from '@in-browser/brand/help.js';
import { helpPaths, SUITE_PAGES, TOOL_HELP, toolHelpPath } from './help';
import de from './i18n/de';
import en from './i18n/en';
import { TOOLS } from './tools';

const root = new URL('../../', import.meta.url);

/** `keys` of every item: German and English must name the same number of key combinations */
function shape(content: HelpContent) {
	return Object.entries(content).flatMap(([topic, { items }]) =>
		Object.entries(items).map(([key, item]) => `${topic}.${key}:${item.keys?.map((combo) => combo.length).join(',') ?? ''}:${Object.keys(item.options ?? {}).join(',')}`)
	);
}

describe('help pages', () => {
	it('have a route and a sitemap entry each', () => {
		const sitemap = readFileSync(new URL('static/sitemap.xml', root), 'utf8');
		for (const path of helpPaths()) {
			expect(() => readFileSync(new URL(`src/routes${path}/+page.svelte`, root)), path).not.toThrow();
			expect(sitemap, path).toContain(`<loc>https://in-browser.org${path}</loc>`);
		}
	});

	it('cover every tool in both languages with the same entries', () => {
		for (const tool of TOOLS) {
			const help = TOOL_HELP[tool.id];
			expect(Object.keys(help.en).length, tool.id).toBeGreaterThan(0);
			expect(shape(help.de), tool.id).toEqual(shape(help.en));
		}
		for (const page of SUITE_PAGES) expect(shape(de.help.pages[page.id].topics)).toEqual(shape(en.help.pages[page.id].topics));
	});

	it('only link to existing help pages', () => {
		const paths = new Set(helpPaths());
		const contents: HelpContent[] = [...TOOLS.flatMap((tool) => Object.values(TOOL_HELP[tool.id])), ...[en, de].flatMap((m) => SUITE_PAGES.map((page) => m.help.pages[page.id].topics))];
		for (const content of contents) {
			for (const topic of Object.values(content)) {
				for (const item of Object.values(topic.items)) {
					expect(helpSearchTexts(item).join(' ')).not.toMatch(/undefined/);
					if (!item.link) continue;
					const [path, anchor] = item.link.href.split('#');
					expect(paths, item.link.href).toContain(path);
					if (anchor) {
						const target = [
							...SUITE_PAGES.map((page) => ({ path: page.path, topics: en.help.pages[page.id].topics as HelpContent })),
							...TOOLS.map((tool) => ({ path: toolHelpPath(tool), topics: TOOL_HELP[tool.id].en }))
						].find((page) => page.path === path);
						expect(target && Object.keys(target.topics), item.link.href).toContain(anchor);
					}
				}
			}
		}
	});
});
