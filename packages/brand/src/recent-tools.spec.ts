import { describe, expect, it } from 'vitest';
import { pushRecent, RECENT_MAX } from './recent-tools';

describe('pushRecent', () => {
	it('puts the tool in front without duplicates', () => {
		expect(pushRecent([], '/notes')).toEqual(['/notes']);
		expect(pushRecent(['/files', '/notes'], '/notes')).toEqual(['/notes', '/files']);
		expect(pushRecent(['/notes', '/files'], '/notes')).toEqual(['/notes', '/files']);
	});
	it('keeps at most RECENT_MAX entries', () => {
		const list = ['/a', '/b', '/c', '/d', '/e'];
		expect(pushRecent(list, '/f')).toEqual(['/f', '/a', '/b', '/c', '/d']);
		expect(pushRecent(list, '/f')).toHaveLength(RECENT_MAX);
	});
});
