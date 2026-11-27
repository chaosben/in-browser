// Errors of every format of encrypted folders (`formats.ts`)

/** The folder isn't an encrypted folder this can open: `invalid` (damaged) or `unsupported` (settings of its format it
 * doesn't know, e.g. gocryptfs' XChaCha20, AES-SIV, plain names, a FIDO2 key) */
export class VaultFormatError extends Error {
	constructor(
		readonly reason: 'invalid' | 'unsupported',
		detail: string
	) {
		super(`${reason}: ${detail}`);
		this.name = 'VaultFormatError';
	}
}

/** The password doesn't open the master key */
export class WrongPassword extends Error {
	constructor() {
		super('wrong password');
		this.name = 'WrongPassword';
	}
}
