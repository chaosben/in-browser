import type { Locator, Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { expect, test } from './fixtures.js';
import { backup } from './jwl.js';
import { formPdf, getFile, putFile, shot } from './pdf.js';

// Files, Text Editor, Fonts and the PDF Editor on a phone (project `mobile`: Pixel 7, touch only): everything without
// right-click, double-click, keyboard shortcuts or dragging.

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
	// (after the last one the ribbon shows the tab “Selection”)
	await page.getByTestId('ribbon').getByRole('tab', { name: 'Home', exact: true }).tap();
	await page.locator('[data-command="newFolder"]:visible').tap();
	const input = page.getByRole('textbox', { name: 'Rename' });
	await input.fill(name);
	await input.press('Enter');
	await expect(page.getByRole('option', { name })).toBeVisible();
}

test('Files: tap opens, long press and ⋯ show the actions, move, delete into the trash and restore from it without dragging', async ({ page, problems: _ }) => {
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
	// The ribbon switched to the tab "Selection"
	await page.locator('[data-command="delete"]:visible').tap();
	// Deleting moves into the trash without a question; the message offers to undo it
	await expect(page.getByRole('option', { name: 'Archive' })).toHaveCount(0);
	await page.getByRole('status').filter({ hasText: 'is in the trash' }).getByRole('button', { name: 'Undo' }).tap();
	await expect(page.getByRole('option', { name: 'Archive' })).toBeVisible();
	await page.getByRole('button', { name: 'Actions for “Archive”' }).tap();
	await page.getByRole('menuitem', { name: 'Delete' }).tap();
	await expect(page.getByRole('option', { name: 'Archive' })).toHaveCount(0);

	// The trash, a special folder at the end of the panel "Folders": a tap picks an entry, the ribbon tab "Trash"
	// (opened by itself) restores it where it was
	await page.getByTestId('ribbon').getByRole('tab', { name: 'View', exact: true }).tap();
	await page.locator('[data-command="panel:folders"]:visible').tap();
	await page.getByTestId('panel').getByRole('button', { name: 'Trash', exact: true }).tap();
	await expect(page).toHaveURL(/\?trash/);
	const trash = page.getByRole('main');
	await trash.getByRole('option', { name: /Archive/ }).tap();
	await page.locator('[data-command="trashRestore"]:visible').tap();
	await expect(trash.getByText('The trash is empty.')).toBeVisible();
	// How long it keeps is a suite setting: the link opens it, on phones as a page of its own with a way back
	await trash.getByRole('button', { name: 'Change in the settings' }).tap();
	const settings = page.getByRole('dialog', { name: 'Trash' });
	await expect(settings.getByRole('combobox', { name: 'Remove deleted items for good after' })).toHaveValue('30');
	await settings.getByRole('button', { name: 'All settings' }).tap();
	await expect(page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Profile' })).toBeVisible();
	await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Close' }).tap();
	// Back in "Docs", where it was
	await page.goBack();
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
	await page.goto('/text-editor/editor?path=%2Fnote.md');
	const content = page.locator('.cm-content');
	await expect(content).toContainText('Hello');
	await expect(content).toHaveClass(/cm-lineWrapping/);

	// The ribbon tab "View": "View only" shows the preview, "Text only" the text again
	await page.getByTestId('ribbon').getByRole('tab', { name: 'View', exact: true }).tap();
	const layout = (id: 'view' | 'text') => page.locator(`[data-command="layout.${id}"]:visible`).tap();
	await layout('view');
	// (Not looked into: the frame is sandboxed without scripts, Playwright can't query inside it)
	const frame = page.locator('iframe[title="Markdown preview"]');
	await expect(frame).toBeVisible();
	await expect(frame).toHaveAttribute('srcdoc', /<h1[^>]*>Hello<\/h1>/);
	await expect(content).toBeHidden();
	await layout('text');
	await expect(content).toBeVisible();

	// The table instead of the text; a tap selects a cell, a second one edits it – the text follows and is saved
	await page.goto('/text-editor/editor?path=%2Fpeople.csv');
	// (the ribbon keeps the tab "View")
	await layout('view');
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
	await page.getByRole('menuitem', { name: 'Delete rows' }).tap();
	await expect(page.getByRole('gridcell', { name: 'Anna' })).toBeHidden();
	await expect(page.getByTitle('Saved')).toBeVisible();
	const saved = await page.evaluate(async () => {
		const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files');
		return (await (await root.getFileHandle('people.csv')).getFile()).text();
	});
	expect(saved).toBe('name,age\n"Bea\nB.",4\n');
	await layout('text');
	await expect(content).toContainText('B.",4');

	// Playwright's own helper scripts are blocked in the script-less sandbox frame (that's the point of it)
	const own = (p: string) => p.includes("Blocked script execution in 'about:srcdoc'");
	problems.splice(0, problems.length, ...problems.filter((p) => !own(p)));
});

test('PDF Editor: fill in a field, draw with a finger, pinch with two, pick pages in the selection mode', async ({ page, problems: _ }) => {
	await page.goto('/pdf-editor');
	await putFile(page, 'Form.pdf', await formPdf(2));
	await page.goto('/pdf-editor/editor?path=%2FForm.pdf');
	await expect(page.getByTestId('surface')).toBeVisible();

	// A field: tapped (the tool "Hand" lets fields take presses), typed into, kept with Enter
	const name = page.getByRole('textbox', { name: 'name', exact: true });
	await expect(name).toBeAttached();
	await name.tap();
	await page.keyboard.type('Zoë');
	await name.press('Enter');

	// A finger draws with the pen
	await page.getByTestId('ribbon').getByRole('tab', { name: 'Comment', exact: true }).tap();
	await page.locator('[data-command="pen"]').tap();
	const box = (await page.getByTestId('surface').boundingBox())!;
	const cdp = await page.context().newCDPSession(page);
	const touch = (type: string, points: { x: number; y: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
	const x = box.x + 60;
	const y = box.y + 200;
	await touch('touchStart', [{ x, y }]);
	for (let i = 1; i <= 12; i++) await touch('touchMove', [{ x: x + i * 12, y: y + Math.sin(i) * 10 }]);
	await touch('touchEnd', []);

	const saved = async () => {
		const doc = await PDFDocument.load(await getFile(page, 'Form.pdf'));
		const annots = doc.getPage(0).node.Annots();
		const kinds = Array.from({ length: annots?.size() ?? 0 }, (_, i) => String(doc.context.lookup(annots!.get(i))?.toString()));
		return { name: doc.getForm().getTextField('name').getText(), ink: kinds.filter((k) => k.includes('/Subtype /Ink')).length };
	};
	await expect.poll(saved, { timeout: 10_000 }).toEqual({ name: 'Zoë', ink: 1 });

	// Two fingers: the zoom changes, nothing is drawn
	const zoom = page.getByTitle('Zoom', { exact: true });
	const before = await zoom.textContent();
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	await touch('touchStart', [{ x: cx - 30, y: cy }, { x: cx + 30, y: cy }]);
	for (let i = 1; i <= 8; i++) await touch('touchMove', [{ x: cx - 30 - i * 10, y: cy }, { x: cx + 30 + i * 10, y: cy }]);
	await touch('touchEnd', []);
	await expect(zoom).not.toHaveText(before!);
	expect((await saved()).ink).toBe(1);

	// Pages: a long press opens the page's menu and starts the selection mode; taps then pick
	await page.getByTestId('ribbon').getByRole('tab', { name: 'View', exact: true }).tap();
	await page.locator('[data-command="panel:pages"]').tap();
	const pages = page.getByRole('dialog');
	await expect(pages.getByText('Current page: 1')).toBeVisible();
	await longPress(page, pages.getByRole('button', { name: 'Page 1', exact: true }));
	await expect(page.getByRole('menuitem', { name: 'Select all' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('menuitem', { name: 'Select all' })).toBeHidden();
	await expect(pages.getByText('1 page picked')).toBeVisible();
	await pages.getByRole('button', { name: 'Page 3', exact: true }).tap();
	await expect(pages.getByText('2 pages picked')).toBeVisible();
	await expect(pages.getByRole('button', { name: 'Page 3', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await shot(page, 'pdf-editor-pages-phone');
	await pages.getByRole('button', { name: 'Clear selection' }).tap();
	await expect(pages.getByText('Current page: 1')).toBeVisible();
	// Out of the selection mode a tap goes to the page (and closes the sheet)
	await pages.getByRole('button', { name: 'Page 2', exact: true }).tap();
	await expect(page.getByRole('dialog')).toBeHidden();
});

test('Fonts: font files from the phone become one font with its faces, opened by a tap, deleted from its ⋯', async ({ page }) => {
	await page.goto('/fonts');
	await expect(page.getByText('You have no fonts of your own yet.', { exact: false })).toBeVisible();
	const dir = 'node_modules/pdfjs-dist/standard_fonts';
	await page.locator('input[type="file"]').setInputFiles([`${dir}/LiberationSans-Regular.ttf`, `${dir}/LiberationSans-Bold.ttf`]);
	const card = page.getByRole('link', { name: /Liberation Sans/ });
	await expect(card).toBeVisible();
	await expect(card).toContainText('2 files');
	await shot(page, 'fonts');
	await card.tap();
	await expect(page.getByText('Bold – Bold')).toBeVisible();
	await page.goBack();
	await page.getByRole('button', { name: /Liberation Sans/ }).tap();
	await page.getByRole('menuitem', { name: 'Delete' }).tap();
	await expect(page.getByText('You have no fonts of your own yet.', { exact: false })).toBeVisible();
});

test('JWL Files: two backups from the phone kept without opening, one merged into the other, the merge undone, a note tagged', async ({ page }) => {
	await page.goto('/jwl-files');
	const input = page.locator('input[type="file"]').first();
	const dialog = page.getByRole('dialog');
	for (const [name, guid, title, device] of [
		['Backup B', 'b', 'Second note', 'Tablet'],
		['Backup A', 'a', 'First note', 'Phone']
	]) {
		await input.setInputFiles({ name: `${name}.jwlibrary`, mimeType: 'application/octet-stream', buffer: await backup([{ guid, title }], device) });
		await dialog.getByRole('button', { name: 'Save', exact: true }).tap();
		await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
	}
	// Kept and listed, not opened; the message offers “Open”
	const kept = page.getByRole('status').filter({ hasText: '“Backup A.jwlibrary” is kept in your files.' });
	await expect(page).toHaveURL(/\/jwl-files$/);
	await kept.getByRole('button', { name: 'Open' }).tap();
	await expect(page).toHaveURL(/\/jwl-files\/editor/);
	await expect(page.getByRole('heading', { name: 'JW Library backup' })).toBeVisible();
	await shot(page, 'jwl-files');

	// “Merge with …” in the tab “File” takes the other backup in – one undo step
	await page.getByRole('tab', { name: 'File' }).tap();
	await page.locator('[data-command="merge"]:visible').tap();
	await dialog.getByRole('option', { name: 'Backup B.jwlibrary' }).tap();
	await dialog.getByRole('button', { name: 'Open', exact: true }).tap();
	const toast = page.getByRole('status').filter({ hasText: 'Merged “Backup B.jwlibrary”: 1 new, 0 changed.' });
	await expect(toast).toBeVisible();
	await page.getByRole('tab', { name: 'Home' }).tap();
	await page.locator('[data-command="view:notes"]:visible').tap();
	await expect(page.getByRole('option', { name: /Second note/ })).toBeVisible();
	await expect(page.getByRole('option', { name: /First note/ })).toBeVisible();
	await shot(page, 'jwl-notes');

	// “Undo” in the message takes it back
	await toast.getByRole('button', { name: 'Undo' }).tap();
	await expect(page.getByRole('option', { name: /Second note/ })).toHaveCount(0);
	await expect(page.getByRole('option', { name: /First note/ })).toBeVisible();

	// A tag typed in the note's dialog is made and put on the note; the filter field finds the note by it
	await page.getByRole('option', { name: /First note/ }).tap();
	const tags = dialog.getByRole('combobox', { name: 'Tags' });
	await tags.fill('Study');
	await dialog.getByRole('option', { name: 'New tag “Study”' }).tap();
	await shot(page, 'jwl-note-tags');
	await dialog.getByRole('button', { name: 'Done', exact: true }).tap();
	await expect(page.getByRole('option', { name: /First note/ })).toContainText('Study');
	await page.getByRole('combobox', { name: 'Filter by tags' }).fill('stu');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('option', { name: /First note/ })).toBeVisible();
	await shot(page, 'jwl-notes-filter');
});
