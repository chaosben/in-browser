// After `vite build`: allows exactly the inline scripts the built pages contain, by hash, in `build/_headers`.
// `static/_headers` writes `script-src 'self' 'unsafe-inline'` as the placeholder for a page policy (SvelteKit starts
// every page with an inline script, and the theme is set by one before the first paint); a served policy never has
// 'unsafe-inline' for scripts – all tools share one origin with the user's files, so injected markup must not run.
// The build fails when a page policy would stay open or a section finds no page.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const BUILD = 'build';
const PLACEHOLDER = "script-src 'self' 'unsafe-inline'";
/** Served for every unknown path, so under any section */
const FALLBACK = '404.html';

const htmlFiles = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? htmlFiles(path) : name.endsWith('.html') ? [path] : [];
	});

/** Hashes of the inline scripts of a page (JSON data blocks are not run and need none) */
function inlineHashes(file: string): string[] {
	const html = readFileSync(file, 'utf8');
	return [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
		.filter(([, attributes]) => !/type="application\/(ld\+)?json"/.test(attributes))
		.map(([, , code]) => `'sha256-${createHash('sha256').update(code).digest('base64')}'`);
}

/** `build/notes/editor.html` → `/notes/editor` */
function urlOf(file: string): string {
	const path = '/' + relative(BUILD, file).replace(/\\/g, '/').replace(/\.html$/, '');
	return path === '/index' ? '/' : path;
}

const pages = htmlFiles(BUILD).map((file) => ({ file, url: urlOf(file), hashes: inlineHashes(file), fallback: relative(BUILD, file) === FALLBACK }));
const lines = readFileSync(join(BUILD, '_headers'), 'utf8').split('\n');

// Sections: a line without indentation starts one; its pattern ends with `*` or is a path
const sections: { pattern: string; line: number }[] = [];
let pattern = '';
for (const [i, line] of lines.entries()) {
	if (line && !/^\s|^#/.test(line)) pattern = line.trim();
	else if (line.includes(PLACEHOLDER)) sections.push({ pattern, line: i });
}
const matches = (pattern: string, url: string) => (pattern.endsWith('*') ? url.startsWith(pattern.slice(0, -1)) : url === pattern);
/** A page takes the policy of the last section matching it (tool sections unset the default before theirs) */
const sectionOf = (url: string) => sections.findLast((section) => matches(section.pattern, url));

for (const section of sections) {
	const own = pages.filter((page) => page.fallback || sectionOf(page.url) === section);
	if (!own.some((page) => !page.fallback)) throw new Error(`[csp] no page for the section ${section.pattern} of _headers`);
	const hashes = [...new Set(own.flatMap((page) => page.hashes))].sort();
	lines[section.line] = lines[section.line].replace(PLACEHOLDER, `script-src 'self' ${hashes.join(' ')}`);
	// Cloudflare drops header lines over 2000 characters
	if (lines[section.line].trim().length > 2000) throw new Error(`[csp] the policy of ${section.pattern} is too long (${lines[section.line].trim().length})`);
	console.log(`csp ${section.pattern}: ${hashes.length} inline scripts allowed`);
}
if (lines.some((line) => /script-src[^;]*'unsafe-inline'/.test(line))) throw new Error("[csp] a policy still allows 'unsafe-inline' scripts");
writeFileSync(join(BUILD, '_headers'), lines.join('\n'));
