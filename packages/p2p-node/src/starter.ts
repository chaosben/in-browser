import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, existsSync, renameSync, statSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXIT_REMOVED, PAIR_LINK, type FromPeer, type ToPeer } from './ipc.js';
import { sandboxArgs } from './sandbox.js';
import { install, uninstall } from './service.js';
import { readJson, writeAtomic } from './json.js';
import { updater } from './updates.js';

// The starter of the p2p-node (`starter.js`, installed once by `/p2p-node/install.sh` or `install.ps1`). It keeps
// the instances, fetches the sync process from the site (signed, see `release.ts`), runs it with Node's permission
// model (only its own folders, network) and swaps it for a new version when the site was updated.
//
// Data folder (`IN_BROWSER_P2P_NODE_HOME`, else ~/.local/share/in-browser-p2p-node or %LOCALAPPDATA%\…):
//   config.json                  { origin }
//   starter.js                   this program
//   bundles/current.json         version to run (see updates.ts)
//   bundles/peer-<commit>.js     sync processes (the current one and the one before)
//   instances/<name>/config.json { folder }
//   instances/<name>/sync/       identity, state, bases (the only place the sync process may write besides the folder)
//   instances/<name>/files/      synced folder unless another one was chosen
//   instances/<name>/node.log    log (also on stdout)

/** Node major version: the permission model with `--allow-net` (25) and the build target of the sync process */
const NODE_MIN = 26;
const CHECK_EVERY = 60 * 60_000;
const OUTDATED_CHECK_GAP = 5 * 60_000;
const LOG_LIMIT = 1 << 20;

const home =
	process.env.IN_BROWSER_P2P_NODE_HOME ||
	(process.platform === 'win32'
		? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'in-browser-p2p-node')
		: join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'in-browser-p2p-node'));
const bundles = join(home, 'bundles');
const instanceDir = (name: string) => join(home, 'instances', name);
const self = fileURLToPath(import.meta.url);

const log = (text: string) => console.log(new Date().toISOString(), text);

async function origin(): Promise<string> {
	const configured = process.env.IN_BROWSER_ORIGIN || (await readJson<{ origin?: string }>(join(home, 'config.json')))?.origin;
	if (!configured) throw new Error(`No origin in ${join(home, 'config.json')} – run the installer again`);
	return configured.replace(/\/+$/, '');
}

const updates = updater({
	bundles,
	origin,
	// Only the installed starter replaces itself (not one run from elsewhere, e.g. while developing)
	starter: self === join(home, 'starter.js') ? self : null,
	log
});

// --- Instances ---

interface InstanceConfig {
	folder: string;
}

function checkName(name: string | undefined): string {
	if (!name || !/^[A-Za-z0-9][A-Za-z0-9-]{0,31}$/.test(name)) {
		throw new Error('Name of the instance: letters, digits and "-" (e.g. "home" or "anna")');
	}
	return name;
}

async function instance(name: string): Promise<{ dir: string; sync: string; folder: string }> {
	const dir = instanceDir(name);
	const config = await readJson<InstanceConfig>(join(dir, 'config.json'));
	if (!config) throw new Error(`No instance "${name}" – pair it first: pair ${name}`);
	return { dir, sync: join(dir, 'sync'), folder: config.folder };
}

function logTo(file: string) {
	return (chunk: Buffer) => {
		process.stdout.write(chunk);
		try {
			if (existsSync(file) && statSync(file).size > LOG_LIMIT) renameSync(file, `${file}.1`);
			appendFileSync(file, chunk, { mode: 0o600 });
		} catch {
			// Logging must never stop the sync
		}
	};
}

function startPeer(bundle: string, command: string, sync: string, folder: string, args: string[], logFile?: string, env?: Record<string, string>): ChildProcess {
	const child = spawn(process.execPath, [...sandboxArgs(bundle, sync, folder), bundle, command, sync, folder, ...args], {
		stdio: logFile ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['inherit', 'inherit', 'inherit', 'ipc'],
		windowsHide: true,
		...(env && { env: { ...process.env, ...env } })
	});
	if (logFile) {
		child.stdout!.on('data', logTo(logFile));
		child.stderr!.on('data', logTo(logFile));
	}
	return child;
}

const exited = (child: ChildProcess) =>
	new Promise<number>((done) => child.on('exit', (code, signal) => done(code ?? (signal ? 1 : 0))));

async function pair(name: string, given: string | undefined, options: Record<string, string>, excluded: string[]) {
	const dir = instanceDir(checkName(name));
	// The link is a key: asked for here, so it is neither in the shell's history nor in the list of processes
	let link = given;
	if (!link) {
		const input = createInterface({ input: process.stdin, output: process.stdout });
		link = (await input.question('Link from "Add device" in Files: ')).trim();
		input.close();
	}
	const configFile = join(dir, 'config.json');
	const existing = await readJson<InstanceConfig>(configFile);
	const folder = options.folder ? resolve(options.folder) : (existing?.folder ?? join(dir, 'files'));
	await mkdir(join(dir, 'sync'), { recursive: true, mode: 0o700 });
	await mkdir(folder, { recursive: true });
	await writeAtomic(configFile, JSON.stringify({ folder } satisfies InstanceConfig));
	const now = await updates.ensure();
	const code = await exited(startPeer(join(bundles, now.file), 'pair', join(dir, 'sync'), folder, ['', options.name ?? '', ...excluded], undefined, { [PAIR_LINK]: link }));
	if (code === 0) {
		console.log(`\nSynced folder: ${folder}`);
		console.log(`Run it in the background: in-browser-p2p-node install ${name}`);
	}
	process.exitCode = code;
}

