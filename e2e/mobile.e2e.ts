import type { Locator, Page } from '@playwright/test';
import { PDFDocument, rgb } from 'pdf-lib';
import { expect, test } from './fixtures.js';
import { formPdf, getFile, putFile, shot } from './pdf.js';

// Files, Text Editor, Notes and the PDF Editor on a phone (project `mobile`: Pixel 7, touch only): everything without right-click,
// double-click, keyboard shortcuts or dragging. Notes is mobile-first: this is its one flow (`stack.md`).

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
	await page.getByRole('button', { name: 'Tabs' }).tap();
	await page.getByRole('menuitem', { name: 'Home' }).tap();
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
	await page.getByRole('button', { name: 'Tabs' }).tap();
	await page.getByRole('menuitem', { name: 'View' }).tap();
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
	await page.getByTestId('ribbon').getByRole('button', { name: 'Tabs' }).tap();
	await page.getByRole('menuitem', { name: 'View' }).tap();
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

test('Notes: a finger draws, two fingers pinch, the ribbon works by tapping, pictures and PDFs go in, it exports', async ({ page, problems: _ }) => {
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

	// The ribbon (tab "Draw"): highlighter, a color, its thickness and the smoothing
	await page.locator('[data-command="highlighter"]').tap();
	await page.locator('[data-command="color"]').tap();
	await page.getByRole('button', { name: 'Color #22c55e' }).tap();
	await page.keyboard.press('Escape');
	await page.locator('[data-command="thickness"]').tap();
	await page.getByRole('menuitem', { name: 'Thickness 22' }).tap();
	await page.locator('[data-command="smoothing"]').tap();
	await page.getByRole('menuitem', { name: 'Strong' }).tap();
	await expect
		.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('notes:tools') ?? '{}')))
		.toMatchObject({ highlighter: { color: expect.stringMatching(/^#22c55e/), size: 22 }, smoothing: 0.7 });
	expect(await savedItems(page)).toBe(1);

	// Kept across a reload
	await page.reload();
	await expect(page.getByTestId('surface')).toBeVisible();
	await expect.poll(() => savedItems(page)).toBe(1);

	// An image goes into the assets (selected right away); a PDF becomes pages after the current one, rendered by
	// PDF.js workers under the real CSP
	const insertTab = async () => {
		await page.getByRole('button', { name: 'Tabs' }).tap();
		await page.getByRole('menuitem', { name: 'Insert' }).tap();
	};
	await insertTab();
	await page.locator('[data-command="image"]').tap();
	const chooser = page.waitForEvent('filechooser');
	await page.getByRole('menuitem', { name: 'Image from this device …' }).tap();
	await (await chooser).setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
	await expect.poll(() => savedItems(page)).toBe(2);
	// (the tab "Selection" opened for the picture)
	await insertTab();
	await page.locator('[data-command="insertPdf"]').tap();
	const pdfChooser = page.waitForEvent('filechooser');
	await page.getByRole('menuitem', { name: 'PDF from this device …' }).tap();
	await (await pdfChooser).setFiles({ name: 'sheet.pdf', mimeType: 'application/pdf', buffer: await onePagePdf() });
	await expect(page.getByText('1 page inserted')).toBeVisible();
	await expect.poll(() => savedPages(page)).toEqual({ pages: 2, pdf: 1 });

	// Export as PDF and download it (the ribbon's tab "File")
	await page.getByRole('button', { name: 'Tabs' }).tap();
	await page.getByRole('menuitem', { name: 'File' }).tap();
	await page.locator('[data-command="export"]:visible').tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Export', exact: true }).tap();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download' }).tap();
	expect((await download).suggestedFilename()).toBe('Notebook.pdf');
	await page.getByRole('dialog', { name: 'Export' }).getByRole('button', { name: 'Close' }).tap();

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

test('PDF Editor: fill in a field, draw with a finger, pick pages in the selection mode', async ({ page, problems: _ }) => {
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
	await page.getByRole('button', { name: 'Tabs' }).tap();
	await page.getByRole('menuitem', { name: 'Comment' }).tap();
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

	// Pages: a long press opens the page's menu and starts the selection mode; taps then pick
	await page.getByRole('button', { name: 'Tabs' }).tap();
	await page.getByRole('menuitem', { name: 'View' }).tap();
	await page.locator('[data-command="panel:pages"]').tap();
	const pages = page.getByRole('dialog');
	await expect(pages.getByText('No pages picked')).toBeVisible();
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
	await expect(pages.getByText('No pages picked')).toBeVisible();
	// Out of the selection mode a tap goes to the page (and closes the sheet)
	await pages.getByRole('button', { name: 'Page 2', exact: true }).tap();
	await expect(page.getByRole('dialog')).toBeHidden();
});

/** Items (strokes, pictures) saved in the notebook `Notebook.note` (OPFS); -1 while a file is being written (not there
 * for a moment – polls try again instead of failing) */
function savedItems(page: Page): Promise<number> {
	return page.evaluate(async () => {
		try {
			const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files');
			const pages = await (await root.getDirectoryHandle('Notebook.note')).getDirectoryHandle('pages');
			let count = 0;
			for await (const handle of (pages as unknown as { values(): AsyncIterable<FileSystemFileHandle> }).values()) {
				count += JSON.parse(await (await handle.getFile()).text()).items.length;
			}
			return count;
		} catch (e) {
			if (e instanceof DOMException && e.name === 'NotFoundError') return -1;
			throw e;
		}
	});
}

/** A 1×1 PNG */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function onePagePdf(): Promise<Buffer> {
	const doc = await PDFDocument.create();
	doc.addPage([300, 200]).drawRectangle({ x: 0, y: 0, width: 150, height: 200, color: rgb(1, 0, 0) });
	return Buffer.from(await doc.save());
}

/** Pages in `Notebook.note` and how many have a PDF page under them */
function savedPages(page: Page): Promise<{ pages: number; pdf: number }> {
	return page.evaluate(async () => {
		const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files');
		const file = await (await (await root.getDirectoryHandle('Notebook.note')).getFileHandle('project.json')).getFile();
		const pages = JSON.parse(await file.text()).pages as { background?: unknown }[];
		return { pages: pages.length, pdf: pages.filter((p) => p.background).length };
	});
}
