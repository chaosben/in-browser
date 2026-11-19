import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { watchProblems } from './fixtures.js';
import { fakeRelay, type RelayEvent } from './relay.js';

// A guest share: A shares one folder; C – another browser, not one of A's devices – opens the link, sees only that
// folder live (also after reloading), writes into it (“Edit”), and loses it when A ends the share. Nothing of it stays
// in C's storage, and the relays see only a few events.

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
function busiestKey(events: RelayEvent[]): number {
	const byKey = new Map<string, number[]>();
	for (const e of events) byKey.set(`${e.relay} ${e.pubkey}`, [...(byKey.get(`${e.relay} ${e.pubkey}`) ?? []), e.at]);
	let max = 0;
	for (const times of byKey.values()) for (const t of times) max = Math.max(max, times.filter((u) => u >= t && u < t + 60_000).length);
	return max;
}

test('a guest opens a shared folder live, edits it and is told when the share ends', async ({ browser }) => {
	test.setTimeout(90_000);
	const relay = fakeRelay();
	const contextA = await browser.newContext({ locale: 'en-US' });
	const contextC = await browser.newContext({ locale: 'en-US' });
	await relay.attach(contextA);
	await relay.attach(contextC);
	const a = await contextA.newPage();
	const c = await contextC.newPage();
	const problems = [a, c].map(watchProblems);

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
	const shares = a.locator('aside').getByRole('region', { name: 'Shares' });
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
	await expect(c.getByRole('option', { name: 'plan.txt' })).toBeVisible({ timeout: 30_000 });
	await expect(c.locator('aside').getByText('Trip', { exact: true })).toBeVisible();
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
	await dialog.getByRole('button', { name: 'Close' }).click();
	const entry = shares.getByRole('list', { name: 'Folders shared with a guest' }).getByRole('button', { name: /^Trip/ });
	await expect(entry).toBeVisible();
	await entry.click({ button: 'right' });
	await a.getByRole('menuitem', { name: 'End share' }).click();
	await a.getByRole('dialog').getByRole('button', { name: 'End share' }).click();
	await expect(entry).toHaveCount(0);

	// C is told right away, without reloading; “Remove” takes it back to its own files
	await expect(c.getByText('The share has ended.').first()).toBeVisible({ timeout: 10_000 });
	await c.getByRole('button', { name: 'Remove' }).click();
	await expect(c).toHaveURL(/\/files$/);
	await expect(c.locator('aside').getByText('Trip')).toHaveCount(0);
	expect(await ownFiles(c)).toEqual([]);

	// The folder menu also works in the tree: A deletes a folder from there
	await a.locator('aside').getByRole('treeitem', { name: 'Private' }).click({ button: 'right' });
	await a.getByRole('menuitem', { name: 'Delete' }).click();
	await expect(a.getByRole('option', { name: 'Private' })).toHaveCount(0);
	await expect(a.getByText('“Private” is in the trash.')).toBeVisible();

	expect(busiestKey(relay.events())).toBeLessThan(30);
	expect(problems.flat()).toEqual([]);
	await contextA.close();
	await contextC.close();
});
