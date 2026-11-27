import { describe, expect, it } from 'vitest';
import { checkConfig, CryptomatorKeys, newMasterkey, newVaultFiles, parseMasterkeyFile, plainSize, unlockMasterkey, verifyConfig } from './cryptomator.js';
import { VaultFormatError, WrongPassword } from './errors.js';

// The Cryptomator format (vault format 8, SIV_GCM): the master key file and the signed configuration, names and
// contents. Its AES-SIV is checked against Cryptomator's own cases in `siv.spec.ts`.

async function vault() {
	const master = newMasterkey();
	const files = await newVaultFiles(master, 'geheim', 2 ** 10);
	return { master, files, keys: await CryptomatorKeys.create(master, (await verifyConfig(files.config, master)).threshold) };
}

describe('Cryptomator', () => {
	it('opens its master key with the password only, and refuses a changed or foreign configuration', async () => {
		const { master, files } = await vault();
		expect(await unlockMasterkey(parseMasterkeyFile(files.masterkey), 'geheim')).toEqual(master);
		await expect(unlockMasterkey(parseMasterkeyFile(files.masterkey), 'falsch')).rejects.toBeInstanceOf(WrongPassword);
		// Signed with the master key: another key or a changed claim fails
		await expect(verifyConfig(files.config, newMasterkey())).rejects.toBeInstanceOf(VaultFormatError);
		const [header, , signature] = files.config.split('.');
		const hub = (claims: object, head: object = JSON.parse(atob(header))) =>
			[btoa(JSON.stringify(head)), btoa(JSON.stringify(claims)), signature].join('.').replaceAll('=', '');
		expect(() => checkConfig(hub({ format: 8, cipherCombo: 'SIV_GCM' }, { kid: 'hub+https://hub.example/vaults/1', alg: 'HS256' }))).toThrow(VaultFormatError);
		expect(() => checkConfig(hub({ format: 8, cipherCombo: 'SIV_CTRMAC' }))).toThrow(VaultFormatError);
	});

	it('names: per folder, deterministic, long ones shortened', async () => {
		const { keys } = await vault();
		const short = await keys.encryptName('Brief.txt', '');
		expect(short.long).toBeNull();
		expect(short.stored).toMatch(/^[A-Za-z0-9_-]+=*\.c9r$/);
		expect((await keys.encryptName('Brief.txt', '')).stored).toBe(short.stored);
		expect(await keys.decryptName(short.stored, '')).toBe('Brief.txt');
		// The same name in another folder is another name, and doesn't decrypt there
		expect(await keys.decryptName(short.stored, 'another-folder')).toBeNull();
		const long = await keys.encryptName(`${'Langer Name '.repeat(20)}.txt`, '');
		expect(long.stored).toMatch(/^[A-Za-z0-9_-]{27}=\.c9s$/);
		expect(await keys.decryptName(long.long!, '')).toBe(`${'Langer Name '.repeat(20)}.txt`);
		expect(await keys.dirPath('')).toMatch(/^d\/[A-Z2-7]{2}\/[A-Z2-7]{30}$/);
	});

	it.each([0, 1, 32768, 32769, 2 * 32768 + 5])('round-trips %i bytes across chunk boundaries', async (size) => {
		const { keys } = await vault();
		const plain = Uint8Array.from({ length: size }, (_, i) => (i * 7) % 251);
		const cipher = await keys.encryptFile(plain);
		expect(plainSize(cipher.length)).toBe(size);
		expect(await keys.decryptFile(cipher)).toEqual(plain);
		cipher[cipher.length - 1] ^= 1;
		await expect(keys.decryptFile(cipher)).rejects.toThrow();
	});

	it('reads masterkey files as Cryptomator writes them', () => {
		const file = parseMasterkeyFile(
			JSON.stringify({ version: 999, scryptSalt: 'AAAAAAAAAAA=', scryptCostParam: 32768, scryptBlockSize: 8, primaryMasterKey: btoa('x'.repeat(40)), hmacMasterKey: btoa('y'.repeat(40)), versionMac: '' })
		);
		expect([file.cost, file.blockSize, file.primary.length]).toEqual([32768, 8, 40]);
		expect(() => parseMasterkeyFile('{"scryptCostParam": 3}')).toThrow(VaultFormatError);
	});
});
