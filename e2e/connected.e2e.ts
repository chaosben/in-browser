import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.js';
import { fakeWebDav } from './webdav.js';

// A folder on the computer, connected in Files and opened live by every tool. Playwright can't operate the browser's
// folder picker, so it hands out a folder of the OPFS outside My files (same API as a folder on disk).

/** Names in the “folder on the computer” (`path`: inside it) */
function diskNames(page: Page, path: string[] = []): Promise<string[]> {
	return page.evaluate(async (path) => {
		let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('disk');
		for (const name of path) dir = await dir.getDirectoryHandle(name);
		const names: string[] = [];
		for await (const name of dir.keys()) names.push(name);
		return names.sort();
	}, path);
}

/** Text of a file in the folder; `null` while it is being written (reading it then fails) */
function diskText(page: Page, name: string): Promise<string | null> {
	return page.evaluate(async (name) => {
		const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('disk');
		return (await (await dir.getFileHandle(name)).getFile()).text().catch(() => null);
	}, name);
}

/** Opens a side panel of Files (a click on an open one would close it) */
async function openPanel(page: Page, id: string) {
	const button = page.locator(`[data-panel="${id}"]`);
	if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
	await expect(page.getByTestId('panel')).toBeVisible();
}

test('connect a folder, save into it from the Text Editor, delete (asked first), disconnect', async ({ page, problems: _ }) => {
	await page.addInitScript(() => {
		window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('disk', { create: true });
	});
	await page.goto('/files');
	await page.evaluate(async () => {
		const disk = await (await navigator.storage.getDirectory()).getDirectoryHandle('disk', { create: true });
		await disk.getDirectoryHandle('Photos', { create: true });
		const writable = await (await disk.getFileHandle('notes.txt', { create: true })).createWritable();
		await writable.write('first line');
		await writable.close();
	});

	// Connecting opens the folder: its content, its name in the path, nothing copied into My files
	const sidebar = page.getByTestId('panel');
	await openPanel(page, 'folders');
	await sidebar.getByRole('button', { name: 'Connect …' }).click();
	await page.getByRole('menuitem', { name: 'Folder on this computer …' }).click();
	await expect(page.getByRole('option', { name: 'notes.txt' })).toBeVisible();
	await expect(page.getByRole('option', { name: 'Photos' })).toBeVisible();
	await expect(sidebar.getByRole('treeitem', { name: 'disk' })).toBeVisible();
	await expect(page.getByText('Live from “disk” on your computer')).toBeVisible();

	// The Text Editor saves right into the folder
	await page.getByRole('option', { name: 'notes.txt' }).dblclick();
	await expect(page).toHaveURL(/text-editor/);
	const content = page.locator('.cm-content');
	await expect(content).toContainText('first line');
	await content.click();
	await page.keyboard.press('Control+End');
	await page.keyboard.type(' and more');
	await expect.poll(() => diskText(page, 'notes.txt')).toBe('first line and more');

	// Deleting there asks first: no trash
	await page.goto('/files');
	await openPanel(page, 'folders');
	await sidebar.getByRole('treeitem', { name: 'disk' }).getByRole('button', { name: 'disk' }).click();
	await page.getByRole('option', { name: 'notes.txt' }).click();
	await page.keyboard.press('Delete');
	const question = page.getByRole('dialog');
	await expect(question.getByText('Delete for good?')).toBeVisible();
	await question.getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByRole('option', { name: 'notes.txt' })).toHaveCount(0);
	expect(await diskNames(page)).toEqual(['Photos']);

	// Disconnecting leaves the folder as it is
	await sidebar.getByRole('treeitem', { name: 'disk' }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Disconnect' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Disconnect' }).click();
	await expect(sidebar.getByRole('treeitem', { name: 'disk' })).toHaveCount(0);
	await expect(page).toHaveURL(/\/files$/);
	expect(await diskNames(page)).toEqual(['Photos']);
});

