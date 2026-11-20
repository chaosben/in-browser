import type { Page } from '@playwright/test';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';

// PDFs and My files for the PDF Editor's flows (desktop and phone)

/** A form: a required name, a check box, a choice – and `blank` empty pages after it */
export async function formPdf(blank = 0): Promise<Buffer> {
	const doc = await PDFDocument.create();
	const page = doc.addPage([595, 842]);
	const form = doc.getForm();
	const name = form.createTextField('name');
	name.enableRequired();
	name.addToPage(page, { x: 72, y: 700, width: 240, height: 24 });
	const city = form.createTextField('city');
	city.addToPage(page, { x: 72, y: 650, width: 240, height: 24 });
	form.createCheckBox('agree').addToPage(page, { x: 72, y: 600, width: 18, height: 18 });
	const color = form.createDropdown('color');
	color.addOptions(['Red', 'Green', 'Blue']);
	color.addToPage(page, { x: 72, y: 540, width: 160, height: 24 });
	for (let i = 0; i < blank; i++) doc.addPage([595, 842]);
	return Buffer.from(await doc.save());
}

/** A form with scripts: hours `a` and `b`, `sum` = a + b by a script of its own, numbers formatted like Acrobat's */
export async function scriptedPdf(): Promise<Buffer> {
	const doc = await PDFDocument.create();
	const page = doc.addPage([595, 842]);
	const form = doc.getForm();
	const js = (code: string) => doc.context.obj({ S: 'JavaScript', JS: PDFString.of(code) });
	const number = { K: js('AFNumber_Keystroke(2, 0, 0, 0, "", true);'), F: js('AFNumber_Format(2, 0, 0, 0, "", true);') };
	for (const [i, name] of ['a', 'b', 'sum'].entries()) {
		const field = form.createTextField(name);
		field.addToPage(page, { x: 72, y: 700 - i * 50, width: 160, height: 24 });
		const aa = name === 'sum' ? { ...number, C: js('event.value = Number(this.getField("a").value) + Number(this.getField("b").value);') } : number;
		field.acroField.dict.set(PDFName.of('AA'), doc.context.obj(aa));
	}
	form.getTextField('sum').enableReadOnly();
	form.acroForm.dict.set(PDFName.of('CO'), doc.context.obj([form.getTextField('sum').acroField.ref]));
	return Buffer.from(await doc.save());
}

/** Writes a file into My files (the OPFS folder `files`) */
export async function putFile(page: Page, name: string, data: Buffer) {
	await page.evaluate(
		async ({ name, base64 }) => {
			const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files', { create: true });
			const writable = await (await root.getFileHandle(name, { create: true })).createWritable();
			await writable.write(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
			await writable.close();
		},
		{ name, base64: data.toString('base64') }
	);
}

/** Reads a file of My files */
export async function getFile(page: Page, name: string): Promise<Buffer> {
	const base64 = await page.evaluate(async (name) => {
		const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('files');
		const bytes = new Uint8Array(await (await (await root.getFileHandle(name)).getFile()).arrayBuffer());
		let s = '';
		for (const b of bytes) s += String.fromCharCode(b);
		return btoa(s);
	}, name);
	return Buffer.from(base64, 'base64');
}

/** Screenshots for looking at the UI (only with SHOTS=<folder>) */
export async function shot(page: Page, name: string) {
	const dir = process.env.SHOTS;
	if (!dir) return;
	for (const theme of ['light', 'dark']) {
		await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
		await page.waitForTimeout(150);
		await page.screenshot({ path: `${dir}/${name}-${theme}.png` });
	}
}
