import { describe, expect, it } from 'vitest';
import { filterIcons, iconList, searchIcons, variantOf } from './index';

const icon = (name: string) => ({ name, body: '', width: 24, height: 24 });
const icons = ['arrow-forward', 'arrow-back', 'mouse', 'left-click'].map(icon);

describe('searchIcons', () => {
	it('all words must occur in the name', () => {
		expect(searchIcons(icons, 'arrow back').map((i) => i.name)).toEqual(['arrow-back']);
		expect(searchIcons(icons, 'Arrow').map((i) => i.name)).toEqual(['arrow-forward', 'arrow-back']);
	});
	it('empty query: everything', () => {
		expect(searchIcons(icons, '  ')).toHaveLength(4);
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

describe('variantOf', () => {
	const suffixes = ['', 'rounded', 'sharp', 'outline', 'outline-rounded', 'outline-sharp'];
	it('takes the longest matching suffix', () => {
		expect(variantOf(suffixes, 'home-outline-rounded')).toBe('outline-rounded');
		expect(variantOf(suffixes, 'home-rounded')).toBe('rounded');
		expect(variantOf(suffixes, 'home')).toBe('');
	});
	it('only whole name parts count', () => {
		expect(variantOf(['fill'], 'backfill')).toBe('');
	});
});

describe('filterIcons', () => {
	const set = [
		{ icon: icon('home'), variant: '', category: 'Home' },
		{ icon: icon('home-rounded'), variant: 'rounded', category: 'Home' },
		{ icon: icon('mic-rounded'), variant: 'rounded', category: 'Audio' },
		{ icon: icon('mic'), variant: '' }
	];
	const names = (filter: Partial<Parameters<typeof filterIcons>[1]>) =>
		filterIcons(set, { query: '', variant: null, category: null, ...filter }).map((i) => i.name);
	it('filters by style, category and search together', () => {
		expect(names({ variant: 'rounded' })).toEqual(['home-rounded', 'mic-rounded']);
		expect(names({ category: 'Home' })).toEqual(['home', 'home-rounded']);
		expect(names({ variant: 'rounded', category: 'Audio' })).toEqual(['mic-rounded']);
		expect(names({ query: 'mic', variant: '' })).toEqual(['mic']);
	});
	it('without filters: the whole set', () => {
		expect(names({})).toHaveLength(4);
	});
});
