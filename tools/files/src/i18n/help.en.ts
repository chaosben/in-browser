// Help texts of Files (English leads; `help.de.ts` must have the same keys): the help window of the tool and the
// page `/help/files`. Describe what users see and do: what each option means, what it costs and how to decide.

import type { HelpContent } from '@in-browser/brand/help.js';

const help = {
	start: {
		title: 'Getting started',
		items: {
			what: {
				title: 'What Files is',
				text: 'Every in-browser tool keeps its documents in one shared storage inside this browser: recordings and projects of Screen Capture, texts of the Text Editor, notes. Files shows that storage like a drive. Here you upload and download, sort documents into folders, rename, copy and delete them – and set up syncing with a folder on your computer or with your other devices. Nothing is uploaded to a server.',
				link: { href: '/help/storage', label: 'Where your files are kept' }
			},
			layout: {
				title: 'Layout',
				text: 'Left: the folder tree, starting with “My files”; below it “Connected” with folders on your computer you opened live, then “Trash” and “Sync” with a short status. Middle: the content of the open folder. The top bar shows the path of the open folder – click a level to go back to it – followed by “Upload” and “New folder”; on the right the search and the switch between “List” and “Tiles”. The bottom line counts the items of the folder and the selected ones, shows a running upload and how much storage is used. At its right end the sync symbol shows the state of syncing, as in every tool.'
			},
			menus: {
				title: 'Where the actions are',
				text: 'The name of the open folder in the top bar (at the top level: “Files” next to “in-browser”) opens the menu of that folder: “New folder”, “New text file”, uploading, “Paste”, “Select all”, the view, “Download as ZIP”, “Properties” and “Trash”. It always holds the complete list, also what the buttons next to it do. Right-clicking an entry shows everything you can do with it or with the selection; right-clicking the free area shows the actions for the folder. Folders in the tree on the left have the same menu as in the list.'
			},
			phone: {
				title: 'On a phone',
				text: 'On narrow screens the folder tree is hidden: you move through folders by tapping them and go back via the path in the top bar. “Upload” and “New folder” are in the menu at the folder name, “Trash” too. The sync symbol in the top bar opens the sync settings, the magnifier the search. Instead of right-clicking you press and hold an entry or tap its ⋮ button.'
			},
			storage: {
				title: 'Storage space',
				text: 'The bottom line shows how much of the browser storage is used, of how much the browser allows (on wide screens). Large media files take the most room. Deleted items stay in the trash and keep using space until they expire or you empty the trash.',
				link: { href: '/help/storage', label: 'Storage space and backups' }
			}
		}
	},
	select: {
		title: 'Selecting and opening',
		items: {
			open: {
				title: 'Opening',
				text: 'Double-click an entry, or select it and press Enter. A folder opens in Files. A document of a tool (e.g. a Screen Capture project or a text file) opens in that tool – if several tools can open it, the menu of the entry offers “Open with …” for each. Other files open in the preview. Some of them can also be edited as text: the menu of an SVG image offers “Open with Text Editor”, while a double-click shows the picture. On touch screens a tap opens.'
			},
			select: {
				title: 'Selecting',
				text: 'A click selects one entry. With Ctrl held (Cmd on a Mac) a click adds an entry to the selection or removes it; with Shift held it selects everything between the last clicked entry and this one. “Select all” is in the menus, Esc or a click on the free area clears the selection. The bottom line counts what is selected.'
			},
			touch: {
				title: 'Selecting on a touch screen',
				text: 'Press and hold an entry: the selection mode starts, the entry gets a check mark and its menu opens. Every further tap then selects or deselects an entry instead of opening it. Meanwhile the top bar shows “Actions for the selection” (⋮) with everything you can do with the selected entries, and “Clear selection” (×), which ends the mode. It also ends when you deselect the last entry. “Select all” is in the menu of each entry.'
			},
			preview: {
				title: 'Preview',
				text: '“Preview” in the menu of a file (or the Space key) shows pictures, videos, audio and text right in Files, without opening a tool. Text files larger than about 1 MB are not shown; for other kinds there is no preview. “Download” in the preview saves the file.'
			},
			properties: {
				title: 'Properties',
				text: '“Properties” in the menu of an entry shows its type, location, size and the time of the last change. For a folder it adds up the size of everything inside and counts the files and folders it contains – the folder menu at the top shows this for the open folder.'
			}
		}
	},
	transfer: {
		title: 'Upload and download',
		items: {
			upload: {
				title: 'Uploading',
				text: '“Upload” copies files from your computer or phone into the open folder – “Upload files” for single files, “Upload folder” for a whole folder with its subfolders (not offered on iPhone and iPad). You can also drag files or folders from your computer onto the list: dropped on the free area they land in the open folder, dropped on a folder in the list or in the tree they land there. The bottom line shows which file is being copied. “Upload” only means copying into the browser storage – nothing leaves your device.'
			},
			download: {
				title: 'Downloading',
				text: '“Download” in the menu of a file saves it as it is. Folders, tool projects and several selected entries are saved as one ZIP file (“Download as ZIP”); the ZIP is put together while it is saved, so even large folders work. Chrome and Edge ask where to save it, other browsers save it to the download folder. “Download as ZIP” in the folder menu at the top saves the whole open folder.',
				tip: 'For a lasting backup of everything, a folder on your computer that stays in sync is more convenient than downloading by hand.',
				link: { href: '/help/storage', label: 'Backups and the folder on your computer' }
			},
			names: {
				title: 'Same names',
				text: 'Files never overwrites anything when uploading, pasting, moving or copying: if the target folder already has an entry with that name, the new one gets a number, e.g. “Photo (2).jpg”.'
			}
		}
	},
	organize: {
		title: 'Organizing',
		items: {
			create: {
				title: 'New folder and new text file',
				text: '“New folder” (top bar or folder menu) and “New text file” (folder menu or right-click on the free area) create the entry in the open folder and let you type its name right away. A new text file is empty; opening it takes you to the Text Editor.'
			},
			rename: {
				title: 'Renaming',
				text: '“Rename” in the menu of an entry (or F2) turns the name into a field; the part before the extension is selected, so the type stays. Enter or clicking elsewhere keeps the new name, Esc cancels. Names that aren’t allowed (e.g. with “/”) are refused with a message.'
			},
			move: {
				title: 'Moving and copying',
				text: 'Drag entries onto a folder in the list or in the folder tree to move them there; hold Ctrl (Cmd or Alt on a Mac) while dropping to copy them instead. Without dragging: “Cut” or “Copy” in the menu, then “Paste” in the target folder (folder menu or right-click on the free area) or “Paste” in the menu of a folder. “Move to …” lets you pick the target folder in a dialog – the easiest way on a phone. “Duplicate” makes a copy in the same folder. Cut entries look faded until you paste them.',
				tip: 'Move when the document should only be in the new place. Copy or duplicate when you want to change one version and keep the other – the copy is a separate document from then on, changes to one don’t reach the other.'
			},
			search: {
				title: 'Searching',
				text: 'The search field in the top bar (on phones the magnifier) filters the open folder while you type: an entry stays when every word you typed occurs in its name. It doesn’t search subfolders or the content of files. When nothing matches, the list says so.'
			},
			view: {
				title: 'Sorting and view',
				text: '“List” shows name, type, size and the time of the last change in columns – click a column heading to sort by it, click it again to reverse the order. Folders always come first. “Tiles” shows large icons, good for many pictures. The choice is remembered. On phones the view switch is in the folder menu.'
			}
		}
	},
	trash: {
		title: 'Trash',
		items: {
			delete: {
				title: 'Deleting',
				text: '“Delete” in the menu (or Del) moves the selected entries into the trash, without asking. A message offers “Undo” for a few seconds. With syncing set up, the entries disappear on your other devices as well and land in the trash there too – so you can get them back on any device.',
				link: { href: '/help/sync', label: 'Deleting and the trash with several devices' }
			},
			open: {
				title: 'Opening the trash',
				text: '“Trash” at the bottom of the sidebar, or in the folder menu at the top (on phones only there). It lists what was deleted – here or on another device – with the folder it came from, when it was deleted and its size.'
			},
			restore: {
				title: 'Restoring',
				text: '“Restore” puts an entry back in its old folder; a message tells you where it ended up. If that name is taken in the meantime, it gets a number instead of overwriting anything.'
			},
			remove: {
				title: 'Deleting for good',
				text: '“Delete for good” (bin with a cross next to an entry) and “Empty trash” remove entries for good, after a question – on all your devices. Only then is their storage space free.'
			},
			keep: {
				title: 'Keep for',
				text: 'How long deleted items stay in the trash before they are removed by themselves. The setting applies to all your devices.',
				options: {
					days7: { label: '7 days', text: 'Frees space soon; a mistake has to be noticed within a week.' },
					days30: { label: '30 days (default)', text: 'Enough time to notice a mistake, without filling the storage for long.' },
					days90: { label: '90 days', text: 'For documents you rarely look at; deleted media keep using space for a long time.' },
					forever: { label: 'Until I empty it', text: 'Nothing is removed by itself – you empty the trash yourself.' }
				},
				tip: 'Keep 30 days. Take 7 days if storage gets tight (large recordings), 90 days or “Until I empty it” if you work with documents you only check now and then.'
			},
			elsewhere: {
				title: 'Trash in the folder on your computer',
				text: 'In the synced folder on your computer and on a p2p-node, the trash is the hidden folder “.in-browser-trash”. Files there are removed according to the same setting.'
			}
		}
	},
	connected: {
		title: 'Connected folders',
		items: {
			connect: {
				title: 'Connecting a folder',
				text: '“Connect folder …” under “Connected” in the sidebar lets you choose a folder on your computer; the browser asks whether in-browser may view and edit it. The folder appears under “Connected” with its name and opens live: you see and change the files right there, nothing is copied into the browser storage and nothing is synced. Only Chrome and Edge on a computer can do this.',
				tip: 'Connect a folder to work on files where they are (e.g. a project folder of another program). Want a copy of My files on your computer instead? Use “Folder on your computer” in the sync settings.',
				link: { href: '/help/connected', label: 'Connected folders' }
			},
			use: {
				title: 'Working in it',
				text: 'Everything works as in My files: opening, preview, uploading, downloading, renaming, moving and copying – also between My files and a connected folder (dragging from one to the other copies, as between drives). The bottom line shows “Live from …” instead of the storage use. Notebooks and projects open right there in their tool.'
			},
			access: {
				title: '“Allow access”',
				text: 'After a restart the browser usually asks again for access. The folder then shows “Allow access” in the sidebar and when you open it; click it and confirm the browser’s question.',
				tip: 'Choose “Allow on every visit” – then it stays connected.'
			},
			manage: {
				title: 'Rename and disconnect',
				text: 'Right-click a connected folder in the sidebar, or open the menu at its name in the top bar: “Rename” changes only the name shown here (the folder keeps its name), “Disconnect” removes it from in-browser. Nothing in the folder is deleted.'
			},
			delete: {
				title: 'Deleting in a connected folder',
				text: 'A connected folder has no trash of in-browser: “Delete” asks “Delete for good?” first and then deletes right away.'
			},
			share: {
				title: 'Sharing a folder with a guest',
				text: '“Share a folder …” under “Shares” in the sidebar (or “Share …” in the menu of a folder in My files) makes a link and QR code for one browser outside your devices – e.g. a friend’s computer you are visiting. The guest sees only that folder, live from this device; nothing stays with them. Choose “View only” (default) or “Edit”. The link works until you end the share, for one browser at a time. Your shares appear under “Shares” (green dot: guest connected); a click shows the link again, right-click offers “End share”.',
				tip: '“View only” to hand over files; “Edit” when the guest should save or upload into the folder. Keep in-browser open here while they use it.',
				link: { href: '/help/connected#share', label: 'Sharing with a guest' }
			},
			guest: {
				title: 'Opening a shared link',
				text: 'A link someone shared with you opens Files with the folder under “Connected”, named after it and the device that shares it (a lock means view only). It lives only in this tab: “Disconnect” or closing the tab ends it, nothing of it stays in your browser; the link opens it again while the share lasts. If another browser is in it right now, Files says so and tries again by itself. Copy files into My files to keep them. When the share ends, Files says so at once; “Remove” takes it out of “Connected”.'
			}
		}
	},
	folder: {
		title: 'Folder on your computer',
		items: {
			connect: {
				title: 'Syncing with a folder',
				text: '“Sync” in the sidebar (on phones the sync symbol in the top bar) opens the sync settings; under “Folder on your computer” click “Choose folder” and pick a folder. From then on Files keeps the browser storage and that folder in sync in both directions; when a file was changed on both sides, the newer version wins. Syncing runs while any in-browser tool is open in this browser. Only Chrome and Edge on a desktop computer can do this.',
				tip: 'Choose an empty folder or one meant only for in-browser – everything in it becomes part of Files. A folder your sync tool (Syncthing, Nextcloud, Dropbox …) carries along gets your documents to other computers as well.',
				link: { href: '/help/storage', label: 'The folder on your computer' }
			},
			paused: {
				title: 'Paused: “Allow access”',
				text: 'The browser often grants access to the folder only until it is closed. Then the sync settings say “Paused” and Files changes nothing in the folder. Click “Allow access” and confirm in the browser’s question; syncing continues and catches up.',
				tip: 'Choose “Allow on every visit” in the browser’s question – then syncing continues by itself the next time.'
			},
			deletes: {
				title: 'Deletions in the folder',
				text: 'If many files disappear from the folder on your computer at once, Files doesn’t simply follow: the sync settings ask whether to delete them here as well. “Delete here too” deletes them in Files, “Restore them instead” writes them back into the folder.',
				tip: 'Restore them if you didn’t delete them on purpose – e.g. when a drive was missing or a sync tool emptied the folder. Delete them here too if you cleaned up the folder yourself.'
			},
			manage: {
				title: 'Sync now and disconnecting',
				text: '“Sync now” syncs right away instead of waiting for the next change. If single files can’t be synced, a line says how many. “Disconnect” ends syncing with the folder; nothing is deleted, neither in Files nor in the folder, and you can choose a folder again at any time.'
			}
		}
	},
	devices: {
		title: 'Your devices',
		items: {
			where: {
				title: 'Where to find it',
				text: '“Sync” in the sidebar (on phones the sync symbol in the top bar) opens the sync settings with “Your devices” at the top. Its entry in the sidebar shows how many devices are connected and shows a warning symbol when something needs you. In every tool the sync symbol at the right end of the bottom line shows the state; its menu leads here with “Manage devices”.',
				link: { href: '/help/sync', label: 'Syncing your devices' }
			},
			first: {
				title: 'Connecting the first devices',
				text: 'On the first device click “Connect devices”: a short explanation, then a name for this device (so you can tell them apart), then “Add device” shows a key as QR code. On the second device either scan the code with the camera, open the link from “Copy link”, or open Files there and type the key under “Enter key”. Keep Files open on the first device until the second one is added.',
				link: { href: '/help/sync', label: 'Pairing devices' }
			},
			add: {
				title: 'Adding more devices',
				text: '“Add device” on any connected device shows a new key. It works once, for 24 hours, and only while the device that shows it is online. Whoever has it can connect a device and read and change all your synced files – share it only with yourself.'
			},
			status: {
				title: 'Status of the devices',
				text: 'The list shows this device (click its name to rename it) and every other one: connected, syncing, when it was last seen or synced. Hints in warning color say when a device is probably not up to date, can’t be reached (often mobile data or a company network) or needs an update. Syncing happens while at least two devices have in-browser open; “Sync now” starts it right away.',
				link: { href: '/help/sync', label: 'When devices don’t sync' }
			},
			folders: {
				title: 'Leaving out folders',
				text: '“Choose folders” shows all folders with their size and where they are; untick one to stop syncing it on this device. The same is in the menu of a folder: “Don’t sync on this device”, and back with “Sync again on this device”. The copy on this device is deleted, the other devices keep the folder. It stays in the tree with a cloud: opening it reads it live from a device that has it, and you can work in it like anywhere else (deleting goes into that device’s trash). If none of them is connected, Files names where the folder is.',
				tip: 'Leave out what you rarely need here, e.g. large recordings on a phone – you can still open them live. Sync a folder again if you need it while your other devices are off.',
				link: { href: '/help/sync', label: 'Live from your devices' }
			},
			deletes: {
				title: 'Deletions from another device',
				text: 'If many files were deleted on another device at once, this device asks before following: “Delete here too” deletes them here. Until you confirm, they stay.'
			},
			remove: {
				title: 'Removing and disconnecting',
				text: 'The button next to another device removes it, after a question: it can no longer connect and gets nothing new, but keeps what it already has. “Disconnect this device” only stops syncing here; your files stay on all devices and you can connect it again later. A device that was removed says so and offers to start over, with or without its files.',
				link: { href: '/help/sync', label: 'Removing devices' }
			},
			explain: {
				title: 'How it works and diagnostics',
				text: 'The question mark next to “Your devices” opens “How it works”: “Simple” explains the principle, “For experts” the technology, and while devices are connected it shows the diagnostics – how each device is connected and which relays are reachable. “Copy diagnostics” copies them, e.g. for a bug report.'
			},
			log: {
				title: 'Troubleshooting',
				text: 'At the bottom of the sync settings, “Troubleshooting” can record a log of both syncs (devices and folder). Turn it on on every device involved, let the problem happen again, then “Export log” on each. The log stays on the device until you export it; it contains file and device names, so look through it before you pass it on. “Clear log” deletes it.'
			},
			node: {
				title: 'Syncing without an open browser',
				text: 'A p2p-node on a computer or home server joins your devices like another browser and stays online all the time – so changes reach your phone even when no other device has in-browser open.',
				link: { href: '/help/p2p-node', label: 'Setting up a p2p-node' }
			}
		}
	},
	keys: {
		title: 'Keyboard shortcuts',
		items: {
			move: {
				title: 'Moving through the list',
				text: 'The arrow keys select the previous or next entry; with Shift held they extend the selection. Shortcuts don’t apply while you type in a field or a dialog is open.',
				keys: [['↑'], ['↓'], ['Shift', '↓']]
			},
			open: { title: 'Open', text: 'Opens the selected entry: a folder in Files, a document in its tool, other files in the preview.', keys: [['Enter']] },
			up: { title: 'Up one folder', text: 'Goes to the folder that contains the open one.', keys: [['Backspace'], ['Alt', '↑']] },
			preview: { title: 'Preview', text: 'Shows the selected file in the preview.', keys: [['Space']] },
			selectAll: { title: 'Select all and clear', text: 'Selects every entry of the open folder; Esc clears the selection.', keys: [['Ctrl', 'A'], ['Esc']] },
			clipboard: { title: 'Copy, cut, paste', text: 'Copy or cut the selection, then paste it into the open folder. On a Mac use Cmd instead of Ctrl.', keys: [['Ctrl', 'C'], ['Ctrl', 'X'], ['Ctrl', 'V']] },
			rename: { title: 'Rename', text: 'Renames the selected entry; Enter keeps the new name, Esc cancels.', keys: [['F2']] },
			delete: { title: 'Delete', text: 'Moves the selection into the trash.', keys: [['Del']] }
		}
	}
} satisfies HelpContent;

export default help;
