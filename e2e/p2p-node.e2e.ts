import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sandboxArgs } from '../packages/p2p-node/src/sandbox.js';
import { watchProblems } from './fixtures.js';
import { fakeRelay } from './relay.js';

// The p2p-node (the built sync process, run in its sandbox like the starter does) keeps the files while the
// browsers are closed: the laptop adds a folder and goes offline, the phone gets it later from the node – together
// with a file written into the node's folder by hand.

const bundleDir = join(import.meta.dirname, '..', 'build', 'p2p-node');

test('a p2p-node passes changes on while the other devices are offline', async ({ browser }) => {
	test.setTimeout(150_000);
	const bundle = join(bundleDir, (await readdir(bundleDir)).find((name) => /^peer-.*\.js$/.test(name))!);
	const dir = await mkdtemp(join(tmpdir(), 'p2p-node-e2e-'));
	const sync = join(dir, 'sync');
	const folder = join(dir, 'files');
	await mkdir(sync);
	await mkdir(folder);

	const relay = fakeRelay();
	const relayUrl = await relay.listen();
	const children: ChildProcess[] = [];
	const output: string[] = [];
	const node = (...args: string[]) => {
		const child = spawn(process.execPath, [...sandboxArgs(bundle, sync, folder), bundle, args[0], sync, folder, ...args.slice(1)], {
			env: { ...process.env, IN_BROWSER_RELAYS: relayUrl }
		});
		child.stdout.on('data', (chunk) => output.push(String(chunk)));
		child.stderr.on('data', (chunk) => output.push(String(chunk)));
		children.push(child);
		return new Promise<number>((resolve) => child.on('exit', (code) => resolve(code ?? 1)));
	};

	const contextA = await browser.newContext({ locale: 'en-US' });
	const contextB = await browser.newContext({ locale: 'en-US' });
	await relay.attach(contextA);
	await relay.attach(contextB);
	const a = await contextA.newPage();
	let b = await contextB.newPage();
	const problems = [watchProblems(a), watchProblems(b)];

	try {
		// The laptop sets up the devices and adds the phone
		await a.goto('/files');
		await a.locator('aside').getByRole('button', { name: /^Sync/ }).click();
		await a.getByRole('button', { name: 'Connect devices' }).click();
		await a.getByRole('button', { name: 'Next' }).click();
		await a.getByLabel('Name of this device').fill('Laptop');
		await a.getByRole('button', { name: 'Next' }).click();
		let key = (await a.getByRole('dialog').locator('code').textContent())!.trim();
		await b.goto(`/files#pair=${key.replace(/-/g, '')}`);
		await b.getByLabel('Name of this device').fill('Phone');
		await b.getByRole('button', { name: 'Connect', exact: true }).click();
		await expect(b.getByText('Connected.')).toBeVisible({ timeout: 30_000 });
		await b.getByRole('button', { name: 'Close' }).click();

		// …and the node, with a new key
		await a.getByRole('button', { name: 'Add another device' }).click();
		await expect(a.getByRole('dialog').locator('code')).not.toHaveText(key);
		key = (await a.getByRole('dialog').locator('code').textContent())!.trim();
		expect(await node('pair', `http://localhost/files#pair=${key.replace(/-/g, '')}`, 'Server'), output.join('')).toBe(0);
		await expect(a.getByText('Server was added.')).toBeVisible({ timeout: 30_000 });
		await a.getByRole('button', { name: 'Close' }).click();
		await a.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();

		void node('run');
		await expect(a.locator('aside').getByText('2 of 2 devices connected')).toBeVisible({ timeout: 60_000 });

		// The phone goes offline; the laptop adds a folder, the node takes it, then the laptop goes offline too
		await b.close();
		await a.getByRole('button', { name: 'New folder' }).first().click();
		const input = a.getByRole('textbox', { name: /name/i });
		await input.fill('Projects');
		await input.press('Enter');
		await expect.poll(() => existsSync(join(folder, 'Projects')), { timeout: 60_000 }).toBe(true);
		await a.close();

		// Edited by hand in the node's folder while both browsers are closed
		await writeFile(join(folder, 'Projects', 'Notes.txt'), 'from the node');

		// The phone comes back and gets both from the node
		b = await contextB.newPage();
		problems.push(watchProblems(b));
		await b.goto('/files');
		await expect(b.getByRole('main').getByText('Projects', { exact: true })).toBeVisible({ timeout: 60_000 });
		await b.getByRole('main').getByText('Projects', { exact: true }).dblclick();
		await expect(b.getByRole('main').getByText('Notes.txt', { exact: true })).toBeVisible({ timeout: 60_000 });

		expect(problems.flat()).toEqual([]);
	} catch (e) {
		console.log(output.join(''));
		throw e;
	} finally {
		for (const child of children) child.kill();
		relay.close();
		await contextA.close();
		await contextB.close();
		await rm(dir, { recursive: true, force: true });
	}
});
