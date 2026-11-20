import { describe, expect, it } from 'vitest';
import { iniFormat } from './ini';
import { looksLikeIni } from './ini-detect';
import { applyChanges, type TreeNode } from './model';

const ini = iniFormat('ini');
const props = iniFormat('properties');
const env = iniFormat('env');
const child = (root: TreeNode, ...keys: string[]) => keys.reduce<TreeNode>((n, k) => n.children!.find((c) => c.key === k)!, root);
const keys = (n: TreeNode) => n.children!.map((c) => c.key);
const values = (n: TreeNode) => n.children!.map((c) => c.value);

const INI = `; global settings
name = demo
debug=true

[server]
host = localhost
port: 8080 ; not a comment

# about paths
[paths]
root = "/srv/app"
`;

describe('iniFormat ini', () => {
	it('reads root entries and sections, keeping text after a value separator', () => {
		const { root, error } = ini.parse(INI);
		expect(error).toBeNull();
		expect(keys(root)).toEqual(['name', 'debug', 'server', 'paths']);
		expect(values(child(root, 'server'))).toEqual(['localhost', '8080 ; not a comment']);
	});
	it.each([
		['ini', ini, 'a = 1\njust words\n', 6],
		['ini', ini, 'a = 1\n  = 2', 8],
		['env', env, 'A=1\nnot a pair\n', 4],
		['env', env, 'A="open\n', 2]
	])('reports broken lines (%s)', (_, format, doc, error) => {
		expect(format.parse(doc).error).toBe(error);
	});
	it('edits values and keys in place', () => {
		const root = ini.parse(INI).root;
		const out = applyChanges(INI, ini.setValue(INI, child(root, 'server', 'host'), { kind: 'string', text: 'example.org' }));
		expect(out).toBe(INI.replace('localhost', 'example.org'));
		expect(applyChanges(INI, ini.rename(INI, child(root, 'debug'), 'verbose'))).toBe(INI.replace('debug=', 'verbose='));
		expect(applyChanges(INI, ini.rename(INI, child(root, 'server'), 'web'))).toBe(INI.replace('[server]', '[web]'));
		expect(ini.rename(INI, child(root, 'debug'), 'a=b')).toBeNull();
		expect(ini.rename(INI, child(root, 'server'), 'a]')).toBeNull();
	});
	it('inserts with the spacing of the first pair, above the comment of the first section', () => {
		const entry = (key: string) => ({ kind: 'entry' as const, key, value: { kind: 'string' as const, text: 'v' } });
		const compact = 'a=1\n[s]\n';
		expect(applyChanges(compact, ini.insert(compact, child(ini.parse(compact).root, 's'), 0, entry('b')))).toBe('a=1\n[s]\nb=v\n');
		const sections = '; top\n\n; about s\n[s]\n';
		expect(applyChanges(sections, ini.insert(sections, ini.parse(sections).root, 0, entry('k')))).toBe('; top\n\nk = v\n\n; about s\n[s]\n');
	});
	it('removes entries and whole sections', () => {
		const root = ini.parse(INI).root;
		expect(applyChanges(INI, ini.remove(INI, root, child(root, 'name')))).toBe(INI.replace('name = demo\n', ''));
		expect(applyChanges(INI, ini.remove(INI, root, child(root, 'server')))).toBe(INI.replace(/\[server\][^]*?(?=# about)/, ''));
		expect(applyChanges(INI, ini.remove(INI, root, child(root, 'paths')))).toBe(INI.slice(0, INI.indexOf('\n\n# about paths') + 1));
	});
	it('tells INI-like texts from others', () => {
		expect(looksLikeIni(INI)).toBe(true);
		expect(looksLikeIni('server {\n  listen 80;\n}\n')).toBe(false);
		expect(looksLikeIni('# only comments\n')).toBe(false);
	});
});

const PROPS = `# app
greeting = Hello\\tWorld \\u00e9
path:C:\\\\temp
spaced value
multi = first, \\
        second, \\
        third
key\\ with\\=sep = x
! bang comment
empty
`;

describe('iniFormat properties', () => {
	it('reads separators, escapes and continuation lines', () => {
		const { root, error } = props.parse(PROPS);
		expect(error).toBeNull();
		expect(keys(root)).toEqual(['greeting', 'path', 'spaced', 'multi', 'key with=sep', 'empty']);
		expect(values(root)).toEqual(['Hello\tWorld é', 'C:\\temp', 'value', 'first, second, third', 'x', '']);
		const multi = child(root, 'multi');
		expect(PROPS.slice(multi.valueRange!.from, multi.valueRange!.to)).toBe('first, \\\n        second, \\\n        third');
	});
	it('removes and moves an entry with its continuation lines', () => {
		const root = props.parse(PROPS).root;
		expect(applyChanges(PROPS, props.remove(PROPS, root, child(root, 'multi')))).toBe(PROPS.replace(/multi[^]*?third\n/, ''));
		const moved = applyChanges(PROPS, props.move(PROPS, root, child(root, 'multi'), -1));
		expect(keys(props.parse(moved).root)).toEqual(['greeting', 'path', 'multi', 'spaced', 'key with=sep', 'empty']);
		expect(child(props.parse(moved).root, 'multi').value).toBe('first, second, third');
	});
	it('writes escapes and keeps the separator style', () => {
		const root = props.parse(PROPS).root;
		const out = applyChanges(PROPS, props.setValue(PROPS, child(root, 'multi'), { kind: 'string', text: '  two\nlines\\ ü' }));
		expect(out).toBe(PROPS.replace(/first[^]*?third/, '\\ \\ two\\nlines\\\\ ü'));
		expect(child(props.parse(out).root, 'multi').value).toBe('  two\nlines\\ ü');
		const renamed = applyChanges(PROPS, props.rename(PROPS, child(root, 'path'), 'a b:c'));
		expect(child(props.parse(renamed).root, 'a b:c').value).toBe('C:\\temp');
	});
});

const ENV = `# database
export DB_HOST=localhost
DB_PASS="s3cr\\"et\\n" # quoted
NAME='single $quoted'
PLAIN=value # comment
MULTI="line one
line two"
EMPTY=
`;

describe('iniFormat env', () => {
	it('reads quotes, export and comments', () => {
		const { root, error } = env.parse(ENV);
		expect(error).toBeNull();
		expect(keys(root)).toEqual(['DB_HOST', 'DB_PASS', 'NAME', 'PLAIN', 'MULTI', 'EMPTY']);
		expect(values(root)).toEqual(['localhost', 's3cr"et\n', 'single $quoted', 'value', 'line one\nline two', '']);
		const host = child(root, 'DB_HOST');
		expect(ENV.slice(host.range.from, host.range.to)).toBe('export DB_HOST=localhost');
		expect(ENV.slice(host.keyRange!.from, host.keyRange!.to)).toBe('DB_HOST');
	});
	it('quotes values only where needed', () => {
		const root = env.parse(ENV).root;
		const plain = child(root, 'PLAIN');
		expect(applyChanges(ENV, env.setValue(ENV, plain, { kind: 'string', text: 'a-b.c:d/e@f' }))).toBe(ENV.replace('=value #', '=a-b.c:d/e@f #'));
		const out = applyChanges(ENV, env.setValue(ENV, plain, { kind: 'string', text: 'two words\n"q"' }));
		expect(out).toBe(ENV.replace('=value #', '="two words\\n\\"q\\"" #'));
		expect(child(env.parse(out).root, 'PLAIN').value).toBe('two words\n"q"');
	});
	it('keeps export when renaming', () => {
		const root = env.parse(ENV).root;
		expect(applyChanges(ENV, env.rename(ENV, child(root, 'DB_HOST'), 'HOST'))).toBe(ENV.replace('export DB_HOST', 'export HOST'));
		expect(env.rename(ENV, child(root, 'DB_HOST'), 'not valid')).toBeNull();
	});
});
