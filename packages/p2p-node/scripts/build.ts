import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { BRAND } from '../../brand/src/brand.ts';
import { RELEASE_KEY, sha256, signManifest, STARTER_VERSION, type Manifest } from '../src/release.ts';

// Builds what the site serves under /p2p-node/ (run after `vite build`, part of `npm run build`): the sync process
// and the starter as single files for Node, `version.json`, its signature and the install scripts.
//
// The signature needs the private release key: `P2P_NODE_SIGNING_KEY` (path to a JWK file), by default
// ~/.config/in-browser/p2p-node-signing-key.json – never in the repository. Without it the build is unsigned:
// fine for tests, but nodes refuse it, and `npm run deploy` stops (`scripts/check-release.ts`).

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(pkg, '..', '..');
const out = join(root, 'build', 'p2p-node');
/** Oldest starter that may run this sync process (raise it when the sync process needs something new of it) */
const STARTER_MIN = 1;
const NODE = 26;

function commit() {
	try {
		const sha = execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
		const dirty = execSync('git status --porcelain', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
		return dirty ? `${sha}-dirty` : sha;
	} catch {
		return 'dev';
	}
}

/** One self-contained ES module for Node (everything bundled but Node's own modules) */
async function bundle(entry: string, file: string) {
	await build({
		configFile: false,
		root: pkg,
		logLevel: 'warn',
		ssr: { noExternal: true, target: 'node' },
		build: {
			ssr: join(pkg, 'src', entry),
			outDir: out,
			emptyOutDir: false,
			target: `node${NODE}`,
			minify: false,
			copyPublicDir: false,
			rolldownOptions: { output: { entryFileNames: file, format: 'es', codeSplitting: false } }
		}
	});
	return new Uint8Array(await readFile(join(out, file)));
}

async function signingKey(): Promise<CryptoKey | null> {
	const file = process.env.P2P_NODE_SIGNING_KEY || join(homedir(), '.config', 'in-browser', 'p2p-node-signing-key.json');
	if (!existsSync(file)) return null;
	const jwk = JSON.parse(await readFile(file, 'utf8')) as JsonWebKey;
	if (jwk.x !== RELEASE_KEY) throw new Error(`${file} is not the key of RELEASE_KEY in packages/p2p-node/src/release.ts`);
	return crypto.subtle.importKey('jwk', jwk, 'Ed25519', false, ['sign']);
}

const version = commit();
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const peerFile = `peer-${version}.js`;
const peer = await bundle('peer.ts', 'peer.js');
await rename(join(out, 'peer.js'), join(out, peerFile));
const starter = await bundle('starter.ts', 'starter.js');

const auth = await readFile(join(root, 'packages', 'files', 'src', 'p2p', 'auth.ts'), 'utf8');
const protocol = Number(/export const PROTOCOL = (\d+);/.exec(auth)?.[1]);
if (!protocol) throw new Error('PROTOCOL not found in packages/files/src/p2p/auth.ts');

const manifest: Manifest = {
	commit: version,
	built: Date.now(),
	protocol,
	node: NODE,
	peer: { file: peerFile, sha256: await sha256(peer) },
	starter: { file: 'starter.js', sha256: await sha256(starter), version: STARTER_VERSION, min: STARTER_MIN }
};
const bytes = new TextEncoder().encode(JSON.stringify(manifest, null, '\t'));
await writeFile(join(out, 'version.json'), bytes);

const key = await signingKey();
if (key) await writeFile(join(out, 'version.json.sig'), await signManifest(bytes, key));
else console.warn('p2p-node: no release key – build is unsigned (nodes will refuse it, deploy stops).');

for (const script of ['install.sh', 'install.ps1']) {
	const text = await readFile(join(pkg, 'install', script), 'utf8');
	await writeFile(join(out, script), text.replaceAll('__ORIGIN__', BRAND.suiteUrl));
}
console.log(`p2p-node ${version}: ${(peer.length / 1024).toFixed(0)} KB sync process, ${key ? 'signed' : 'unsigned'}`);
