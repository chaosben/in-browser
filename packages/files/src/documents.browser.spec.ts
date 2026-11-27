import { describe, expect, it } from 'vitest';
import { holdDocument } from './documents.js';

describe('holdDocument', () => {
	it('gives a document up only after its last save, so no other tab opens the version before it', async () => {
		const key = `test:${crypto.randomUUID()}`;
		const hold = (await holdDocument(key))!;
		expect(await holdDocument(key)).toBeNull();
		let finish!: () => void;
		let written = false;
		hold.saves(() => new Promise<void>((resolve) => (finish = () => ((written = true), resolve()))));
		// The page goes: the save is still running, the document stays held
		const closing = hold.close();
		await new Promise((r) => setTimeout(r, 50));
		const held = async () => (await navigator.locks.query()).held!.some((lock) => lock.name === key);
		expect(await held()).toBe(true);
		// Opened again on this tab meanwhile (back and in again): it waits for that save instead of failing
		const again = holdDocument(key);
		finish();
		await closing;
		const next = await again;
		expect(written).toBe(true);
		expect(next).not.toBeNull();
		// A save that fails still frees the document
		next!.saves(() => Promise.reject(new Error('full')));
		await next!.close();
		await (await holdDocument(key))!.close();
	});
});