test('a WebDAV server: wrong password refused, connect, upload, rename, delete for good', async ({ page }) => {
	const server = fakeWebDav('anna', 'secret');
	const url = await server.listen();
	server.files.set('/report.txt', { folder: false, data: Buffer.from('hello'), modified: new Date() });
	try {
		await page.goto('/files');
		await openPanel(page, 'folders');
		const sidebar = page.getByTestId('panel');
		await sidebar.getByRole('button', { name: 'Connect …' }).click();
		await page.getByRole('menuitem', { name: 'WebDAV server …' }).click();
		const dialog = page.getByRole('dialog', { name: 'Connect a WebDAV server' });
		await dialog.getByLabel('Address of the folder').fill(url);
		await dialog.getByLabel('User name').fill('anna');
		await dialog.getByLabel('Password or app password').fill('wrong');
		await dialog.getByLabel('Name', { exact: true }).fill('Cloud');
		await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
		await expect(dialog.getByText('The server didn’t accept the user name or password.')).toBeVisible();
		await dialog.getByLabel('Password or app password').fill('secret');
		await dialog.getByRole('button', { name: 'Connect', exact: true }).click();

		// It opens live: the server's file, its name in the panel, nothing in My files
		await expect(page.getByRole('option', { name: 'report.txt' })).toBeVisible();
		await expect(sidebar.getByRole('treeitem', { name: 'Cloud' })).toBeVisible();
		await expect(page.getByText('Live from “Cloud”')).toBeVisible();

		// Upload goes to the server
		await page.locator('[data-tab="home"]').click();
		await page.locator('[data-command="upload"]:visible').click();
		const chooser = page.waitForEvent('filechooser');
		await page.getByRole('menuitem', { name: 'Upload files' }).click();
		await (await chooser).setFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(3000, 7) });
		await expect.poll(() => server.files.get('/photo.jpg')?.data.length).toBe(3000);

		// Renaming moves it there
		await page.getByRole('option', { name: 'report.txt' }).click();
		await page.keyboard.press('F2');
		await page.getByRole('textbox', { name: 'Rename' }).fill('notes.txt');
		await page.getByRole('textbox', { name: 'Rename' }).press('Enter');
		await expect.poll(() => [...server.files.keys()].sort()).toEqual(['/', '/notes.txt', '/photo.jpg']);
		expect(server.files.get('/notes.txt')?.data.toString()).toBe('hello');

		// Deleting asks first: the server has no trash
		await page.getByRole('option', { name: 'photo.jpg' }).click();
		await page.keyboard.press('Delete');
		const question = page.getByRole('dialog');
		await expect(question.getByText('Delete for good?')).toBeVisible();
		await question.getByRole('button', { name: 'Delete' }).click();
		await expect.poll(() => server.files.has('/photo.jpg')).toBe(false);
		await expect(page.getByRole('option', { name: 'photo.jpg' })).toHaveCount(0);
	} finally {
		await server.close();
	}
});

test('videos play in pieces through the Service Worker, also from My files', async ({ page, problems }) => {
	await page.goto('/files');
	// The Service Worker has to control the page (first visit: it installs; the next load is controlled)
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload();
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
	// A short real video, recorded from a canvas
	await page.evaluate(async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 160;
		canvas.height = 90;
		const ctx = canvas.getContext('2d')!;
		const recorder = new MediaRecorder(canvas.captureStream(25), { mimeType: 'video/webm' });
		const parts: Blob[] = [];
		recorder.ondataavailable = (e) => parts.push(e.data);
		const done = new Promise((resolve) => (recorder.onstop = resolve));
		recorder.start();
		for (let i = 0; i < 20; i++) {
			ctx.fillStyle = `hsl(${i * 18} 80% 50%)`;
			ctx.fillRect(0, 0, 160, 90);
			await new Promise((r) => setTimeout(r, 40));
		}
		recorder.stop();
		await done;
		const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files', { create: true });
		const writable = await (await root.getFileHandle('clip.webm', { create: true })).createWritable();
		await writable.write(new Blob(parts, { type: 'video/webm' }));
		await writable.close();
	});
	await page.reload();
	await page.getByRole('option', { name: 'clip.webm' }).dblclick();
	const video = page.getByRole('dialog').locator('video');
	await expect(video).toHaveAttribute('src', /^\/_live\//);
	await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
	// Only media elements get the bytes: opened as a page (an SVG or HTML file would run in our origin) or fetched → 403
	const src = (await video.getAttribute('src'))!;
	expect(await page.evaluate((url) => fetch(url).then((r) => r.status), src)).toBe(403);
	// The browser reports the refused request itself – expected here
	await expect.poll(() => problems.some((p) => p.includes('403'))).toBe(true);
	problems.splice(0, problems.length, ...problems.filter((p) => !p.includes('403')));
	const tab = await page.context().newPage();
	const response = await tab.goto(src);
	expect(response?.status()).toBe(403);
	expect(response?.headers()['content-security-policy']).toContain('sandbox');
	await tab.close();
});
