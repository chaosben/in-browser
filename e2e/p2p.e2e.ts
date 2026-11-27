import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { watchProblems } from './fixtures.js';
import { fakeRelay, type RelayEvent } from './relay.js';

// The P2P sync in one flow: two devices (separate browser contexts = separate OPFS and IndexedDB) pair with a one-time
// key and sync – through a fake relay, with real WebRTC between them – and one is removed. Then a guest share: A shares
// one folder; C – another browser, not one of A's devices – opens the link, gets only that folder as a synced copy
// (kept after reloading), writes into it (“Edit”), and loses it when A ends the share: nothing of it stays in C's
// storage – never in its My files, and the copy is deleted. The relays see only a few events.

/** Names in My files of a browser (its own storage, not what it sees live) */
function ownFiles(page: Page): Promise<string[]> {
	return page.evaluate(async () => {
		const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files', { create: true });
		const names: string[] = [];
		for await (const name of root.keys()) names.push(name);
		return names;
	});
}

/** Most events one key sent to one relay within a minute (public relays allow 60) */
/** Opens the sync dialog from the ribbon tab "Sync" of Files */
async function syncSettings(page: Page) {
	await page.locator('[data-tab="sync"]').click();
	await page.locator('[data-command="syncSettings"]:visible').click();
}

/** The sync state in the footer */
function syncStatus(page: Page, text: string) {
	return page.getByRole('contentinfo').getByRole('button', { name: `Sync status: ${text}` });
}

/** Opens a side panel of Files (a click on an open one would close it) */
async function openPanel(page: Page, id: string) {
	const button = page.locator(`[data-panel="${id}"]`);
	if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
	await expect(page.getByTestId('panel')).toBeVisible();
}

function busiestKey(events: RelayEvent[]): number {
	const byKey = new Map<string, number[]>();
	for (const e of events) byKey.set(`${e.relay} ${e.pubkey}`, [...(byKey.get(`${e.relay} ${e.pubkey}`) ?? []), e.at]);
	let max = 0;
	for (const times of byKey.values()) for (const t of times) max = Math.max(max, times.filter((u) => u >= t && u < t + 60_000).length);
	return max;
}


