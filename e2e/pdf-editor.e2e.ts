import type { Page } from '@playwright/test';
import { PDFDict, PDFDocument, PDFHexString, PDFName, rgb, StandardFonts } from 'pdf-lib';
import { expect, test } from './fixtures.js';
import { formPdf, getFile, putFile, scriptedPdf, shot } from './pdf.js';

// The PDF Editor in one flow: open a PDF from the files, see its pages, ribbon, side panel and footer, move between
// pages, rotate a page (saved by itself as an update of the file; undoing gives the original file again), draw on it,
// place a note with a subject, a reply and a status, type a text box, fill in a form. The writer, the pages' rendering
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

	// Side panel with the pages; a click goes to page 3
	await page.getByRole('button', { name: 'Pages', exact: true }).first().click();
	await expect(page.getByTestId('panel')).toBeVisible();
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
});
