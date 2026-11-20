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
		'screen-capture': 'Screen Capture',
		'pdf-editor': 'PDF Editor'
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
		settings: 'Settings'
	},

	ribbon: {
		label: 'Commands',
		tabs: 'Tabs',
		/** The first tab of a document tool: what is done to the document (save, export, show in Files, delete …) */
		file: 'File',
		more: 'More',
		options: 'Group options',
		display: 'Ribbon display',
		modes: { classic: 'Classic', simplified: 'Simplified', tabs: 'Tabs only' },
		modeHints: {
			classic: 'Groups with large buttons and their names',
			simplified: 'One compact row',
			tabs: 'Only the tabs; a tab opens over the page'
		},
		collapse: 'Show only the tabs (Ctrl+F1)',
		expand: 'Show the ribbon (Ctrl+F1)'
	},

	pick: {
		actions: (name: string) => `Actions for “${name}”`,
		clear: 'Clear selection',
		selectAll: 'Select all'
	},

	inspector: {
		label: 'Properties',
		close: 'Hide the properties',
		resize: 'Width of the properties',
		search: 'Search properties',
		clearSearch: 'Clear search',
		noMatches: 'No matching property.'
	},

	panels: {
		label: 'Panels',
		close: 'Close the panel',
		resize: 'Width of the panel',
		failed: 'The panel could not be loaded.'
	},

	keys: {
		ctrl: 'Ctrl',
		shift: 'Shift',
		alt: 'Alt',
		named: {
			Delete: 'Del',
			Backspace: 'Backspace',
			Home: 'Home',
			End: 'End',
			PageUp: 'Page Up',
			PageDown: 'Page Down',
			' ': 'Space',
			Escape: 'Esc',
			Enter: 'Enter',
			ArrowLeft: '←',
			ArrowRight: '→',
			ArrowUp: '↑',
			ArrowDown: '↓'
		} as Record<string, string>
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