test('two devices pair, sync and can be removed; a guest gets a shared folder until the share ends', async ({ browser }) => {
	test.setTimeout(150_000);
	const relay = fakeRelay();
	const contextA = await browser.newContext({ locale: 'en-US' });
	const contextB = await browser.newContext({ locale: 'en-US' });
	await relay.attach(contextA);
	await relay.attach(contextB);
	const a = await contextA.newPage();
	const b = await contextB.newPage();
	const problems = [...[a, b].map(watchProblems)];

	// A has a folder with a file before B joins (B will leave it out while setting up)
	await a.goto('/files');
	await a.locator('[data-tab="home"]').click();
	await a.locator('[data-command="newFolder"]:visible').click();
	await a.getByRole('textbox', { name: /name/i }).fill('Archive');
	await a.getByRole('textbox', { name: /name/i }).press('Enter');
	await a.getByRole('option', { name: 'Archive' }).dblclick();
	await a.locator('[data-command="newTextFile"]:visible').click();
	await a.getByRole('textbox', { name: 'Rename' }).press('Enter');
	await a.goto('/files');

	// A: connect devices → how it works → name → key (closing returns to the sync dialog)
	// The ribbon tab "Sync" opens the sync dialog, which holds the rest
	await syncSettings(a);
	await a.getByRole('button', { name: 'Connect devices' }).click();
	await expect(a.getByRole('heading', { name: 'How it works', exact: true })).toBeVisible();
	await a.getByRole('dialog').getByRole('tab', { name: 'For experts' }).click();
	await expect(a.getByRole('dialog').getByText('Signaling')).toBeVisible();
	await a.getByRole('dialog').getByRole('tab', { name: 'Simple' }).click();
	await a.getByRole('button', { name: 'Next' }).click();
	await a.getByLabel('Name of this device').fill('Laptop');
	await a.getByRole('button', { name: 'Next' }).click();
	const key = (await a.getByRole('dialog').locator('code').textContent())!.trim();
	expect(key).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){4}$/);

	// B: opens the pairing link
	await b.goto(`/files#pair=${key.replace(/-/g, '')}`);
	await expect(b.getByRole('heading', { name: 'Connect this device' })).toBeVisible();
	await expect(b.getByRole('textbox', { name: 'Key' })).toHaveValue(key);
	await b.getByLabel('Name of this device').fill('Phone');
	await b.getByRole('button', { name: 'Connect', exact: true }).click();
	await expect(a.getByText('Phone was added.')).toBeVisible({ timeout: 30_000 });
	// B looks first, then syncs: it leaves “Archive” out and starts
	const choose = b.getByRole('dialog', { name: 'Choose what this device syncs' });
	await expect(choose).toBeVisible({ timeout: 30_000 });
	await choose.getByRole('checkbox', { name: 'Archive' }).uncheck();
	await choose.getByRole('button', { name: 'Start syncing' }).click();
	await expect(choose).toBeHidden();
	await a.getByRole('button', { name: 'Close', exact: true }).click();
	// Back in the sync dialog, which now lists the phone
	await expect(a.getByRole('heading', { name: 'Sync', exact: true })).toBeVisible();
	await a.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();

	// Both see each other: short status in the footer, details in the dialog
	await expect(syncStatus(a, '1 of 1 devices connected')).toBeVisible({ timeout: 30_000 });
	await syncSettings(b);
	await expect(b.getByRole('dialog').getByText('Laptop')).toBeVisible();
	await b.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();

	// A goes to the overview and back into Files: pages change without reloading, so its device and the connection
	// stay (a page loaded anew would start both again, and the other device would see it gone for seconds)
	await a.evaluate(() => ((window as unknown as { sameTab: boolean }).sameTab = true));
	await a.getByRole('banner').locator('a[href="/"]').click();
	await expect(a.getByRole('searchbox', { name: 'Search tools' })).toBeVisible();
	await a.locator('main a[href="/files"]').first().click();
	await expect(a.getByRole('banner').getByText('Files', { exact: true })).toBeVisible();
	expect(await a.evaluate(() => (window as unknown as { sameTab?: boolean }).sameTab)).toBe(true);
	await expect(syncStatus(a, '1 of 1 devices connected')).toBeVisible({ timeout: 1500 });

	// A turns the troubleshooting log on
	await syncSettings(a);
	await a.getByText('Troubleshooting').click();
	await a.getByLabel('Record a log of the sync (devices and folder)').check();
	await a.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();

	// A creates a folder, it shows up on B
	await a.locator('[data-tab="home"]').click();
	await a.locator('[data-command="newFolder"]:visible').click();
	const input = a.getByRole('textbox', { name: /name/i });
	await input.fill('Projects');
	await input.press('Enter');
	await expect(b.getByRole('main').getByText('Projects', { exact: true })).toBeVisible({ timeout: 30_000 });
	// What B left out while setting up never came: it stays on A and opens live from there
	expect(await b.evaluate(async () => (await navigator.storage.getDirectory()).getDirectoryHandle('files').then((d) => d.getDirectoryHandle('Archive')).then(() => true, () => false))).toBe(false);
	await expect(b.getByRole('option', { name: 'Archive' })).toBeVisible();

	// B stops syncing it: the copy on B goes, the folder stays as a cloud and opens live from A
	await b.getByRole('option', { name: 'Projects' }).click({ button: 'right' });
	await b.getByRole('menuitem', { name: 'Don’t sync on this device' }).click();
	await b.getByRole('dialog').getByRole('button', { name: 'Don’t sync on this device' }).click();
	await expect
		.poll(() => b.evaluate(async () => (await navigator.storage.getDirectory()).getDirectoryHandle('files').then((d) => d.getDirectoryHandle('Projects')).then(() => true, () => false)))
		.toBe(false);
	await b.getByRole('option', { name: 'Projects' }).dblclick();
	await expect(b).toHaveURL(/path=%2FProjects/);
	await expect(b.getByText('Live from your other devices')).toBeVisible();
	// Written on B, lands on A
	await b.locator('[data-tab="home"]').click();
	await b.locator('[data-command="newTextFile"]:visible').click();
	await b.getByRole('textbox', { name: 'Rename' }).press('Enter');
	await a.getByRole('option', { name: 'Projects' }).dblclick();
	await expect(a.getByRole('option', { name: 'New text file.txt' })).toBeVisible({ timeout: 30_000 });
	await a.goto('/files');
	// B syncs it again: it comes back with the new file
	await b.goto('/files');
	await b.getByRole('option', { name: 'Projects' }).click({ button: 'right' });
	await b.getByRole('menuitem', { name: 'Sync again on this device' }).click();
	await expect
		.poll(
			() => b.evaluate(async () => (await navigator.storage.getDirectory()).getDirectoryHandle('files').then((d) => d.getDirectoryHandle('Projects')).then((d) => d.getFileHandle('New text file.txt')).then(() => true, () => false)),
			{ timeout: 30_000 }
		)
		.toBe(true);

	// A exports the log: it shows the sync and the folder
	await syncSettings(a);
	await a.getByText('Troubleshooting').click();
	await expect(a.getByRole('button', { name: 'Export log' })).toBeEnabled({ timeout: 10_000 });
	const [download] = await Promise.all([a.waitForEvent('download'), a.getByRole('button', { name: 'Export log' }).click()]);
	expect(download.suggestedFilename()).toMatch(/^in-browser-sync-log-Laptop-.*\.txt$/);
	const logContent = await (await download.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString());
	expect(logContent).toContain('# in-browser sync log');
	expect(logContent).toContain('/Projects');
	expect(logContent).toMatch(/\[p2p\] (sync|serve)\./);
	await a.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();

	// The footer of another tool shows the devices
	const editor = await contextB.newPage();
	problems.push(watchProblems(editor));
	await editor.goto('/text-editor');
	await expect(editor.getByRole('contentinfo').getByRole('button', { name: /Sync status: 1 of 1 devices connected/ })).toBeVisible({
		timeout: 30_000
	});
	await editor.close();

	// A removes the phone; B learns that it was removed
	await syncSettings(a);
	await a.getByRole('button', { name: 'Remove “Phone”' }).click();
	await a.getByRole('dialog').getByRole('button', { name: 'Remove device' }).click();
	await expect(a.getByRole('dialog').getByText('Phone')).toHaveCount(0);
	await a.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
	await expect(syncStatus(b, 'This device was removed from your devices')).toBeVisible({ timeout: 30_000 });

	// B resets to the start and keeps its files; the hint is gone and it can be connected again
	await syncSettings(b);
	await b.getByRole('button', { name: 'Reset, keep files' }).click();
	await expect(b.getByRole('dialog').getByRole('button', { name: 'Connect devices' })).toBeVisible();
	await expect(b.getByText('This device was removed from your devices.')).toHaveCount(0);
	await b.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
	await expect(b.getByRole('contentinfo').getByRole('button', { name: /^Sync status/ })).toHaveCount(0);
	await expect(b.getByRole('main').getByText('Projects', { exact: true })).toBeVisible();
	// Even after a reload the state stays reset
	await b.reload();
	await expect(b.getByRole('main').getByText('Projects', { exact: true })).toBeVisible({ timeout: 10_000 });
	await expect(b.getByRole('contentinfo').getByRole('button', { name: /^Sync status/ })).toHaveCount(0);

	// --- A guest share ---
	const contextC = await browser.newContext({ locale: 'en-US' });
	await relay.attach(contextC);
	const c = await contextC.newPage();
	problems.push(watchProblems(c));

	// A: a folder with a file, shared for editing
	await a.goto('/files');
	await a.evaluate(async () => {
		const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files', { create: true });
		const trip = await root.getDirectoryHandle('Trip', { create: true });
		const writable = await (await trip.getFileHandle('plan.txt', { create: true })).createWritable();
		await writable.write('day 1: lake');
		await writable.close();
		await root.getDirectoryHandle('Private', { create: true });
	});
	await a.reload();
	// “Share a folder …” under “Shares”: pick the folder, then what the guest may
	await openPanel(a, 'shares');
	const shares = a.getByTestId('panel').getByRole('region', { name: 'Shares' });
	await shares.getByRole('button', { name: 'Share a folder …' }).click();
	const picker = a.getByRole('dialog').filter({ hasText: 'Choose a folder to share' });
	await picker.getByRole('option', { name: 'Trip' }).dblclick();
	await picker.getByRole('button', { name: 'Share this folder' }).click();
	const dialog = a.getByRole('dialog').filter({ hasText: 'Share “Trip”' });
	await dialog.getByLabel('Edit').check();
	await dialog.getByRole('button', { name: 'Share', exact: true }).click();
	const link = await dialog.getByRole('textbox').inputValue();
	expect(link).toMatch(/\/files#share=[0-9A-Z]{20}$/);
	await expect(dialog.getByText('Waiting for the guest')).toBeVisible();

	// C opens the link: the folder under “Connected”, only its content
	await c.goto(link.replace(/^https?:\/\/[^/]+/, ''));
	// A link can come from anywhere: nothing connects before the guest agreed
	await c.getByRole('dialog').filter({ hasText: 'Open this share?' }).getByRole('button', { name: 'Open share' }).click();
	await expect(c.getByRole('option', { name: 'plan.txt' })).toBeVisible({ timeout: 30_000 });
	await openPanel(c, 'folders');
	await expect(c.getByTestId('panel').getByText('Trip from Laptop', { exact: true })).toBeVisible();
	await expect(c.getByRole('option', { name: 'Private' })).toHaveCount(0);
	await expect(dialog.getByText('Guest connected.')).toBeVisible({ timeout: 10_000 });

	// A reload keeps the share (same tab, same guest)
	await c.reload();
	await expect(c.getByRole('option', { name: 'plan.txt' })).toBeVisible({ timeout: 30_000 });

	// C writes into it: lands on A
	await c.getByRole('main').click({ button: 'right', position: { x: 600, y: 400 } });
	await c.getByRole('menuitem', { name: 'New text file' }).click();
	await c.getByRole('textbox', { name: 'Rename' }).press('Enter');
	await expect
		.poll(() =>
			a.evaluate(async () => {
				const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files');
				const trip = await root.getDirectoryHandle('Trip');
				return trip.getFileHandle('New text file.txt').then(() => true, () => false);
			}),
			{ timeout: 15_000 }
		)
		.toBe(true);
	expect(await ownFiles(c)).toEqual([]);

	// A finds the share under “Shares” and ends it there
	await dialog.getByRole('button', { name: 'Close', exact: true }).click();
	const entry = shares.getByRole('list', { name: 'Folders shared with a guest' }).getByRole('button', { name: /^Trip/ });
	await expect(entry).toBeVisible();
	await entry.click({ button: 'right' });
	await a.getByRole('menuitem', { name: 'End share' }).click();
	await a.getByRole('dialog').getByRole('button', { name: 'End share' }).click();
	await expect(entry).toHaveCount(0);

	// C is told right away, without reloading; “Remove” takes it back to its own files
	await expect(c.getByText('The share has ended.').first()).toBeVisible({ timeout: 10_000 });
	// Its copy went with the share
	await expect
		.poll(() =>
			c.evaluate(async () => {
				const shares = await (await navigator.storage.getDirectory()).getDirectoryHandle('shares').catch(() => null);
				const names: string[] = [];
				if (shares) for await (const name of shares.keys()) names.push(name);
				return names;
			})
		)
		.toEqual([]);
	await c.getByRole('button', { name: 'Remove' }).click();
	await expect(c).toHaveURL(/\/files$/);
	await expect(c.getByTestId('panel').getByText('Trip')).toHaveCount(0);
	expect(await ownFiles(c)).toEqual([]);

	// The folder menu also works in the tree: A deletes a folder from there
	await openPanel(a, 'folders');
	await a.getByTestId('panel').getByRole('treeitem', { name: 'Private' }).click({ button: 'right' });
	await a.getByRole('menuitem', { name: 'Delete' }).click();
	await expect(a.getByRole('option', { name: 'Private' })).toHaveCount(0);
	await expect(a.getByText('“Private” is in the trash.')).toBeVisible();

	expect(busiestKey(relay.events())).toBeLessThan(30);
	expect(problems.flat()).toEqual([]);
	await contextA.close();
	await contextB.close();
	await contextC.close();
});
