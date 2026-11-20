import help from './help.en.js';
// English texts. This file defines the structure; `de.ts` must have the same keys.

const en = {
	common: {
		cancel: 'Cancel',
		delete: 'Delete'
	},

	brand: {
		description: 'Handwritten notes with pen, highlighter and eraser – made for stylus and touch, free and entirely in the browser.'
	},

	home: {
		tagline: 'Write and sketch by hand – with a stylus, a finger or the mouse. Your notebooks stay in your browser.',
		newNotebook: 'New notebook',
		open: 'Open …',
		newTitle: 'Where should the new notebook go?',
		openTitle: 'Open notebook',
		untitled: 'Notebook',
		notebooks: 'Notebooks',
		empty: 'No notebooks yet. Create one to start writing.',
		pages: (n: number) => (n === 1 ? '1 page' : `${n} pages`),
		loadFailed: (error: string) => `The notebooks could not be listed: ${error}`,
		showInFiles: 'Show in Files',
		failed: (error: string) => `That did not work: ${error}`,
		importPdf: 'Import PDF'
	},

	editor: {
		loadFailed: (error: string) => `The notebook could not be opened: ${error}`,
		openElsewhere: 'This notebook is already open in another tab or window.',
		unknownFormat: 'This is not a notebook this app can read.',
		newerVersion: 'The notebook was created with a newer version of the app. Reload the page to get it.',
		pageFailed: (error: string) => `A page could not be loaded: ${error}`,
		changedElsewhere: 'The notebook was changed elsewhere. Your changes here are kept.',
		undo: 'Undo',
		redo: 'Redo',
		pageOf: (n: number, total: number) => `Page ${n} of ${total}`,
		zoom: (percent: number) => `${percent} %`,
		zoomMenu: 'Zoom',
		fitWidth: 'Fit width',
		actualSize: 'Actual size',
		zoomIn: 'Zoom in',
		zoomOut: 'Zoom out',
		penOnly: 'Only the pen draws',
		penOnlyTip: 'Fingers only scroll and zoom, from the first touch on',
		penOnlyOn: 'Only the pen draws – fingers move the page',
		selectAll: 'Select all',
		selectAllTip: 'Everything on the page in view',
		showInFiles: 'Show in Files',
		back: 'All notebooks'
	},

	ribbon: {
		tabs: { draw: 'Draw', insert: 'Insert', pages: 'Pages', view: 'View', drawing: 'Drawing', selection: 'Selection', arrange: 'Arrange' },
		groups: {
			notebook: 'Notebook',
			tools: 'Tools',
			format: 'Format',
			options: 'Options',
			object: 'Object',
			pictures: 'Pictures',
			pages: 'Pages',
			page: 'Page',
			organize: 'Organize',
			zoom: 'Zoom'
		}
	},

	insert: {
		image: 'Image',
		pdf: 'PDF',
		imageFromFiles: 'Image from Files …',
		imageFromDevice: 'Image from this device …',
		icon: 'Icon',
		pdfFromFiles: 'PDF from Files …',
		pdfFromDevice: 'PDF from this device …',
		choosePdf: 'Choose a PDF',
		pdfInserted: (n: number) => (n === 1 ? '1 page inserted' : `${n} pages inserted`),
		pdfPassword: (name: string) => `“${name}” is protected by a password and can't be opened.`,
		pdfError: (error: string) => `The PDF could not be opened: ${error}`,
		pdfFailed: (name: string) => `“${name}” could not be read – is it a PDF?`,
		chooseImage: 'Choose an image',
		iconHint: 'The icon takes the pen color. Move and resize it with the frame.',
		imageFailed: (name: string) => `“${name}” could not be inserted – is it an image?`
	},

	export: {
		title: 'Export',
		menu: 'Export …',
		format: 'Format',
		pdf: 'PDF – all pages',
		png: 'PNG – this page',
		pdfHint: 'Strokes and imported PDF pages stay sharp at any size.',
		pngHint: (n: number) => `Page ${n} as an image.`,
		export: 'Export',
		running: 'Exporting …',
		done: (name: string, size: string) => `${name} (${size}) is ready.`,
		download: 'Download',
		saveToFiles: 'Save in Files …',
		savedToFiles: (path: string) => `Saved as ${path}`,
		open: 'Open',
		pageFile: (name: string, n: number) => `${name} – page ${n}`,
		failed: (error: string) => `Exporting failed: ${error}`,
		close: 'Close'
	},

	page: {
		add: 'Add page',
		delete: 'Delete page',
		deleteTip: 'Deletes the page in view with everything on it – the message offers to undo it',
		deleted: (n: number) => `Page ${n} deleted`,
		moveUp: 'Move page up',
		moveDown: 'Move page down',
		paper: 'Paper',
		papers: { blank: 'Blank', lined: 'Lined', grid: 'Grid', dotted: 'Dotted' },
		size: 'Page size',
		sizes: { a4: 'A4', a5: 'A5', a3: 'A3', letter: 'US Letter' },
		landscape: 'Landscape'
	},

	perf: {
		frame: 'Frame',
		latency: 'Input → pixels',
		rate: 'Points/s',
		tiles: 'Tiles'
	},

	/** Help window and the page `/help/notes` (topics in help.en.ts) */
	help
};

export default en;
