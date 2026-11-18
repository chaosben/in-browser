import { describe, expect, it } from 'vitest';
import { viewsOf } from './registry';

const ids = (name: string, text = '') => viewsOf(name, () => text)?.views.map((v) => v.id) ?? null;

describe('viewsOf', () => {
	it('finds the views of a file by its name, case-insensitive', () => {
		expect(ids('README.md')).toEqual(['markdown']);
		expect(ids('data.CSV')).toEqual(['table']);
		expect(ids('a.tsv')).toEqual(['table']);
		expect(ids('package.json')).toEqual(['tree']);
		expect(ids('ci.yml')).toEqual(['tree']);
		expect(ids('Cargo.toml')).toEqual(['tree']);
		expect(ids('feed.xml')).toEqual(['tree']);
		expect(ids('index.html')).toEqual(['html']);
		expect(ids('app.properties')).toEqual(['tree']);
		expect(ids('notes.txt')).toBeNull();
		expect(ids('Makefile')).toBeNull();
	});
	it('offers several views where they fit, the first one by default', () => {
		expect(ids('log.jsonl')).toEqual(['table', 'tree']);
		expect(ids('log.ndjson')).toEqual(['table', 'tree']);
		expect(ids('logo.svg')).toEqual(['svg', 'tree']);
		expect(viewsOf('log.jsonl', () => '')?.type).toBe('.jsonl');
	});
	it('knows .env files by their whole name', () => {
		expect(viewsOf('.env', () => '')?.type).toBe('.env');
		expect(ids('.env.local')).toEqual(['tree']);
		expect(ids('my.env.backup')).toBeNull();
	});
	it('gives .conf files a view only when they look like INI', () => {
		expect(ids('app.conf', '[main]\nkey = value\n')).toEqual(['tree']);
		expect(ids('nginx.conf', 'server {\n  listen 80;\n  location / {\n    root /var/www;\n  }\n}\n')).toBeNull();
	});
	it('loads every format', async () => {
		for (const name of ['a.md', 'a.html', 'a.svg', 'a.csv', 'a.json', 'a.jsonl', 'a.yaml', 'a.toml', 'a.xml', 'a.ini', '.env']) {
			for (const spec of viewsOf(name, () => '[a]\nb = 1')!.views) expect(await spec.format?.()).not.toBeNull();
		}
	});
});
