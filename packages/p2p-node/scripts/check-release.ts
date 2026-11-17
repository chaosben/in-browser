import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, verifyManifest } from '../src/release.ts';

// Run by `npm run deploy` before uploading: the p2p-node files in build/ must carry a valid signature of the release
// key and match their checksums – otherwise every node would refuse the update.

const out = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'build', 'p2p-node');
const fail = (text: string) => {
	console.error(`p2p-node: ${text}`);
	process.exit(1);
};

const bytes = new Uint8Array(await readFile(join(out, 'version.json')));
const signature = await readFile(join(out, 'version.json.sig'), 'utf8').catch(() => fail('unsigned build – the release key is missing (see packages/p2p-node/scripts/build.ts)'));
const manifest = await verifyManifest(bytes, signature!);
if (!manifest) fail('the signature of version.json is not valid for RELEASE_KEY');
for (const file of [manifest!.peer, manifest!.starter]) {
	if ((await sha256(new Uint8Array(await readFile(join(out, file.file))))) !== file.sha256) fail(`${file.file} doesn't match version.json`);
}
console.log(`p2p-node ${manifest!.commit}: signed`);
