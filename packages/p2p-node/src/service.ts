import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Running instances in the background: on Linux one systemd user unit template `in-browser-p2p-node@.service`
// (an instance per name), on Windows one scheduled task per name at logon.

export const UNIT = 'in-browser-p2p-node@.service';
export const unitName = (name: string) => `in-browser-p2p-node@${name}.service`;
export const taskName = (name: string) => `in-browser p2p-node (${name})`;

/** systemd needs paths with spaces quoted and `%` doubled */
const systemdArg = (arg: string) => `"${arg.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/%/g, '%%')}"`;

export function unitFile(node: string, starter: string): string {
	return [
		'[Unit]',
		'Description=in-browser p2p-node (%i)',
		'Wants=network-online.target',
		'After=network-online.target',
		'',
		'[Service]',
		`ExecStart=${systemdArg(node)} ${systemdArg(starter)} run %i`,
		'Restart=on-failure',
		'RestartSec=10',
		// Nothing it starts ever gains rights (setuid programs)
		'NoNewPrivileges=yes',
		'',
		'[Install]',
		'WantedBy=default.target',
		''
	].join('\n');
}

/** PowerShell command line of the scheduled task: starts the instance without a console window */
export function taskCommand(node: string, starter: string, name: string): string {
	const ps = (arg: string) => `'${arg.replace(/'/g, "''")}'`;
	return `powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process -WindowStyle Hidden -FilePath ${ps(node)} -ArgumentList ${ps(`"${starter}" run ${name}`)}"`;
}

const run = (command: string, args: string[]) => execFileSync(command, args, { stdio: 'inherit' });

export async function install(name: string, starter: string) {
	if (process.platform === 'win32') {
		run('schtasks', ['/Create', '/F', '/SC', 'ONLOGON', '/RL', 'LIMITED', '/TN', taskName(name), '/TR', taskCommand(process.execPath, starter, name)]);
		run('schtasks', ['/Run', '/TN', taskName(name)]);
		console.log(`Runs now and at every logon (scheduled task "${taskName(name)}").`);
		return;
	}
	if (process.platform !== 'linux' || !existsSync('/run/systemd/system')) {
		console.log(`No systemd here: start it yourself, e.g. at login: node "${starter}" run ${name}`);
		return;
	}
	const dir = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'systemd', 'user');
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, UNIT), unitFile(process.execPath, starter));
	run('systemctl', ['--user', 'daemon-reload']);
	run('systemctl', ['--user', 'enable', '--now', unitName(name)]);
	console.log(`Runs now and at every login (${unitName(name)}).`);
	console.log(`To keep it running while you are logged out: loginctl enable-linger ${process.env.USER ?? '$USER'}`);
	console.log(`Log: journalctl --user -u ${unitName(name)} -f`);
}

export async function uninstall(name: string) {
	if (process.platform === 'win32') {
		run('schtasks', ['/End', '/TN', taskName(name)]);
		run('schtasks', ['/Delete', '/F', '/TN', taskName(name)]);
		return;
	}
	if (process.platform !== 'linux' || !existsSync('/run/systemd/system')) return;
	run('systemctl', ['--user', 'disable', '--now', unitName(name)]);
}

