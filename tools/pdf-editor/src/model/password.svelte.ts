// Passwords of PDFs that need one to open. Asked for in our own dialog (`PasswordDialog.svelte`, placed by the pages
// that open PDFs); remembered only when the user asks for it – on this device, sealed with its device key
// (`@in-browser/files/sources/secrets.js`, the key never leaves the browser), never synced, by the file's path. A
// remembered one that no longer opens the file is forgotten.

import { seal, unseal, type Sealed } from '@in-browser/files/sources/secrets.js';
import { idbGet, idbSet } from '@in-browser/files/sync/idb.js';
import { PdfError } from '@in-browser/pdf/pdfjs.js';

const KEY = 'pdf-editor:passwords';

async function stored(): Promise<Record<string, Sealed>> {
	return (await idbGet<Record<string, Sealed>>(KEY).catch(() => undefined)) ?? {};
}

/** The password remembered for a file, or null */
export async function rememberedPassword(path: string): Promise<string | null> {
	const sealed = (await stored())[path];
	return sealed ? unseal(sealed).catch(() => null) : null;
}

/** Remembers a file's password on this device */
export async function rememberPassword(path: string, password: string): Promise<void> {
	await idbSet(KEY, { ...(await stored()), [path]: await seal(password) });
}

/** Forgets a file's password */
export async function forgetPassword(path: string): Promise<void> {
	const all = await stored();
	if (!(path in all)) return;
	delete all[path];
	await idbSet(KEY, all);
}

/** Is a password remembered for this file? */
export async function hasRememberedPassword(path: string): Promise<boolean> {
	return path in (await stored());
}

/** The question shown (`PasswordDialog.svelte`): for which file, whether the last answer was wrong, whether it can
 * be remembered (a file of the shared file system) */
export const passwordRequest = $state<{ current: { name: string; wrong: boolean; canRemember: boolean; resolve: (answer: { password: string; remember: boolean } | null) => void } | null }>({ current: null });

function ask(name: string, wrong: boolean, canRemember: boolean): Promise<{ password: string; remember: boolean } | null> {
	return new Promise((resolve) => {
		passwordRequest.current?.resolve(null);
		passwordRequest.current = { name, wrong, canRemember, resolve };
	});
}

const needsPassword = (e: unknown) => e instanceof PdfError && e.reason === 'password';

/** Windows of this browser that have a protected PDF open tell its password to another one opening it (the slides
 * of a presentation), so it isn't asked for again in front of an audience */
const CHANNEL = 'pdf-editor:passwords';

/** Answers questions for this file's password while it is open here; returns the end of that */
export function sharePassword(path: string, password: string): () => void {
	if (!password || typeof BroadcastChannel === 'undefined') return () => {};
	const channel = new BroadcastChannel(CHANNEL);
	channel.onmessage = (e) => {
		if ((e.data as { ask?: string } | null)?.ask === path) channel.postMessage({ path, password });
	};
	return () => channel.close();
}

/** The password of a file open in another window of this browser; null when none answers within `wait` ms */
function fromOpenWindows(path: string, wait = 600): Promise<string | null> {
	if (typeof BroadcastChannel === 'undefined') return Promise.resolve(null);
	return new Promise((resolve) => {
		const channel = new BroadcastChannel(CHANNEL);
		const done = (value: string | null) => {
			clearTimeout(timer);
			channel.close();
			resolve(value);
		};
		const timer = setTimeout(() => done(null), wait);
		channel.onmessage = (e) => {
			const data = e.data as { path?: string; password?: unknown } | null;
			if (data?.path === path && typeof data.password === 'string') done(data.password);
		};
		channel.postMessage({ ask: path });
	});
}

/**
 * Opens a PDF that may need a password: without one, then with the remembered one (`path`), then the one another
 * window of this browser has it open with, then asking until it opens; null when the user cancels. `open` throws `PdfError('password')` while the password doesn't fit.
 */
export async function withPassword<T>(name: string, path: string | null, open: (password: string) => Promise<T>): Promise<T | null> {
	try {
		return await open('');
	} catch (e) {
		if (!needsPassword(e)) throw e;
	}
	if (path) {
		const remembered = await rememberedPassword(path);
		if (remembered !== null) {
			try {
				return await open(remembered);
			} catch (e) {
				if (!needsPassword(e)) throw e;
				await forgetPassword(path);
			}
		}
		const told = await fromOpenWindows(path);
		if (told !== null) {
			try {
				return await open(told);
			} catch (e) {
				if (!needsPassword(e)) throw e;
			}
		}
	}
	let wrong = false;
	for (;;) {
		const answer = await ask(name, wrong, !!path);
		if (!answer) return null;
		try {
			const result = await open(answer.password);
			if (path && answer.remember) await rememberPassword(path, answer.password).catch((e) => console.warn('[pdf-editor] password not kept', e));
			return result;
		} catch (e) {
			if (!needsPassword(e)) throw e;
			wrong = true;
		}
	}
}
