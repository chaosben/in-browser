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
