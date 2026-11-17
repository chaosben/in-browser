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
		unsupported: 'This browser has no file system for websites (OPFS). Please use a current browser.',
		newNotebook: 'New notebook',
		open: 'Open …',
		openNotebook: 'Open',
		newTitle: 'Where should the new notebook go?',
		openTitle: 'Open notebook',
		untitled: 'Notebook',
		notebooks: 'Notebooks',
		empty: 'No notebooks yet. Create one to start writing.',
		pages: (n: number) => (n === 1 ? '1 page' : `${n} pages`),
		loadFailed: (error: string) => `The notebooks could not be listed: ${error}`,
		actions: (name: string) => `Actions for ${name}`,
		deleteQuestion: {
			title: 'Delete notebook?',
			message: (name: string) => `“${name}” and all its pages will be deleted.`,
			confirm: 'Delete'
		},
		failed: (error: string) => `That did not work: ${error}`,
		importPdf: 'Import PDF',
		importing: 'Reading the PDF …'
	},

	editor: {
		loadFailed: (error: string) => `The notebook could not be opened: ${error}`,
		openElsewhere: 'This notebook is already open in another tab or window.',
		unknownFormat: 'This is not a notebook this app can read.',
		newerVersion: 'The notebook was created with a newer version of the app. Reload the page to get it.',
		pageFailed: (error: string) => `A page could not be loaded: ${error}`,
		saveFailed: (error: string) => `Saving failed: ${error}`,
		changedElsewhere: 'The notebook was changed elsewhere. Your changes here are kept.',
		saving: 'Saving …',
		saved: 'Saved',
		notSaved: 'Not saved yet',
		rename: 'Rename',
		renameFailed: (error: string) => `Renaming failed: ${error}`,
		undo: 'Undo',
		redo: 'Redo',
		pageOf: (n: number, total: number) => `Page ${n} of ${total}`,
		zoom: (percent: number) => `${percent} %`,
		zoomMenu: 'Zoom',
		fitWidth: 'Fit width',
		actualSize: '100 %',
		zoomIn: 'Zoom in',
		zoomOut: 'Zoom out',
		penOnly: 'Only the pen draws',
		penOnlyOn: 'Only the pen draws – fingers move the page',
		back: 'All notebooks'
	},

	tools: {
		label: 'Tools',
		pen: 'Pen',
		highlighter: 'Highlighter',
		eraser: 'Eraser',
		lasso: 'Lasso',
		laser: 'Laser pointer',
		eraserMode: 'Erases',
		eraserModes: { stroke: 'Whole strokes', pixel: 'Pixels' },
		color: 'Color',
		size: 'Thickness',
		sizeValue: (n: number) => `Thickness ${n}`,
		options: 'Color, thickness and smoothing',
		smoothing: 'Smoothing',
		smoothingLevels: ['Off', 'Light', 'Medium', 'Strong'] as string[],
		smoothingHint: 'Smoother lines that follow the pen with a small delay'
	},

	selection: {
		label: (n: number) => (n === 1 ? '1 item selected' : `${n} items selected`),
		color: 'Color',
		duplicate: 'Duplicate',
		delete: 'Delete'
	},

	insert: {
		menu: 'Insert',
		imageFromFiles: 'Image from Files …',
		imageFromDevice: 'Image from this device …',
		icon: 'Icon …',
		pdfFromFiles: 'PDF from Files …',
		pdfFromDevice: 'PDF from this device …',
		choosePdf: 'Choose a PDF',
		pdfInserted: (n: number) => (n === 1 ? '1 page inserted' : `${n} pages inserted`),
		pdfPassword: (name: string) => `“${name}” is protected by a password and can't be opened.`,
		pdfError: (error: string) => `The PDF could not be opened: ${error}`,
		pdfFailed: (name: string) => `“${name}” could not be read – is it a PDF?`,
		chooseImage: 'Choose an image',
		iconsTitle: 'Insert icon',
		iconHint: 'The icon takes the pen color. Move and resize it with the frame.',
		close: 'Close',
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
		pageFile: (name: string, n: number) => `${name} – page ${n}`,
		failed: (error: string) => `Exporting failed: ${error}`,
		close: 'Close'
	},

	page: {
		menu: 'Page',
		add: 'Add page',
		delete: 'Delete page',
		moveUp: 'Move page up',
		moveDown: 'Move page down',
		paper: 'Paper',
		papers: { blank: 'Blank', lined: 'Lined', grid: 'Grid', dotted: 'Dotted' },
		size: 'Page size',
		sizes: { a4: 'A4', a5: 'A5', a3: 'A3', letter: 'US Letter' },
		landscape: 'Landscape',
		deleteQuestion: {
			title: 'Delete page?',
			message: (n: number) => `Page ${n} and everything on it will be deleted. You can undo this.`,
			confirm: 'Delete'
		}
	},

	perf: {
		frame: 'Frame',
		latency: 'Input → pixels',
		rate: 'Points/s',
		tiles: 'Tiles'
	}
};

export default en;
