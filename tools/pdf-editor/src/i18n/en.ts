import help from './help.en.js';
// English texts. This file defines the structure; `de.ts` must have the same keys.

const en = {
	common: {
		cancel: 'Cancel',
		close: 'Close'
	},

	brand: {
		description: 'View, annotate and fill in PDFs, organize and merge pages – free and entirely in the browser.'
	},

	home: {
		tagline: 'Annotate, fill in and organize PDFs. Your files stay in your browser.',
		open: 'Open PDF …',
		openTitle: 'Open PDF',
		fromDevice: 'Open from the computer …',
		saveTitle: 'Where should the PDF be kept?',
		empty: 'No PDFs opened yet. Open one from your files or from the computer.',
		remove: 'Remove from the list',
		failed: (error: string) => `That did not work: ${error}`
	},

	editor: {
		loadFailed: (error: string) => `The PDF could not be opened: ${error}`,
		password: 'This PDF is protected by a password.',
		invalid: 'This file is not a PDF that can be read.',
		openElsewhere: 'This PDF is already open in another tab or window.',
		missing: 'This PDF no longer exists.',
		back: 'All PDFs',
		page: (n: number, total: number) => `Page ${n} of ${total}`,
		pageField: 'Page number',
		zoom: (percent: number) => `${percent} %`,
		download: 'Download',
		showInFiles: 'Show in Files'
	},

	notice: {
		encrypted: 'This PDF is protected in a way that can’t be changed here: you can read it, but changes can’t be saved.',
		failed: 'This PDF can be read, but its structure is too damaged to save changes.',
		signed: 'This PDF is signed. Your changes are added after the signatures: they keep proving the signed version.',
		checking: 'The PDF is being prepared for changes …'
	},

	conflict: {
		changed: (name: string) => `“${name}” was changed elsewhere (another tab or the sync). Saving is paused.`,
		deleted: (name: string) => `“${name}” was deleted or moved. Saving creates it again.`,
		reload: 'Reload',
		keepMine: 'Keep my version',
		reloaded: (name: string) => `“${name}” was changed elsewhere and has been reloaded.`
	},

	questions: {
		signedPages: {
			title: 'Change pages of a signed PDF?',
			message: 'The signatures stay valid for the signed version, but programs may report that pages changed after signing.',
			confirm: 'Change pages'
		}
	},

	ribbon: {
		tabs: {
			home: 'Home',
			comment: 'Comment',
			pages: 'Pages',
			form: 'Form',
			view: 'View',
			// Shown while something is selected
			textbox: 'Text box',
			note: 'Note',
			markup: 'Marked text',
			drawing: 'Drawing',
			selection: 'Selection',
			arrange: 'Arrange'
		},
		groups: {
			pdf: 'PDF',
			tools: 'Tools',
			zoom: 'Zoom',
			panels: 'Panels',
			rotate: 'Rotate',
			select: 'Select',
			markup: 'Text',
			notes: 'Comment',
			draw: 'Draw',
			format: 'Format',
			find: 'Find',
			text: 'Text',
			box: 'Box',
			object: 'Object',
			sizing: 'Size',
			paragraph: 'Paragraph',
			organize: 'Organize',
			insert: 'Insert',
			newFile: 'New PDF',
			fields: 'Fields'
		}
	},


	comments: {
		find: 'Find in comments',
		kind: 'Show',
		all: 'All comments',
		notes: 'Notes',
		texts: 'Text boxes',
		marks: 'Marked text',
		drawings: 'Drawings',
		none: 'No comments yet. Mark text, place a note or draw – they show up here.',
		noneFound: 'No comment matches.',
		page: (n: number) => `Page ${n}`,
		unknownAuthor: 'Unknown',
		reply: 'Reply',
		send: 'Send',
		cancel: 'Cancel',
		replyPlaceholder: 'Write a reply',
		replies: (n: number) => (n === 1 ? '1 reply' : `${n} replies`),
		deleteReply: 'Delete reply',
		replyActions: 'Actions for the reply',
		readOnly: 'This PDF can’t be changed, so replies can’t be added.',
		subject: 'Subject',
		renameSubject: 'Click to change the subject',
		status: 'Status',
		statusBy: (state: string, author: string, when: string) => `${state}${author ? ` – ${author}` : ''}${when ? `, ${when}` : ''}`,
		states: { None: 'None', Accepted: 'Accepted', Rejected: 'Rejected', Cancelled: 'Cancelled', Completed: 'Completed' }
	},

	textbox: {
		label: 'Text of the text box',
		edit: 'Edit text',
		size: 'Size',
		fontSize: 'Font size',
		textColor: 'Text color',
		sizeValue: (pt: number) => `${pt} pt`,
		style: 'Background and border',
		fill: 'Background',
		border: 'Border',
		borderWidth: 'Width',
		borderWidthValue: (pt: number) => `${pt} pt`,
		none: 'None',
		autoWidth: 'Auto width',
		autoWidthTip: 'As wide as the longest line; lines break only where you press Enter',
		autoHeight: 'Auto height',
		autoHeightTip: 'Keeps its width; lines wrap and the box grows with the text',
		fixedSize: 'Fixed size',
		fixedSizeTip: 'Keeps width and height; text that doesn’t fit runs out below',
		alignLeft: 'Align text left',
		alignCenter: 'Center text',
		alignRight: 'Align text right',
		justify: 'Justify'
	},

	note: {
		label: 'Comment of the note',
		placeholder: 'Write a comment …',
		edit: 'Edit comment',
		icon: 'Icon',
		icons: { Comment: 'Comment', Note: 'Note', Key: 'Key', Help: 'Help', NewParagraph: 'New paragraph', Paragraph: 'Paragraph', Insert: 'Insert' }
	},

	commands: {
		undo: 'Undo',
		redo: 'Redo',
		hand: 'Hand',
		handTip: 'Drag to move the pages',
		selectText: 'Select text',
		selectTextTip: 'Select and copy text, mark it',
		zoomIn: 'Zoom in',
		zoomOut: 'Zoom out',
		fitWidth: 'Fit width',
		fitPage: 'Whole page',
		actualSize: 'Actual size',
		firstPage: 'First page',
		previousPage: 'Previous page',
		nextPage: 'Next page',
		lastPage: 'Last page',
		find: 'Find',
		markTip: 'Marks the text you drag over',
		highlight: 'Highlight',
		underline: 'Underline',
		strikeout: 'Strike out',
		note: 'Note',
		noteTip: 'Places a sticky note with a comment where you click',
		textbox: 'Text box',
		textboxTip: 'Click or drag to type text onto the page',
		rotateLeft: 'Rotate left',
		rotateRight: 'Rotate right',
		rotateTip: 'Turns the picked pages (in the panel “Pages”), else the current page, by a quarter',
		deletePages: 'Delete pages',
		deletePagesTip: 'Deletes the picked pages, else the current page, with what is drawn on them',
		moveUp: 'Move up',
		moveDown: 'Move down',
		moveFirst: 'Move to the start',
		moveLast: 'Move to the end',
		moveTip: 'Moves the picked pages, else the current page',
		insertBlank: 'Blank page',
		insertBlankTip: 'Inserts a blank page after the current one, as big as it',
		pageActions: (label: string) => `Actions for page ${label}`,
		selectAll: 'Select all',
		selectAllTip: 'Selects everything drawn or written on the current page (in the panel “Pages”: all pages)',
		picked: (n: number) => (n === 0 ? 'No pages picked' : n === 1 ? '1 page picked' : `${n} pages picked`),
		clearPick: 'Clear selection',
		pickAll: 'Select all',
		insertPdf: 'From PDF …',
		insertPdfTip: 'Inserts all pages of another PDF after the current page',
		insertPdfTitle: 'Insert pages from PDF',
		insertImage: 'Image …',
		insertImageTip: 'Inserts a picture as a page of its own after the current page',
		insertImageTitle: 'Insert image as page',
		extract: 'Extract …',
		extractTip: 'Saves the picked pages, else the current page, as a new PDF',
		extractTitle: 'Save pages as PDF',
		extractName: (stem: string) => `${stem} (pages).pdf`,
		merge: 'Merge …',
		mergeTip: 'Saves this PDF followed by other PDFs as a new PDF',
		mergeTitle: 'Choose PDFs to add',
		mergeSaveTitle: 'Save merged PDF',
		mergeName: (stem: string) => `${stem} (merged).pdf`,
		saved: (name: string) => `Saved as “${name}”.`,
		openNew: 'Open',
		failed: (error: string) => `That didn’t work: ${error}`,
		protected: 'This PDF is protected by a password; its pages can’t be copied.',
		highlightFields: 'Highlight fields',
		highlightFieldsTip: 'Tints the fields to fill in and frames the required ones',
		clearForm: 'Clear form',
		clearFormTip: 'Empties every field that can be filled in (one step to undo)'
	},

	panels: {
		pages: 'Pages',
		outline: 'Bookmarks',
		search: 'Search',
		attachments: 'Attachments',
		layers: 'Layers',
		noOutline: 'This PDF has no bookmarks.',
		noAttachments: 'This PDF has no attachments.',
		noLayers: 'This PDF has no layers.',
		searchPlaceholder: 'Find in the PDF',
		searching: 'Searching …',
		results: (n: number) => (n === 1 ? '1 result' : `${n} results`),
		noResults: 'Nothing found.',
		matchCase: 'Match case',
		previous: 'Previous result',
		next: 'Next result',
		pageLabel: (label: string) => `Page ${label}`,
		comments: 'Comments',
		fields: 'Fields',
		noFields: 'This PDF has no form fields.',
		fieldsFilled: (filled: number, total: number) => `${filled} of ${total} required fields filled in`,
		required: 'Required',
		empty: 'Empty',
		checked: 'Checked',
		unchecked: 'Not checked',
		readOnlyField: 'Can’t be changed',
		onlyRequired: 'Only required fields',
		download: (name: string) => `Download ${name}`,
		saveInFiles: (name: string) => `Save ${name} in Files`
	},

	help
};

export default en;
