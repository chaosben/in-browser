import { BRAND } from '../brand.js';

// Texts of the brand components. Defines the structure; de.ts must have the same keys.
const en = {
	common: {
		cancel: 'Cancel'
	},

	brand: {
		home: `${BRAND.suite} overview`,
		allTools: `All tools from ${BRAND.suite}`,
		toolHome: (tool: string) => `${tool} home`
	},

	bar: {
		actions: (name: string) => `Actions for “${name}”`,
		rename: 'Click to rename'
	},

	theme: {
		label: 'Appearance',
		system: 'System',
		light: 'Light',
		dark: 'Dark'
	},

	build: {
		version: (version: string) => `Version ${version}`,
		sourceHint: 'Source code on GitHub'
	},

	pwa: {
		updateReady: 'A new version is available.',
		reload: 'Reload',
		later: 'Later'
	}
};

export default en;
