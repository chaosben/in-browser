import { describe, expect, it } from 'vitest';
import { md5, rc4 } from '../crypt.js';
import { loadPdf } from '../load.js';
import { openPdf } from '../pdfjs.js';
import { pdfLib } from '../pdf-lib.js';
import type { NewAnnotation } from './annotations.js';
import { IncrementalPdf } from './incremental.js';

// PDFs protected without a password (an owner password only), made by MuPDF (`fixtures/`, see there): read
// decrypted, changes appended encrypted with the file's key – checked by PDF.js, an independent implementation.
// Each has a page with “Protected page” and a note by “Ada” saying “Hello encrypted”; the `user-*` files need a
// password (below).

async function fixture(name: string): Promise<Uint8Array> {
	return new Uint8Array(await (await fetch(new URL(`./fixtures/${name}.pdf`, import.meta.url))).arrayBuffer());
}

/** What PDF.js reads: the page's text and its annotations' contents */
async function shown(bytes: Uint8Array, password?: string) {
	const pdf = await openPdf(bytes.slice(), password);
	const out: { text: string; contents: string[] }[] = [];
	for (let n = 1; n <= pdf.numPages; n++) {
		const page = await pdf.getPage(n);
		const text = (await page.getTextContent()).items.map((i) => ('str' in i ? i.str : '')).join('');
		const contents = (await page.getAnnotations()).map((a: { contentsObj?: { str: string } }) => a.contentsObj?.str ?? '');
		out.push({ text, contents });
	}
	await pdf.loadingTask.destroy();
	return out;
}

const note: NewAnnotation = {
	subtype: 'Text',
	name: 'note-1',
	rect: [200, 200, 220, 220],
	color: [1, 0.8, 0],
	author: 'Zoë',
	contents: 'Neu – größer (1)',
	appearance: { content: '1 0.8 0 rg 0 0 20 20 re f' }
};

describe('crypt', () => {
	it('computes MD5 and RC4 as specified', () => {
		const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
		const bytes = (s: string) => new TextEncoder().encode(s);
		expect(hex(md5(bytes('')))).toBe('d41d8cd98f00b204e9800998ecf8427e');
		expect(hex(md5(bytes('abc')))).toBe('900150983cd24fb0d6963f7d28e17f72');
		expect(hex(md5(bytes('a'.repeat(100))))).toBe('36a92cc94a9e0fa21f625f8bfb007adf');
		// RFC 6229-style vector: key "Key", text "Plaintext"
		expect(hex(rc4(bytes('Key'), bytes('Plaintext')))).toBe('bbf316e8d940af0ad3');
	});
});

describe('PDFs protected without a password', () => {
	for (const name of ['rc4-40', 'rc4-128', 'aes-128', 'aes-256']) {
		it(`reads and writes ${name}`, async () => {
			const base = await fixture(name);
			const pdf = await IncrementalPdf.open(base);
			expect(pdf.encrypted).toBe(true);
			expect(pdf.locked).toBe(false);
			expect(pdf.pageCount).toBe(1);
			expect(pdf.annotations(0)).toMatchObject([{ subtype: 'Text', author: 'Ada', contents: 'Hello encrypted' }]);

			const out = await pdf.update({ annotations: new Map([[0, [note]]]), rotate: new Map([[0, 90]]) });
			expect(out.subarray(0, base.length)).toEqual(base);
			// The note's popup shows its text too
			const [page] = await shown(out);
			expect(page.text).toBe('Protected page');
			expect(page.contents.sort()).toEqual(['Hello encrypted', 'Hello encrypted', 'Neu – größer (1)']);

			// Our section read back by us: still the same key
			const again = await IncrementalPdf.open(out);
			expect(again.locked).toBe(false);
			expect(again.rotation(0)).toBe(90);
			expect(again.annotations(0).map((a) => [a.author, a.contents])).toEqual([
				['Ada', 'Hello encrypted'],
				['Zoë', 'Neu – größer (1)']
			]);
		});
	}

	it('copies pages of a protected PDF into another one', async () => {
		const target = await IncrementalPdf.open(await fixture('rc4-128'));
		const source = await fixture('aes-256');
		const out = await target.update({ pages: [{ base: 0 }, { copy: { pdf: source, index: 0 } }] });
		expect((await shown(out)).map((p) => p.text)).toEqual(['Protected page', 'Protected page']);
	});

	it('extracts and merges pages of protected PDFs with PDF.js', async () => {
		const pdf = await openPdf(await fixture('aes-256'));
		const out = await pdf.extractPages([{ document: null }, { document: await fixture('rc4-40') }]);
		await pdf.loadingTask.destroy();
		expect((await shown(out)).map((p) => p.text)).toEqual(['Protected page', 'Protected page']);
	});

	it('leaves PDFs that need a password alone without it', async () => {
		const bytes = await fixture('user-password');
		const pdf = await IncrementalPdf.open(bytes);
		expect(pdf.locked).toBe(true);
		await expect(pdf.update({ rotate: new Map([[0, 90]]) })).rejects.toThrow();
		expect((await loadPdf(bytes)).locked).toBe(true);
		expect((await loadPdf(bytes, false, 'wrong')).locked).toBe(true);
	});
});

