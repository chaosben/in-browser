import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sha256, signManifest, toBase64Url, type Manifest } from './release.js';
import { updater, type Current } from './updates.js';

const ORIGIN = 'https://example.test';
const encode = (text: string) => new TextEncoder().encode(text);

let dir: string;
let files: Map<string, Uint8Array<ArrayBuffer>>;
let logs: string[];
let key: CryptoKeyPair;
let publicKey: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'p2p-node-updates-'));
	files = new Map();
	logs = [];
	key = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
	publicKey = toBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', key.publicKey)));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

/** Publishes a release on the fake site */
async function publish(commit: string, changes: { peer?: string; node?: number; starter?: { version: number; min: number }; signWith?: CryptoKey } = {}) {
	const peer = encode(changes.peer ?? `console.log(${JSON.stringify(commit)})`);
	const starter = encode(`// starter ${changes.starter?.version ?? 1}`);
	const manifest: Manifest = {
		commit,
		protocol: 1,
		node: changes.node ?? 26,
		peer: { file: `peer-${commit}.js`, sha256: await sha256(encode(`console.log(${JSON.stringify(commit)})`)) },
		starter: { file: 'starter.js', sha256: await sha256(starter), version: changes.starter?.version ?? 1, min: changes.starter?.min ?? 1 }
	};
	const bytes = encode(JSON.stringify(manifest));
	files.set(`${ORIGIN}/p2p-node/version.json`, bytes);
	files.set(`${ORIGIN}/p2p-node/version.json.sig`, encode(await signManifest(bytes, changes.signWith ?? key.privateKey)));
	files.set(`${ORIGIN}/p2p-node/peer-${commit}.js`, peer);
	files.set(`${ORIGIN}/p2p-node/starter.js`, starter);
}

function make(options: { starter?: string | null; online?: boolean } = {}) {
	return updater({
		bundles: join(dir, 'bundles'),
		origin: async () => ORIGIN,
		starter: options.starter ?? null,
		log: (text) => logs.push(text),
		key: publicKey,
		starterVersion: 1,
		nodeMajor: 26,
		fetch: (async (url: string) => {
			if (options.online === false) throw new Error('offline');
			const body = files.get(url);
			return body ? new Response(body) : new Response('missing', { status: 404 });
		}) as typeof fetch
	});
}

const current = async () => JSON.parse(await readFile(join(dir, 'bundles', 'current.json'), 'utf8')) as Current;

describe('updater', () => {
	it('loads a signed version and follows every change, keeping the one before', async () => {
		const updates = make();
		await publish('aaa');
		expect(await updates.update()).toBe('updated');
		expect(await current()).toEqual({ commit: 'aaa', file: 'peer-aaa.js', bad: [] });
		expect(await updates.update()).toBe('current');

		await publish('bbb');
		expect(await updates.update()).toBe('updated');
		expect(await current()).toMatchObject({ commit: 'bbb', previous: { commit: 'aaa', file: 'peer-aaa.js' } });

		await publish('ccc');
		await updates.update();
		// Only the current and the previous version stay
		expect(existsSync(join(dir, 'bundles', 'peer-aaa.js'))).toBe(false);
		expect(existsSync(join(dir, 'bundles', 'peer-bbb.js'))).toBe(true);
		// An older build on the site again (rollback of the site): followed as well
		await publish('aaa');
		expect(await updates.update()).toBe('updated');
		expect((await current()).commit).toBe('aaa');
	});

	it('refuses a version with a wrong signature or checksum', async () => {
		const updates = make();
		const other = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
		await publish('evil', { signWith: other.privateKey });
		expect(await updates.update()).toBe('refused');
		await publish('evil', { peer: 'process.exit()' });
		expect(await updates.update()).toBe('refused');
		expect(existsSync(join(dir, 'bundles', 'current.json'))).toBe(false);
		expect(logs.join('\n')).toMatch(/signature[\s\S]*checksum/);
	});

	it('stays on its version when the site is unreachable or needs a newer Node', async () => {
		await publish('aaa');
		await make().update();
		expect(await make({ online: false }).update()).toBe('failed');
		await publish('bbb', { node: 30 });
		expect(await make().update()).toBe('refused');
		expect((await current()).commit).toBe('aaa');
		expect((await make({ online: false }).ensure()).commit).toBe('aaa');
	});

	it('replaces the installed starter and asks for a restart when the new version needs it', async () => {
		const starter = join(dir, 'starter.js');
		await writeFile(starter, '// starter 1');
		await publish('aaa', { starter: { version: 2, min: 2 } });
		expect(await make({ starter }).update()).toBe('restart');
		expect(await readFile(starter, 'utf8')).toBe('// starter 2');
		// A starter that may not replace itself can't take this version
		expect(await make({ starter: null }).update()).toBe('refused');
	});

	it('goes back to the previous version once and never takes the failing one again', async () => {
		const updates = make();
		await publish('aaa');
		await updates.update();
		await publish('bbb');
		await updates.update();
		expect(await updates.rollback('bbb')).toBe(true);
		expect(await current()).toEqual({ commit: 'aaa', file: 'peer-aaa.js', bad: ['bbb'] });
		expect(await updates.update()).toBe('current');
		expect(await updates.rollback('aaa')).toBe(false);
		await publish('ccc');
		expect(await updates.update()).toBe('updated');
	});

	it('throws when there is no version at all', async () => {
		await expect(make({ online: false }).ensure()).rejects.toThrow(/could not be loaded/);
	});
});
