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
		selectAll: 'Select all',
		moveTo: 'Move to …',
		moveHere: 'Move here',
		more: (name: string) => `Actions for “${name}”`,
		selection: 'Actions for the selection',
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
		hint: 'Double-click opens, right-click shows all actions. Drag items onto a folder to move them, hold Ctrl to copy.'
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
		zipping: 'Preparing the ZIP file …'
	},

	storage: {
		used: (used: string, quota: string) => `${used} of ${quota} used`
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
		title: 'Sync',
		open: 'Open sync settings',
		off: 'Not set up',
		devices: (online: number, total: number) => `${online} of ${total} devices connected`,
		alone: 'Waiting for a second device',
		waiting: 'Waiting for your devices',
		removed: 'Removed from your devices',
		folder: (name: string) => `Folder “${name}”`,
		folderPaused: 'Folder paused'
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
		never: 'not seen yet',
		unreachable: 'Online, but can’t be reached. The network probably blocks direct connections (e.g. mobile data or a company network).',
		outdated: 'Needs an update: open in-browser there and reload the page.',
		lastSync: (ago: string) => `last synced ${ago}`,
		upToDate: 'up to date',
		probablyBehind: (changes: string, ago: string) => `Probably not up to date: ${changes} since the last sync ${ago}.`,
		changes: (n: number, more: boolean) => (more ? `more than ${n} changes` : n === 1 ? '1 change' : `${n} changes`),
		waiting: 'Waiting for your other devices. Open in-browser on one of them.',
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

	join: {
		title: 'Connect this device',
		keyLabel: 'Key',
		keyPlaceholder: 'XXXX-XXXX-XXXX-XXXX-XXXX',
		invalidKey: 'That is not a valid key (20 characters).',
		confirm: 'Connect this device with your devices? All files will be synced with the other devices.',
		connecting: 'Connecting … keep in-browser open on the device that shows the key.',
		timeout: 'No answer. Is in-browser open on the other device, and is the key still valid?',
		done: 'Connected.'
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
			['Transport', 'WebRTC data channels (SCTP over DTLS), directly between the devices, each with each. STUN via stun.cloudflare.com, no TURN – so strict NATs (symmetric NAT, CGNAT on mobile networks) often prevent a connection. A p2p-node uses the fixed UDP ports 29400–29449 and has the router forward them (UPnP), so it is reachable from anywhere.'],
			['Signaling', 'Trystero over public Nostr relays. They see IP addresses, timing and a hash of the room; offers and ICE candidates are encrypted with a key derived from the room secret. Every removal brings a new room secret.'],
			['Identity', 'Ed25519 key pair per device (WebCrypto, not extractable, IndexedDB). The device ID is the fingerprint of the public key. Signing in signs a nonce together with the DTLS fingerprints of the connection, so no relay can sit in between.'],
			['Members', 'Hash-chained log of signed entries (create, add, remove, rename), merged on every contact. A removal beats concurrent entries of the removed device; mutual concurrent removals remove both. A device that was offline learns about a removal from any member – if it meets the removed device first, that one can still sync with it until then.'],
			['One-time key', '100 bits, valid once and for 24 hours, only while the issuing device is online. Proven by HMAC over the DTLS fingerprints in both directions.'],
			['Sync', 'Three-way comparison per pair of devices against the stored state of the last sync; the device with the smaller ID drives. Newer wins, the other version becomes a conflict copy; SHA-256 avoids needless transfers; many deletions at once wait for confirmation (on either device). Right before overwriting or deleting, the state is compared with the one planned on – what changed meanwhile is left alone. Deletions and replacements from other devices are applied (like Syncthing); what you delete goes into the trash folder, which syncs like any other. Renames in upper/lower case only stay renames. Folder choice = intersection of both devices, never causes deletions.'],
			['Knowledge', 'Change log with running numbers per device and version vectors: the basis of the hints on devices that are probably not up to date, also when they got changes indirectly.'],
			['Storage', 'Files in the OPFS (persistence requested); keys, member log, sync state and vectors in IndexedDB.'],
			['Limits', 'Runs only in an open tab, on phones only in the foreground. What a removed device already has, it keeps. A p2p-node lifts the first limit: a Node process (WebRTC via werift) that joins as a device and keeps the files in a folder on disk.']
		] as [string, string][],
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

	scope: {
		empty: 'No folders yet.',
		title: 'Choose folders',
		hint: 'Folders you deselect stay on the other devices and keep syncing there – only this device doesn’t get them.',
		always: 'Always synced (tool data)',
		onlyOn: (devices: string) => `only on ${devices}`,
		excludeTitle: (name: string) => `Stop syncing “${name}” on this device?`,
		excludeMessage: 'The other devices keep it. You can keep the copy on this device or delete it here – that doesn’t affect the other devices.',
		keepCopy: 'Keep copy here',
		deleteCopy: 'Delete here',
		exclude: 'Don’t sync on this device',
		include: 'Sync again on this device',
		excluded: 'Not synced on this device'
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
	},

	/** The trash: what the user deleted, on every device (sidebar, menu at the tool name) */
	trash: {
		title: 'Trash',
		intro: 'What you delete lands here first – on all your devices, so you can get it back on any of them.',
		elsewhere: 'In a connected folder on your computer and with a p2p-node it is the hidden folder “.in-browser-trash”.',
		summary: (n: number, size: string) => (n === 1 ? `1 item, ${size}` : `${n} items, ${size}`),
		nothing: 'The trash is empty.',
		keep: 'Keep for',
		days: (n: number) => (n === 1 ? '1 day' : `${n} days`),
		forever: 'Until I empty it',
		keepHint: 'Applies to all your devices.',
		from: (folder: string) => `from ${folder}`,
		when: (time: string, size: string) => `deleted ${time} · ${size}`,
		restore: 'Restore',
		restored: (path: string) => `Restored as “${path}”.`,
		remove: 'Delete for good',
		removeTitle: 'Delete for good?',
		removeMessage: (name: string) => `“${name}” cannot be restored afterwards – on none of your devices.`,
		empty: 'Empty trash',
		emptyTitle: 'Empty the trash?',
		emptyMessage: (n: number) => (n === 1 ? '1 item is deleted for good, on all your devices.' : `${n} items are deleted for good, on all your devices.`),
		more: (n: number) => `${n} more – restore or delete some first.`,
		close: 'Close'
	}
};

export default en;