// PDFs that need a password to open (user password “secret”, owner password “owner”; one with “Grüße”): opened with
// either, changed and written with the file's key, and read back by PDF.js with the password
describe('PDFs protected by a password', () => {
	it.each([
		['user-rc4-40', 'secret'],
		['user-rc4-128', 'owner'],
		['user-password', 'secret'],
		['user-aes-256', 'secret'],
		['user-aes-256', 'owner'],
		['user-aes-256-umlaut', 'Grüße']
	])('opens %s with “%s”, writes into it, and it stays protected', async (name, password) => {
		const base = await fixture(name);
		const pdf = await IncrementalPdf.open(base, password);
		expect(pdf.locked).toBe(false);
		expect(pdf.annotations(0)).toMatchObject([{ author: 'Ada', contents: 'Hello encrypted' }]);
		const out = await pdf.update({ annotations: new Map([[0, [note]]]) });
		expect(out.subarray(0, base.length)).toEqual(base);
		await expect(openPdf(out.slice())).rejects.toMatchObject({ reason: 'password' });
		const [page] = await shown(out, password);
		expect(page.text).toBe('Protected page');
		expect(page.contents).toContain('Neu – größer (1)');
		expect((await IncrementalPdf.open(out, password)).annotations(0).map((a) => a.author)).toEqual(['Ada', 'Zoë']);
	});

	it('says when a password is wrong', async () => {
		await expect(openPdf(await fixture('user-aes-256'), 'nope')).rejects.toMatchObject({ reason: 'password', wrong: true });
		expect((await IncrementalPdf.open(await fixture('user-rc4-128'), 'nope')).locked).toBe(true);
	});
});

// Protection set here: always AES-256 (revision 6), the file written anew – checked by PDF.js
describe('protecting a PDF', () => {
	async function plain(): Promise<Uint8Array> {
		const { PDFDocument, StandardFonts } = await pdfLib();
		const doc = await PDFDocument.create();
		doc.setTitle('Secret title');
		const font = await doc.embedFont(StandardFonts.Helvetica);
		doc.addPage([300, 400]).drawText('Protected page', { x: 20, y: 360, size: 18, font });
		return doc.save({ useObjectStreams: false });
	}
	const latin1 = (b: Uint8Array) => new TextDecoder('latin1').decode(b);

	it('sets, changes and removes a password with permissions; nothing stays readable without it', async () => {
		const base = await plain();
		const out = await (await IncrementalPdf.open(base)).protect({ user: 'Grüße', owner: 'chef', permissions: ['print', 'fillForms'] });
		expect(latin1(out)).not.toContain('Secret title');
		await expect(openPdf(out.slice())).rejects.toMatchObject({ reason: 'password' });
		for (const password of ['Grüße', 'chef']) {
			const pdf = await openPdf(out.slice(), password);
			expect((await pdf.getMetadata()).info).toMatchObject({ Title: 'Secret title' });
			// PDF.js lists what is allowed (the standard's bit numbers)
			expect([...((await pdf.getPermissions()) ?? [])].sort((a, b) => a - b)).toEqual([4, 256, 512]);
			await pdf.loadingTask.destroy();
		}
		expect((await shown(out, 'Grüße'))[0].text).toBe('Protected page');
		const opened = await IncrementalPdf.open(out, 'Grüße');
		expect(opened.protection).toEqual({ method: 'aes-256', permissions: ['print', 'fillForms', 'accessibility'], needsPassword: true, openedAs: 'user' });
		// Which password opened it (the dialog keeps a known one when its field stays empty)
		expect((await IncrementalPdf.open(out, 'chef')).protection?.openedAs).toBe('owner');

		// Another password: the old one opens it no more
		const changed = await opened.protect({ user: 'neu', owner: '', permissions: [] });
		await expect(openPdf(changed.slice(), 'Grüße')).rejects.toMatchObject({ reason: 'password', wrong: true });
		expect((await shown(changed, 'neu'))[0].text).toBe('Protected page');

		// No protection at all
		const open = await (await IncrementalPdf.open(changed, 'neu')).protect(null);
		expect(latin1(open)).not.toContain('/Encrypt');
		expect((await shown(open))[0].text).toBe('Protected page');
		expect((await IncrementalPdf.open(open)).protection).toBeNull();
	});

	it('protects pages taken out of a protected PDF as it is', async () => {
		const base = await fixture('user-rc4-128');
		const source = await IncrementalPdf.open(base, 'secret');
		const pdf = await openPdf(base.slice(), 'secret');
		const extracted = await pdf.extractPages([{ document: null }]);
		await pdf.loadingTask.destroy();
		const sealed = await source.protectLike(extracted);
		await expect(openPdf(sealed.slice())).rejects.toMatchObject({ reason: 'password' });
		expect((await shown(sealed, 'secret'))[0].text).toBe('Protected page');
	});
});
