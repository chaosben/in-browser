import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import type { Page } from '@playwright/test';
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, rgb, StandardFonts } from 'pdf-lib';
import { expect, test } from './fixtures.js';
import { formPdf, getFile, putFile, scriptedPdf, shot } from './pdf.js';

// The PDF Editor in one flow: open a PDF from the files, see its pages, ribbon, side panel and footer, move between
// pages, print two of them, rotate a page (saved by itself as an update of the file; undoing gives the original file again), draw on it,
// measure a distance with two clicks, delete objects of a page's own content, place a note with a subject, a reply and a status, type a text box, fill in a form. The writer, the pages' rendering
// and the annotations' looks are covered by the browser specs of packages/pdf and tools/pdf-editor.

/** A PDF with three pages, each with its number as text */
async function pdf(): Promise<Buffer> {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let n = 1; n <= 3; n++) {
		const page = doc.addPage([595, 842]);
		page.drawText(`Page ${n} of the test PDF`, { x: 72, y: 760, size: 24, font });
		page.drawRectangle({ x: 72, y: 400, width: 200, height: 120, color: rgb(0.2, 0.4, 0.9) });
	}
	return Buffer.from(await doc.save());
}

/** Elements around the ribbon that scroll sideways although everything should fit */
function overflowing(page: Page) {
	return page.evaluate(() => {
		const found: string[] = [];
		for (let el = document.querySelector('[data-testid="ribbon"]'); el; el = el.parentElement)
			if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'hidden') found.push(`${el.tagName}.${el.className}`);
		return found;
	});
}


