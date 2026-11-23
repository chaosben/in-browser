import { PDFDocument, StandardFonts } from 'pdf-lib';
import { expect, test, watchProblems } from './fixtures.js';
import { fakeRelay } from './relay.js';
import { getFile, putFile, shot } from './pdf.js';

// Presenting a PDF: the presenter view in the editor's tab with the slides in a window of their own – the window
// follows the presenter view and its own keys, comes back where it was when closed, and ends with the presentation.
// Then the remote control: a phone shares the PDF, a computer at the projector opens it with four words and shows the
// slides, the phone steers them – also after reloading, while another tab of the phone held the connections – and a
// change made on the phone meanwhile arrives on the slides.
// What the display and its controls decide (places, steps) is covered by `show/state.spec.ts`.

/** A PDF with three slides, each with its number */
async function slides(): Promise<Buffer> {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let n = 1; n <= 3; n++) doc.addPage([960, 540]).drawText(`Slide ${n}`, { x: 72, y: 400, size: 48, font });
	return Buffer.from(await doc.save());
}

test('presents with the presenter view: the slides window follows, is found again after a reload, comes back when closed and ends with it', async ({ page }) => {
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto('/pdf-editor');
	await putFile(page, 'Talk.pdf', await slides());
	await page.goto('/pdf-editor/editor?path=%2FTalk.pdf');
	await expect(page.getByText('/ 3')).toBeVisible();

	// Notes for the first slide, written in the side panel (kept when the field is left)
	await page.getByRole('tab', { name: 'Present' }).click();
	await page.locator('[data-command="panel:notes"]').first().click();
	await page.getByLabel('Notes for page 1').fill('Welcome everybody');
	await page.getByLabel('Notes for page 1').press('Tab');
	// A step for the first slide (steps are managed in the side panel)
	await page.locator('[data-command="panel:steps"]').first().click();
	await page.getByRole('button', { name: 'Another step' }).click();

	// A stroke on the first slide that is there with the page and goes at step 1 (“Show and hide”)
	await page.getByRole('tab', { name: 'Comment' }).click();
	await page.locator('[data-command="pen"]').first().click();
	const surface = (await page.getByTestId('surface').boundingBox())!;
	await page.mouse.move(surface.x + 300, surface.y + 300);
	await page.mouse.down();
	for (let i = 1; i <= 10; i++) await page.mouse.move(surface.x + 300 + i * 20, surface.y + 300 + (i % 2) * 15);
	await page.mouse.up();
	await page.keyboard.press('l');
	await page.mouse.click(surface.x + 360, surface.y + 300 + 15);
	await page.locator('[data-command="visibility"]:visible').first().click();
	await page.getByRole('checkbox', { name: 'Step 1: Visible' }).click();
	await expect(page.getByRole('checkbox', { name: 'Step 1: Visible' })).not.toBeChecked();
	await expect(page.getByRole('checkbox', { name: 'With the page: Visible' })).toBeChecked();
	await shot(page, 'present-visibility');
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-save="saved"]')).toBeVisible({ timeout: 10_000 });

	await page.getByRole('tab', { name: 'Present' }).click();
	// The page's steps in the side panel, with what goes at step 1
	await expect(page.getByTestId('panel').getByRole('button', { name: 'Step 1 1 goes' })).toBeVisible();
	// A step put before it moves it on – for the whole page, as one step to undo
	await page.getByTestId('panel').getByRole('button', { name: 'Step 1 1 goes' }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Insert step before' }).click();
	await expect(page.getByTestId('panel').getByRole('button', { name: 'Step 2 1 goes' })).toBeVisible();
	await shot(page, 'present-steps');
	await page.keyboard.press('Control+z');
	await expect(page.getByTestId('panel').getByRole('button', { name: 'Step 2 1 goes' })).toHaveCount(0);
	await expect(page.getByTestId('panel').getByRole('button', { name: 'Step 1 1 goes' })).toBeVisible();
	const opened = page.waitForEvent('popup');
	await shot(page, 'present-tab');
	await page.locator('[data-command="present"]').first().click();
	const window = await opened;
	await expect(page.getByText('Slide 1 of 3')).toBeVisible();
	await expect(page.getByText('Welcome everybody')).toBeVisible();
	await expect(window.getByRole('img', { name: 'Slide 1 of 3' })).toBeVisible();
	await shot(page, 'present-presenter');
	// The first “Next” stays on the slide: its one step (the stroke goes)
	await page.getByRole('button', { name: 'Next', exact: true }).click();
	await expect(page.getByText('step 1 of 1')).toBeVisible();

	// The presenter view goes on, the slides follow; keys on the slides window go on too, the presenter view follows
	await page.getByRole('button', { name: 'Next', exact: true }).click();
	await expect(window.getByRole('img', { name: 'Slide 2 of 3' })).toBeVisible();
	await window.keyboard.press('ArrowRight');
	await expect(page.getByText('Slide 3 of 3')).toBeVisible();

	// The presenter view reloaded by mistake: it finds its slides again where they are and steers them
	await page.reload();
	await expect(page.getByText('Slide 3 of 3')).toBeVisible();
	await page.getByRole('button', { name: 'Previous', exact: true }).click();
	await expect(window.getByRole('img', { name: 'Slide 2 of 3' })).toBeVisible();
	await page.getByRole('button', { name: 'Next', exact: true }).click();
	await expect(window.getByRole('img', { name: 'Slide 3 of 3' })).toBeVisible();

	// Closed by mistake: the presenter view says so and opens it again where it was
	await window.close();
	await expect(page.getByText('The slides window is closed.')).toBeVisible();
	const reopened = page.waitForEvent('popup');
	await page.getByRole('button', { name: 'Open the slides window' }).click();
	const again = await reopened;
	await expect(again.getByRole('img', { name: 'Slide 3 of 3' })).toBeVisible();

	// “End”: the slides window closes, the editor shows the slide the presentation was at
	const closed = again.waitForEvent('close');
	await page.getByRole('button', { name: 'End', exact: true }).click();
	await closed;
	await expect(page.getByTestId('surface')).toBeVisible();
});

