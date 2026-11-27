// After `vite build`: allows exactly the inline scripts the built pages contain, by hash, in `build/_headers`.
// `static/_headers` writes `script-src 'self' 'unsafe-inline'` as the placeholder for a page policy (SvelteKit starts
// every page with an inline script, and the theme is set by one before the first paint); a served policy never has
// 'unsafe-inline' for scripts – all tools share one origin with the user's files, so injected markup must not run.
// There is one page policy (under `/*`); every group of pages (`/files*`, `/help*` …) gets a section with that
// policy and the hashes of its own pages. The build fails when a page policy would stay open.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const BUILD = 'build';
const PLACEHOLDER = "script-src 'self' 'unsafe-inline'";
/** The comment line in `static/_headers` after which the sections of the page groups are added */
const MARK = 'added here by `scripts/csp.ts`';
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

// The one page policy (the placeholder line under `/*`) and where the groups' sections go
const policyLine = lines.findIndex((line) => line.includes(PLACEHOLDER));
if (policyLine < 0 || lines.filter((line) => line.includes(PLACEHOLDER)).length !== 1) throw new Error('[csp] _headers needs exactly one page policy (under /*)');
const mark = lines.findIndex((line) => line.includes(MARK));
if (mark < 0) throw new Error('[csp] _headers lost the place for the sections of the page groups');

/** `/files/editor` → `/files`; the home page: the default section */
const groupOf = (url: string) => (url === '/' ? '' : '/' + url.split('/')[1]);
const fallback = pages.filter((page) => page.fallback).flatMap((page) => page.hashes);
const groups = new Map<string, string[]>();
for (const page of pages) if (!page.fallback) groups.set(groupOf(page.url), [...(groups.get(groupOf(page.url)) ?? []), ...page.hashes]);
if (!groups.has('')) throw new Error('[csp] no home page found');

/** The policy with the inline scripts of a group (and of the page for unknown paths, served under any) */
function policy(hashes: string[], pattern: string): string {
	const all = [...new Set([...hashes, ...fallback])].sort();
	const line = lines[policyLine].replace(PLACEHOLDER, `script-src 'self' ${all.join(' ')}`);
	// Cloudflare drops header lines over 2000 characters
	if (line.trim().length > 2000) throw new Error(`[csp] the policy of ${pattern} is too long (${line.trim().length})`);
	console.log(`csp ${pattern}: ${all.length} inline scripts allowed`);
	return line;
}

// The same policy for every group, only the hashes differ: a tab keeps the policy of the page it loaded first, so
// nothing else may depend on the page
const sections = [...groups]
	.filter(([group]) => group)
	.sort(([a], [b]) => a.localeCompare(b))
	.flatMap(([group, hashes]) => [`${group}*`, '  ! Content-Security-Policy', policy(hashes, `${group}*`), '']);
lines[policyLine] = policy(groups.get('')!, '/*');
lines.splice(mark + 1, 0, '', ...sections.slice(0, -1));
if (lines.some((line) => /script-src[^;]*'unsafe-inline'/.test(line))) throw new Error("[csp] a policy still allows 'unsafe-inline' scripts");
writeFileSync(join(BUILD, '_headers'), lines.join('\n'));
