import { describe, expect, it } from 'vitest';
import { iconList, searchIcons } from './index';

const icon = (name: string) => ({ name, body: '', width: 24, height: 24 });
const icons = ['arrow-forward', 'arrow-back', 'mouse', 'left-click'].map(icon);

describe('searchIcons', () => {
	it('all words must occur in the name', () => {
		expect(searchIcons(icons, 'arrow back').map((i) => i.name)).toEqual(['arrow-back']);
		expect(searchIcons(icons, 'Arrow').map((i) => i.name)).toEqual(['arrow-forward', 'arrow-back']);
	});
	it('empty query: everything, limited', () => {
		expect(searchIcons(icons, '  ', 2)).toHaveLength(2);
	});
});

describe('iconList', () => {
	it('visible icons with the default size of the set', () => {
		const list = iconList({ width: 24, height: 24, icons: { a: { body: '<path/>' }, b: { body: '', hidden: true }, c: { body: '', width: 20 } } });
		expect(list).toEqual([
			{ name: 'a', body: '<path/>', width: 24, height: 24 },
			{ name: 'c', body: '', width: 20, height: 24 }
		]);
	});
});
