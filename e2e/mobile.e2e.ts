import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.js';

// Files, Text Editor and Notes on a phone (project `mobile`: Pixel 7, touch only): everything without right-click,
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

test('Files: tap opens, long press and ⋯ show the actions, move, delete into the trash and restore without dragging', async ({ page, problems: _ }) => {
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
	// Deleting moves into the trash without a question; the message offers to undo it
	await expect(page.getByRole('option', { name: 'Archive' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Undo' }).tap();
	await expect(page.getByRole('option', { name: 'Archive' })).toBeVisible();
	await page.getByRole('button', { name: 'Actions for “Archive”' }).tap();
	await page.getByRole('menuitem', { name: 'Delete' }).tap();
	await expect(page.getByRole('option', { name: 'Archive' })).toHaveCount(0);

	// The trash (in the menu of the open folder on phones) restores it where it was
	await page.getByRole('button', { name: 'Actions for “Docs”' }).tap();
	await page.getByRole('menuitem', { name: 'Trash' }).tap();
	const trash = page.getByRole('dialog');
	await expect(trash.getByText('Archive', { exact: true })).toBeVisible();
	await trash.getByRole('button', { name: 'Restore' }).tap();
	await expect(trash.getByText('The trash is empty.')).toBeVisible();
	await trash.getByRole('button', { name: 'Close' }).tap();
	await expect(page.getByRole('option', { name: 'Archive' })).toBeVisible();
});

test('Text Editor: wraps lines, switches to the Markdown preview, edits a CSV as a table', async ({ page, problems }) => {
	await page.goto('/files');
	await page.evaluate(async () => {
		const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files', { create: true });
		const files = {
			'note.md': '# Hello\n\nA line long enough to need wrapping on a phone screen, so nothing scrolls sideways.',
			'people.csv': 'name,age\nAnna,31\nBen,4\n'
		};
		for (const [name, text] of Object.entries(files)) {
			const writable = await (await root.getFileHandle(name, { create: true })).createWritable();
			await writable.write(text);
			await writable.close();
		}
	});
	await page.goto('/text-editor?path=%2Fnote.md');
	const content = page.locator('.cm-content');
	await expect(content).toContainText('Hello');
	await expect(content).toHaveClass(/cm-lineWrapping/);

	const preview = page.getByRole('button', { name: 'Show Markdown preview' });
	await preview.tap();
	// (Not looked into: the frame is sandboxed without scripts, Playwright can't query inside it)
	const frame = page.locator('iframe[title="Markdown preview"]');
	await expect(frame).toBeVisible();
	await expect(frame).toHaveAttribute('srcdoc', /<h1[^>]*>Hello<\/h1>/);
	await expect(content).toBeHidden();
	await preview.tap();
	await expect(content).toBeVisible();

	// The table instead of the text; a tap selects a cell, a second one edits it – the text follows and is saved
	await page.goto('/text-editor?path=%2Fpeople.csv');
	await page.getByRole('button', { name: 'Show Table' }).tap();
	const cell = page.getByRole('gridcell', { name: 'Ben' });
	await cell.tap();
	await cell.tap();
	// By touch Enter starts a new line in the cell, ✓ saves it
	await page.keyboard.type('Bea');
	await page.keyboard.press('Enter');
	await page.keyboard.type('B.');
	await page.getByRole('button', { name: 'Apply' }).tap();
	await expect(page.getByRole('gridcell', { name: 'Bea ⏎ B.' })).toBeVisible();
	await page.getByRole('button', { name: 'Row 1: insert, move, delete …' }).tap();
	await page.getByRole('menuitem', { name: 'Delete row' }).tap();
	await expect(page.getByRole('gridcell', { name: 'Anna' })).toBeHidden();
	await expect(page.getByTitle('Saved')).toBeVisible();
	const saved = await page.evaluate(async () => {
		const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files');
		return (await (await root.getFileHandle('people.csv')).getFile()).text();
	});
	expect(saved).toBe('name,age\n"Bea\nB.",4\n');
	await page.getByRole('button', { name: 'Show Table' }).tap();
	await expect(content).toContainText('B.",4');

	// Playwright's own helper scripts are blocked in the script-less sandbox frame (that's the point of it)
	const own = (p: string) => p.includes("Blocked script execution in 'about:srcdoc'");
	problems.splice(0, problems.length, ...problems.filter((p) => !own(p)));
});

test('Notes: a finger draws, two fingers pinch, the palette works by tapping', async ({ page, problems: _ }) => {
	await page.goto('/notes');
	await page.getByRole('button', { name: 'New notebook' }).tap();
	await page.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(page.getByTestId('surface')).toBeVisible();
	const box = (await page.getByTestId('surface').boundingBox())!;
	const cdp = await page.context().newCDPSession(page);
	const touch = (type: string, points: { x: number; y: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });

	// One finger: a stroke
	const x = box.x + 60;
	const y = box.y + 120;
	await touch('touchStart', [{ x, y }]);
	for (let i = 1; i <= 12; i++) await touch('touchMove', [{ x: x + i * 15, y: y + Math.sin(i) * 10 }]);
	await touch('touchEnd', []);
	await expect.poll(() => savedItems(page)).toBe(1);

	// Two fingers: zoom changes, no stroke
	const zoom = page.getByTitle('Zoom');
	const before = await zoom.textContent();
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	await touch('touchStart', [{ x: cx - 30, y: cy }, { x: cx + 30, y: cy }]);
	for (let i = 1; i <= 8; i++) await touch('touchMove', [{ x: cx - 30 - i * 10, y: cy }, { x: cx + 30 + i * 10, y: cy }]);
	await touch('touchEnd', []);
	await expect(zoom).not.toHaveText(before!);

	// Palette: highlighter, its options, a color
	await page.getByRole('button', { name: 'Highlighter' }).tap();
	await page.getByRole('button', { name: 'Color, thickness and smoothing' }).tap();
	await page.getByRole('button', { name: 'Color #22c55e' }).tap();
	await page.getByRole('button', { name: 'Thickness 22' }).tap();
	await expect(page.getByRole('button', { name: 'Thickness 22' })).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: 'Strong' }).tap();
	await expect(page.getByRole('button', { name: 'Strong' })).toHaveAttribute('aria-pressed', 'true');
	expect(await savedItems(page)).toBe(1);

	// Help: full screen on the phone, topics in a list, closed by tapping
	await page.getByRole('banner').getByRole('button', { name: 'Help' }).tap();
	const help = page.getByRole('dialog', { name: 'Help' });
	await expect(help).toBeVisible();
	const helpBox = (await help.boundingBox())!;
	expect(helpBox.width).toBe(page.viewportSize()!.width);
	const topics = help.getByRole('combobox', { name: 'Topics' });
	await topics.selectOption({ index: 1 });
	await expect(help.getByRole('heading', { level: 3 })).toHaveText((await topics.locator('option:checked').textContent())!);
	await help.getByRole('button', { name: 'Close help' }).tap();
	await expect(help).toBeHidden();
});

/** Strokes saved in the notebook `Notebook.note` (OPFS) */
function savedItems(page: Page): Promise<number> {
	return page.evaluate(async () => {
		const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files');
		const pages = await (await root.getDirectoryHandle('Notebook.note')).getDirectoryHandle('pages');
		let count = 0;
		for await (const handle of (pages as unknown as { values(): AsyncIterable<FileSystemFileHandle> }).values()) {
			count += JSON.parse(await (await handle.getFile()).text()).items.length;
		}
		return count;
	});
}