/** Runs one instance until stopped: restarts the sync process after crashes and swaps it on updates */
async function run(name: string) {
	const { dir, sync, folder } = await instance(checkName(name));
	const logFile = join(dir, 'node.log');
	const say = (text: string) => logTo(logFile)(Buffer.from(`${new Date().toISOString()} ${text}\n`));
	let child: ChildProcess | null = null;
	let running: string | null = null;
	let stopping = false;
	let crashes = 0;
	let lastOutdatedCheck = 0;

	const stopChild = () => child?.connected && child.send({ type: 'stop' } satisfies ToPeer);
	const shutdown = (code = 0) => {
		stopping = true;
		if (!child) process.exit(code);
		stopChild();
		setTimeout(() => child?.kill(), 70_000).unref();
		child.once('exit', () => process.exit(code));
	};
	process.on('SIGTERM', () => shutdown());
	process.on('SIGINT', () => shutdown());
	/** A new starter was installed: systemd restarts the unit after exit code 75, elsewhere it starts itself again */
	const restart = () => {
		if (process.env.INVOCATION_ID) return shutdown(75);
		spawn(process.execPath, [self, 'run', name], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
		shutdown();
	};

	const checkUpdate = async () => {
		if ((await updates.update()) === 'restart') return restart();
		const now = await updates.current();
		if (now && running && now.commit !== running) {
			say(`Switching to version ${now.commit} after the current sync.`);
			stopChild();
		}
	};
	setInterval(() => void checkUpdate(), CHECK_EVERY).unref();
	// Another instance may have taken an update: follow it
	setInterval(async () => {
		const now = await updates.current();
		if (now && running && now.commit !== running) stopChild();
	}, 60_000).unref();

	say(`Starting "${name}" (folder ${folder}).`);
	while (!stopping) {
		const now = await updates.ensure();
		running = now.commit;
		const started = Date.now();
		child = startPeer(join(bundles, now.file), 'run', sync, folder, [], logFile);
		child.on('message', (message: FromPeer) => {
			if (message.type === 'outdated' && Date.now() - lastOutdatedCheck > OUTDATED_CHECK_GAP) {
				lastOutdatedCheck = Date.now();
				say(`A device runs protocol version ${message.version}: looking for an update.`);
				void checkUpdate();
			}
		});
		const code = await exited(child);
		child = null;
		if (stopping) break;
		if (code === EXIT_REMOVED) {
			say('Stopped: this device is not (or no longer) paired.');
			process.exit(0);
		}
		if (code === 0) {
			crashes = 0;
			continue;
		}
		crashes = Date.now() - started < 60_000 ? crashes + 1 : 1;
		say(`The sync process ended with code ${code}.`);
		if (crashes >= 3 && (await updates.rollback(now.commit))) crashes = 0;
		await new Promise((r) => setTimeout(r, Math.min(60_000, 5000 * 2 ** Math.max(0, crashes - 1))));
	}
}

async function status(name?: string) {
	const names = name ? [checkName(name)] : await readdir(join(home, 'instances')).catch(() => [] as string[]);
	if (!names.length) return console.log('No instances yet. Pair one: pair <name>');
	const now = await updates.current();
	console.log(`Version: ${now?.commit ?? '–'} · data: ${home}\n`);
	for (const n of names) {
		const { sync, folder } = await instance(n);
		console.log(`[${n}]`);
		if (now) await exited(startPeer(join(bundles, now.file), 'status', sync, folder, []));
		console.log();
	}
}

const HELP = `in-browser p2p-node: keeps your files syncing with your devices while no browser is open.

  pair <name> [--folder <dir>] [--name <device name>] [--exclude <folder>]…
                        add this computer as a device; asks for the link "Add device" shows in
                        Files (it may also follow the name, but then stays in the shell's history);
                        --exclude leaves a folder of My files out (repeat it for more)
  run <name>            run an instance in the foreground
  install <name>        run it in the background (systemd user service / Windows task)
  uninstall <name>      stop running it in the background (keeps its data)
  status [<name>]       devices and folder of one or all instances
  update                look for a new version now

Several instances (e.g. one per person) each sync their own folder as their own device.`;

async function main() {
	const [command, ...rest] = process.argv.slice(2);
	const positional = rest.filter((arg, i) => !arg.startsWith('--') && !rest[i - 1]?.startsWith('--'));
	const options: Record<string, string> = {};
	rest.forEach((arg, i) => arg.startsWith('--') && (options[arg.slice(2)] = rest[i + 1] ?? ''));
	const excluded = rest.filter((arg, i) => rest[i - 1] === '--exclude');
	if (Number(process.versions.node.split('.')[0]) < NODE_MIN) throw new Error(`Needs Node ${NODE_MIN} or newer (this is ${process.versions.node}).`);
	switch (command) {
		case 'pair':
			if (!positional[0]) throw new Error('Usage: pair <name>');
			return pair(positional[0], positional[1], options, excluded);
		case 'run':
			return run(positional[0]);
		case 'install':
			await instance(checkName(positional[0]));
			return install(positional[0], self);
		case 'uninstall':
			return uninstall(checkName(positional[0]));
		case 'status':
			return status(positional[0]);
		case 'update': {
			const result = await updates.update();
			if (result === 'updated' && (await updates.current())?.previous) console.log('Running instances switch to the new version within a minute.');
			else if (result === 'current') console.log(`Up to date (${(await updates.current())?.commit}).`);
			else if (result === 'restart') console.log('The starter was updated; restart running instances to use it.');
			return;
		}
		default:
			console.log(HELP);
	}
}

main().catch((e: unknown) => {
	console.error(e instanceof Error ? e.message : e);
	process.exit(1);
});
