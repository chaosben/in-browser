import { describe, expect, it } from 'vitest';
import { md5, rc4 } from '../crypt.js';
import { loadPdf } from '../load.js';
import { openPdf } from '../pdfjs.js';
import type { NewAnnotation } from './annotations.js';
import { IncrementalPdf } from './incremental.js';

// PDFs protected without a password (an owner password only), made by MuPDF (`fixtures/`, see there): read
// decrypted, changes appended encrypted with the file's key – checked by PDF.js, an independent implementation.
// Each has a page with “Protected page” and a note by “Ada” saying “Hello encrypted”; `user-password.pdf` needs
// the password “secret”.

async function fixture(name: string): Promise<Uint8Array> {
	return new Uint8Array(await (await fetch(new URL(`./fixtures/${name}.pdf`, import.meta.url))).arrayBuffer());
}

/** What PDF.js reads: the page's text and its annotations' contents */
async function shown(bytes: Uint8Array) {
	const pdf = await openPdf(bytes.slice());
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

	it('leaves PDFs that need a password alone', async () => {
		const bytes = await fixture('user-password');
		const pdf = await IncrementalPdf.open(bytes);
		expect(pdf.locked).toBe(true);
		await expect(pdf.update({ rotate: new Map([[0, 90]]) })).rejects.toThrow();
		expect((await loadPdf(bytes)).locked).toBe(true);
	});
});
