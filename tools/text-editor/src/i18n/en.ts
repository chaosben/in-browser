// English texts. This file defines the structure; `de.ts` must have the same keys.

const en = {
	common: {
		cancel: 'Cancel',
		untitled: (n: number) => (n > 1 ? `Untitled ${n}` : 'Untitled')
	},

	brand: {
		partOf: 'Part of',
		suiteClaim: 'tools that run entirely in your browser',
		description:
			'Edit text, Markdown, JSON, YAML, CSV and code with tabs, syntax highlighting and a Markdown preview – free and entirely in the browser.'
	},

	home: {
		tagline: 'Text, Markdown, JSON, YAML and code – with tabs, syntax highlighting and preview. Your files stay in your browser.',
		unsupported: 'This browser has no file system for websites (OPFS). Please use a current browser.',
		recent: 'Recently opened',
		noRecent: 'Files you open will appear here.',
		inFolder: (folder: string) => `in ${folder}`,
		dropHint: 'Or drag text files from your computer here.'
	},

	actions: {
		new: 'New',
		open: 'Open',
		openFromFiles: 'Open from Files …',
		openFromComputer: 'Open from computer …',
		save: 'Save',
		saveTo: 'Save …',
		saveAs: 'Save as …',
		rename: 'Rename',
		download: 'Download',
		showInFiles: 'Show in Files',
		close: 'Close',
		closeOthers: 'Close others'
	},

	edit: {
		undo: 'Undo',
		redo: 'Redo',
		search: 'Search',
		find: 'Find',
		replace: 'Replace',
		gotoLine: 'Go to line'
	},

	format: {
		title: 'Formatting',
		bold: 'Bold',
		italic: 'Italic',
		link: 'Link',
		paragraph: 'Paragraph',
		heading: (level: number) => `Heading ${level}`,
		bulletList: 'Bulleted list',
		numberedList: 'Numbered list',
		taskList: 'Task',
		quote: 'Quote',
		codeBlock: 'Code block',
		inlineCode: 'Inline code'
	},

	view: {
		title: 'View',
		wrap: 'Word wrap',
		preview: 'Markdown preview',
		fontLarger: 'Larger text',
		fontSmaller: 'Smaller text',
		fontReset: 'Default text size'
	},

	dialogs: {
		open: 'Open text files',
		saveAs: 'Save as'
	},

	drop: {
		release: 'Release to open'
	},

	status: {
		position: (line: number, column: number) => `Ln ${line}, Col ${column}`,
		selected: (chars: number) => `${chars} selected`,
		plainText: 'Plain text',
		saving: 'Saving …',
		saved: 'Saved',
		notSaved: 'Not saved yet',
		deleted: 'Deleted',
		lineEnding: 'Line ending',
		encoding: 'Encoding'
	},

	encoding: {
		withBom: (name: string) => `${name} with BOM`,
		reopen: 'Reopen with encoding',
		saveWith: 'Save with encoding'
	},

	conflict: {
		changed: (name: string) => `“${name}” was changed elsewhere (another tab or the sync). Saving is paused.`,
		deleted: (name: string) => `“${name}” was deleted or moved. Saving creates it again.`,
		reload: 'Reload',
		keepMine: 'Keep my version'
	},

	problem: {
		unmappable: (count: number, encoding: string) =>
			`${count === 1 ? 'One character' : `${count} characters`} can’t be saved in ${encoding}. Saving is paused.`,
		asUtf8: 'Save as UTF-8'
	},

	questions: {
		discard: {
			title: 'Discard changes?',
			message: (name: string) => `“${name}” has changes that are not saved. They will be lost.`,
			confirm: 'Discard'
		},
		overwrite: {
			title: 'Replace the newer version?',
			message: (name: string) => `“${name}” was changed elsewhere since you opened it. Saving replaces that version.`,
			confirm: 'Replace'
		},
		unmappable: {
			title: 'Some characters can’t be saved',
			message: (count: number, encoding: string) =>
				`${count === 1 ? 'One character' : `${count} characters`} can’t be represented in ${encoding} and would become “?”. Save as UTF-8 instead?`,
			confirm: 'Save as UTF-8'
		}
	},

	toasts: {
		saved: (name: string) => `Saved “${name}”.`,
		reloaded: (name: string) => `“${name}” was changed elsewhere and reloaded.`,
		binary: (name: string) => `“${name}” is not a text file.`,
		tooLarge: (name: string, max: string) => `“${name}” is too large for the editor (more than ${max}).`,
		notFound: (name: string) => `“${name}” no longer exists.`,
		foldersSkipped: (count: number) => (count === 1 ? 'A folder was skipped.' : `${count} folders were skipped.`),
		failed: (error: string) => `That didn’t work: ${error}`
	},

	/** Texts inside the editor (search panel, go to line), keyed by CodeMirror's English phrase */
	phrases: {
		Find: 'Find',
		Replace: 'Replace',
		next: 'next',
		previous: 'previous',
		all: 'all',
		'match case': 'match case',
		regexp: 'regexp',
		'by word': 'by word',
		replace: 'replace',
		'replace all': 'replace all',
		close: 'close',
		'current match': 'current match',
		'on line': 'on line',
		'replaced $ matches': 'replaced $ matches',
		'replaced match on line $': 'replaced match on line $',
		'Go to line': 'Go to line',
		go: 'go',
		'Selection deleted': 'Selection deleted',
		'Control character': 'Control character',
		'folded code': 'folded code',
		unfold: 'unfold'
	},

	preview: {
		title: 'Markdown preview'
	}
};

export default en;
