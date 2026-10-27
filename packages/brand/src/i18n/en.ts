import { BRAND } from '../brand.js';

// Texts of the brand components. Defines the structure; de.ts must have the same keys.
const en = {
	brand: {
		home: `${BRAND.suite} overview`,
		allTools: `All tools from ${BRAND.suite}`,
		toolHome: (tool: string) => `${tool} home`,
		localOnly: 'Runs locally in your browser',
		localOnlyHint: 'No uploads – your files stay on your device.'
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
		install: 'Install',
		installHint: 'Install as an app – launches like a program and also works offline.',
		updateReady: 'A new version is available.',
		reload: 'Reload',
		later: 'Later'
	}
};

export default en;
