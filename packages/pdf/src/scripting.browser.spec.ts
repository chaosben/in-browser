import { afterEach, describe, expect, it } from 'vitest';
import { readFields } from './forms.js';
import { pdfLib } from './pdf-lib.js';
import { openPdf } from './pdfjs.js';
import { startScripts, type FormScripts } from './scripting.js';

// A form's scripts in the QuickJS sandbox: a sum calculated by the form's own JavaScript, numbers formatted and
// checked by Acrobat's functions (`AFNumber_*`), as forms made with Acrobat have them.

/** Hours `a` and `b` (numbers with two decimals), `sum` = a + b by a script of its own (`/AA /C`, `/CO`) */
async function sample(): Promise<Uint8Array> {
	const { PDFDocument, PDFName, PDFString } = await pdfLib();
	const doc = await PDFDocument.create();
	const page = doc.addPage([400, 300]);
	const form = doc.getForm();
	const js = (code: string) => doc.context.obj({ S: 'JavaScript', JS: PDFString.of(code) });
	const number = { K: js('AFNumber_Keystroke(2, 0, 0, 0, "", true);'), F: js('AFNumber_Format(2, 0, 0, 0, "", true);') };
	for (const [i, name] of ['a', 'b', 'sum'].entries()) {
		const field = form.createTextField(name);
		field.addToPage(page, { x: 20, y: 240 - i * 40, width: 120, height: 24 });
		const aa = name === 'sum' ? { ...number, C: js('event.value = Number(this.getField("a").value) + Number(this.getField("b").value);') } : number;
		field.acroField.dict.set(PDFName.of('AA'), doc.context.obj(aa));
	}
	form.acroForm.dict.set(PDFName.of('CO'), doc.context.obj([form.getTextField('sum').acroField.ref]));
	return doc.save({ useObjectStreams: false });
}

const open: FormScripts[] = [];
afterEach(() => open.splice(0).forEach((s) => s.destroy()));

describe('form scripts', { timeout: 20_000 }, () => {
	it('calculates, formats and turns down what a field does not take', async () => {
		const pdf = await openPdf(await sample());
		const alerts: string[] = [];
		const scripts = (await startScripts(pdf, { language: 'en-US', onAlert: (t) => alerts.push(t) }))!;
		expect(scripts).not.toBeNull();
		open.push(scripts);
		const widget = Object.fromEntries((await readFields(pdf)).map((f) => [f.name, f.widgets[0].id]));
		const commit = (name: string, value: string) => scripts.dispatch({ id: widget[name], name: 'Keystroke', value, willCommit: true, commitKey: 1, selStart: 0, selEnd: 0 });

		expect(await commit('a', '1.5')).toContainEqual(expect.objectContaining({ field: 'a', value: '1.5', formattedValue: '1.50' }));
		const changes = await commit('b', '2.25');
		expect(changes).toContainEqual(expect.objectContaining({ field: 'sum', value: 3.75, formattedValue: '3.75' }));

		// Not a number: the input is turned down with a message
		const refused = await commit('a', 'many');
		expect(refused).toContainEqual(expect.objectContaining({ field: 'a', value: '' }));
		expect(alerts.length).toBe(1);
	});

	it('starts nothing for a form without scripts', async () => {
		const { PDFDocument } = await pdfLib();
		const doc = await PDFDocument.create();
		doc.getForm().createTextField('plain').addToPage(doc.addPage([200, 200]), { x: 10, y: 10, width: 100, height: 20 });
		expect(await startScripts(await openPdf(await doc.save()), { language: 'en-US' })).toBeNull();
	});
});
