import { describe, expect, it } from 'vitest';
import { advance, LOG_LIMIT, mergeDevices, mergeLogs, missing, record, type Change, type Vector } from './knowledge.js';

describe('knowledge', () => {
	it('numbers local changes per device', () => {
		let state: { log: Change[]; vector: Vector } = { log: [], vector: {} };
		state = record(state.log, state.vector, 'A', '/a');
		state = record(state.log, state.vector, 'A', '/b');
		expect(state.vector).toEqual({ A: 2 });
		expect(state.log.map((c) => c.n)).toEqual([1, 2]);
	});

	it('keeps the last entries per origin', () => {
		let state: { log: Change[]; vector: Vector } = { log: [], vector: {} };
		for (let i = 0; i < LOG_LIMIT + 5; i++) state = record(state.log, state.vector, 'A', `/f${i}`);
		expect(state.log).toHaveLength(LOG_LIMIT);
		expect(state.log[0].n).toBe(6);
	});

	it('counts what a device misses, indirectly updated devices included (A → B → C)', () => {
		// A changes two files
		let a = record([], {}, 'A', '/x');
		a = record(a.log, a.vector, 'A', '/y');
		// B syncs with A, C with B (A never sees C directly)
		const log = mergeLogs(a.log, []);
		const b = advance({}, [], a.vector, [], log);
		const c = advance({}, [], b, [], log);
		expect(c).toEqual({ A: 2 });
		// A, learning C's vector through B, sees nothing missing
		expect(missing(c, [], log)).toEqual({ paths: 0, more: false });
		expect(missing({}, [], log)).toEqual({ paths: 2, more: false });
	});

	it('takes the folders of both devices into account', () => {
		let a = record([], {}, 'A', '/Videos/big.mp4');
		a = record(a.log, a.vector, 'A', '/Docs/note.md');
		// B excludes /Videos: what it misses there doesn't count, and it can't pass it on
		const b = advance({}, ['/Videos'], a.vector, [], a.log);
		expect(b).toEqual({ A: 2 });
		expect(missing(b, ['/Videos'], a.log).paths).toBe(0);
		// C takes part in /Videos, but synced only with B: it is missing the video
		const c = advance({}, [], b, ['/Videos'], a.log);
		expect(c).toEqual({ A: 0 });
		expect(missing(c, [], a.log).paths).toBe(2);
	});

	it('reports a trimmed log as “more”', () => {
		const log: Change[] = [{ o: 'A', n: 50, p: '/a' }];
		expect(missing({ A: 10 }, [], log)).toEqual({ paths: 1, more: true });
	});

	it('merges what devices know about each other', () => {
		const merged = mergeDevices(
			{ C: { lastSeen: 5, lastSync: 5, scope: [], vector: { A: 1 } } },
			{ C: { lastSeen: 9, lastSync: 7, scope: ['/V'], vector: { A: 3, B: 1 } } }
		);
		expect(merged.C).toEqual({ lastSeen: 9, lastSync: 7, scope: ['/V'], vector: { A: 3, B: 1 } });
	});
});