test('a phone shares a PDF by four words and steers the slides on another computer', async ({ browser }) => {
	test.setTimeout(120_000);
	const relay = fakeRelay();
	const phoneContext = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 }, hasTouch: true });
	const laptopContext = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 800 } });
	await relay.attach(phoneContext);
	await relay.attach(laptopContext);
	const phone = await phoneContext.newPage();
	const laptop = await laptopContext.newPage();
	const problems = [phone, laptop].map(watchProblems);

	// The phone: the PDF in its files, shared alone for viewing from the editor's tab “File”
	await phone.goto('/pdf-editor');
	await putFile(phone, 'Talk.pdf', await slides());
	await phone.goto('/pdf-editor/editor?path=%2FTalk.pdf');
	await expect(phone.getByText('/ 3')).toBeVisible();
	await phone.getByRole('tab', { name: 'File' }).click();
	await phone.locator('[data-command="share"]:visible').first().click();
	const dialog = phone.getByRole('dialog').filter({ hasText: 'Share “Talk.pdf”' });
	await dialog.getByRole('button', { name: 'Share', exact: true }).click();
	await dialog.getByRole('button', { name: 'Show four words' }).click();
	const words = (await dialog.getByTestId('share-words').textContent())!.trim();
	expect(words.split(' ')).toHaveLength(4);
	await shot(phone, 'share-words');
	await dialog.getByRole('button', { name: 'Close' }).click();

	// The computer at the projector: “Connect …” → “A share by four words …”, the words – the PDF opens in the editor, only for reading
	await laptop.goto('/files');
	await laptop.locator('[data-tab="connect"]').click();
	await laptop.locator('[data-command="connect"]:visible').click();
	await laptop.getByRole('menuitem', { name: 'A share by four words …' }).click();
	await laptop.getByLabel('Four words').fill(words.toUpperCase());
	await shot(laptop, 'open-share');
	await laptop.getByRole('button', { name: 'Open', exact: true }).click();
	await laptop.waitForURL(/\/pdf-editor\/editor/, { timeout: 30_000 });
	await expect(laptop.getByText('/ 3')).toBeVisible({ timeout: 30_000 });
	await expect(laptop.getByText('shared with you for viewing')).toBeVisible();
	// The slides fill this screen (one screen at the projector)
	await laptop.evaluate(() => localStorage.setItem('pdf-editor:present', JSON.stringify({ mode: 'display', noteSize: 18 })));
	await laptop.reload();
	await expect(laptop.getByText('/ 3')).toBeVisible({ timeout: 30_000 });
	await laptop.getByRole('tab', { name: 'Present' }).click();
	await laptop.locator('[data-command="present"]').first().click();
	await expect(laptop.getByRole('img', { name: 'Slide 1 of 3' })).toBeVisible();

	// Another tab on the phone takes the connections while the first one moves on to the remote control
	const other = await phoneContext.newPage();
	problems.push(watchProblems(other));
	await other.goto('/files');
	await phone.getByRole('button', { name: 'Remote control' }).click({ timeout: 30_000 });
	await phone.waitForURL(/\/pdf-editor\/remote/);
	await expect(phone.getByText('Slide 1 of 3')).toBeVisible({ timeout: 30_000 });
	await phone.getByRole('button', { name: 'Next', exact: true }).click();
	await expect(laptop.getByRole('img', { name: 'Slide 2 of 3' })).toBeVisible({ timeout: 10_000 });
	await shot(phone, 'remote');
	// While the phone steers, a key at the projector moves nothing
	await laptop.keyboard.press('ArrowRight');
	await phone.getByRole('button', { name: 'Next', exact: true }).click();
	await expect(laptop.getByRole('img', { name: 'Slide 3 of 3' })).toBeVisible({ timeout: 10_000 });
	await expect(phone.getByText('Slide 3 of 3')).toBeVisible({ timeout: 10_000 });

	// The phone reloads (a crash, a locked screen): it finds the slides again where they are
	const started = Date.now();
	await phone.reload();
	await expect(phone.getByText('Slide 3 of 3')).toBeVisible({ timeout: 30_000 });
	// Back within seconds, not after the next round of announcements
	expect(Date.now() - started).toBeLessThan(10_000);
	await phone.getByRole('button', { name: 'Previous', exact: true }).click();
	await expect(laptop.getByRole('img', { name: 'Slide 2 of 3' })).toBeVisible({ timeout: 10_000 });

	// Changed on the way: a note written in another tab of the phone. The remote control reads the new version, the
	// computer gets it through the share and shows it on the slide it is at – then both have the same again
	await other.goto('/pdf-editor/editor?path=%2FTalk.pdf');
	await other.getByRole('tab', { name: 'Present' }).click();
	await other.locator('[data-command="panel:notes"]:visible').first().click();
	const before = (await getFile(other, 'Talk.pdf')).length;
	await other.getByLabel(/^Notes for page \d$/).fill('Changed on the way');
	await other.getByLabel(/^Notes for page \d$/).press('Tab');
	await expect.poll(async () => (await getFile(other, 'Talk.pdf')).length, { timeout: 10_000 }).toBeGreaterThan(before);
	const size = (await getFile(other, 'Talk.pdf')).length;
	await expect
		.poll(
			() =>
				laptop.evaluate(async () => {
					const shares = await (await navigator.storage.getDirectory()).getDirectoryHandle('shares');
					for await (const copy of shares.values()) return (await (await (copy as FileSystemDirectoryHandle).getFileHandle('Talk.pdf')).getFile()).size;
					return 0;
				}),
			{ timeout: 20_000 }
		)
		.toBe(size);
	await expect(phone.getByText('The slides are being brought up to date …')).toHaveCount(0, { timeout: 15_000 });
	await expect(laptop.getByRole('img', { name: 'Slide 2 of 3' })).toBeVisible();
	await phone.getByRole('button', { name: 'Next', exact: true }).click();
	await expect(laptop.getByRole('img', { name: 'Slide 3 of 3' })).toBeVisible({ timeout: 10_000 });

	// “End” on the phone leaves the remote control only: the slides stay, and their own keys work again
	await phone.getByRole('button', { name: 'End', exact: true }).click();
	await phone.waitForURL(/\/pdf-editor$/);
	await expect(laptop.getByRole('img', { name: 'Slide 3 of 3' })).toBeVisible();
	await expect(async () => {
		await laptop.keyboard.press('ArrowLeft');
		await expect(laptop.getByRole('img', { name: 'Slide 2 of 3' })).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 10_000 });

	await phoneContext.close();
	await laptopContext.close();
	expect(problems.flat(), 'console errors, exceptions or CSP violations').toEqual([]);
});

