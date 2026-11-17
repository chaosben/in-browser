import { describe, expect, it } from 'vitest';
import { LOG_LIMIT, logText, SyncLog } from './log.js';

describe('sync log', () => {
	it('records only while enabled and keeps the newest entries', () => {
		const log = new SyncLog();
		log.add('ignored');
		expect(log.entries).toEqual([]);
		log.enabled = true;
		for (let i = 0; i < LOG_LIMIT + 3; i++) log.add('e', { i });
		expect(log.entries).toHaveLength(LOG_LIMIT);
		expect(log.entries[0].data).toEqual({ i: 3 });
	});

	it('exports a header and one line per entry', () => {
		const text = logText([{ t: Date.UTC(2026, 0, 1), event: 'sync.start', data: { local: 2 } }], { device: 'Laptop' });
		expect(text).toBe('# in-browser sync log\n# device: "Laptop"\n\n2026-01-01T00:00:00.000Z sync.start {"local":2}\n');
	});
});
