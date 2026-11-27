import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { cipherNameKind, formatMasterKey, GocryptfsKeys, newConfig, newMasterKey, parseConfig, parseDirIV, plainSize, unlockMasterKey, VaultFormatError, WrongPassword } from './gocryptfs.js';

// A folder written by gocryptfs itself (`fixtures/v1.3`, see the README there): what the suite reads must be what
// gocryptfs wrote, and what it writes must be what gocryptfs would read.

const fixture = (name: string) => readFile(new URL(`./fixtures/v1.3/${name}`, import.meta.url));
const LONG_NAME = `longname_255_${'x'.repeat(255 - 13)}`;

async function unlocked() {
	const config = parseConfig((await fixture('gocryptfs.conf')).toString());
	const master = await unlockMasterKey(config, 'test');
	return { config, master, keys: await GocryptfsKeys.create(master, config), iv: parseDirIV(new Uint8Array(await fixture('gocryptfs.diriv'))) };
}

describe('gocryptfs', () => {
	it('reads a folder gocryptfs wrote: master key, names, long names and contents', async () => {
		const { master, keys, iv } = await unlocked();
		expect(formatMasterKey(master)).toBe('fd890dab-86bf61cf-ec5ad460-ad3ed01f-9c52d546-2a31783d-a56b088d-3d05232e');
		const names = new Map<string, string>();
		for (const name of await readdir(new URL('./fixtures/v1.3/', import.meta.url))) {
			const kind = cipherNameKind(name);
			if (kind === 'internal') continue;
			const encrypted = kind === 'long' ? (await fixture(`${name}.name`)).toString() : name;
			names.set((await keys.decryptName(encrypted, iv))!, name);
		}
		expect([...names.keys()].sort()).toEqual([LONG_NAME, 'status.txt']);
		const status = new Uint8Array(await fixture(names.get('status.txt')!));
		expect(new TextDecoder().decode(await keys.decryptFile(status))).toBe('It works!\n');
		expect(plainSize(status.length, keys.cipherBS)).toBe(10);
		// Encrypting gives the names gocryptfs gave (EME is deterministic per folder)
		expect((await keys.encryptName('status.txt', iv)).stored).toBe(names.get('status.txt'));
		expect((await keys.encryptName(LONG_NAME, iv)).stored).toBe(names.get(LONG_NAME));
	});

	it('refuses a wrong password and settings it does not know', async () => {
		const config = parseConfig((await fixture('gocryptfs.conf')).toString());
		await expect(unlockMasterKey(config, 'wrong')).rejects.toBeInstanceOf(WrongPassword);
		const xchacha = JSON.parse((await fixture('gocryptfs.conf')).toString());
		xchacha.FeatureFlags.push('XChaCha20Poly1305');
		expect(() => parseConfig(JSON.stringify(xchacha))).toThrow(VaultFormatError);
	});

	it.each([0, 1, 4095, 4096, 4097, 3 * 4096 + 7])('round-trips %i bytes across block boundaries', async (size) => {
		const { keys } = await unlocked();
		const plain = crypto.getRandomValues(new Uint8Array(size));
		const cipher = await keys.encryptFile(plain);
		expect(plainSize(cipher.length, keys.cipherBS)).toBe(size);
		expect(await keys.decryptFile(cipher)).toEqual(plain);
		// A changed byte is noticed, never read as something else
		if (size) {
			cipher[cipher.length - 1] ^= 1;
			await expect(keys.decryptFile(cipher)).rejects.toThrow();
		}
	});

	it('creates a folder that opens with its password', async () => {
		const master = newMasterKey();
		const config = parseConfig(await newConfig(master, 'geheim', 10));
		expect(await unlockMasterKey(config, 'geheim')).toEqual(master);
	});
});
