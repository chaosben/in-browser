import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.js';

// Files and Text Editor on a phone (project `mobile`: Pixel 7, touch only): everything without right-click,
// double-click, keyboard shortcuts or dragging

/** Holds a finger on the element (real touch events, so the page sees `pointerType: 'touch'`) */
async function longPress(page: Page, target: Locator) {
	const box = (await target.boundingBox())!;
	const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
	await page.waitForTimeout(800);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function newFolder(page: Page, name: string) {
	await page.getByRole('button', { name: 'Actions for “Files”' }).tap();
	await page.getByRole('menuitem', { name: 'New folder' }).tap();
	const input = page.getByRole('textbox', { name: 'Rename' });
	await input.fill(name);
	await input.press('Enter');
	await expect(page.getByRole('option', { name })).toBeVisible();
}

test('Files: tap opens, long press and ⋯ show the actions, move and delete without dragging', async ({ page, problems: _ }) => {
	await page.goto('/files');
	await newFolder(page, 'Docs');
	await newFolder(page, 'Inbox');

	// A tap opens the folder
	await page.getByRole('option', { name: 'Docs' }).tap();
	await expect(page).toHaveURL(/path=%2FDocs/);
	await page.goBack();
	await expect(page.getByRole('option', { name: 'Inbox' })).toBeVisible();

	// Long press: the menu of the entry
	await longPress(page, page.getByRole('option', { name: 'Inbox' }));
	await page.getByRole('menuitem', { name: 'Rename' }).tap();
	const input = page.getByRole('textbox', { name: 'Rename' });
	await input.fill('Archive');
	await input.press('Enter');
	await expect(page.getByRole('option', { name: 'Archive' })).toBeVisible();
	await page.getByRole('button', { name: 'Clear selection' }).tap();

	// ⋯ button: move into another folder with the folder dialog
	await page.getByRole('button', { name: 'Actions for “Archive”' }).tap();
	await page.getByRole('menuitem', { name: 'Move to …' }).tap();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('option', { name: 'Docs' }).tap();
	await dialog.getByRole('button', { name: 'Open' }).tap();
	await dialog.getByRole('button', { name: 'Move here' }).tap();
	await expect(page.getByRole('option', { name: 'Archive' })).toHaveCount(0);

	// Selection mode: long press selects, the bar holds the actions of the selection
	await page.getByRole('option', { name: 'Docs' }).tap();
	await expect(page.getByRole('option', { name: 'Archive' })).toBeVisible();
	await longPress(page, page.getByRole('option', { name: 'Archive' }));
	await page.keyboard.press('Escape');
	await expect(page.getByRole('option', { name: 'Archive' })).toHaveAttribute('aria-selected', 'true');
	await page.getByRole('button', { name: 'Actions for the selection' }).tap();
	await page.getByRole('menuitem', { name: 'Delete' }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).tap();
	await expect(page.getByRole('option', { name: 'Archive' })).toHaveCount(0);
});

test('Text Editor: wraps lines and switches between editor and Markdown preview', async ({ page, problems }) => {
	await page.goto('/files');
	await page.evaluate(async () => {
		const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files', { create: true });
		const writable = await (await root.getFileHandle('note.md', { create: true })).createWritable();
		await writable.write('# Hello\n\nA line long enough to need wrapping on a phone screen, so nothing scrolls sideways.');
		await writable.close();
	});
	await page.goto('/text-editor?path=%2Fnote.md');
	const content = page.locator('.cm-content');
	await expect(content).toContainText('Hello');
	await expect(content).toHaveClass(/cm-lineWrapping/);

	const preview = page.getByRole('button', { name: 'Markdown preview' });
	await preview.tap();
	// (Not looked into: the frame is sandboxed without scripts, Playwright can't query inside it)
	const frame = page.locator('iframe[title="Markdown preview"]');
	await expect(frame).toBeVisible();
	await expect(frame).toHaveAttribute('srcdoc', /<h1[^>]*>Hello<\/h1>/);
	await expect(content).toBeHidden();
	await preview.tap();
	await expect(content).toBeVisible();

	// Playwright's own helper scripts are blocked in the script-less sandbox frame (that's the point of it)
	const own = (p: string) => p.includes("Blocked script execution in 'about:srcdoc'");
	problems.splice(0, problems.length, ...problems.filter((p) => !own(p)));
});