test('opens a PDF from the files and moves through its pages', async ({ page }) => {
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto('/pdf-editor');
	// "New PDF …": an empty page with a paper, saved where the dialog says and opened
	await page.getByRole('button', { name: 'New PDF …' }).click();
	await page.getByRole('dialog').getByText('Lined').click();
	await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByTestId('surface')).toBeVisible();
	await expect(page.getByText('/ 1')).toBeVisible();
	expect((await getFile(page, 'New.pdf')).subarray(0, 5).toString()).toBe('%PDF-');
	// An icon goes onto the page as a picture (an SVG drawn once) and is saved as a stamp
	await page.getByRole('tab', { name: 'Comment' }).click();
	await page.getByRole('button', { name: 'Icon', exact: true }).click();
	await page.locator(':popover-open button.btn-square[title]').first().click();
	await expect.poll(async () => (await getFile(page, 'New.pdf')).toString('latin1').includes('/Subtype /Stamp'), { timeout: 10_000 }).toBe(true);
	// A word stamp is placed, and what it says is changed on the page
	await page.getByRole('tab', { name: 'Comment' }).click();
	await page.locator('[data-command="stamp"]').first().click();
	const paper = (await page.getByTestId('surface').boundingBox())!;
	await page.mouse.click(paper.x + paper.width / 2, paper.y + 120);
	await page.locator('[data-command="editStamp"]').first().click();
	const word = page.getByRole('group', { name: 'Edit text' }).getByRole('textbox').first();
	await word.fill('Checked');
	await word.press('Enter');
	await expect.poll(async () => (await getFile(page, 'New.pdf')).toString('latin1').includes('(Checked)'), { timeout: 10_000 }).toBe(true);
	// Two points are also set with two clicks, and the view scrolls between them: a distance is measured that way
	await page.keyboard.press('Escape');
	await page.getByRole('tab', { name: 'Comment' }).click();
	await page.locator('[data-command="measure-distance"]').first().click();
	await page.mouse.click(paper.x + paper.width / 2 - 100, paper.y + 300);
	await page.mouse.move(paper.x + paper.width / 2, paper.y + 340);
	await page.mouse.wheel(0, 120);
	await page.mouse.click(paper.x + paper.width / 2 + 100, paper.y + 300);
	await expect.poll(async () => (await getFile(page, 'New.pdf')).toString('latin1').includes('/LineDimension'), { timeout: 10_000 }).toBe(true);

	await page.goto('/pdf-editor');
	const original = await pdf();
	await putFile(page, 'Test.pdf', original);
	await page.goto('/pdf-editor/editor?path=%2FTest.pdf');

	await expect(page.getByTestId('ribbon')).toBeVisible();
	await expect(page.getByTestId('surface')).toBeVisible();
	await expect(page.getByText('/ 3')).toBeVisible();
	await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
	// The pages are drawn (white paper with the blue box somewhere on the surface)
	await expect
		.poll(async () =>
			page.getByTestId('surface').locator('canvas').first().evaluate((c: HTMLCanvasElement) => {
				const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
				for (let i = 0; i < d.length; i += 4) if (d[i] < 120 && d[i + 2] > 180) return true;
				return false;
			})
		)
		.toBe(true);

	// "Print …" (Ctrl+P): our dialog, then the pages as pictures for the browser's print dialog – only they are printed
	await page.evaluate(() => (window.print = () => {}));
	await page.keyboard.press('Control+p');
	await page.getByRole('dialog').getByPlaceholder('e.g. 1-3, 7').fill('1, 3');
	await page.getByRole('dialog').getByRole('button', { name: 'Print', exact: true }).click();
	await expect(page.locator('.print-root img')).toHaveCount(2);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.evaluate(() => dispatchEvent(new Event('afterprint')));
	await expect(page.locator('.print-root')).toHaveCount(0);

	// "Export …" as a JW Library playlist into the files: built by the playlist worker (WebAssembly – the CSP must let
	// it run), one item per page, the manifest naming the database's hash
	await page.getByRole('tab', { name: 'File' }).click();
	await page.getByRole('button', { name: 'Export …' }).click();
	await page.getByRole('dialog').getByLabel('Format').selectOption('playlist');
	await shot(page, 'pdf-editor-export');
	// The background's color field opens over the dialog and can be used there; Esc closes only it
	await page.getByRole('dialog').getByRole('button', { name: 'Background' }).click();
	await page.locator('#export-background').getByRole('button').first().click();
	await shot(page, 'pdf-editor-export-background');
	await page.keyboard.press('Escape');
	await expect(page.locator('#export-background')).toBeHidden();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.getByRole('dialog').getByRole('button', { name: 'Save …' }).click();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByText('Saved as “Test.jwlplaylist”.')).toBeVisible({ timeout: 20_000 });
	const files = unzipSync(await getFile(page, 'Test.jwlplaylist'));
	const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString());
	expect(manifest.userDataBackup.hash).toBe(createHash('sha256').update(files['userData.db']).digest('hex'));
	expect(Object.keys(files).filter((name) => name.endsWith('.jpg'))).toHaveLength(3);
	await page.getByRole('tab', { name: 'Home' }).click();

	// Side panel with the pages; a click goes to page 3
	const textOffset = () =>
		page.evaluate(() => {
			const surface = document.querySelector('[data-testid="surface"]')!.getBoundingClientRect();
			return document.querySelector('[data-text-layer]')!.getBoundingClientRect().left - surface.left - surface.width / 2;
		});
	await expect(page.locator('[data-text-layer]').first()).toBeAttached();
	const centered = await textOffset();
	await page.getByRole('button', { name: 'Pages', exact: true }).first().click();
	await expect(page.getByTestId('panel')).toBeVisible();
	// The pages' text (and what is dragged open on it) follows the page into the narrower view
	await expect.poll(textOffset).toBeCloseTo(centered, 0);
	await shot(page, 'pdf-editor');
	// Nothing sticks out sideways (the ribbon measures its groups in a hidden box wider than the window)
	expect(await overflowing(page)).toEqual([]);
	await page.getByRole('button', { name: 'Page 3' }).click();
	await expect(page.getByLabel('Page number')).toHaveAttribute('placeholder', '3');

	// Footer: back to the first page
	await page.locator('[data-command="first"]').click();
	await expect(page.getByLabel('Page number')).toHaveAttribute('placeholder', '1');
	await shot(page, 'pdf-editor-view');

	// Pages tab: rotate the first page; it saves itself as an update appended to the file
	await page.getByRole('tab', { name: 'Pages' }).click();
	await expect(page.locator('[data-command="rotateRight"]').first()).toBeEnabled();
	await page.locator('[data-command="rotateRight"]').first().click();
	await expect(page.locator('[data-save="saved"]')).toBeVisible({ timeout: 10_000 });
	await expect.poll(async () => (await getFile(page, 'Test.pdf')).length).toBeGreaterThan(original.length);
	const rotated = await getFile(page, 'Test.pdf');
	expect(rotated.subarray(0, original.length).equals(original)).toBe(true);
	expect((await PDFDocument.load(rotated)).getPage(0).getRotation().angle).toBe(90);
	await shot(page, 'pdf-editor-rotated');
	// Undo: the original file again
	await page.keyboard.press('Control+z');
	await expect.poll(async () => (await getFile(page, 'Test.pdf')).equals(original), { timeout: 10_000 }).toBe(true);

	// Comment tab: a pen stroke becomes an ink annotation of the page
	await page.getByRole('tab', { name: 'Comment' }).click();
	await page.locator('[data-command="pen"]').first().click();
	const surface = (await page.getByTestId('surface').boundingBox())!;
	await page.mouse.move(surface.x + 300, surface.y + 300);
	await page.mouse.down();
	for (let i = 1; i <= 10; i++) await page.mouse.move(surface.x + 300 + i * 20, surface.y + 300 + (i % 2) * 15);
	await page.mouse.up();
	await expect.poll(async () => (await getFile(page, 'Test.pdf')).length, { timeout: 10_000 }).toBeGreaterThan(original.length);
	await expect(page.locator('[data-save="saved"]')).toBeVisible({ timeout: 10_000 });
	const annotated = await PDFDocument.load(await getFile(page, 'Test.pdf'));
	const annots = annotated.getPage(0).node.Annots();
	expect(annots?.size()).toBe(1);
	expect(String(annotated.context.lookup(annots!.get(0))?.toString())).toContain('/Subtype /Ink');
	await shot(page, 'pdf-editor-ink');
	// Select it and delete it with the selection's menu: the original file again
	await page.keyboard.press('l');
	await page.mouse.click(surface.x + 360, surface.y + 300 + 15);
	await page.getByRole('toolbar', { name: '1 item selected' }).getByRole('button', { name: 'Delete' }).click();
	await expect.poll(async () => (await getFile(page, 'Test.pdf')).equals(original), { timeout: 10_000 }).toBe(true);

	// "Note" places a sticky note; its comment is typed below it and saved when it is left
	await page.keyboard.press('n');
	const placeAt = (await page.getByTestId('surface').boundingBox())!;
	await page.mouse.click(placeAt.x + 420, placeAt.y + 420);
	const comment = page.getByRole('textbox', { name: 'Comment of the note' });
	await expect(comment).toBeFocused();
	await comment.fill('Check this');
	await page.keyboard.press('Escape');
	await expect
		.poll(
			async () => {
				const saved = await PDFDocument.load(await getFile(page, 'Test.pdf'));
				const annots = saved.getPage(0).node.Annots();
				const note = annots?.size() ? saved.context.lookup(annots.get(0)) : null;
				return note instanceof PDFDict ? note.lookup(PDFName.of('Contents'), PDFHexString)?.decodeText() : null;
			},
			{ timeout: 10_000 }
		)
		.toBe('Check this');
	await shot(page, 'pdf-editor-note');
	// The author is the name in the suite settings (gear at the right end of the top bar)
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings.getByRole('textbox', { name: 'Your name' }).fill('Ada');
	await shot(page, 'settings');
	await settings.getByRole('button', { name: 'Close' }).click();
	// The panel "Comments" lists it; selected, it takes a subject, a status and – after "Reply" – a reply (/IRT)
	await page.getByRole('button', { name: 'Comments', exact: true }).click();
	const comments = page.getByTestId('panel');
	await comments.getByRole('button', { name: /Check this/ }).click();
	await comments.getByRole('button', { name: 'Note', exact: true }).click();
	await comments.getByRole('textbox', { name: 'Subject' }).fill('Question');
	await page.keyboard.press('Enter');
	await comments.getByRole('button', { name: 'Reply', exact: true }).click();
	await comments.getByRole('textbox', { name: 'Write a reply' }).fill('Done');
	await comments.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(comments.getByText('Done', { exact: true })).toBeVisible();
	await comments.getByRole('button', { name: /^Status/ }).click();
	await page.getByRole('menuitem', { name: 'Completed' }).click();
	await expect(comments.getByText('Completed')).toBeVisible();
	await expect
		.poll(
			async () => {
				const saved = await PDFDocument.load(await getFile(page, 'Test.pdf'));
				const annots = saved.getPage(0).node.Annots();
				const found: string[] = [];
				const text = (a: PDFDict, k: string) => (a.lookup(PDFName.of(k)) as PDFHexString | undefined)?.decodeText();
				for (let i = 0; i < (annots?.size() ?? 0); i++) {
					const a = saved.context.lookup(annots!.get(i));
					if (!(a instanceof PDFDict)) continue;
					if (a.get(PDFName.of('State'))) found.push(`state ${text(a, 'T')}: ${text(a, 'State')}`);
					else if (a.get(PDFName.of('IRT'))) found.push(`reply ${text(a, 'T')}: ${text(a, 'Contents')}`);
					else found.push(`note ${text(a, 'Subj')} ${a.get(PDFName.of('Name'))}`);
				}
				return found.join(' | ');
			},
			{ timeout: 10_000 }
		)
		.toBe('note Question /Comment | reply Ada: Done | state Ada: Completed');
	await shot(page, 'pdf-editor-comments');
	await page.getByRole('button', { name: 'Pages', exact: true }).click();

	// "Text box": a click places one, typed into right there; saved as a /FreeText annotation with the text
	await page.keyboard.press('t');
	await page.mouse.click(placeAt.x + 300, placeAt.y + 480);
	const typing = page.getByRole('textbox', { name: 'Text of the text box' });
	await expect(typing).toBeFocused();
	await typing.fill('Typed onto the page');
	await shot(page, 'pdf-editor-textbox-typing');
	await page.keyboard.press('Escape');
	await expect
		.poll(
			async () => {
				const saved = await PDFDocument.load(await getFile(page, 'Test.pdf'));
				const annots = saved.getPage(0).node.Annots();
				for (let i = 0; i < (annots?.size() ?? 0); i++) {
					const a = saved.context.lookup(annots!.get(i));
					if (a instanceof PDFDict && a.lookup(PDFName.of('Subtype'))?.toString() === '/FreeText')
						return a.lookup(PDFName.of('Contents'), PDFHexString)?.decodeText();
				}
				return null;
			},
			{ timeout: 10_000 }
		)
		.toBe('Typed onto the page');
	await shot(page, 'pdf-editor-textbox');

	// Shift+click adds a second text box to the selection, "Align left" lines both up (a click alone replaced the
	// selection, so "Arrange" stayed disabled)
	await page.keyboard.press('t');
	await page.mouse.click(placeAt.x + 400, placeAt.y + 560);
	await typing.fill('Second');
	await page.keyboard.press('Escape');
	await page.keyboard.press('l');
	await page.mouse.click(placeAt.x + 320, placeAt.y + 482);
	await page.keyboard.down('Shift');
	await page.mouse.click(placeAt.x + 420, placeAt.y + 562);
	await page.keyboard.up('Shift');
	await expect(page.getByRole('toolbar', { name: '2 items selected' })).toBeVisible();
	await page.getByRole('tab', { name: 'Arrange' }).click();
	await page.locator('[data-command="align:left"]').first().click();
	await expect
		.poll(
			async () => {
				const saved = await PDFDocument.load(await getFile(page, 'Test.pdf'));
				const annots = saved.getPage(0).node.Annots();
				const lefts: number[] = [];
				for (let i = 0; i < (annots?.size() ?? 0); i++) {
					const a = saved.context.lookup(annots!.get(i));
					if (a instanceof PDFDict && a.lookup(PDFName.of('Subtype'))?.toString() === '/FreeText')
						lefts.push(Math.round(Number(a.lookup(PDFName.of('Rect'), PDFArray).get(0).toString())));
				}
				return lefts.length === 2 && lefts[0] === lefts[1];
			},
			{ timeout: 10_000 }
		)
		.toBe(true);

	// The start page lists it
	await page.goto('/pdf-editor');
	await expect(page.getByText('Test.pdf')).toBeVisible();

	// A form: typed into, Tab to the next field, a box checked, a choice made – saved as the fields' values
	await putFile(page, 'Form.pdf', await formPdf());
	await page.goto('/pdf-editor/editor?path=%2FForm.pdf');
	const name = page.getByRole('textbox', { name: 'name', exact: true });
	await expect(name).toBeAttached();
	// Fields take presses with "Hand", "Select" and "Select text" (the text box tool is still chosen from above)
	await page.getByRole('tab', { name: 'Home' }).click();
	await page.locator('[data-command="hand"]').first().click();
	await page.getByRole('tab', { name: 'Form' }).click();
	await page.locator('[data-command="panel:fields"]').first().click();
	await expect(page.getByText('0 of 1 required fields filled in')).toBeVisible();
	await name.click();
	// Focused, the field covers what the page shows (also with the fields highlighted)
	await expect(name).toHaveCSS('background-color', 'rgb(255, 255, 255)');
	await page.keyboard.type('Zoë Ada');
	await page.keyboard.press('Tab');
	await expect(page.getByRole('textbox', { name: 'city', exact: true })).toBeFocused();
	await page.keyboard.type('Köln');
	await page.getByRole('checkbox', { name: 'agree' }).click();
	await page.getByRole('combobox', { name: 'color' }).selectOption('Green');
	await expect(page.getByText('1 of 1 required fields filled in')).toBeVisible();
	await shot(page, 'pdf-editor-form');
	const values = async () => {
		const form = (await PDFDocument.load(await getFile(page, 'Form.pdf'))).getForm();
		return [form.getTextField('name').getText(), form.getTextField('city').getText(), form.getCheckBox('agree').isChecked(), form.getDropdown('color').getSelected()[0]];
	};
	await expect.poll(values, { timeout: 10_000 }).toEqual(['Zoë Ada', 'Köln', true, 'Green']);
	// Undo takes the choice back
	await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
	await expect.poll(values, { timeout: 10_000 }).toEqual(['Zoë Ada', 'Köln', true, undefined]);

	// A form's own scripts calculate (in their sandbox); the sum belongs to the input's undo step
	await putFile(page, 'Sum.pdf', await scriptedPdf());
	await page.goto('/pdf-editor/editor?path=%2FSum.pdf');
	const a = page.getByRole('textbox', { name: 'a', exact: true });
	await expect(a).toBeAttached();
	await page.getByRole('tab', { name: 'Home' }).click();
	await page.locator('[data-command="hand"]').first().click();
	await a.click();
	await page.keyboard.type('1.5');
	await page.keyboard.press('Tab');
	await page.keyboard.type('2');
	await page.keyboard.press('Tab');
	const sum = async () => (await PDFDocument.load(await getFile(page, 'Sum.pdf'))).getForm().getTextField('sum').getText();
	await expect.poll(sum, { timeout: 10_000 }).toBe('3.5');
	await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
	await expect.poll(sum, { timeout: 10_000 }).toBe('1.5');
	// The page's own content: only with the switch "Edit content" on. What is deleted there is gone from the file,
	// not only from the page (the file is written anew)
	await putFile(page, 'Content.pdf', original);
	await page.goto('/pdf-editor/editor?path=%2FContent.pdf');
	await expect(page.getByTestId('surface')).toBeVisible();
	const everything = async () => {
		const bytes = await getFile(page, 'Content.pdf');
		const doc = await PDFDocument.load(bytes);
		let all = bytes.toString('latin1');
		for (const [, object] of doc.context.enumerateIndirectObjects()) if (object instanceof PDFRawStream) all += Buffer.from(decodePDFRawStream(object).decode()).toString('latin1');
		return all;
	};
	const hex = (text: string) => Buffer.from(text, 'latin1').toString('hex').toUpperCase();
	// A comment is embedded in its page from the menu at the selection – that needs no switch: it is no comment
	// any more but part of the page's content
	await page.getByRole('tab', { name: 'Comment' }).click();
	await page.locator('[data-command="pen"]').first().click();
	const sheet = (await page.getByTestId('surface').boundingBox())!;
	await page.mouse.move(sheet.x + 300, sheet.y + 450);
	await page.mouse.down();
	await page.mouse.move(sheet.x + 420, sheet.y + 450, { steps: 6 });
	await page.mouse.up();
	await page.locator('[data-command="lasso"]').first().click();
	await page.mouse.click(sheet.x + 360, sheet.y + 450);
	await page.locator('[data-command="flattenSelection"]').last().click();
	await expect.poll(async () => (await everything()).includes('/InB0 Do'), { timeout: 10_000 }).toBe(true);
	expect((await PDFDocument.load(await getFile(page, 'Content.pdf'))).getPage(0).node.Annots()?.size() ?? 0).toBe(0);
	// The page's own objects need the switch
	await page.getByRole('tab', { name: 'Content' }).click();
	await expect(page.locator('[data-command="contentSelectAll"]').first()).toBeDisabled();
	await page.locator('[data-command="contentEdit"]').first().click();
	await page.locator('[data-command="contentSelectAll"]').first().click();
	await expect(page.getByTestId('content-status')).toHaveText('3 objects of the page picked');
	await page.locator('[data-command="contentDelete"]').first().click();
	await expect.poll(async () => (await everything()).includes(hex('Page 1 of the test PDF')), { timeout: 10_000 }).toBe(false);
	expect(await everything()).toContain(hex('Page 2 of the test PDF'));
});

