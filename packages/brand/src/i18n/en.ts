import { BRAND } from '../brand.js';

// Texts of the brand components. Defines the structure; de.ts must have the same keys.
const en = {
	common: {
		cancel: 'Cancel'
	},

	/** Visible names of the tools (code, folders and addresses stay English: the key is the tool's folder) */
	tools: {
		files: 'Files',
		notes: 'Notes',
		'text-editor': 'Text Editor',
		'screen-capture': 'Screen Capture'
	},

	brand: {
		home: `${BRAND.suite} overview`,
		allTools: `All tools from ${BRAND.suite}`,
		toolHome: (tool: string) => `${tool} home`
	},

	save: {
		saving: 'Saving …',
		saved: 'Saved',
		notSaved: 'Not saved yet'
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

	/** Help window of the tools and help pages */
	help: {
		title: 'Help',
		button: 'Help',
		buttonTitle: 'Help (F1)',
		search: 'Search help',
		noMatches: 'Nothing found.',
		topics: 'Topics',
		move: 'Drag to move the help window',
		close: 'Close help',
		tipLabel: 'How to decide',
		asPage: 'Open as page',
		copy: 'Copy',
		copied: 'Copied'
	},

	pwa: {
		updateReady: 'A new version is available.',
		reload: 'Reload',
		later: 'Later'
	}
};

export default en;
