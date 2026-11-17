import { expect, it } from 'vitest';
import { clearLog, exportLog, journal, logInfo, setLogEnabled } from './journal.svelte.js';

// The shared log of both syncs in IndexedDB

it('records only when switched on and merges the trails of both syncs in time order', async () => {
	await clearLog();
	await setLogEnabled(false);
	const folder = await journal('folder');
	const p2p = await journal('p2p');
	folder.add('folder.ignored');
	expect((await logInfo()).count).toBe(0);

	await setLogEnabled(true);
	folder.add('folder.start', { local: 1 });
	await new Promise((r) => setTimeout(r, 5));
	p2p.add('sync.start', { remote: 2 });
	const text = await exportLog({ device: 'Test' });
	expect(text).toContain('# device: "Test"');
	const lines = text.split('\n').filter((line) => line.startsWith('20'));
	expect(lines).toHaveLength(2);
	expect(lines[0]).toContain('[folder] folder.start');
	expect(lines[1]).toContain('[p2p] sync.start');

	await clearLog();
	expect((await logInfo()).count).toBe(0);
	await setLogEnabled(false);
});
