import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The rule files (`.claude/rules`) are the memory of the agents that program the suite: a file they name must exist,
// or the rule describes code that is gone (`rules.md`). Checked: paths in backticks with a folder and an extension,
// against the repository root and the folders the rule is about (its `paths`, each tool and package).

const RULES = '.claude/rules';
const EXTENSIONS = /\.(ts|svelte|js|mjs|css|html|md|json|jsonc|svg|sh|ps1|webmanifest|xml)$/;
/** Made by a build or outside the repository */
const GENERATED = /^(build|node_modules|\.svelte-kit|\.debug|~|\/)/;

const workspaces = ['packages', 'tools'].flatMap((dir) => readdirSync(dir).map((name) => join(dir, name)));
const roots = ['', 'src', ...workspaces, ...workspaces.map((dir) => join(dir, 'src'))];

function named(text: string): string[] {
	const found = new Set<string>();
	for (const [, token] of text.matchAll(/`([^`\s]+)`/g)) {
		// Placeholders, patterns, addresses and imports are no files
		if (/[<>*…{}$?#|=:@]/.test(token) || !token.includes('/') || !EXTENSIONS.test(token) || GENERATED.test(token)) continue;
		found.add(token.replace(/^\.\//, ''));
	}
	return [...found];
}

describe('rule files', () => {
	const files = readdirSync(RULES).filter((name) => name.endsWith('.md'));

	it.each(files)('%s names only files that exist', (name) => {
		const text = readFileSync(join(RULES, name), 'utf8');
		const own = [...text.matchAll(/^ {2}- "([^"*]+)\/\*\*"$/gm)].flatMap(([, dir]) => [dir, join(dir, 'src')]);
		const missing = named(text).filter((path) => ![...roots, ...own].some((root) => existsSync(join(root, path))));
		expect(missing).toEqual([]);
	});

	it.each(files)('%s refers only to rule files that exist and loads for folders that exist', (name) => {
		const text = readFileSync(join(RULES, name), 'utf8');
		const rules = [...text.matchAll(/`([a-z0-9-]+\.md)`/g)].map(([, file]) => file).filter((file) => !existsSync(join(RULES, file)));
		// The part of each `paths` entry before its first wildcard must be there
		const folders = [...text.matchAll(/^ {2}- "([^"]+)"$/gm)]
			.map(([, glob]) => glob.split('*')[0])
			.map((prefix) => (prefix.endsWith('/') || existsSync(prefix) ? prefix : dirname(prefix)))
			.filter((dir) => !existsSync(dir));
		expect([...new Set(rules)], 'rule files').toEqual([]);
		expect(folders, 'paths').toEqual([]);
	});
});
