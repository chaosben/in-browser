import { describe, expect, it } from 'vitest';
import { parseSettings, withValue } from './settings';
import { DEFAULT_RETENTION } from './trash';

describe('suite settings', () => {
	it('takes valid values and leaves the rest at their default', () => {
		expect(parseSettings('{broken')).toEqual({ profile: { name: '' }, trash: { days: DEFAULT_RETENTION }, sync: { askAbove: 1e9 } });
		expect(parseSettings('{"profile":{"name":3},"trash":{"days":12}}')).toEqual(parseSettings(null));
		expect(parseSettings('{"trash":{"days":null}}').trash.days).toBeNull();
	});

	it('changes one value and keeps everything else in the file', () => {
		const text = withValue('{"profile":{"name":"A","later":true},"future":{"x":1}}', 'trash', 'days', 7);
		expect(JSON.parse(text)).toEqual({ profile: { name: 'A', later: true }, future: { x: 1 }, trash: { days: 7 } });
	});
});
