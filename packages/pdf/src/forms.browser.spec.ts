import { describe, expect, it } from 'vitest';
import { filledForm, readFields, storageValue, type FieldValue } from './forms.js';
import { pdfLib } from './pdf-lib.js';
import { openPdf } from './pdfjs.js';
import { IncrementalPdf } from './write/incremental.js';

// Form fields read through PDF.js, filled in and saved by PDF.js (`filledForm`), taken into our section by the writer,
// read back by PDF.js and pdf-lib.

async function sample(): Promise<Uint8Array> {
	const { PDFDocument } = await pdfLib();
	const doc = await PDFDocument.create();
	const page = doc.addPage([400, 400]);
	const form = doc.getForm();
	const name = form.createTextField('person.name');
	name.addToPage(page, { x: 20, y: 340, width: 200, height: 24 });
	name.enableRequired();
	name.acroField.setDefaultAppearance('/Helv 0 Tf 0 g');
	const notes = form.createTextField('notes');
	notes.enableMultiline();
	notes.addToPage(page, { x: 20, y: 240, width: 200, height: 80 });
	const agree = form.createCheckBox('agree');
	agree.addToPage(page, { x: 20, y: 200, width: 16, height: 16 });
	const size = form.createRadioGroup('size');
	size.addOptionToPage('S', page, { x: 20, y: 160, width: 16, height: 16 });
	size.addOptionToPage('L', page, { x: 60, y: 160, width: 16, height: 16 });
	const color = form.createDropdown('color');
	color.addOptions(['Red', 'Green']);
	color.addToPage(page, { x: 20, y: 110, width: 120, height: 22 });
	const days = form.createOptionList('days');
	days.addOptions(['Mon', 'Tue', 'Wed']);
	days.enableMultiselect();
	days.addToPage(page, { x: 200, y: 60, width: 100, height: 60 });
	// The form's own fonts, as real forms have them (`/DA` names `/Helv`)
	const { PDFName } = await pdfLib();
	const helv = doc.context.register(doc.context.obj({ Type: 'Font', Subtype: 'Type1', BaseFont: 'Helvetica', Encoding: 'WinAnsiEncoding' }));
	form.acroForm.dict.set(PDFName.of('DR'), doc.context.obj({ Font: { Helv: helv } }));
	return doc.save({ useObjectStreams: false });
}

async function fieldsOf(bytes: Uint8Array) {
	const pdf = await openPdf(bytes.slice());
	const fields = await readFields(pdf);
	await pdf.loadingTask.destroy();
	return fields;
}

