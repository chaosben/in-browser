import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FORMATS } from '@in-browser/files/formats.js';

// The web app manifests are plain JSON that nothing else checks: the languages must not drift apart, and the
// installed suite must offer “Open with” for every tool's file format (`documents.md` “Files from and to other
// apps”) – a new format without its entry fails here.

type Manifest = Record<string, unknown> & { file_handlers?: { action: string; accept: Record<string, string[]> }[]; share_target?: unknown };

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Manifest;
const folders = ['static', ...readdirSync('static', { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(`static/${e.name}/manifest.webmanifest`)).map((e) => `static/${e.name}`)];

/** A manifest without what is written per language */
function shape(manifest: Manifest) {
	const { lang: _l, name: _n, short_name: _s, description: _d, shortcuts, ...rest } = manifest;
	return { ...rest, shortcuts: (shortcuts as Record<string, unknown>[] | undefined)?.map(({ name: _, ...s }) => s) };
}

describe('web app manifests', () => {
	it.each(folders)('%s: the German manifest differs only in its texts', (folder) => {
		expect(shape(read(`${folder}/manifest.de.webmanifest`))).toEqual(shape(read(`${folder}/manifest.webmanifest`)));
	});

	it('only the suite registers with the system, with “Open with” for every file format of a tool', () => {
		for (const folder of folders.filter((f) => f !== 'static')) {
			const manifest = read(`${folder}/manifest.webmanifest`);
			expect(manifest.share_target, folder).toBeUndefined();
			expect(manifest.file_handlers, folder).toBeUndefined();
		}
		const suite = read('static/manifest.webmanifest');
		expect(suite.share_target).toBeDefined();
		const expected = new Map<string, string[]>();
		for (const f of FORMATS) if (f.kind === 'file' && !f.fallback) expected.set(`/${f.tool}?open-with`, [...(expected.get(`/${f.tool}?open-with`) ?? []), f.ext]);
		const actual = new Map((suite.file_handlers ?? []).map((h) => [h.action, Object.values(h.accept).flat().sort()]));
		expect(actual).toEqual(new Map([...expected].map(([action, exts]) => [action, exts.sort()])));
	});
});
