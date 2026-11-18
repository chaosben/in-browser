import { devices, test } from '@playwright/test';

// Screenshots of every tool in both themes for a visual check, not a test: `SCREENS=dir npx playwright test screens`

const DIR = process.env.SCREENS;
test.skip(!DIR, 'set SCREENS to an output folder');

for (const path of ['/', '/files', '/text-editor', '/screen-capture', '/notes']) {
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

// Text Editor: a CSV as a table and a JSON file as a tree, next to their text
for (const scheme of ['light', 'dark'] as const) {
	test(`text editor views ${scheme}`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: scheme });
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/files');
		await page.evaluate(async () => {
			const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files', { create: true });
			const files = {
				'people.csv': 'name,age,city\nAnna,31,"Berlin, Mitte"\nBen,4,Köln\nCarl,10,Hamburg\n',
				'config.json': '{\n  "name": "demo",\n  "list": [1, 2, 3],\n  "nested": {\n    "on": true,\n    "off": null\n  }\n}\n'
			};
			for (const [name, text] of Object.entries(files)) {
				const writable = await (await root.getFileHandle(name, { create: true })).createWritable();
				await writable.write(text);
				await writable.close();
			}
		});
		for (const [file, role] of [['people.csv', 'grid'], ['config.json', 'tree']] as const) {
			await page.goto(`/text-editor?path=%2F${file}`);
			await page.getByRole(role).waitFor();
			await page.waitForTimeout(300);
			await page.screenshot({ path: `${DIR}/text-editor-${role === 'grid' ? 'table' : 'tree'}-${scheme}.png` });
		}
	});
}

// The launcher on a phone, with recently used tools and Screen Capture's badge (phones have no screen capture)
for (const scheme of ['light', 'dark'] as const) {
	test(`phone launcher ${scheme}`, async ({ browser }) => {
		const context = await browser.newContext({ ...devices['Pixel 7'], colorScheme: scheme });
		await context.addInitScript(() => {
			delete (MediaDevices.prototype as Partial<MediaDevices>).getDisplayMedia;
			localStorage.setItem('recent-tools', JSON.stringify(['/notes', '/files', '/text-editor']));
		});
		const page = await context.newPage();
		await page.goto('/');
		await page.getByRole('region', { name: 'Recently used' }).waitFor();
		await page.screenshot({ path: `${DIR}/phone-launcher-${scheme}.png`, fullPage: true });
		await context.close();
	});
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

// Files and Text Editor on a phone (touch): list with ⋯ buttons, the menu of an entry, selection mode, editor, preview
for (const scheme of ['light', 'dark'] as const) {
	test(`phone ${scheme}`, async ({ browser }) => {
		const context = await browser.newContext({ ...devices['Pixel 7'], colorScheme: scheme });
		const page = await context.newPage();
		await page.goto('/files');
		await page.evaluate(async () => {
			const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files', { create: true });
			for (const name of ['Documents', 'Photos', 'Projects']) await root.getDirectoryHandle(name, { create: true });
			const writable = await (await root.getFileHandle('Notes.md', { create: true })).createWritable();
			await writable.write('# Notes\n\nA first line that is long enough to wrap on a phone.\n\n- one\n- two\n');
			await writable.close();
		});
		await page.reload();
		await page.getByRole('option', { name: 'Notes.md' }).waitFor();
		await page.screenshot({ path: `${DIR}/phone-files-${scheme}.png` });
		await page.getByRole('button', { name: 'Actions for “Photos”' }).tap();
		await page.screenshot({ path: `${DIR}/phone-files-menu-${scheme}.png` });
		await page.getByRole('menuitem', { name: 'Select all' }).tap();
		await page.screenshot({ path: `${DIR}/phone-files-selection-${scheme}.png` });
		await page.goto('/text-editor?path=%2FNotes.md');
		await page.locator('.cm-content').waitFor();
		await page.waitForTimeout(300);
		await page.screenshot({ path: `${DIR}/phone-editor-${scheme}.png` });
		await page.getByRole('button', { name: 'Show Markdown preview' }).tap();
		await page.waitForTimeout(300);
		await page.screenshot({ path: `${DIR}/phone-preview-${scheme}.png` });
		// Phones have no screen capture (Chromium on the desktop does)
		await page.addInitScript(() => delete (MediaDevices.prototype as Partial<MediaDevices>).getDisplayMedia);
		await page.goto('/screen-capture');
		await page.getByRole('alert').waitFor();
		await page.screenshot({ path: `${DIR}/phone-screen-capture-${scheme}.png` });
		await context.close();
	});
}

// Notes' shape tool: its panel on the desktop and the palette at 360 px (touch), then a lasso selection's colors
for (const scheme of ['light', 'dark'] as const) {
	test(`notes shapes ${scheme}`, async ({ browser }) => {
		for (const [name, options] of [
			['notes-shapes', { viewport: { width: 1280, height: 720 } }],
			['phone-notes-shapes', { ...devices['Pixel 7'], viewport: { width: 360, height: 740 } }]
		] as const) {
			const context = await browser.newContext({ ...options, colorScheme: scheme });
			const page = await context.newPage();
			await page.goto('/notes');
			await page.getByRole('button', { name: 'New notebook' }).click();
			await page.getByRole('button', { name: 'Save', exact: true }).click();
			await page.getByTestId('surface').waitFor();
			await page.getByRole('button', { name: 'Shapes' }).click();
			await page.getByRole('button', { name: 'Shapes' }).click();
			await page.waitForTimeout(300);
			await page.screenshot({ path: `${DIR}/${name}-${scheme}.png` });
			// A dragged rectangle, selected with the lasso, its color field open
			await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
			await page.getByRole('button', { name: 'Shapes' }).click();
			const box = (await page.getByTestId('surface').boundingBox())!;
			const [x, y] = [box.x + box.width / 2 - 60, box.y + 200];
			await page.mouse.move(x, y);
			await page.mouse.down();
			await page.mouse.move(x + 120, y + 70, { steps: 5 });
			await page.mouse.up();
			await page.getByRole('button', { name: 'Select', exact: true }).click();
			await page.mouse.move(x - 30, y - 30);
			await page.mouse.down();
			for (const [dx, dy] of [[180, 0], [180, 130], [0, 130], [0, 0]]) await page.mouse.move(x - 30 + dx, y - 30 + dy, { steps: 4 });
			await page.mouse.up();
			await page.getByRole('toolbar', { name: '1 item selected' }).getByRole('button', { name: 'Color', exact: true }).click();
			await page.screenshot({ path: `${DIR}/${name}-selection-${scheme}.png` });
			await context.close();
		}
	});
}
