import help from './help.en.js';
// English texts. This file defines the structure; `de.ts` must have the same keys.

const en = {
	common: {
		cancel: 'Cancel',
		close: 'Close',
		rename: 'Rename',
		download: 'Download'
	},

	brand: {
		description:
			'Manage the files of your in-browser tools in the browser storage and keep them in sync with a folder on your computer.'
	},

	toolbar: {
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

	/** Names and tooltips of commands that have no other text */
	commands: {
		undo: 'Undo',
		undoTip: 'Takes back the last renaming, moving, pasting or duplicating',
		openWith: 'Open with',
		downloadTip: 'The selection, else the open folder (several entries and folders as ZIP)',
		shareTip: 'Shares the selected folder, else the open one, with a guest',
		syncSettings: 'Sync settings',
		syncHere: 'Sync on this device',
		syncHereTip: 'Whether the selected folder, else the open one, is kept on this device',
		up: 'Up one folder'
	},

	ribbon: {
		tabs: {
			home: 'Home',
			share: 'Share',
			connect: 'Connect',
			sync: 'Sync',
			view: 'View',
			// Shown while entries are selected
			selection: 'Selection',
			// Shown while the trash is open
			trash: 'Trash'
		},
		groups: {
			new: 'New',
			clipboard: 'Clipboard',
			organize: 'Organize',
			select: 'Select',
			find: 'Find',
			share: 'Share',
			download: 'Download',
			sync: 'Sync',
			devices: 'Devices',
			trash: 'Trash',
			show: 'Show',
			panels: 'Panels',
			open: 'Open',
			entries: 'Entries'
		}
	},

	panels: {
		folders: 'Folders'
	},

	view: {
		sortBy: 'Sort by',
		ascending: 'Ascending',
		descending: 'Descending'
	},

	columns: {
		name: 'Name',
		kind: 'Type',
		size: 'Size',
		modified: 'Modified',
		// In the trash
		origin: 'Original location',
		deleted: 'Deleted'
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
		selectAll: 'Select all',
		moveTo: 'Move to …',
		moveHere: 'Move here',
		clearSelection: 'Clear selection'
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
		hint: 'Double-click opens, right-click shows all actions, a click on the name of the selected item renames it. Drag items onto a folder to move them, hold Ctrl to copy.'
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
		moved: (n: number) => (n === 1 ? '1 item moved' : `${n} items moved`),
		copied: (n: number) => (n === 1 ? '1 item copied' : `${n} items copied`),
		duplicated: (n: number) => (n === 1 ? '1 item duplicated' : `${n} items duplicated`),
		renamed: (name: string) => `Renamed to “${name}”`,
		undo: 'Undo',
		zipping: 'Preparing the ZIP file …'
	},

	storage: {
		used: (used: string, quota: string) => `${used} of ${quota} used`,
		/** The browser hasn't promised to keep the storage (footer, links to the help) */
		notKept: 'The browser may clear this storage',
		notKeptHint: 'This browser hasn’t promised to keep the storage of in-browser. Keep a copy – sync with a folder or another device – or install in-browser. Opens the help.'
	},

	/** Folders on the computer opened live (sidebar section “Connected”) */
	/** Sharing a folder with a guest */
	share: {
		action: 'Share …',
		title: (folder: string) => `Share “${folder}”`,
		intro: 'A guest gets this folder in their browser with a link or QR code: it is copied onto their device and kept in sync while in-browser is open here. When the share ends, the copy there is deleted.',
		mode: 'The guest may',
		view: 'View only',
		viewHint: 'Open, preview and download files (default).',
		edit: 'Edit',
		editHint: 'Also save, upload, rename and delete – deleted items go into the trash here.',
		untilEnded: 'Until you end it',
		validity: 'The link works until you end the share. Whoever has it gets in while no one else is connected – give it only to your guest.',
		create: 'Share',
		link: 'Link for the guest',
		qr: 'QR code of the share link',
		copy: 'Copy link',
		copied: 'Link copied.',
		waiting: 'Waiting for the guest – one browser at a time can open the link.',
		connected: 'Guest connected.',
		away: 'The guest is not connected right now.',
		end: 'End share',
		endTitle: 'End the share?',
		endMessage: (folder: string) => `The guest can no longer open “${folder}”. Nothing in the folder changes.`,
		shared: 'shared',
		guestConnected: 'Guest connected',
		guestWaiting: 'No guest connected',
		menu: (folder: string) => `Actions for the share of “${folder}”`,
		ended: 'The share has ended.',
		endedHint: 'Its copy on this device was deleted. What you copied into My files stays.',
		remove: 'Remove',
		show: 'Show link',
		panelLabel: 'Folders shared with a guest',
		section: 'Shares',
		new: 'Share a folder …',
		chooseTitle: 'Choose a folder to share',
		chooseConfirm: 'Share this folder',
		notRoot: 'My files as a whole can’t be shared – choose a folder in it.',
		notShareable: 'This folder isn’t on this device (it is left out of the sync here), so it can’t be shared from here.',
		help: 'How sharing with a guest works',
		unsupported: 'This browser can’t share folders. Use a current version of Chrome, Edge, Firefox or Safari.'
	},

	/** Folders this device doesn't sync, opened live from the other devices */
	remote: {
		live: 'Live from your other devices',
		unreachable: (name: string, devices: string[]) =>
			devices.length
				? `“${name}” can’t be reached right now – it is on ${devices.join(', ')}, and none of them is connected.`
				: `“${name}” can’t be reached right now – none of your connected devices has it.`,
		help: 'How folders that aren’t synced here work'
	},

	connected: {
		title: 'Connected',
		connect: 'Connect …',
		connectHint: 'Opens a folder on your computer, a WebDAV server or S3 storage live – nothing is copied into the browser –, or unlocks an encrypted folder of My files.',
		kinds: {
			folder: 'Folder on this computer …',
			folderUnsupported: 'Folder on this computer (needs Chrome or Edge on a computer)',
			webdav: 'WebDAV server …',
			s3: 'S3 storage …',
			vault: 'Encrypted folder in My files …'
		},
		/** Picking the encrypted folder to connect */
		chooseVault: 'Choose an encrypted folder',
		chooseVaultConfirm: 'Unlock this folder',
		notVault: 'This folder isn’t an encrypted folder – or it lies in a folder this device doesn’t sync. Choose the encrypted folder itself, not a folder inside it.',
		edit: 'Edit …',
		noAccess: (name: string) => `The browser needs your permission again for “${name}”.`,
		allow: 'Allow access',
		allowHint: 'Tip: choose “Allow on every visit”, then it stays connected.',
		disconnect: 'Disconnect',
		disconnectTitle: 'Disconnect the folder?',
		disconnectMessage: (name: string) =>
			`Nothing in “${name}” is deleted. It just no longer shows up here; you can connect it again at any time.`,
		alsoSynced: (name: string) => `My files already sync with “${name}” – its content now shows up twice.`,
		live: (name: string) => `Live from “${name}” on your computer`,
		liveServer: (name: string) => `Live from “${name}”`,
		sharedCopy: (host: string) => (host ? `Shared by ${host} – a copy on this device` : 'Shared – a copy on this device'),
		help: 'How connected folders work'
	},

	/** Encrypted folders (gocryptfs) in My files */
	vault: {
		/** Ribbon group in the tab “Connect” */
		group: 'Encrypted',
		newFolder: 'New encrypted folder …',
		newTitle: 'New encrypted folder',
		newIntro: 'Everything you put into it is stored encrypted – in this browser, on your other devices and in the synced folder on your computer.',
		name: 'Name',
		defaultName: 'Private',
		format: 'Format',
		/** A format in the list; the default one is marked */
		formatOption: (name: string, isDefault: boolean) => (isDefault ? `${name} (default)` : name),
		/** What each format means, below the list */
		formats: {
			gocryptfs:
				'Opens on a computer with gocryptfs (Linux, macOS) or cppcryptfs (Windows). Names and contents are encrypted; how many files and folders there are and roughly how large they are stays visible.',
			cryptomator:
				'Opens with Cryptomator on computers and phones. Names, contents and how the folders nest are encrypted; how many files there are and roughly how large they are stays visible. There is no key to write down here: if you may forget the password, open the folder once in Cryptomator and make its recovery key there.'
		},
		password: 'Password',
		repeat: 'Repeat password',
		mismatch: 'The passwords don’t match.',
		tooShort: (n: number) => `Use at least ${n} characters.`,
		create: 'Create',
		creating: 'Creating …',
		cancel: 'Cancel',
		keyTitle: 'Write down the master key',
		keyIntro: 'If you forget the password, only this key opens the folder (with gocryptfs on a computer: “-masterkey”). Keep it somewhere safe – in-browser doesn’t keep it for you and can’t show it again.',
		copy: 'Copy',
		copied: 'The master key is on the clipboard.',
		done: 'Done',
		showEncrypted: 'Show encrypted files',
		/** Footer while the decrypted folder is open */
		status: (name: string) => `Decrypted from “${name}” in My files`,
		remembered: 'Key remembered on this device'
	},

	log: {
		title: 'Troubleshooting',
		record: 'Record a log of the sync (devices and folder)',
		hint: 'Turn it on on every device involved, reproduce the problem, then export the log on each. It stays on this device until you export it and contains file and device names – look through it before you pass it on.',
		count: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
		export: 'Export log',
		clear: 'Clear log',
		fileName: (device: string, date: string) => `in-browser-sync-log-${device}-${date}.txt`
	},

	syncHub: {
		title: 'Sync'
	},

	devices: {
		title: 'Your devices',
		intro: 'Sync these files directly with your other devices – phone, laptop, tablet. No cloud, no account.',
		unsupported: 'This browser can’t sync with other devices. Use a current version of Chrome, Edge, Firefox or Safari.',
		connect: 'Connect devices',
		enterKey: 'Enter key',
		howItWorks: 'How it works',
		addDevice: 'Add device',
		chooseFolders: 'Choose folders',
		syncNow: 'Sync now',
		leave: 'Disconnect this device',
		removeNamed: (name: string) => `Remove “${name}”`,
		remove: 'Remove device',
		rename: 'Rename',
		thisDevice: 'this device',
		online: 'connected',
		syncing: (done: number, total: number) => `syncing … ${done}/${total}`,
		lastSeen: (ago: string) => `last seen ${ago}`,
		/** Seen by another device, not by this one */
		lastSeenVia: (ago: string, via: string) => `last seen ${ago} by ${via}`,
		never: 'not seen yet',
		unreachable: 'Online, but can’t be reached. The network probably blocks direct connections (e.g. mobile data or a company network).',
		outdated: 'Needs an update: open in-browser there and reload the page.',
		newer: 'Runs a newer version: reload this page.',
		lastSync: (ago: string) => `last synced ${ago}`,
		upToDate: 'up to date',
		probablyBehind: (changes: string, ago: string) => `Probably not up to date: ${changes} since the last sync ${ago}.`,
		changes: (n: number, more: boolean) => (more ? `more than ${n} changes` : n === 1 ? '1 change' : `${n} changes`),
		waiting: 'Waiting for your other devices. Open in-browser on one of them.',
		/** No other device connected, but all have the same state as this one (as far as known) */
		allUpToDate: 'All your devices are up to date. Changes travel as soon as in-browser is open on two of them.',
		/** Another device has changes this one doesn’t have yet */
		ahead: 'Has changes this device doesn’t have yet.',
		selfAhead:
			'Another of your devices has changes this device doesn’t have yet. Open in-browser there (or on a device that synced with it) before you continue here – otherwise conflict copies may appear.',
		selfBehind: (ago: string) =>
			`This device was last synced ${ago}. Open in-browser on one of your other devices before you continue here – otherwise conflict copies may appear.`,
		excludedCount: (n: number) => (n === 1 ? '1 folder not synced on this device' : `${n} folders not synced on this device`),
		pendingDeletes: (n: number) => `${n} files were deleted on another device. Delete them here as well?`,
		applyDeletes: 'Delete here too',
		runsWhileOpen: 'Syncing runs while in-browser is open on at least two devices – or all the time with a p2p-node on a computer or home server.',
		p2pNode: 'Set up a p2p-node',
		removeTitle: (name: string) => `Remove “${name}”?`,
		removeMessage:
			'It can no longer connect to your devices and gets nothing new. What it already has stays there – remote deleting isn’t possible.',
		leaveTitle: 'Disconnect this device?',
		leaveMessage: 'Your files stay here and on the other devices. This device just stops syncing; you can connect it again later.',
		removedTitle: 'This device was removed from your devices.',
		removedMessage: 'It no longer syncs. The files that were synced stay here until you delete them.',
		resetKeep: 'Reset, keep files',
		resetDelete: 'Delete files and reset',
		resetDeleteTitle: 'Delete all files on this device and reset?',
		resetDeleteMessage:
			'This deletes every file in Files on this device and resets syncing to the start. The other devices are not affected.',
		resetHint: 'Resetting brings this device back to the start: you can connect it again with a new key.',
		nameLabel: 'Name of this device',
		nameHint: 'So you can tell your devices apart, e.g. “Laptop office”.',
		suggestion: (browser: string, system: string) => (browser && system ? `${browser} on ${system}` : browser || system || 'My device'),
		phone: 'Android phone',
		tablet: 'Android tablet',
		next: 'Next',
		back: 'Back',
		close: 'Close',
		cancel: 'Cancel',
		start: 'Connect',
		failed: (message: string) => `That didn’t work: ${message}`
	},

	pair: {
		title: 'Add device',
		yourKey: 'Your key',
		scan: 'Scan the code with the camera of your phone, or enter the key in in-browser on the other device (Files → Your devices → Enter key).',
		copyLink: 'Copy link',
		copied: 'Link copied.',
		validity: 'Valid once, for 24 hours, while this device is online.',
		warning: 'Whoever has this key can connect a device and read and change all your synced files.',
		waiting: 'Waiting for the other device …',
		added: (name: string) => `${name} was added.`,
		addAnother: 'Add another device'
	},

	/** Asked before a share link (`/files#share=…`) connects */
	shareLink: {
		title: 'Open this share?',
		message: 'This link opens a folder or file that somebody shares with you. Your browser connects directly to their device and copies what is shared onto this device. Open it only if you know who the link is from.',
		replaces: 'The share that is open in this browser now is closed, and its copy here is deleted.',
		open: 'Open share'
	},

	join: {
		title: 'Connect this device',
		keyLabel: 'Key',
		keyPlaceholder: 'XXXX-XXXX-XXXX-XXXX-XXXX',
		invalidKey: 'That is not a valid key (20 characters).',
		confirm: 'Connect this device with your devices? All files will be synced with the other devices.',
		connecting: 'Connecting … keep in-browser open on the device that shows the key.',
		timeout: 'No answer. Is in-browser open on the other device, and is the key still valid?',
	},

	explain: {
		title: 'How it works',
		simple: 'Simple',
		expert: 'For experts',
		points: [
			'Your devices exchange files **directly** with each other – encrypted, without a cloud.',
			'Syncing happens **while at least two devices have in-browser open**. One tab with any tool is enough, even in the background. On a phone only while the page is in front. What was missed is caught up. A **p2p-node** on a computer or home server keeps syncing even when no browser is open.',
			'**Every device has its own key.** A new device only joins with a one-time key one of your devices issues. You can remove a lost device at any time.',
			'For each device you can leave out folders. They then stay only where they are.'
		],
		diagram: 'Three devices connected directly with each other, no server in between',
		expertSections: [
			['Transport', 'WebRTC data channels (SCTP over DTLS), directly between the devices, each with each. STUN via stun.cloudflare.com and stun.l.google.com, no TURN – so strict NATs (symmetric NAT, CGNAT on mobile networks) often prevent a connection. A p2p-node uses the fixed UDP ports 29400–29449 and has the router forward them (UPnP), so it is reachable from anywhere.'],
			['Signaling', 'Trystero over public Nostr relays. They see IP addresses, timing and a hash of the room; offers and ICE candidates are encrypted with a key derived from the room secret. Every removal brings a new room secret.'],
			['Identity', 'Ed25519 key pair per device (WebCrypto, not extractable, IndexedDB). The device ID is the fingerprint of the public key. Signing in signs a nonce together with the DTLS fingerprints of the connection, so no relay can sit in between.'],
			['Members', 'Hash-chained log of signed entries (create, add, remove, rename), merged on every contact. A removal beats concurrent entries of the removed device; mutual concurrent removals remove both. A device that was offline learns about a removal from any member – if it meets the removed device first, that one can still sync with it until then.'],
			['One-time key', '100 bits, valid once and for 24 hours, only while the issuing device is online. Proven by HMAC over the DTLS fingerprints in both directions.'],
			['Sync', 'Three-way comparison per pair of devices against the stored state of the last sync; the device with the smaller ID drives. Newer wins, the other version becomes a conflict copy; SHA-256 avoids needless transfers; many deletions at once wait for confirmation (on either device). Right before overwriting or deleting, the state is compared with the one planned on – what changed meanwhile is left alone. Deletions and replacements from other devices are applied (like Syncthing); what you delete goes into the trash folder, which syncs like any other. Renames in upper/lower case only stay renames. Folder choice = intersection of both devices, never causes deletions.'],
			['Knowledge', 'Change log with running numbers per device and version vectors: the basis of the hints on devices that are probably not up to date, also when they got changes indirectly.'],
			['Storage', 'Files in the OPFS (persistence requested); keys, member log, sync state and vectors in IndexedDB.'],
			['Limits', 'Runs only in an open tab, on phones only in the foreground. What a removed device already has, it keeps. A p2p-node lifts the first limit: a Node process (WebRTC via werift) that joins as a device and keeps the files in a folder on disk.']
		] as [string, string][],
		more: 'More about syncing in the help',
		p2pNode: 'p2p-node: an always-on device for your computer or home server',
		source: 'Source code of the P2P module',
		diagnostics: 'Diagnostics',
		ownFingerprint: 'This device',
		connection: { host: 'directly in the local network', srflx: 'through NAT (STUN)', prflx: 'through NAT', relay: 'relayed (TURN)', unknown: 'unknown' } as Record<string, string>,
		rtt: (ms: number) => `${ms} ms`,
		relays: 'Relays',
		relayConnected: 'connected',
		relayDisconnected: 'not connected',
		noPeers: 'No device connected right now.',
		copyDiagnostics: 'Copy diagnostics',
		copied: 'Diagnostics copied.'
	},

	/** Connecting a server (`ConnectDialog`) */
	connect: {
		webdav: 'Connect a WebDAV server',
		editWebdav: 'Edit WebDAV server',
		s3: 'Connect S3 storage',
		editS3: 'Edit S3 storage',
		webdavIntro: 'A folder on Nextcloud, ownCloud, a NAS or any WebDAV server opens live here – nothing is copied into the browser.',
		s3Intro: 'A bucket of AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO or other S3-compatible storage opens live here.',
		url: 'Address of the folder',
		username: 'User name',
		password: 'Password or app password',
		provider: 'Provider',
		providers: { aws: 'Amazon S3', r2: 'Cloudflare R2', b2: 'Backblaze B2', wasabi: 'Wasabi', other: 'Other (MinIO …)' },
		region: 'Region',
		bucket: 'Bucket',
		endpoint: 'Endpoint',
		prefix: 'Folder in the bucket',
		prefixPlaceholder: 'empty: the whole bucket',
		pathStyle: 'Bucket in the path (path-style addresses)',
		accessKeyId: 'Access key ID',
		secretKey: 'Secret access key',
		keepSecret: 'unchanged',
		name: 'Name',
		namePlaceholder: 'optional',
		httpsOnly: 'Only HTTPS addresses work (or a server on this computer).',
		secretStays: 'The password stays on this device, encrypted. It is never synced.',
		unreachable: 'The server can’t be reached, or it doesn’t allow access from the browser (CORS).',
		wrongCredentials: 'The server didn’t accept the user name or password.',
		corsHelp: 'How to set it up',
		notFound: 'The server answered, but this folder or bucket doesn’t exist.',
		cancel: 'Cancel',
		connect: 'Connect',
		save: 'Save'
	},

	/** Choosing folders before a sync target starts (`ScopeSetupDialog`) */
	scopeSetup: {
		titleFolder: (folder: string) => `Choose folders for “${folder}”`,
		titleDevice: 'Choose what this device syncs',
		hintSetup: 'Nothing is transferred until you start. Large folders and those that don’t fit are deselected – you can change that.',
		hintFolder: 'Deselected folders stay where they are – in My files and in the folder on your computer. They just aren’t synced.',
		hintDevice: 'Deselected folders stay on your other devices; here you open them live from there.',
		comesHere: (size: string) => `Comes here: ${size}`,
		goesThere: (size: string) => `Goes there: ${size}`,
		free: (size: string) => `Free in the browser: ${size}`,
		incoming: (size: string) => `${size} comes here`,
		outgoing: (size: string) => `${size} goes there`,
		toDevices: (size: string) => `${size} goes to your devices`,
		both: (size: string) => `${size} on both sides`,
		large: 'large',
		full: 'doesn’t fit',
		start: 'Start syncing',
		apply: 'Apply',
		later: 'Later',
		cancel: 'Cancel',
		waitingForDevices: 'Waiting for your other devices – keep in-browser open on one of them …',
		unreadable: 'The folder on your computer can’t be read right now. Allow access again first.'
	},

	/** New folders held back before they arrive (large or not fitting) */
	held: {
		waiting: (name: string, size: string) => `New folder “${name}” (${size}) waits for your confirmation.`,
		why: (limit: string) => `It is larger than ${limit}.`,
		full: 'It doesn’t fit into the browser’s free storage.',
		sync: 'Sync',
		exclude: 'Exclude',
		limit: 'Change the limit'
	},

	scope: {
		empty: 'No folders yet.',
		asking: 'Asking your other devices …',
		failed: (error: string) => `The folders could not be read: ${error}`,
		title: 'Choose folders',
		hint: 'Folders you deselect stay on the other devices and keep syncing there – only this device doesn’t get them.',
		always: 'Always synced (tool data)',
		onlyOn: (devices: string) => `only on ${devices}`,
		excludeTitle: (name: string) => `Stop syncing “${name}” on this device?`,
		excludeMessage: 'The copy on this device is deleted – the folder stays on your other devices, and here you open it live from one of them (it needs to be connected).',
		exclude: 'Don’t sync on this device',
		include: 'Sync again on this device',
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
			`Nothing is deleted – neither here nor in “${folder}”. Syncing just stops; you can choose a folder again at any time.`,
		lastSync: (time: string) => `Last synced ${time}`,
		failed: (n: number) => (n === 1 ? '1 file could not be synced.' : `${n} files could not be synced.`),
		confirmDeletes: (n: number) => `${n} files were deleted in the folder on your computer. Delete them here as well?`,
		applyDeletes: 'Delete here too',
		restoreInstead: 'Restore them instead',
		chooseFolders: 'Choose folders …',
		setup: 'Waiting for your choice: nothing is synced until you have chosen the folders.',
		runsWhileOpen: 'Syncing runs while any in-browser tool is open in this browser.'
	},

	/** The trash: what the user deleted, on every device (a special folder at the end of the panel “Folders”) */
	trash: {
		title: 'Trash',
		intro: 'What you delete lands here first – on all your devices, so you can get it back on any of them.',
		elsewhere: 'In the synced folder on your computer and with a p2p-node it is the hidden folder “.in-browser-trash”.',
		/** Deleted here by a sync because it was deleted elsewhere past the trash (an earlier version of this device) */
		localOnly: 'only on this device',
		summary: (n: number, size: string) => (n === 1 ? `1 item, ${size}` : `${n} items, ${size}`),
		nothing: 'The trash is empty.',
		kept: (days: number | null) => (days === null ? 'Items stay until you empty the trash.' : `Items stay ${days} days, then they are removed for good.`),
		changeKept: 'Change in the settings',
		from: (folder: string) => `from ${folder}`,
		when: (time: string, size: string) => `deleted ${time} · ${size}`,
		restore: 'Restore',
		restored: (path: string) => `Restored as “${path}”.`,
		restoredMany: (n: number) => `${n} items restored.`,
		picked: (n: number) => (n === 0 ? 'Select items to restore or delete them' : n === 1 ? '1 selected' : `${n} selected`),
		remove: 'Delete for good',
		removeTitle: 'Delete for good?',
		removeMessage: (name: string) => `“${name}” cannot be restored afterwards – on none of your devices.`,
		removeMessageMany: (n: number) => `${n} items cannot be restored afterwards – on none of your devices.`,
		empty: 'Empty trash',
		emptyTitle: 'Empty the trash?',
		emptyMessage: (n: number) => (n === 1 ? '1 item is deleted for good, on all your devices.' : `${n} items are deleted for good, on all your devices.`),
		more: (n: number) => `${n} more – restore or delete some first.`,
		close: 'Close'
	},

	/** “Earlier versions …” of a file: what a sync replaced or deleted on this device */
	versions: {
		action: 'Earlier versions …',
		tip: 'What a sync replaced on this device – restore one as a copy',
		title: (name: string) => `Earlier versions of “${name}”`,
		intro: 'When a sync replaces or deletes this file because it changed on another device or in the synced folder, the version that was here is kept – on this device only.',
		none: 'No earlier versions on this device.',
		/** Date of the version itself is shown above; this is when the sync took it away */
		replaced: (time: string) => `replaced ${time}`,
		deleted: (time: string) => `deleted ${time}`,
		restore: 'Restore',
		restored: (path: string) => `Restored as “${path}”.`,
		open: 'Open'
	},

	/** Help window and the page `/help/files` (topics in help.en.ts) */
	help
};

export default en;
