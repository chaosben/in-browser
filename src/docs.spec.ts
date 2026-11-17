import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Keeps README.md and THIRD_PARTY_LICENSES.md in step with the code (see .claude/rules/docs.md): every tool and
// package is in the README, every shipped npm package is in the license list, with the installed version.

const root = join(import.meta.dirname, '..');
const workspaces = ['tools', 'packages'].flatMap((dir) => readdirSync(join(root, dir)).map((name) => `${dir}/${name}`));
/** Type definitions only: nothing of them is shipped */
const typesOnly = (name: string) => name.startsWith('@types/') || name === '@iconify/types';

interface Pkg {
	name: string;
	version: string;
	dependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

function resolvePackage(name: string, from: string): string {
	for (let dir = from; ; dir = dirname(dir)) {
		const file = join(dir, 'node_modules', name, 'package.json');
		if (existsSync(file)) return file;
		if (dirname(dir) === dir) throw new Error(`${name} not installed (from ${from})`);
	}
}

/** Runtime dependencies of all tools and packages, with their own dependencies: name → installed versions */
function shipped(): Map<string, Set<string>> {
	const found = new Map<string, Set<string>>();
	const visit = (name: string, from: string) => {
		if (name.startsWith('@in-browser/') || typesOnly(name)) return;
		const file = resolvePackage(name, from);
		const pkg = JSON.parse(readFileSync(file, 'utf8')) as Pkg;
		const versions = found.get(pkg.name) ?? new Set();
		if (versions.has(pkg.version)) return;
		found.set(pkg.name, versions.add(pkg.version));
		const required = Object.keys(pkg.peerDependencies ?? {}).filter((peer) => !pkg.peerDependenciesMeta?.[peer]?.optional);
		for (const dep of [...Object.keys(pkg.dependencies ?? {}), ...required]) visit(dep, dirname(file));
	};
	for (const workspace of workspaces) {
		const pkg = JSON.parse(readFileSync(join(root, workspace, 'package.json'), 'utf8')) as Pkg;
		for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep, join(root, workspace));
	}
	return found;
}

describe('THIRD_PARTY_LICENSES.md', () => {
	const text = readFileSync(join(root, 'THIRD_PARTY_LICENSES.md'), 'utf8');
	const rows = text.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| ---'));
	const names = new Set([...text.matchAll(/`(@?[a-z0-9][\w./-]*(?:\/\*)?)`/g)].map((m) => m[1]));
	const covered = (name: string) => names.has(name) || (name.startsWith('@') && names.has(`${name.split('/')[0]}/*`));
	const packages = shipped();

	it('lists every shipped npm package (by its npm name in backticks)', () => {
		expect([...packages.keys()].filter((name) => !covered(name)).sort()).toEqual([]);
	});

	it('names the installed version (the first package of a row)', () => {
		const wrong: string[] = [];
		for (const row of rows) {
			const [component, version] = row.split('|').slice(1, 3).map((cell) => cell.trim());
			const name = /`(@?[a-z0-9][\w./-]*)`/.exec(component)?.[1];
			const listed = /^\d+\.\d+\.\d+$/.exec(version)?.[0];
			if (!name || !listed || !packages.has(name)) continue;
			if (!packages.get(name)!.has(listed)) wrong.push(`${name}: listed ${listed}, installed ${[...packages.get(name)!].join(', ')}`);
		}
		expect(wrong).toEqual([]);
	});
});

describe('README.md', () => {
	it('lists every tool and package', () => {
		const readme = readFileSync(join(root, 'README.md'), 'utf8');
		expect(workspaces.filter((workspace) => !readme.includes(`\`${workspace}\``))).toEqual([]);
	});
});
