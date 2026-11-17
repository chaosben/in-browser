import { test } from '@playwright/test';

// Screenshots of every tool in both themes for a visual check, not a test: `SCREENS=dir npx playwright test screens`

const DIR = process.env.SCREENS;
test.skip(!DIR, 'set SCREENS to an output folder');

for (const path of ['/', '/files', '/text-editor', '/screen-capture']) {
	for (const scheme of ['light', 'dark'] as const) {
		test(`${path} ${scheme}`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: scheme });
			await page.setViewportSize({ width: 1280, height: 720 });
			await page.goto(path);
			await page.getByRole('banner').waitFor();
			await page.waitForTimeout(300);
			await page.screenshot({ path: `${DIR}/${path.slice(1) || 'overview'}-${scheme}.png`, fullPage: path === '/' });
		});
	}
}

// The device dialogs and panels, with two paired devices
for (const scheme of ['light', 'dark'] as const) {
	test(`devices ${scheme}`, async ({ browser }) => {
		test.setTimeout(90_000);
		const { fakeRelay } = await import('./relay.js');
		const relay = fakeRelay();
		const [ca, cb] = await Promise.all([browser.newContext({ colorScheme: scheme }), browser.newContext({ colorScheme: scheme })]);
		await relay.attach(ca);
		await relay.attach(cb);
		const a = await ca.newPage();
		const b = await cb.newPage();
		await a.setViewportSize({ width: 1280, height: 800 });
		await a.goto('/files');
		await a.screenshot({ path: `${DIR}/sidebar-off-${scheme}.png` });
		await a.locator('aside').getByRole('button', { name: /^Sync/ }).click();
		await a.screenshot({ path: `${DIR}/sync-dialog-off-${scheme}.png` });
		await a.getByRole('button', { name: 'Connect devices' }).click();
		await a.screenshot({ path: `${DIR}/explain-${scheme}.png` });
		await a.getByRole('tab', { name: 'For experts' }).click();
		await a.screenshot({ path: `${DIR}/explain-expert-${scheme}.png` });
		await a.getByRole('tab', { name: 'Simple' }).click();
		await a.getByRole('button', { name: 'Next' }).click();
		await a.screenshot({ path: `${DIR}/name-${scheme}.png` });
		await a.getByLabel('Name of this device').fill('Laptop office');
		await a.getByRole('button', { name: 'Next' }).click();
		const key = (await a.getByRole('dialog').locator('code').textContent())!.trim();
		await a.screenshot({ path: `${DIR}/pair-${scheme}.png` });
		await b.setViewportSize({ width: 390, height: 844 });
		await b.goto(`/files#pair=${key}`);
		await b.getByLabel('Name of this device').fill('Phone');
		await b.screenshot({ path: `${DIR}/join-${scheme}.png` });
		await b.getByRole('button', { name: 'Connect', exact: true }).click();
		await b.getByText('Connected.').waitFor({ timeout: 30_000 });
		await a.getByRole('button', { name: 'Close' }).click();
		await a.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
		await a.locator('aside').getByText('1 of 1 devices connected').waitFor({ timeout: 30_000 });
		await a.screenshot({ path: `${DIR}/sidebar-${scheme}.png` });
		await a.locator('aside').getByRole('button', { name: /^Sync/ }).click();
		await a.screenshot({ path: `${DIR}/devices-${scheme}.png` });
		await a.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
		await a.getByRole('contentinfo').getByRole('button', { name: /Sync status/ }).click();
		await a.screenshot({ path: `${DIR}/footer-menu-${scheme}.png` });
		await a.keyboard.press('Escape');
		await a.locator('aside').getByRole('button', { name: /^Sync/ }).click();
		await a.getByRole('button', { name: 'Choose folders' }).click();
		await a.getByRole('dialog').getByText('Choose folders').waitFor();
		await a.waitForTimeout(500);
		await a.screenshot({ path: `${DIR}/scope-${scheme}.png` });
		await a.keyboard.press('Escape');
		await a.getByRole('button', { name: 'How it works' }).click();
		await a.getByRole('tab', { name: 'For experts' }).click();
		await a.getByRole('heading', { name: 'Diagnostics' }).waitFor();
		await a.waitForTimeout(3500);
		await a.screenshot({ path: `${DIR}/diagnostics-${scheme}.png`, fullPage: true });
		await b.getByRole('button', { name: 'Close' }).click();
		await b.getByRole('button', { name: 'Open sync settings' }).click();
		await b.screenshot({ path: `${DIR}/phone-devices-${scheme}.png` });
		await ca.close();
		await cb.close();
	});
}
