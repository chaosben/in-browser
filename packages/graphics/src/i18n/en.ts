// Texts of the shared graphics components (color field, icon picker). English leads: de.ts has the same keys.

const en = {
	color: {
		none: 'None',
		opacity: 'Opacity',
		value: (c: string) => `Color ${c}`,
		custom: 'Custom color',
		recent: 'Recent and project colors',
		paletteHint: 'drag a color here to replace it',
		resetPalette: 'Restore default colors'
	},

	icons: {
		searchSet: (set: string) => `Search ${set} (English names)`,
		source: 'Icon set',
		variant: 'Style',
		category: 'Category',
		all: 'All',
		insert: (name: string) => `Insert icon ${name}`,
		categories: { arrows: 'Arrows', notices: 'Notices', status: 'Status', input: 'Mouse & keyboard', objects: 'Objects', people: 'People' },
		noResults: 'No matching icon.',
		count: (n: number) => `${n.toLocaleString('en')} icons`,
		load: (size: string) => `Load all icons (approx. ${size})`,
		loadHint: (count: number) =>
			`Loads about ${count.toLocaleString('en')} icons once – afterwards they are kept in the browser and work offline. Then you can filter by style.`,
		license: (set: string, license: string) => `${set} · ${license} license`,
		offline: 'Loading an icon set needs an internet connection.',
		loadFailed: (error: string) => `The icons could not be loaded: ${error}`
	}
};

export default en;