test('a paired device is offered the remote control of slides shown on the other one, also when its tab was in the back', async ({ browser }) => {
	test.setTimeout(150_000);
	const relay = fakeRelay();
	const laptopContext = await browser.newContext({ locale: 'en-US', viewport: { width: 1400, height: 900 } });
	const phoneContext = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 }, hasTouch: true });
	await relay.attach(laptopContext);
	await relay.attach(phoneContext);
	const laptop = await laptopContext.newPage();
	const phone = await phoneContext.newPage();
	const problems = [laptop, phone].map(watchProblems);

	// The laptop has the PDF and pairs with the phone, which syncs everything
	await laptop.goto('/files');
	await putFile(laptop, 'Talk.pdf', await slides());
	await laptop.locator('[data-tab="sync"]').click();
	await laptop.locator('[data-command="syncSettings"]:visible').click();
	await laptop.getByRole('button', { name: 'Connect devices' }).click();
	await laptop.getByRole('button', { name: 'Next' }).click();
	await laptop.getByLabel('Name of this device').fill('Laptop');
	await laptop.getByRole('button', { name: 'Next' }).click();
	const key = (await laptop.getByRole('dialog').locator('code').textContent())!.trim();
	await phone.goto(`/files#pair=${key.replace(/-/g, '')}`);
	await phone.getByLabel('Name of this device').fill('Phone');
	await phone.getByRole('button', { name: 'Connect', exact: true }).click();
	const choose = phone.getByRole('dialog', { name: 'Choose what this device syncs' });
	await expect(choose).toBeVisible({ timeout: 30_000 });
	await choose.getByRole('button', { name: 'Start syncing' }).click();
	await expect.poll(() => getFile(phone, 'Talk.pdf').then((f) => f.length, () => 0), { timeout: 30_000 }).toBeGreaterThan(0);

	// The phone's tab is in the back while the presentation starts
	await phone.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }));

	// The laptop presents with the presenter view: its slides window offers itself to the phone
	await laptop.goto('/pdf-editor/editor?path=%2FTalk.pdf');
	await expect(laptop.getByText('/ 3')).toBeVisible();
	await laptop.getByRole('tab', { name: 'Present' }).click();
	const opened = laptop.waitForEvent('popup');
	await laptop.locator('[data-command="present"]').first().click();
	const window = await opened;
	problems.push(watchProblems(window));
	await expect(window.getByRole('img', { name: 'Slide 1 of 3' })).toBeVisible();

	// The phone hears of it; back in front it says so with the way in, and steers
	await expect(phone.locator('[data-live="1"]')).toBeAttached({ timeout: 45_000 });
	await expect(phone.getByRole('button', { name: 'Remote control' })).toHaveCount(0);
	await phone.evaluate(() => {
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await phone.getByRole('button', { name: 'Remote control' }).click();
	await phone.waitForURL(/\/pdf-editor\/remote/);
	await expect(phone.getByText('Slide 1 of 3')).toBeVisible({ timeout: 30_000 });
	await phone.getByRole('button', { name: 'Next', exact: true }).click();
	await expect(window.getByRole('img', { name: 'Slide 2 of 3' })).toBeVisible({ timeout: 10_000 });
	// The presenter view on the laptop follows
	await expect(laptop.getByText('Slide 2 of 3')).toBeVisible();

	await phoneContext.close();
	await laptopContext.close();
	expect(problems.flat(), 'console errors, exceptions or CSP violations').toEqual([]);
});
