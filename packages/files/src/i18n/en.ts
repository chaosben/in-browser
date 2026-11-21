// Texts of the file system components (file dialog, error messages). Defines the structure; de.ts must have the
// same keys.
const en = {
	root: 'My files',
	kinds: {
		folder: 'Folder',
		file: 'File',
		fileType: (ext: string) => `${ext} file`,
		package: (tool: string) => `${tool} project`
	},

	dialog: {
		titleOpen: 'Open',
		titleSave: 'Save as',
		titleFolder: 'Choose folder',
		chooseFolder: 'Choose this folder',
		open: 'Open',
		openCount: (n: number) => `Open (${n})`,
		save: 'Save',
		cancel: 'Cancel',
		up: 'Up one folder',
		newFolder: 'New folder',
		folderName: 'Name of the new folder',
		create: 'Create',
		name: 'Name',
		empty: 'Nothing here yet.',
		exists: (name: string) => `“${name}” already exists here. Choose another name.`,
		replace: 'Replace',
		replaces: (name: string) => `“${name}” already exists here and will be replaced.`,
		/** Choice between My files and the connected folders */
		place: 'Place'
	},

	errors: {
		notFound: (name: string) => `“${name}” no longer exists.`,
		exists: (name: string) => `“${name}” already exists.`,
		collision: (name: string) => `There is already an entry that only differs in upper/lower case from “${name}”.`,
		invalidName: (name: string) => `“${name}” is not a valid name.`,
		intoItself: (name: string) => `“${name}” cannot be moved or copied into itself.`,
		root: (_name: string) => 'This is not possible with the top folder.',
		offline: (name: string) => `“${name}” can’t be reached right now.`,
		denied: (name: string) => `The browser doesn’t allow access to “${name}” right now. Allow it in Files under “Connected”.`,
		readOnly: (name: string) => `“${name}” can only be read.`,
		ended: (_name: string) => 'The share has ended.',
		taken: (_name: string) => 'This share is open in another browser right now. Try again later.',
		credentials: (name: string) => `The server of “${name}” didn’t accept the sign-in data. Change them in Files under “Connected”.`,
		full: (name: string) => `“${name}” doesn’t fit: the storage of this browser is full. Free space in Files, e.g. with “Empty trash”.`,
	},

	/** Sync status in the footer of every tool (`SyncIndicator`) */
	indicator: {
		label: 'Sync status',
		folder: (folder: string) => `Folder “${folder}”`,
		synced: 'Up to date',
		syncing: 'Syncing …',
		paused: 'Paused',
		pausedHint: 'Allow access again in Files.',
		failed: (n: number) => (n === 1 ? '1 file not synced' : `${n} files not synced`),
		pendingDeletes: (n: number) => `${n} deletions wait for your confirmation`,
		setup: 'Waiting for your choice',
		heldFolders: (n: number, name: string) => (n === 1 ? `New folder “${name}” waits` : `${n} new folders wait`),
		lastSync: (ago: string) => `Last synced ${ago}`,
		syncNow: 'Sync now',
		manage: 'Manage in Files',
		help: 'How syncing works'
	},

	/** Moving what the user deletes into the trash (every tool) */
	trash: {
		moved: (name: string) => `“${name}” is in the trash.`,
		movedMany: (n: number) => `${n} items are in the trash.`,
		undo: 'Undo',
		/** Deleting in a connected folder, which has no trash */
		forGoodTitle: 'Delete for good?',
		forGood: (name: string) => `“${name}” is in a connected folder, which has no trash. It will be deleted for good.`,
		forGoodMany: (n: number) => `${n} items are in a connected folder, which has no trash. They will be deleted for good.`,
		forGoodConfirm: 'Delete'
	},

	/** Connected folders (access, start pages of the tools) */
	document: {
		saveFailed: (error: string) => `Saving failed: ${error}`,
		changedTitle: (name: string) => `“${name}” was changed elsewhere`,
		changedMessage: 'Another version was saved – on another device, in another tab or by another program. Reload to see it here; you have no unsaved changes.',
		reload: 'Reload',
		keep: 'Don’t reload',
		dontAsk: 'Don’t ask again while it is open'
	},

	connected: {
		allow: 'Allow access',
		noAccess: (name: string) => `The browser needs your permission again for “${name}”.`,
		editCredentials: 'Change sign-in data'
	},

	/** Start pages of the tools (`StartPage`) */
	start: {
		recent: 'Recently opened',
		unsupported: 'This browser has no file system for websites (OPFS). Please use a current browser.',
		open: 'Open'
	},

	/** Guest shares: one folder for a browser outside your devices */
	share: {
		/** A share opened as a guest, under “Connected” */
		connection: (folder: string, host: string) => (host ? `${folder} from ${host}` : folder),
		pending: 'Shared folder',
		viewOnly: 'View only'
	},

	/** Sync with a folder on disk */
	folderSync: {
		/** Whose version a conflict copy holds: `Notes (conflict browser).md` */
		browser: 'browser',
		folder: 'folder'
	},

	/** Sync with your other devices (footer of every tool, toasts) */
	p2p: {
		/** Part of the name of a conflict copy: `Notes (conflict Laptop).md` */
		conflictLabel: (device: string) => `conflict ${device}`,
		connected: (online: number, total: number) => `${online} of ${total} devices connected`,
		waiting: 'Waiting for your devices',
		syncingWith: (name: string, done: number, total: number) => `Syncing with ${name} … ${done}/${total}`,
		upToDate: 'Up to date',
		probablyBehind: (name: string) => `${name} probably not up to date`,
		selfBehind: 'This device is not up to date',
		removed: 'This device was removed from your devices',
		online: 'connected',
		lastSeen: (ago: string) => `last seen ${ago}`,
		never: 'not seen yet',
		unreachable: 'online, but not reachable',
		outdated: 'needs an update of in-browser',
		newer: 'has a newer version – reload this page',
		missing: (n: number, more: boolean) =>
			more ? `more than ${n} changes missing` : n === 1 ? '1 change missing' : `${n} changes missing`,
		pendingDeletes: (n: number) => `${n} deletions wait for your confirmation`,
		manage: 'Manage devices',
		conflicts: (names: string[]) =>
			names.length === 1
				? `“${names[0]}” was changed on two devices – both versions are kept.`
				: `${names.length} files were changed on two devices – both versions are kept.`,
		added: (name: string) => `${name} was added to your devices.`,
		removedDevice: (name: string) => `${name} was removed from your devices.`,
		paired: 'This device is now connected with your devices.',
		oldCopy: (name: string) =>
			`“${name}” isn’t synced on this device and now opens live from your other devices – the old copy that was still here is in the trash.`
	},

	/** The suite settings (`settings.ts`): one entry per category and setting, named so it explains itself */
	settings: {
		title: 'Settings',
		open: 'Settings',
		close: 'Close',
		back: 'All settings',
		categoriesLabel: 'Categories',
		synced: 'Applies on all your devices.',
		saveFailed: (error: string) => `The setting couldn’t be saved: ${error}`,
		categories: { profile: 'Profile', trash: 'Trash', sync: 'Sync' },
		profile: {
			name: { label: 'Your name' }
		},
		trash: {
			days: {
				label: 'Remove deleted items for good after',
				option: (days: number | null) => (days === null ? 'Never' : `${days} days`)
			}
		},
		sync: {
			askAbove: {
				label: 'Ask before syncing new folders larger than',
				option: (bytes: number | null) => (bytes === null ? 'Never ask' : bytes >= 1e9 ? `${bytes / 1e9} GB` : `${bytes / 1e6} MB`)
			}
		}
	},

	/** Why a name is not allowed (shown while typing) */
	names: {
		empty: 'Enter a name.',
		dots: '“.” and “..” are not allowed.',
		chars: 'These characters are not allowed: \\ / : * ? " < > |',
		reserved: 'This name is reserved on Windows.',
		trailing: 'The name must not start with a space or end with a space or dot.',
		long: 'The name is too long.'
	}
};

export default en;
