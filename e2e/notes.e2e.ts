import type { Page } from '@playwright/test';
import { PDFDocument, rgb } from 'pdf-lib';
import { expect, test } from './fixtures.js';

// Notes in one flow: create, draw, undo/redo, erase, saved across a reload, insert an image and a PDF, export. The drawing logic itself (lasso, pixel
// eraser, shapes, formats) is covered by the unit and browser specs in tools/notes.

/** Items (strokes, pictures) saved in `Notebook.note` (OPFS) */
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

/** A wavy line across the middle of the surface */
async function draw(page: Page, dy = 0) {
	const box = (await page.getByTestId('surface').boundingBox())!;
	const x = box.x + box.width / 2 - 100;
	const y = box.y + 200 + dy;
	await page.mouse.move(x, y);
	await page.mouse.down();
	for (let i = 1; i <= 20; i++) await page.mouse.move(x + i * 10, y + Math.sin(i / 2) * 15);
	await page.mouse.up();
}

/** Files in the notebook's assets */
function savedAssets(page: Page): Promise<number> {
	return page.evaluate(async () => {
		const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files');
		const assets = await (await root.getDirectoryHandle('Notebook.note')).getDirectoryHandle('assets').catch(() => null);
		let count = 0;
		if (assets) for await (const _ of (assets as unknown as { values(): AsyncIterable<unknown> }).values()) count++;
		return count;
	});
}

/** A 1×1 PNG */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

/** Pages in `Notebook.note` and how many have a PDF page under them */
function savedPages(page: Page): Promise<{ pages: number; pdf: number }> {
	return page.evaluate(async () => {
		const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files');
		const file = await (await (await root.getDirectoryHandle('Notebook.note')).getFileHandle('project.json')).getFile();
		const pages = JSON.parse(await file.text()).pages as { background?: unknown }[];
		return { pages: pages.length, pdf: pages.filter((p) => p.background).length };
	});
}

async function pdf(): Promise<Buffer> {
	const doc = await PDFDocument.create();
	doc.addPage([300, 200]).drawRectangle({ x: 0, y: 0, width: 150, height: 200, color: rgb(1, 0, 0) });
	return Buffer.from(await doc.save());
}

test('draws, undoes, erases, keeps strokes, inserts an image and a PDF, exports', async ({ page, problems: _ }) => {
	await page.goto('/notes');
	await page.getByRole('button', { name: 'New notebook' }).click();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByTestId('surface')).toBeVisible();

	await draw(page);
	await draw(page, 80);
	await expect.poll(() => savedItems(page)).toBe(2);
	await page.keyboard.press('Control+z');
	await expect.poll(() => savedItems(page)).toBe(1);
	await page.getByRole('button', { name: 'Redo' }).click();
	await expect.poll(() => savedItems(page)).toBe(2);

	await page.getByRole('button', { name: 'Eraser' }).click();
	await draw(page);
	await expect.poll(() => savedItems(page)).toBe(1);

	await page.reload();
	await expect(page.getByTestId('surface')).toBeVisible();
	await expect.poll(() => savedItems(page)).toBe(1);

	// The image goes into the assets and is selected right away
	await page.getByRole('button', { name: 'Insert' }).click();
	const chooser = page.waitForEvent('filechooser');
	await page.getByRole('menuitem', { name: 'Image from this device …' }).click();
	await (await chooser).setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
	await expect(page.getByRole('toolbar', { name: '1 item selected' })).toBeVisible();
	await expect.poll(() => savedItems(page)).toBe(2);
	expect(await savedAssets(page)).toBe(1);

	// A PDF becomes pages after the current one, rendered by PDF.js workers (under the real CSP)
	await page.getByRole('button', { name: 'Insert' }).click();
	const pdfChooser = page.waitForEvent('filechooser');
	await page.getByRole('menuitem', { name: 'PDF from this device …' }).click();
	await (await pdfChooser).setFiles({ name: 'sheet.pdf', mimeType: 'application/pdf', buffer: await pdf() });
	await expect(page.getByText('1 page inserted')).toBeVisible();
	await expect.poll(() => savedPages(page)).toEqual({ pages: 2, pdf: 1 });
	await expect(page.getByText('Page 2 of 2')).toBeVisible();

	// Export as PDF and download it
	await page.getByRole('button', { name: 'Export', exact: true }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Export', exact: true }).click();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download' }).click();
	expect((await download).suggestedFilename()).toBe('Notebook.pdf');
});
