import help from './help.en.js';
// English texts. This file defines the structure; `de.ts` must have the same keys.

const en = {
	common: {
		cancel: 'Cancel'
	},

	brand: {
		description: 'Your own fonts for every in-browser tool – added from your files or installed from a catalog of free fonts, kept with your files.'
	},

	ribbon: {
		tabs: { home: 'Home' },
		groups: { add: 'Add', organize: 'Organize', preview: 'Preview', select: 'Selection' }
	},

	commands: {
		addFromFiles: 'Add from Files …',
		addFromFilesTip: 'Font files (TrueType, OpenType) of your files become fonts of every tool',
		addFromComputer: 'Import from the computer …',
		catalog: 'Search online',
		catalogTip: 'Free fonts from the catalog of Fontsource – searched only when you ask',
		remove: 'Delete',
		open: 'Open',
		selectAll: 'Select all',
		clearSelection: 'Clear selection',
		sample: 'Sample text',
		sampleDefault: 'The quick brown fox jumps over the lazy dog',
		size: 'Size',
		install: 'Install',
		installed: 'Installed',
		myFonts: 'My fonts'
	},

	home: {
		search: 'Find a font',
		empty: 'You have no fonts of your own yet. Add font files from your files or the computer, or search the catalog online.',
		noMatch: 'No font matches.',
		faces: (n: number) => (n === 1 ? '1 file' : `${n} files`),
		count: (n: number) => (n === 1 ? '1 font' : `${n} fonts`),
		picked: (n: number) => `${n} selected`,
		added: (n: number) => (n === 1 ? 'Font added' : `${n} font files added`),
		notFonts: 'These files are no fonts that can be used (TrueType or OpenType).',
		dropHint: 'Or drag font files here.'
	},

	family: {
		missing: 'This font is not among your fonts (any more).',
		faces: { regular: 'Regular', bold: 'Bold', italic: 'Italic', boldItalic: 'Bold italic' },
		used: 'Used for',
		notUsed: 'Not used',
		style: 'Style',
		weight: 'Weight',
		file: 'File',
		glyphs: 'Characters',
		version: 'Version',
		designer: 'Designer',
		copyright: 'Copyright',
		license: 'License',
		embedding: 'Says about itself',
		embeddings: {
			installable: 'May be embedded in documents',
			editable: 'May be embedded in documents that can be edited',
			preview: 'May be embedded for viewing and printing only',
			restricted: 'Asks not to be embedded in documents'
		},
		embeddingHint: 'in-browser shows what the file says, but doesn’t stop you: whether you may use a font is between you and its license.',
		removed: (name: string) => `“${name}” deleted`
	},

	file: {
		missing: 'This file no longer exists.',
		notFont: 'This file is no font that can be used (TrueType or OpenType).',
		install: 'Add to my fonts',
		already: 'This file is one of your fonts.',
		added: (name: string) => `“${name}” is one of your fonts now`
	},

	catalog: {
		title: 'Catalog',
		privacy:
			'Searching and installing ask Fontsource (api.fontsource.org) and the files come from jsDelivr: they see your IP address, what you search and which font you install. Nothing of your files is sent. Nothing is asked before you search.',
		search: 'Search',
		category: 'Kind of font',
		allCategories: 'All',
		placeholder: 'Name of a font',
		searching: 'Searching …',
		results: (n: number) => (n === 1 ? '1 font' : `${n} fonts`),
		more: (n: number) => `Showing the first ${n} – type more to narrow it down.`,
		none: 'No font of this name in the catalog.',
		failed: (error: string) => `The catalog could not be reached: ${error}`,
		categories: { 'sans-serif': 'Sans-serif', serif: 'Serif', display: 'Display', handwriting: 'Handwriting', monospace: 'Monospace', other: 'Other' } as Record<string, string>,
		styles: (n: number) => (n === 1 ? '1 style' : `${n} styles`),
		subset: 'Characters',
		subsetHint: 'Each file holds one set of characters: pick the one your language needs (“latin” covers Western European languages, “latin-ext” the rest of Europe).',
		preview: 'Loading the preview …',
		installing: 'Installing …',
		installed: (name: string) => `“${name}” is installed`,
		license: (license: string) => `License: ${license}`
	},

	help
};

export default en;
