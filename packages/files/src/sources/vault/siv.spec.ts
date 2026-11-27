import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { Siv } from './siv.js';

// AES-SIV against RFC 5297 and Cryptomator's own test cases (`fixtures/siv-testcases.txt`, a selection with 256-bit
// keys of siv-mode's `testcases.txt`, MIT License, © Cryptomator: ctrKey;macKey;plaintext;n;ad1…adn;ciphertext)

const hex = (text: string) => Uint8Array.from(text.match(/../g) ?? [], (h) => parseInt(h, 16));

const cases = (await readFile(new URL('./fixtures/siv-testcases.txt', import.meta.url), 'utf8'))
	.trim()
	.split('\n')
	.map((line) => {
		const fields = line.split(';');
		const n = Number(fields[3]);
		return { ctr: hex(fields[0]), mac: hex(fields[1]), plain: hex(fields[2]), data: fields.slice(4, 4 + n).map(hex), cipher: hex(fields[4 + n]) };
	});

describe('AES-SIV', () => {
	it('matches RFC 5297 (A.1)', async () => {
		const key = hex('fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff');
		const siv = await Siv.create(key.slice(16), key.slice(0, 16));
		const out = await siv.encrypt(hex('112233445566778899aabbccddee'), hex('101112131415161718191a1b1c1d1e1f2021222324252627'));
		expect(out).toEqual(hex('85632d07c6e8f37f950acd320a2ecc9340c02b9690c4dc04daef7f6afe5c'));
	});

	it('matches siv-mode’s cases and refuses what was changed', async () => {
		for (const c of cases) {
			const siv = await Siv.create(c.ctr, c.mac);
			expect(await siv.encrypt(c.plain, ...c.data)).toEqual(c.cipher);
			expect(await siv.decrypt(c.cipher, ...c.data)).toEqual(c.plain);
			const changed = new Uint8Array(c.cipher);
			changed[changed.length - 1] ^= 1;
			expect(await siv.decrypt(changed, ...c.data)).toBeNull();
		}
	});
});
