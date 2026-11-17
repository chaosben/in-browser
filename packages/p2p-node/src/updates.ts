import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RELEASE_KEY, sha256, STARTER_VERSION, verifyManifest } from './release.js';

// Keeping the sync process up to date (used by the starter): the site's `version.json` is taken only with a valid
// signature, every file only with its signed checksum. `bundles/current.json` names the version to run and the one
// before (for going back when a new one keeps crashing). Several instances share the folder: every write goes
// through a temporary file, and each instance follows `current.json` when another one updated it.

export interface Current {
	commit: string;
	file: string;
	previous?: { commit: string; file: string };
	/** Commits that kept crashing here: not taken again */
	bad: string[];
}

export interface UpdaterOptions {
	/** Folder of the sync processes and `current.json` */
	bundles: string;
	/** Address of the site (`https://…`, no trailing slash) */
	origin: () => Promise<string>;
	/** The installed starter, replaced by a newer one from the site (`null`: never, e.g. while developing) */
	starter: string | null;
	log: (text: string) => void;
	/** For the specs */
	key?: string;
	starterVersion?: number;
	nodeMajor?: number;
	fetch?: typeof fetch;
}

/**
 * `updated`: `current.json` names a new version · `current`: nothing to do · `refused`: the site's version can't be
 * used here (logged why) · `failed`: no answer, try again later · `restart`: the starter was replaced and must
 * restart before it can run the new version
 */
export type UpdateResult = 'updated' | 'current' | 'refused' | 'failed' | 'restart';

async function readJson<T>(file: string): Promise<T | undefined> {
	try {
		return JSON.parse(await readFile(file, 'utf8')) as T;
	} catch {
		return undefined;
	}
}

export async function writeAtomic(file: string, data: string | Uint8Array) {
	const temp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
	await writeFile(temp, data, { mode: 0o600 });
	await rename(temp, file);
}

export function updater(options: UpdaterOptions) {
	const { bundles, log } = options;
	const key = options.key ?? RELEASE_KEY;
	const starterVersion = options.starterVersion ?? STARTER_VERSION;
	const nodeMajor = options.nodeMajor ?? Number(process.versions.node.split('.')[0]);
	const get = options.fetch ?? fetch;
	const currentFile = join(bundles, 'current.json');

	async function bytes(url: string): Promise<Uint8Array<ArrayBuffer>> {
		const response = await get(url, { cache: 'no-store', signal: AbortSignal.timeout(60_000) });
		if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
		return new Uint8Array(await response.arrayBuffer());
	}

	const current = () => readJson<Current>(currentFile);

	async function update(): Promise<UpdateResult> {
		let base: string;
		let manifestBytes: Uint8Array<ArrayBuffer>;
		let signature: Uint8Array<ArrayBuffer>;
		try {
			base = `${await options.origin()}/p2p-node`;
			[manifestBytes, signature] = await Promise.all([bytes(`${base}/version.json`), bytes(`${base}/version.json.sig`)]);
		} catch (e) {
			log(`Looking for updates failed: ${e instanceof Error ? e.message : e}`);
			return 'failed';
		}
		const manifest = await verifyManifest(manifestBytes, new TextDecoder().decode(signature), key);
		if (!manifest) {
			log('Update refused: the version on the site has no valid signature.');
			return 'refused';
		}
		const now = await current();
		if (manifest.commit === now?.commit && existsSync(join(bundles, now.file))) return 'current';
		if (now?.bad.includes(manifest.commit)) return 'current';
		if (manifest.node > nodeMajor) {
			log(`Version ${manifest.commit} needs Node ${manifest.node} or newer (this is Node ${nodeMajor}). Please update Node.`);
			return 'refused';
		}
		try {
			let replaced = false;
			if (manifest.starter.version > starterVersion && options.starter) {
				const starter = await bytes(`${base}/${manifest.starter.file}`);
				if ((await sha256(starter)) !== manifest.starter.sha256) {
					log(`Update refused: ${manifest.starter.file} doesn't match its signed checksum.`);
					return 'refused';
				}
				await writeAtomic(options.starter, starter);
				replaced = true;
				log(`Starter updated to version ${manifest.starter.version}.`);
			}
			if (manifest.starter.min > starterVersion) {
				if (replaced) return 'restart';
				log(`Version ${manifest.commit} needs a newer starter: run the installer again.`);
				return 'refused';
			}
			const peer = await bytes(`${base}/${manifest.peer.file}`);
			if ((await sha256(peer)) !== manifest.peer.sha256) {
				log(`Update refused: ${manifest.peer.file} doesn't match its signed checksum.`);
				return 'refused';
			}
			await mkdir(bundles, { recursive: true });
			await writeAtomic(join(bundles, manifest.peer.file), peer);
			const previous = now && now.commit !== manifest.commit ? { commit: now.commit, file: now.file } : now?.previous;
			const next: Current = { commit: manifest.commit, file: manifest.peer.file, previous, bad: now?.bad ?? [] };
			await writeAtomic(currentFile, JSON.stringify(next));
			// Keep the current and the previous version only
			for (const name of await readdir(bundles)) {
				if (/^peer-.*\.js$/.test(name) && name !== next.file && name !== next.previous?.file) await rm(join(bundles, name), { force: true });
			}
			log(now && now.commit !== manifest.commit ? `Updated from ${now.commit} to ${manifest.commit}.` : `Version ${manifest.commit} loaded.`);
			return 'updated';
		} catch (e) {
			log(`Loading the update failed: ${e instanceof Error ? e.message : e}`);
			return 'failed';
		}
	}

	/** The version to run; loads one from the site when there is none yet */
	async function ensure(): Promise<Current> {
		const now = await current();
		if (now && existsSync(join(bundles, now.file))) return now;
		await update();
		const loaded = await current();
		if (loaded && existsSync(join(bundles, loaded.file))) return loaded;
		throw new Error('The sync process could not be loaded from the site (see above).');
	}

	/** Back to the previous version when `commit` keeps crashing; `false` if there is none */
	async function rollback(commit: string): Promise<boolean> {
		const now = await current();
		if (!now?.previous || now.commit !== commit || !existsSync(join(bundles, now.previous.file))) return false;
		await writeAtomic(currentFile, JSON.stringify({ commit: now.previous.commit, file: now.previous.file, bad: [...now.bad, commit] } satisfies Current));
		log(`Version ${commit} keeps failing: back to ${now.previous.commit}.`);
		return true;
	}

	return { current, update, ensure, rollback };
}