test('pages get a background and another size – in the file, with the way back', async ({ page }) => {
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto('/pdf-editor');
	await putFile(page, 'Pages.pdf', await pdf());
	await page.goto('/pdf-editor/editor?path=%2FPages.pdf');
	await expect(page.getByTestId('surface')).toBeVisible();
	const sizes = async () => (await PDFDocument.load(await getFile(page, 'Pages.pdf'))).getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())]);
	const before = await sizes();

	// A color under the current page: saved into the page, read again by the editor
	await page.getByRole('tab', { name: 'Pages' }).click();
	await page.locator('[data-command="pageBackground"]:visible').first().click();
	await page.getByRole('button', { name: 'Color #' }).first().click();
	await shot(page, 'page-background');
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-save="saved"]')).toBeVisible({ timeout: 10_000 });
	const colored = await PDFDocument.load(await getFile(page, 'Pages.pdf'));
	expect(colored.getPage(0).node.has(PDFName.of('InBrowserBackground'))).toBe(true);
	expect(colored.getPageCount() > 1 && colored.getPage(1).node.has(PDFName.of('InBrowserBackground'))).toBe(false);

	// “Barcode …”: a QR code of what is typed, placed as a picture (a stamp with a vector appearance)
	await page.getByRole('tab', { name: 'Comment' }).click();
	await page.locator('[data-command="barcode"]:visible').first().click();
	const code = page.getByRole('dialog').filter({ hasText: 'Barcode' });
	await expect(code.getByRole('button', { name: 'Insert' })).toBeDisabled();
	await code.getByLabel('Kind').selectOption({ label: 'EAN-13' });
	await code.getByLabel('Content', { exact: true }).fill('4006381333932');
	await expect(code.getByRole('alert')).toHaveText('The check digit doesn’t fit the other digits.');
	await code.getByLabel('Kind').selectOption({ label: 'QR code' });
	// A QR code by a template: the address gets its scheme
	await code.getByLabel('Content as').selectOption({ label: 'Web address' });
	await code.getByLabel('Address', { exact: true }).fill('example.org');
	await expect(code.getByRole('img', { name: 'QR code: https://example.org' })).toBeVisible();
	await shot(page, 'barcode');
	await code.getByRole('button', { name: 'Insert' }).click();
	// It stays a barcode: changed in the same dialog, in its place
	await page.locator('[data-command="editBarcode"]:visible').first().click();
	const edited = page.getByRole('dialog').filter({ hasText: 'Edit barcode' });
	await expect(edited.getByLabel('Content', { exact: true })).toHaveValue('https://example.org');
	await edited.getByLabel('Kind').selectOption({ label: 'Code 128' });
	await edited.getByLabel('Content', { exact: true }).fill('PJJ123C');
	await expect(edited.getByRole('img', { name: 'Code 128: PJJ123C' })).toBeVisible();
	await shot(page, 'barcode-edit');
	await edited.getByRole('button', { name: 'Apply' }).click();
	await expect(edited).toBeHidden();
	await expect
		.poll(async () => {
			const saved = await PDFDocument.load(await getFile(page, 'Pages.pdf'));
			const annots = saved.getPage(0).node.Annots();
			return Array.from({ length: annots?.size() ?? 0 }, (_, i) => (saved.context.lookup(annots!.get(i)) as PDFDict).lookup(PDFName.of('Subtype'))?.toString());
		}, { timeout: 10_000 })
		.toContain('/Stamp');
	await page.getByRole('tab', { name: 'Pages' }).click();

	// “Page size …”: all pages as slides, the content fitted in
	await page.locator('[data-command="pageSize"]:visible').first().click();
	const dialog = page.getByRole('dialog').filter({ hasText: 'Page size' });
	await dialog.getByRole('combobox').selectOption({ label: 'Presentation 16:9' });
	await dialog.getByText('Fit to the page').click();
	await dialog.getByText(/^All \d+ pages$/).click();
	await shot(page, 'page-size');
	await dialog.getByRole('button', { name: 'Change' }).click();
	await expect(page.getByText('Page size changed.')).toBeVisible({ timeout: 20_000 });
	expect(await sizes()).toEqual(before.map(() => [960, 540]));
	await expect(page.getByTestId('surface')).toBeVisible();

	// The way back: the file as it was
	await page.getByRole('button', { name: 'Undo', exact: true }).last().click();
	await expect.poll(sizes, { timeout: 20_000 }).toEqual(before);
	// Our own write back: never taken for a version saved elsewhere (it asked – that happened)
	await expect(page.getByTestId('surface')).toBeVisible();
	await page.waitForTimeout(1500);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	// The barcode came back from the file as one that can be changed
	await page.getByRole('tab', { name: 'Comment' }).click();
	await page.keyboard.press('l');
	await page.keyboard.press('Control+a');
	await expect(page.locator('[data-command="editBarcode"]:visible').first()).toBeVisible();
});

