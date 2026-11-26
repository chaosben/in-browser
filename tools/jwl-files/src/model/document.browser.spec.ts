import { afterEach, describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import schema from '@in-browser/jwl/schema-v16.sql?raw';
import { editNote } from '@in-browser/jwl/edits.js';
import { jwlBlob } from '@in-browser/jwl/jwl-file.js';
import { emptyData, locKey, type Location } from '@in-browser/jwl/model.js';
import { list, remove, watch, write } from '@in-browser/files/fs.js';
import { JwlDocument } from './document.svelte.js';

// Regression: every save of an edited backup was taken for a change made elsewhere – its own announcement came before
// the save had its new stamp – and the conflict bar stopped saving.

afterEach(async () => {
	for (const entry of await list('/')) await remove(entry.path);
});

async function backup(content: string): Promise<Blob> {
	const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
	const db = new SQL.Database();
	const triggers = schema.indexOf('CREATE TRIGGER');
	db.exec(schema.slice(0, triggers));
	db.run('INSERT INTO LastModified (LastModified) VALUES (?)', ['2026-01-01T00:00:00Z']);
	db.exec(schema.slice(triggers));
	db.exec('PRAGMA user_version = 16');
	const template = db.export();
	db.close();
	const verse: Location = { book: 43, chapter: 3, document: null, track: null, issue: 0, keySymbol: 'nwtsty', language: 2, type: 0, title: null, specialty: null, edition: null };
	const data = emptyData();
	data.locations.set(locKey(verse), verse);
	data.notes.set('n1', { guid: 'n1', mark: null, loc: locKey(verse), title: 'Note', content, modified: '2026-01-02T00:00:00Z', created: '2026-01-02T00:00:00Z', blockType: 0, blockId: null });
	return jwlBlob({ kind: 'backup', name: '', deviceName: 'test', data, template, files: new Map() });
}

describe('an open backup', () => {
	it('takes its own saves for its own and a change made elsewhere meanwhile for a conflict', async () => {
		await write('/Backup.jwlibrary', await backup('first'));
		const doc = await JwlDocument.open('/Backup.jwlibrary');
		const answers: Promise<string>[] = [];
		const stop = watch((paths) => answers.push(doc.external(paths)));
		try {
			doc.change(editNote(doc.data, 'n1', { content: 'edited' }));
			await doc.flush();
			expect(answers.length).toBeGreaterThan(0);
			expect(new Set(await Promise.all(answers))).toEqual(new Set(['none']));
			expect(doc.conflict).toBeNull();
			expect(doc.dirty).toBe(false);

			// Written by someone else while an edit waits here
			doc.change(editNote(doc.data, 'n1', { content: 'mine' }));
			answers.length = 0;
			await write('/Backup.jwlibrary', await backup('theirs, a little longer'));
			expect(await Promise.all(answers)).toContain('conflict');
			expect(doc.conflict).toBe('changed');
		} finally {
			stop();
			doc.dispose();
		}
	});
});
