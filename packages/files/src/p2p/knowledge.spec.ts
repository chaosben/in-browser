import { describe, expect, it } from 'vitest';
import { advance, mergeLogs, missing, record, type Change } from './knowledge.js';

describe('knowledge', () => {
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
});
