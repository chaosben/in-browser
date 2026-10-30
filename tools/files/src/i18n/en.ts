// English texts. This file defines the structure; `de.ts` must have the same keys.

const en = {
	common: {
		cancel: 'Cancel',
		close: 'Close',
		open: 'Open',
		delete: 'Delete',
		rename: 'Rename',
		download: 'Download'
	},

	brand: {
		partOf: 'Part of',
		suiteClaim: 'tools that run entirely in your browser',
		description:
			'Manage the files of your in-browser tools in the browser storage and keep them in sync with a folder on your computer.'
	},

	toolbar: {
		up: 'Up one folder',
		newFolder: 'New folder',
		newTextFile: 'New text file',
		upload: 'Upload',
		uploadFiles: 'Upload files',
		uploadFolder: 'Upload folder',
		search: 'Search in this folder',
		list: 'List',
		grid: 'Tiles',
		refresh: 'Refresh'
	},

	columns: {
		name: 'Name',
		kind: 'Type',
		size: 'Size',
		modified: 'Modified'
	},

	menu: {
		open: 'Open',
		openWith: (tool: string) => `Open with ${tool}`,
		preview: 'Preview',
		download: 'Download',
		downloadZip: 'Download as ZIP',
		rename: 'Rename',
		duplicate: 'Duplicate',
		copy: 'Copy',
		cut: 'Cut',
		paste: 'Paste',
		delete: 'Delete',
		properties: 'Properties',
		selectAll: 'Select all'
	},

	list: {
		loading: 'Loading …',
		unsupported: 'Your browser lacks the storage Files needs (Origin Private File System). Use a current browser.',
		empty: 'This folder is empty. Drop files here or use “Upload”.',
		noMatch: 'Nothing matches your search.',
		items: (n: number) => (n === 1 ? '1 item' : `${n} items`),
		selected: (n: number) => `${n} selected`,
		newFolderName: 'New folder',
		newTextFileName: 'New text file.txt',
		dropHere: (folder: string) => `Drop to upload into “${folder}”`,
		hint: 'Double-click opens, right-click shows all actions. Drag items onto a folder to move them, hold Ctrl to copy.'
	},

	confirm: {
		deleteTitle: 'Delete for good?',
		deleteOne: (name: string) => `“${name}” will be deleted with everything in it. This cannot be undone.`,
		deleteMany: (n: number) => `${n} items will be deleted with everything in them. This cannot be undone.`
	},

	properties: {
		title: 'Properties',
		kind: 'Type',
		location: 'Location',
		size: 'Size',
		modified: 'Modified',
		contents: 'Contains',
		counts: (files: number, folders: number) =>
			`${files === 1 ? '1 file' : `${files} files`}, ${folders === 1 ? '1 folder' : `${folders} folders`}`,
		calculating: 'Calculating …'
	},

	preview: {
		none: 'There is no preview for this file.',
		tooLarge: 'The file is too large for a text preview.'
	},

	toasts: {
		uploaded: (n: number) => (n === 1 ? '1 file uploaded' : `${n} files uploaded`),
		uploading: (name: string) => `Uploading ${name} …`,
		pasted: (n: number) => (n === 1 ? '1 item pasted' : `${n} items pasted`),
		zipping: 'Preparing the ZIP file …'
	},

	storage: {
		used: (used: string, quota: string) => `${used} of ${quota} used`
	},

	sync: {
		title: 'Folder on your computer',
		intro:
			'Keep these files in sync with a real folder, e.g. one your sync tool (Syncthing, Nextcloud, Dropbox …) carries to your other computers. The newer version wins.',
		unsupported: 'Your browser cannot access folders on your computer. Use Chrome or Edge for this.',
		connect: 'Choose folder',
		connected: (folder: string) => `Synced with “${folder}”`,
		paused: (folder: string) => `Paused: the browser needs your permission again for “${folder}”.`,
		renew: 'Allow access',
		renewHint: 'Tip: choose “Allow on every visit” so syncing continues by itself.',
		syncing: 'Syncing …',
		syncNow: 'Sync now',
		disconnect: 'Disconnect',
		disconnectTitle: 'Disconnect the folder?',
		disconnectMessage: (folder: string) =>
			`Nothing is deleted – neither here nor in “${folder}”. Syncing just stops; you can connect a folder again at any time.`,
		lastSync: (time: string) => `Last synced ${time}`,
		failed: (n: number) => (n === 1 ? '1 file could not be synced.' : `${n} files could not be synced.`),
		confirmDeletes: (n: number) => `${n} files were deleted in the folder on your computer. Delete them here as well?`,
		applyDeletes: 'Delete here too',
		restoreInstead: 'Restore them instead',
		runsWhileOpen: 'Syncing runs while any in-browser tool is open in this browser.'
	}
};

export default en;
