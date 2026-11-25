import help from './help.en.js';
// English texts. This file defines the structure; `de.ts` must have the same keys.

const en = {
	common: {
		cancel: 'Cancel',
		close: 'Close',
		done: 'Done'
	},

	brand: {
		description: 'JW Library backups and playlists in your browser: look inside, tidy up, merge the backups of your devices, edit playlists – nothing is uploaded.'
	},

	home: {
		tagline: 'Merge, tidy up and edit JW Library backups and playlists.',
		open: 'Open …',
		newPlaylist: 'New playlist …',
		newPlaylistTitle: 'New playlist',
		newPlaylistName: 'Playlist',
		openTitle: 'Open a backup or playlist',
		fromDevice: 'Open from the device …',
		saveTitle: 'Where should the file be kept?',
		empty: 'Nothing opened yet. Share a backup from JW Library to in-browser, or open one.',
		onlyFirst: (name: string) => `Only “${name}” was taken – one file at a time.`,
		remove: 'Remove from the list',
		failed: (error: string) => `The file could not be kept: ${error}`,
		hint: 'A backup shared from JW Library lands here: keep it as a new file, or merge it into the one you keep.'
	},

	ribbon: {
		tabs: { file: 'File', home: 'Home', notes: 'Notes', highlights: 'Highlights', tags: 'Tags', bookmarks: 'Bookmarks', playlist: 'Playlist' },
		groups: {
			file: 'File',
			share: 'Pass on',
			export: 'Export',
			show: 'Show',
			select: 'Selection',
			note: 'Note',
			filter: 'Filter',
			tags: 'Tags',
			color: 'Color',
			tidy: 'Tidy up',
			tag: 'Tag',
			playlists: 'Playlists',
			items: 'Items',
			order: 'Order'
		}
	},

	views: {
		overview: 'Overview',
		notes: 'Notes',
		highlights: 'Highlights',
		bookmarks: 'Bookmarks',
		tags: 'Tags',
		playlists: 'Playlists'
	},

	commands: {
		undo: 'Undo',
		redo: 'Redo',
		download: 'Download',
		downloadTip: 'Saves the file in the download folder of this device – from there JW Library opens it',
		showInFiles: 'Show in Files',
		exportNotes: 'Notes as text …',
		exportNotesTip: 'The notes (the selected ones, else all) as a text file in your files',
		delete: 'Delete',
		selectAll: 'Select all',
		clearSelection: 'Clear selection',
		editNote: 'Edit note …',
		tagNotes: 'Tags',
		filterTags: 'Filter by tags',
		filterTagsTip: 'Show only the notes with the tags you pick',
		newTag: 'New tag',
		newPlaylist: 'New playlist',
		newPlaylistTip: 'An empty playlist in this backup – name it, then add pictures and videos',
		recolor: 'Color',
		cleanUp: 'Clean up',
		cleanUpTip: 'Removes highlights without any text and tags on nothing',
		rename: 'Rename',
		mergeInto: 'Merge into',
		openPlaylist: 'Open',
		backToPlaylists: 'All playlists',
		addMedia: 'Pictures and videos …',
		addMediaTip: 'Pictures and videos of your files become items at the end of the playlist',
		addFromDevice: 'From the device …',
		moveUp: 'Move up',
		moveDown: 'Move down',
		removeItems: 'Remove',
		importPlaylist: 'Add playlist …',
		importPlaylistTip: 'A .jwlplaylist of your files becomes a playlist of this backup',
		exportPlaylist: 'Save as playlist file …',
		exportPlaylistTip: 'The open playlist as a .jwlplaylist file of its own',
		appendPlaylist: 'Append playlist …',
		appendPlaylistTip: 'The items of another .jwlplaylist at the end of this one',
		deletePlaylist: 'Delete playlist',
		trim: 'Trim …',
		trimTip: 'Play only a part of the selected video or piece of music'
	},

	editor: {
		back: 'Back to JWL Files',
		openElsewhere: 'This file is open in another tab. Close it there to edit it here.',
		loadFailed: (error: string) => `The file could not be opened: ${error}`,
		archive: 'This is no JW Library file (no backup, no playlist).',
		database: 'The database in this file can’t be read.',
		schema: 'This file was written by a newer JW Library than JWL Files knows. Nothing was changed.',
		changed: (name: string) => `“${name}” was changed elsewhere, and this tab has changes that aren’t saved yet.`,
		reload: 'Reload',
		keepMine: 'Keep my version',
		reloaded: (name: string) => `“${name}” was read again.`,
		warnings: (n: number) => (n === 1 ? '1 entry points at something missing and was left out.' : `${n} entries point at something missing and were left out.`),
		readOnly: 'Shared with you for viewing: you can look, not change.'
	},

	overview: {
		backup: 'JW Library backup',
		playlist: 'JW Library playlist',
		device: 'Made on',
		modified: 'Last changed',
		schema: 'Database version',
		merged: 'Merged by in-browser',
		counts: {
			notes: 'Notes',
			highlights: 'Highlights',
			bookmarks: 'Bookmarks',
			tags: 'Tags',
			playlists: 'Playlists',
			items: 'Items',
			inputs: 'Filled-in fields'
		},
		mergeHint: 'To merge the backup of another device into this one, share it from JW Library to in-browser and choose this file – or use “Merge with …” in the tab “File”.',
		backHint: 'Back to JW Library: “Send …” where the device offers it, else “Download” and open the file from the download message or the download folder.'
	},

	notes: {
		search: 'Search notes',
		empty: 'No notes.',
		none: 'No note matches.',
		untitled: 'Untitled',
		title: 'Title',
		text: 'Text',
		editTitle: 'Edit note',
		tagsNone: 'No tags yet – make one under “Tags”.',
		tagsButton: 'Tags',
		clearFilter: 'Show all notes',
		removeFilter: (name: string) => `Stop filtering by “${name}”`,
		match: 'Notes with',
		matchAll: 'all of them',
		matchAny: 'one of them',
		exported: (name: string) => `Saved as “${name}”.`,
		fileName: (name: string) => `${name} – notes.txt`
	},

	highlights: {
		empty: 'No highlights.',
		publication: 'Publication',
		color: 'Color',
		count: 'Highlights',
		colors: ['None', 'Yellow', 'Green', 'Blue', 'Pink', 'Orange', 'Purple'],
		style: { 0: 'Highlight', 1: 'Underline' } as Record<number, string>,
		cleaned: (n: number) => (n === 1 ? '1 entry removed.' : `${n} entries removed.`),
		nothingToClean: 'Nothing to clean up.'
	},

	bookmarks: {
		empty: 'No bookmarks.',
		slot: (n: number) => `Bookmark ${n + 1}`
	},

	tags: {
		empty: 'No tags of your own.',
		count: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
		newName: 'New tag',
		rename: (name: string) => `Rename “${name}”`
	},

	playlists: {
		empty: 'No playlists.',
		newName: 'New playlist',
		rename: (name: string) => `Rename “${name}”`,
		taken: (name: string) => `There is a playlist “${name}” already.`,
		emptyItems: 'This playlist is empty. Add pictures or videos.',
		items: (n: number) => (n === 1 ? '1 item' : `${n} items`),
		label: 'Name',
		seconds: 'Seconds',
		endAction: 'At the end',
		endActions: ['Continue', 'Stop', 'Freeze', 'Repeat'],
		video: 'Video',
		audio: 'Music',
		picture: 'Picture',
		trimmed: (from: string, to: string) => `Trimmed: ${from}–${to}`,
		other: 'Item of a publication',
		adding: 'Adding …',
		addFailed: (name: string) => `“${name}” could not be added.`,
		exported: (name: string) => `Saved as “${name}”.`,
		imported: (name: string) => `“${name}” added.`,
		notPlaylist: 'This is no JW Library playlist.',
		saveTitle: 'Save playlist as',
		openTitle: 'Choose a playlist',
		mediaTitle: 'Choose pictures and videos'
	},

	trim: {
		title: (label: string) => `Trim “${label}”`,
		publication: 'This video or piece of music comes from a publication – JW Library has it, so there is no preview here. Enter where it should start and end (minutes:seconds).',
		start: 'Start',
		end: 'End',
		startHere: 'Start here',
		endHere: 'End here',
		play: 'Play from here',
		length: (part: string, of: string) => `Plays ${part} of ${of}.`,
		invalid: 'The end must come after the start.',
		reset: 'Untrimmed'
	},

	status: {
		selected: (n: number) => `${n} selected`,
		shown: (n: number, of: number) => (n === of ? `${of}` : `${n} of ${of}`)
	},

	help
};

export default en;
