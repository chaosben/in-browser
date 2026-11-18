// Texts of the file system components (file dialog, error messages). Defines the structure; de.ts must have the
// same keys.
const en = {
	root: 'Files',
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
		replaces: (name: string) => `“${name}” already exists here and will be replaced.`
	},

	errors: {
		notFound: (name: string) => `“${name}” no longer exists.`,
		exists: (name: string) => `“${name}” already exists.`,
		collision: (name: string) => `There is already an entry that only differs in upper/lower case from “${name}”.`,
		invalidName: (name: string) => `“${name}” is not a valid name.`,
		intoItself: (name: string) => `“${name}” cannot be moved or copied into itself.`,
		root: (_name: string) => 'This is not possible with the top folder.'
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
		lastSync: (ago: string) => `Last synced ${ago}`,
		syncNow: 'Sync now',
		manage: 'Manage in Files'
	},

	/** Moving what the user deletes into the trash (every tool) */
	trash: {
		moved: (name: string) => `“${name}” is in the trash.`,
		movedMany: (n: number) => `${n} items are in the trash.`,
		undo: 'Undo'
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
		paired: 'This device is now connected with your devices.'
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