test('text boxes take formats for parts of their text, lists and a font – saved for every program', async ({ page }) => {
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto('/pdf-editor');
	await putFile(page, 'Text.pdf', await pdf());
	await page.goto('/pdf-editor/editor?path=%2FText.pdf');
	await expect(page.getByTestId('surface')).toBeVisible();
	const surface = (await page.getByTestId('surface').boundingBox())!;
	/** The saved text box's entry `key` as text */
	const saved = async (key: string) => {
		const doc = await PDFDocument.load(await getFile(page, 'Text.pdf'));
		const annots = doc.getPage(0).node.Annots();
		for (let i = 0; i < (annots?.size() ?? 0); i++) {
			const a = doc.context.lookup(annots!.get(i));
			if (a instanceof PDFDict && a.lookup(PDFName.of('Subtype'))?.toString() === '/FreeText') return (a.lookupMaybe(PDFName.of(key), PDFHexString) ?? a.lookup(PDFName.of(key)))?.toString() ?? '';
		}
		return '';
	};
	const decoded = async (key: string) => {
		const raw = await saved(key);
		return /^<[0-9A-Fa-f]*>$/.test(raw) ? PDFHexString.of(raw.slice(1, -1)).decodeText() : raw;
	};

	// Typed with a part in bold (Ctrl+B switches it for what comes next), then a second line as a list item
	await page.keyboard.press('t');
	await page.mouse.click(surface.x + 500, surface.y + 300);
	const typing = page.getByRole('textbox', { name: 'Text of the text box' });
	await expect(typing).toBeFocused();
	await page.keyboard.type('Plain ');
	await page.keyboard.press('Control+b');
	await page.keyboard.type('bold');
	await page.keyboard.press('Control+b');
	await page.keyboard.type(' again');
	await page.keyboard.press('Enter');
	await page.keyboard.type('a point');
	await page.locator('[data-command="list:bullet"]:visible').first().click();
	await expect(typing).toBeFocused();
	// The last word of the line in italics from the ribbon: selected with the keyboard
	await page.keyboard.press('Shift+Control+ArrowLeft');
	await page.locator('[data-command="italic"]:visible').first().click();
	await shot(page, 'pdf-editor-rich-typing');
	await page.keyboard.press('Escape');
	await expect.poll(() => decoded('Contents'), { timeout: 10_000 }).toBe('Plain bold again\na point');
	const rc = await decoded('RC');
	expect(rc).toMatch(/font-weight:bold;[^"]*">bold<\/span>/);
	expect(rc).toMatch(/font-weight:normal;[^"]*">Plain <\/span>/);
	expect(rc).toMatch(/">• <\/span>.*font-style:italic;[^"]*">point<\/span>/);

	// The selected box as a whole in another font: its own style, kept with the formats of its parts
	await page.keyboard.press('l');
	await page.mouse.click(surface.x + 520, surface.y + 305);
	await page.locator('[data-command="fontFamily"]:visible').first().click();
	await page.getByRole('menuitemcheckbox', { name: 'Serif', exact: true }).or(page.getByRole('menuitem', { name: 'Serif', exact: true })).click();
	await expect.poll(() => decoded('DS'), { timeout: 10_000 }).toContain('Times');
	expect(await decoded('RC')).toMatch(/font-family:Times;[^"]*font-weight:bold;[^"]*">bold<\/span>/);
	await shot(page, 'pdf-editor-rich');

	// Read again: the formats are back in the field
	await page.reload();
	await expect(page.getByTestId('surface')).toBeVisible();
	await page.keyboard.press('l');
	await page.mouse.dblclick(surface.x + 520, surface.y + 305);
	await expect(page.getByRole('textbox', { name: 'Text of the text box' }).locator('span', { hasText: /^bold$/ })).toHaveCSS('font-weight', '700');
});
