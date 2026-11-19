import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.js';

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

test('connect a folder, work in it live, save from the Text Editor and Notes, delete, disconnect', async ({ page, problems: _ }) => {
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
	const sidebar = page.locator('aside');
	await sidebar.getByRole('button', { name: 'Connect folder …' }).click();
	await expect(page.getByRole('option', { name: 'notes.txt' })).toBeVisible();
	await expect(page.getByRole('option', { name: 'Photos' })).toBeVisible();
	await expect(sidebar.getByRole('treeitem', { name: 'disk' })).toBeVisible();
	await expect(page.getByText('Live from “disk” on your computer')).toBeVisible();

	// Copying from My files into it (dragging across copies; here via the clipboard)
	await page.goto('/files');
	await page.getByRole('button', { name: 'Actions for “Files”' }).click();
	await page.getByRole('menuitem', { name: 'New folder' }).click();
	const input = page.getByRole('textbox', { name: 'Rename' });
	await input.fill('Mine');
	await input.press('Enter');
	await page.getByRole('option', { name: 'Mine' }).click();
	await page.keyboard.press('Control+c');
	await sidebar.getByRole('treeitem', { name: 'disk' }).getByRole('button', { name: 'disk' }).click();
	await expect(page.getByRole('option', { name: 'notes.txt' })).toBeVisible();
	await page.keyboard.press('Control+v');
	await expect(page.getByRole('option', { name: 'Mine' })).toBeVisible();
	expect(await diskNames(page)).toEqual(['Mine', 'Photos', 'notes.txt']);

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
	await page.goBack();
	await page.getByRole('option', { name: 'notes.txt' }).click();
	await page.keyboard.press('Delete');
	const question = page.getByRole('dialog');
	await expect(question.getByText('Delete for good?')).toBeVisible();
	await question.getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByRole('option', { name: 'notes.txt' })).toHaveCount(0);
	expect(await diskNames(page)).toEqual(['Mine', 'Photos']);

	// Notes keeps a notebook right in the folder and lists it on its start page
	await page.goto('/notes');
	await page.getByRole('button', { name: 'New notebook' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('combobox', { name: 'Place' }).selectOption({ label: 'disk' });
	await expect(dialog.getByRole('option', { name: 'Photos' })).toBeVisible();
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(/notes\/editor/);
	await expect.poll(() => diskNames(page)).toContain('Notebook.note');
	await page.goto('/notes');
	await expect(page.getByRole('link', { name: /Notebook/ }).first()).toBeVisible();
	await page.goto('/files');

	// Disconnecting leaves the folder as it is
	await sidebar.getByRole('treeitem', { name: 'disk' }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Disconnect' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Disconnect' }).click();
	await expect(sidebar.getByRole('treeitem', { name: 'disk' })).toHaveCount(0);
	await expect(page).toHaveURL(/\/files$/);
	expect(await diskNames(page)).toEqual(['Mine', 'Notebook.note', 'Photos']);
});

test('videos play in pieces through the Service Worker, also from My files', async ({ page, problems: _ }) => {
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
});
