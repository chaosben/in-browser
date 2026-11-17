import { expect, test } from '@playwright/test';
import { watchProblems } from './fixtures.js';
import { fakeRelay } from './relay.js';

// Two devices (separate browser contexts = separate OPFS and IndexedDB) pair with a one-time key and sync – through
// a fake relay, with real WebRTC between them

test('two devices pair, sync and can be removed', async ({ browser }) => {
	test.setTimeout(90_000);
	const relay = fakeRelay();
	const contextA = await browser.newContext({ locale: 'en-US' });
	const contextB = await browser.newContext({ locale: 'en-US' });
	await relay.attach(contextA);
	await relay.attach(contextB);
	const a = await contextA.newPage();
	const b = await contextB.newPage();
	const problems = [...[a, b].map(watchProblems)];

	// A: connect devices → how it works → name → key (closing returns to the sync dialog)
	await a.goto('/files');
	// The sidebar has one entry; the sync dialog holds the rest
	await expect(a.locator('aside').getByRole('button', { name: 'Connect devices' })).toHaveCount(0);
	await a.locator('aside').getByRole('button', { name: /^Sync/ }).click();
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
	await expect(b.getByText('Connected.')).toBeVisible({ timeout: 30_000 });
	await expect(a.getByText('Phone was added.')).toBeVisible({ timeout: 30_000 });
	await b.getByRole('button', { name: 'Close' }).click();
	await a.getByRole('button', { name: 'Close' }).click();
	// Back in the sync dialog, which now lists the phone
	await expect(a.getByRole('heading', { name: 'Sync', exact: true })).toBeVisible();
	await a.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();

	// Both see each other: short status in the sidebar, details in the dialog
	await expect(a.locator('aside').getByText('1 of 1 devices connected')).toBeVisible({ timeout: 30_000 });
	await b.locator('aside').getByRole('button', { name: /^Sync/ }).click();
	await expect(b.getByRole('dialog').getByText('Laptop')).toBeVisible();
	await b.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();

	// A turns the troubleshooting log on
	await a.locator('aside').getByRole('button', { name: /^Sync/ }).click();
	await a.getByText('Troubleshooting').click();
	await a.getByLabel('Record a log of the sync with your devices').check();
	await a.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();

	// A creates a folder, it shows up on B
	await a.getByRole('button', { name: 'New folder' }).first().click();
	const input = a.getByRole('textbox', { name: /name/i });
	await input.fill('Projects');
	await input.press('Enter');
	await expect(b.getByRole('main').getByText('Projects', { exact: true })).toBeVisible({ timeout: 30_000 });

	// A exports the log: it shows the sync and the folder
	await a.locator('aside').getByRole('button', { name: /^Sync/ }).click();
	await a.getByText('Troubleshooting').click();
	await expect(a.getByRole('button', { name: 'Export log' })).toBeEnabled({ timeout: 10_000 });
	const [download] = await Promise.all([a.waitForEvent('download'), a.getByRole('button', { name: 'Export log' }).click()]);
	expect(download.suggestedFilename()).toMatch(/^in-browser-sync-log-Laptop-.*\.txt$/);
	const logContent = await (await download.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString());
	expect(logContent).toContain('# in-browser sync log');
	expect(logContent).toContain('/Projects');
	await a.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();

	// The footer of another tool shows the devices
	const editor = await contextB.newPage();
	problems.push(watchProblems(editor));
	await editor.goto('/text-editor');
	await expect(editor.getByRole('contentinfo').getByRole('button', { name: /Sync status: 1 of 1 devices connected/ })).toBeVisible({
		timeout: 30_000
	});
	await editor.close();

	// A removes the phone; B learns that it was removed
	await a.locator('aside').getByRole('button', { name: /^Sync/ }).click();
	await a.getByRole('button', { name: 'Remove “Phone”' }).click();
	await a.getByRole('dialog').getByRole('button', { name: 'Remove device' }).click();
	await expect(a.getByRole('dialog').getByText('Phone')).toHaveCount(0);
	await a.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
	await expect(b.locator('aside').getByText('Removed from your devices')).toBeVisible({ timeout: 30_000 });

	// B resets to the start and keeps its files; the hint is gone and it can be connected again
	await b.locator('aside').getByRole('button', { name: /^Sync/ }).click();
	await b.getByRole('button', { name: 'Reset, keep files' }).click();
	await expect(b.getByRole('dialog').getByRole('button', { name: 'Connect devices' })).toBeVisible();
	await expect(b.getByText('This device was removed from your devices.')).toHaveCount(0);
	await b.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
	await expect(b.locator('aside').getByText('Not set up')).toBeVisible();
	await expect(b.getByRole('main').getByText('Projects', { exact: true })).toBeVisible();
	// Even after a reload the state stays reset
	await b.reload();
	await expect(b.locator('aside').getByText('Not set up')).toBeVisible({ timeout: 10_000 });

	expect(problems.flat()).toEqual([]);
	await contextA.close();
	await contextB.close();
});