describe('form fields', () => {
	it('reads the fields with their kinds, widgets and values', async () => {
		const fields = await fieldsOf(await sample());
		const by = (n: string) => fields.find((f) => f.name === n)!;
		expect(fields.map((f) => [f.name, f.kind])).toEqual([
			['person.name', 'text'],
			['notes', 'text'],
			['agree', 'checkbox'],
			['size', 'radio'],
			['color', 'combo'],
			['days', 'list']
		]);
		expect(by('person.name')).toMatchObject({ required: true, value: '', multiLine: false });
		expect(by('notes').multiLine).toBe(true);
		expect(by('agree').value).toBe('Off');
		expect(by('size').widgets.map((w) => w.on)).toHaveLength(2);
		expect(by('color').options.map((o) => o.label)).toEqual(['Red', 'Green']);
		expect(by('days').multiSelect).toBe(true);
		expect(by('person.name').widgets[0].ref).toMatch(/^\d+ 0 R$/);
		const agree = by('agree');
		expect(storageValue(agree, agree.widgets[0], agree.widgets[0].on!)).toEqual({ value: true });
	});

	it('saves values as PDF.js writes them: in the form’s own font, sized like on screen', async () => {
		const base = await sample();
		const fields = await fieldsOf(base);
		const by = (n: string) => fields.find((f) => f.name === n)!;
		const fill = (values: [string, FieldValue][]) => {
			const out = new Map<string, ReturnType<typeof storageValue>>();
			for (const [name, value] of values) for (const w of by(name).widgets) out.set(w.id, storageValue(by(name), w, value));
			return out;
		};
		const large = by('size').widgets[1].on!;
		const form = await filledForm(
			base,
			fill([
				['person.name', 'Zoë (Ada)'],
				['agree', by('agree').widgets[0].on!],
				['size', large],
				['color', 'Green'],
				['days', ['Mon', 'Wed']]
			])
		);
		const out = await (await IncrementalPdf.open(base)).update({ form, rotate: new Map([[0, 0]]) });
		expect(out.subarray(0, base.length)).toEqual(base);
		// One section of ours
		expect(new TextDecoder('latin1').decode(out.subarray(base.length)).match(/%%EOF/g)).toHaveLength(1);

		const again = await fieldsOf(out);
		const get = (n: string) => again.find((f) => f.name === n)!.value;
		expect(get('person.name')).toBe('Zoë (Ada)');
		expect(get('agree')).not.toBe('Off');
		expect(get('size')).toBe(large);
		expect(get('color')).toBe('Green');
		expect(get('days')).toEqual(['Mon', 'Wed']);

		// pdf-lib: the boxes' states; the name's appearance uses the form's own Helvetica (`/DR`), at PDF.js's size
		const { PDFDocument, PDFName, PDFDict, PDFRawStream, PDFRef, decodePDFRawStream } = await pdfLib();
		const doc = await PDFDocument.load(out);
		const form2 = doc.getForm();
		expect(form2.getCheckBox('agree').isChecked()).toBe(true);
		const states = form2.getRadioGroup('size').acroField.getWidgets().map((w) => w.getAppearanceState()?.decodeText());
		expect(states[0]).toBe('Off');
		expect(states[1]).not.toBe('Off');
		const dr = doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict).lookup(PDFName.of('DR'), PDFDict).lookup(PDFName.of('Font'), PDFDict);
		const [widget] = form2.getTextField('person.name').acroField.getWidgets();
		const ap = widget.dict.lookup(PDFName.of('AP'), PDFDict).lookup(PDFName.of('N'));
		expect(ap).toBeInstanceOf(PDFRawStream);
		const stream = ap as unknown as Parameters<typeof decodePDFRawStream>[0];
		const fonts = stream.dict.lookup(PDFName.of('Resources'), PDFDict).lookup(PDFName.of('Font'), PDFDict);
		expect(fonts.get(PDFName.of('Helv'))).toBeInstanceOf(PDFRef);
		expect(fonts.get(PDFName.of('Helv'))!.toString()).toBe(dr.get(PDFName.of('Helv'))!.toString());
		const content = new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode());
		// Height 25 (pdf-lib's box with its border): (25 − 2) / 1.35
		expect(content).toContain('/Helv 17.03 Tf');
	});

	it('leaves text a form’s font can’t write to the viewers (`/NeedAppearances`)', async () => {
		const base = await sample();
		const fields = await fieldsOf(base);
		const name = fields.find((f) => f.name === 'person.name')!;
		const form = await filledForm(base, new Map([[name.widgets[0].id, storageValue(name, name.widgets[0], 'Łódź 大')]]));
		const out = await (await IncrementalPdf.open(base)).update({ form });
		expect((await fieldsOf(out)).find((f) => f.name === 'person.name')!.value).toBe('Łódź 大');
		const { PDFDocument, PDFName, PDFDict } = await pdfLib();
		const doc = await PDFDocument.load(out);
		expect(doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict).get(PDFName.of('NeedAppearances'))?.toString()).toBe('true');
	});

	it('fills in a form protected without a password; it stays protected', async () => {
		const base = new Uint8Array(await (await fetch(new URL('./write/fixtures/form-aes-128.pdf', import.meta.url))).arrayBuffer());
		const fields = await fieldsOf(base);
		const name = fields.find((f) => f.name === 'name')!;
		const agree = fields.find((f) => f.name === 'agree')!;
		const form = await filledForm(
			base,
			new Map([
				[name.widgets[0].id, storageValue(name, name.widgets[0], 'Ada')],
				[agree.widgets[0].id, storageValue(agree, agree.widgets[0], agree.widgets[0].on!)]
			])
		);
		const pdf = await IncrementalPdf.open(base);
		expect(pdf.encrypted).toBe(true);
		const out = await pdf.update({ form });
		const again = await fieldsOf(out);
		expect(again.find((f) => f.name === 'name')!.value).toBe('Ada');
		expect(again.find((f) => f.name === 'agree')!.value).not.toBe('Off');
		expect((await IncrementalPdf.open(out)).encrypted).toBe(true);
	});
});
