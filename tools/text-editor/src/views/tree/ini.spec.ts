import { describe, expect, it } from 'vitest';
import { iniFormat, insertSection, looksLikeIni } from './ini';
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
	it('reads root entries and sections', () => {
		const { root, error } = ini.parse(INI);
		expect(error).toBeNull();
		expect(keys(root)).toEqual(['name', 'debug', 'server', 'paths']);
		const server = child(root, 'server');
		expect(server).toMatchObject({ kind: 'section', id: '/server', can: { rename: true, remove: true, add: ['entry'] } });
		expect(values(server)).toEqual(['localhost', '8080 ; not a comment']);
		expect(child(root, 'paths', 'root')).toMatchObject({ value: '"/srv/app"', id: '/paths/root', kind: 'string' });
		expect(INI.slice(server.range.from, server.range.to)).toBe('[server]\nhost = localhost\nport: 8080 ; not a comment\n\n# about paths');
		const host = child(server, 'host');
		expect(INI.slice(host.range.from, host.range.to)).toBe('host = localhost');
		expect(INI.slice(host.keyRange!.from, host.keyRange!.to)).toBe('host');
	});
	it('reports a line that is neither comment, header nor pair', () => {
		expect(ini.parse('a = 1\njust words\n').error).toBe(6);
		expect(ini.parse('a = 1\n  = 2').error).toBe(8);
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
	it('inserts with the spacing of the first pair', () => {
		const root = ini.parse(INI).root;
		const entry = (key: string) => ({ kind: 'entry' as const, key, value: { kind: 'string' as const, text: 'v' } });
		expect(applyChanges(INI, ini.insert(INI, child(root, 'server'), 2, entry('x')))).toBe(INI.replace('not a comment\n', 'not a comment\nx = v\n'));
		expect(applyChanges(INI, ini.insert(INI, child(root, 'server'), 0, entry('x')))).toBe(INI.replace('[server]\n', '[server]\nx = v\n'));
		expect(applyChanges(INI, ini.insert(INI, root, 4, entry('x')))).toBe(INI.replace('debug=true\n', 'debug=true\nx = v\n'));
		const compact = 'a=1\n[s]\n';
		const r = ini.parse(compact).root;
		expect(applyChanges(compact, ini.insert(compact, child(r, 's'), 0, entry('b')))).toBe('a=1\n[s]\nb=v\n');
		const sections = '; top\n\n; about s\n[s]\n';
		expect(applyChanges(sections, ini.insert(sections, ini.parse(sections).root, 0, entry('k')))).toBe('; top\n\nk = v\n\n; about s\n[s]\n');
	});
	it('removes entries and whole sections', () => {
		const root = ini.parse(INI).root;
		expect(applyChanges(INI, ini.remove(INI, root, child(root, 'name')))).toBe(INI.replace('name = demo\n', ''));
		expect(applyChanges(INI, ini.remove(INI, root, child(root, 'server')))).toBe(INI.replace(/\[server\][^]*?(?=# about)/, ''));
		expect(applyChanges(INI, ini.remove(INI, root, child(root, 'paths')))).toBe(INI.slice(0, INI.indexOf('\n\n# about paths') + 1));
	});
	it('duplicates and moves within a section only', () => {
		const root = ini.parse(INI).root;
		const server = child(root, 'server');
		expect(applyChanges(INI, ini.duplicate(INI, server, child(server, 'host')))).toBe(INI.replace('host = localhost\n', 'host = localhost\nhost 2 = localhost\n'));
		expect(applyChanges(INI, ini.move(INI, server, child(server, 'host'), 1))).toBe(
			INI.replace('host = localhost\nport: 8080 ; not a comment', 'port: 8080 ; not a comment\nhost = localhost')
		);
		expect(ini.move(INI, root, child(root, 'debug'), 1)).toBeNull();
		expect(ini.move(INI, server, child(server, 'host'), -1)).toBeNull();
	});
	it('appends sections', () => {
		expect(applyChanges(INI, insertSection(INI, ini.parse(INI).root, 'new'))).toBe(`${INI}\n[new]\n`);
		expect(applyChanges('a=1', insertSection('a=1', ini.parse('a=1').root, 'new'))).toBe('a=1\n\n[new]\n');
		expect(applyChanges('', insertSection('', ini.parse('').root, 'new'))).toBe('[new]\n');
		expect(insertSection('', ini.parse('').root, 'a]b')).toBeNull();
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
	it('removes an entry with its continuation lines', () => {
		const root = props.parse(PROPS).root;
		expect(applyChanges(PROPS, props.remove(PROPS, root, child(root, 'multi')))).toBe(PROPS.replace(/multi[^]*?third\n/, ''));
	});
	it('writes escapes and keeps the separator style', () => {
		const root = props.parse(PROPS).root;
		const out = applyChanges(PROPS, props.setValue(PROPS, child(root, 'multi'), { kind: 'string', text: '  two\nlines\\ ü' }));
		expect(out).toBe(PROPS.replace(/first[^]*?third/, '\\ \\ two\\nlines\\\\ ü'));
		expect(child(props.parse(out).root, 'multi').value).toBe('  two\nlines\\ ü');
		const renamed = applyChanges(PROPS, props.rename(PROPS, child(root, 'path'), 'a b:c'));
		expect(child(props.parse(renamed).root, 'a b:c').value).toBe('C:\\temp');
		const added = applyChanges(PROPS, props.insert(PROPS, root, 6, { kind: 'entry', key: 'new', value: { kind: 'string', text: 'v' } }));
		expect(added).toBe(`${PROPS}new = v\n`);
	});
	it('duplicates and moves continued entries as a whole', () => {
		const root = props.parse(PROPS).root;
		const dup = applyChanges(PROPS, props.duplicate(PROPS, root, child(root, 'multi')));
		expect(child(props.parse(dup).root, 'multi 2').value).toBe('first, second, third');
		const moved = applyChanges(PROPS, props.move(PROPS, root, child(root, 'multi'), -1));
		expect(keys(props.parse(moved).root)).toEqual(['greeting', 'path', 'multi', 'spaced', 'key with=sep', 'empty']);
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
	it('reports broken lines and open quotes', () => {
		expect(env.parse('A=1\nnot a pair\n').error).toBe(4);
		expect(env.parse('A="open\n').error).toBe(2);
	});
	it('quotes values only where needed', () => {
		const root = env.parse(ENV).root;
		const plain = child(root, 'PLAIN');
		expect(applyChanges(ENV, env.setValue(ENV, plain, { kind: 'string', text: 'a-b.c:d/e@f' }))).toBe(ENV.replace('=value #', '=a-b.c:d/e@f #'));
		const out = applyChanges(ENV, env.setValue(ENV, plain, { kind: 'string', text: 'two words\n"q"' }));
		expect(out).toBe(ENV.replace('=value #', '="two words\\n\\"q\\"" #'));
		expect(child(env.parse(out).root, 'PLAIN').value).toBe('two words\n"q"');
	});
	it('keeps export when renaming, removing and moving', () => {
		const root = env.parse(ENV).root;
		expect(applyChanges(ENV, env.rename(ENV, child(root, 'DB_HOST'), 'HOST'))).toBe(ENV.replace('export DB_HOST', 'export HOST'));
		expect(env.rename(ENV, child(root, 'DB_HOST'), 'not valid')).toBeNull();
		expect(applyChanges(ENV, env.remove(ENV, root, child(root, 'MULTI')))).toBe(ENV.replace('MULTI="line one\nline two"\n', ''));
		const moved = applyChanges(ENV, env.move(ENV, root, child(root, 'DB_HOST'), 1));
		expect(moved).toBe(ENV.replace('export DB_HOST=localhost\nDB_PASS="s3cr\\"et\\n"', 'DB_PASS="s3cr\\"et\\n"\nexport DB_HOST=localhost'));
	});
	it('inserts and duplicates with keys .env can hold', () => {
		const root = env.parse(ENV).root;
		const out = applyChanges(ENV, env.insert(ENV, root, 1, { kind: 'entry', key: 'PORT', value: { kind: 'string', text: '5432' } }));
		expect(out).toBe(ENV.replace('localhost\n', 'localhost\nPORT=5432\n'));
		expect(env.insert(ENV, root, 0, { kind: 'entry', key: 'bad key', value: { kind: 'string', text: '' } })).toBeNull();
		const dup = applyChanges(ENV, env.duplicate(ENV, root, child(root, 'DB_HOST')));
		expect(dup).toBe(ENV.replace('localhost\n', 'localhost\nexport DB_HOST_2=localhost\n'));
	});
});
