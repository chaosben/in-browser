// Help texts of Files (English leads; `help.de.ts` must have the same keys): the help window of the tool and the
// page `/help/files`. Describe what users see and do: what each option means, what it costs and how to decide.

import type { HelpContent } from '@in-browser/brand/help.js';

const help = {
	start: {
		title: 'Getting started',
		items: {
			what: {
				title: 'What Files is',
				text: 'Every in-browser tool keeps its documents in one shared storage inside this browser: recordings and projects of Screen Capture, texts of the Text Editor, PDFs. Files shows that storage like a drive. Here you upload and download, sort documents into folders, rename, copy and delete them – and set up syncing with a folder on your computer or with your other devices. Nothing is uploaded to a server.',
				link: { href: '/help/storage', label: 'Where your files are kept' }
			},
			layout: {
				title: 'Layout',
				text: 'The top bar shows the path of the open folder – click a level to go back to it. Below it lies the ribbon: “Undo” on the left, then the tabs “Home” (new and “Upload”, clipboard, organize, select, find), “Share” (share with a guest, download), “Connect” (connect a folder on your computer, allow access, disconnect), “Sync” (sync now, sync settings, devices) and “View” (list or tiles, sort, panels, refresh). While entries are selected, the tab “Selection”, set off in color, holds what you can do with them (in the trash: the tab “Trash”); the ribbon switches to it by itself and back to the tab before when nothing is selected anymore. On the left edge a narrow bar holds the side panels “Folders” (open at the start: My files as a tree, below it your connected folders, at the end the trash) and “Shares”; click one to open it next to the list, click it again to close it, and drag its right edge to make it wider. Middle: the content of the open folder. The bottom line counts the items of the folder, shows a running upload, how much storage is used and how many items are selected; at its right end the sync symbol shows the state of syncing, as in every tool.'
			},
			ribbon: {
				title: 'Ribbon display',
				text: 'When the window gets narrower, the groups on the right get smaller first: their buttons lose the text below the icon, then their text altogether, and at last a whole group becomes one button that opens it. The button with the bar icon at the right end of the tabs chooses how the ribbon is shown – for every in-browser tool on this device. The arrow next to it collapses the ribbon: only the tabs stay, and a click on a tab opens its commands over the page until you pick one; a double click on a tab or Ctrl+F1 do the same, and the arrow brings the ribbon back as it was.',
				options: {
					classic: { label: 'Classic (default on a computer)', text: 'Commands in three rows with their names, in groups with a name each. Easiest to find things, takes about 130 pixels of height.' },
					simplified: { label: 'Simplified', text: 'One compact row of buttons, without group names. Leaves more room for the list.' },
					minimal: { label: 'Minimal (default on phones and tablets)', text: 'One row of icons without text; hold the pointer over an icon – or press and hold it – to see its name. Least height with every command in reach.' }
				},
				tip: 'Start with Classic until you know where things are, then switch to Simplified or Minimal – or collapse the ribbon – to see more of the list.',
				keys: [['Ctrl', 'F1']]
			},
			accessKeys: {
				title: 'Access keys',
				text: 'Press and release Alt (or press F10): letters appear on the tabs and a number on “Undo”. Type a tab’s letter, then the letter shown on a command to run it – everything works without the mouse. Esc goes back one step.',
				keys: [['Alt'], ['F10']]
			},
			menus: {
				title: 'Where the actions are',
				text: 'Right-clicking an entry shows everything you can do with it or with the selection; right-clicking the free area shows what you can add to the open folder (new, upload, paste), “Select all”, “Refresh” and the sorting. Folders in the panel “Folders” have the same menu as in the list – that is where you rename, move, delete or look up the properties of the open folder itself; “My files” there has its own (open, paste, download, properties). The ribbon holds the rest; its commands act on the selection, those that also work without one (“Download”, “Share …”) on the open folder. What can’t be done right now – e.g. changing anything in a shared folder you may only view – stays in the menus, greyed out.'
			},
			phone: {
				title: 'On a phone',
				text: 'On a phone or tablet the ribbon starts as “Minimal”: the tabs in one row, below it the tab’s commands as icons that scroll sideways; press and hold an icon to see its name. The arrow at the right of the tabs collapses the ribbon when you need the height. The side panels open over the whole screen from “View” → “Panels” and close after you tap a folder. You move through folders by tapping them and go back via the path in the top bar; the search is in the tab “Home”. Instead of right-clicking you press and hold an entry or tap its ⋮ button – also in the panels.'
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
				text: 'Double-click an entry, or select it and press Enter. A folder opens in Files. A document of a tool (e.g. a Screen Capture project or a text file) opens in that tool – if several tools can open it, the menu of the entry offers “Open with …” for each. Other files open in the preview. Some of them can also be edited as text: the menu of an SVG image offers “Open with Text Editor”, while a double-click shows the picture. On touch screens a tap opens. To keep this folder in view, open an entry in a new browser tab: click it with the middle mouse button (the wheel), or middle-click “Open” or “Open with …” in its menu – a folder opens in Files there, a document in its tool. This also works for folders in the panel “Folders” and for the trash.'
			},
			select: {
				title: 'Selecting',
				text: 'A click selects one entry. With Ctrl held (Cmd on a Mac) a click adds an entry to the selection or removes it; with Shift held it selects everything between the last clicked entry and this one. The arrow keys move the selection, with Shift held they extend it. “Select all” and “Clear selection” are in the “Home” tab, in the “Selection” tab and in the menus; Esc or a click on the free area clears the selection too. The bottom line counts what is selected; commands of the ribbon act on the selection, those that work without one (“Download”, “Share …”) on the open folder.'
			},
			touch: {
				title: 'Selecting on a touch screen',
				text: 'Press and hold an entry: the selection mode starts, the entry gets a check mark and its menu opens. Every further tap then selects or deselects an entry instead of opening it, and the ribbon switches to the tab “Selection” with everything you can do with the selected entries – among them “Select all” and “Clear selection”, which ends the mode. It also ends when you deselect the last entry. The ⋮ button of an entry opens the menu for the selection too.'
			},
			preview: {
				title: 'Preview',
				text: '“Preview” in the menu of a file or in the “Selection” tab (or the Space key) shows pictures, videos, audio and text right in Files, without opening a tool. Text files larger than about 1 MB are not shown; for other kinds there is no preview. “Download” in the preview saves the file.'
			},
			properties: {
				title: 'Properties',
				text: '“Properties” in the menu of an entry or in the “Selection” tab shows its type, location, size and the time of the last change. For a folder it adds up the size of everything inside and counts the files and folders it contains – for the open folder use its menu in the panel “Folders”.'
			},
		}
	},
	transfer: {
		title: 'Upload and download',
		items: {
			upload: {
				title: 'Uploading',
				text: '“Upload” (“Home” tab, group “New”) copies files from your computer or phone into the open folder – “Upload files” for single files, “Upload folder” for a whole folder with its subfolders (not offered on iPhone and iPad). You can also drag files or folders from your computer onto the list: dropped on the free area they land in the open folder, dropped on a folder in the list or in the panel “Folders” they land there. The bottom line shows which file is being copied. “Upload” only means copying into the browser storage – nothing leaves your device.'
			},
			download: {
				title: 'Downloading',
				text: '“Download” in the menu of a file saves it as it is. Folders, tool projects and several selected entries are saved as one ZIP file (“Download as ZIP”); the ZIP is put together while it is saved, so even large folders work. Chrome and Edge ask where to save it, other browsers save it to the download folder. “Download” in the “Share” tab saves the selection – or, with nothing selected, the whole open folder as ZIP.',
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
				text: '“New folder” and “New text file” (“Home” tab or right-click on the free area) create the entry in the open folder and let you type its name right away. A new text file is empty; opening it takes you to the Text Editor.'
			},
			rename: {
				title: 'Renaming',
				text: '“Rename” in the menu of an entry or in the ribbon (or F2) turns the name into a field; the part before the extension is selected, so the type stays. A click on the name of the entry that is already the only one selected does the same after a moment (a double click still opens it). The open folder itself is renamed in the list of the folder above it or with “Rename” in its menu in the panel “Folders” – not at the path in the top bar. Enter or clicking elsewhere keeps the new name, Esc cancels. Names that aren’t allowed (e.g. with “/”) are refused with a message.'
			},
			move: {
				title: 'Moving and copying',
				text: 'Drag entries onto a folder in the list or in the panel “Folders” to move them there; hold Ctrl (Cmd or Alt on a Mac) while dropping to copy them instead. Without dragging: “Cut” or “Copy”, then “Paste” in the target folder (“Home” tab or right-click on the free area) or “Paste” in the menu of a folder. “Move to …” lets you pick the target folder in a dialog – the easiest way on a phone. “Duplicate” makes a copy in the same folder. Cut entries look faded until you paste them.',
				tip: 'Move when the document should only be in the new place. Copy or duplicate when you want to change one version and keep the other – the copy is a separate document from then on, changes to one don’t reach the other.'
			},
			undo: {
				title: 'Undo',
				text: 'After renaming, moving, pasting, duplicating or deleting, a message says what happened and offers “Undo” for a few seconds: it renames or moves the entries back, puts the copies into the trash or takes deleted entries out of it again. “Undo” at the left end of the ribbon (or Ctrl+Z) does the same for the last such step, also after the message is gone. Deleting for good in a connected folder can’t be undone.',
				keys: [['Ctrl', 'Z']]
			},
			search: {
				title: 'Searching',
				text: 'The search field in the “Home” tab (group “Find”) filters the open folder while you type: an entry stays when every word you typed occurs in its name. It doesn’t search subfolders or the content of files. When nothing matches, the list says so.'
			},
			view: {
				title: 'Sorting and view',
				text: '“List” and “Tiles” in the “View” tab switch the view: “List” shows name, type, size and the time of the last change in columns, “Tiles” large icons, good for many pictures. The choice is remembered. “Sort by” (“View” tab or right-click on the free area) sorts by name, type, size or date, ascending or descending; the current choice has a check mark. In the list a click on a column heading sorts by it, a second click reverses the order. Folders always come first.',
				options: {
					name: { label: 'Name (default)', text: 'Alphabetically, numbers in their natural order (“2” before “10”).' },
					kind: { label: 'Type', text: 'By extension or tool, so documents of one kind stand together.' },
					size: { label: 'Size', text: 'Largest first when you choose it – to find what takes room.' },
					modified: { label: 'Modified', text: 'Newest first when you choose it – to find what you worked on last.' }
				}
			},
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
				text: 'The trash is a special folder at the end of the panel “Folders” (on phones: “View” tab → “Folders”). Click it and it shows what was deleted – here or on another device – like a folder: as a list or as tiles (“View” tab), sorted and searched the same way, with the columns “Original location” and “Deleted”; the tab “Trash” of the ribbon holds what you can do with it. You can also drag entries onto it to delete them.'
			},
			restore: {
				title: 'Restoring',
				text: 'Select entries in the trash like in a folder – a click, Ctrl+click, Shift+click, Ctrl+A; on a touch screen a tap selects or deselects – then click “Restore” in the tab “Trash” (or in the menu of an entry, or press Enter): they go back to their old folders, and a message tells you where one ended up. If a name is taken in the meantime, the entry gets a number instead of overwriting anything.'
			},
			remove: {
				title: 'Deleting for good',
				text: '“Delete for good” (or Del) removes the selected entries, “Empty trash” all of them – each after a question, on all your devices. Only then is their storage space free. “Empty trash” stays greyed out while the trash is empty.'
			},
			keep: {
				title: 'How long it keeps',
				text: 'The trash names how long entries stay (30 days unless you change it). “Change in the settings” opens “Settings” → “Trash”, where you choose it for all your devices – also with the gear at the top right.',
				link: { href: '/help/settings#trash', label: 'Choosing how long' }
			},
			elsewhere: {
				title: 'Trash in the folder on your computer',
				text: 'In the synced folder on your computer and on a p2p-node, the trash is the hidden folder “.in-browser-trash”. Files there are removed after the same time.'
			}
		}
	},
	connected: {
		title: 'Connected folders',
		items: {
			connect: {
				title: 'Connecting a folder or server',
				text: '“Connect …” (“Connect” tab, or in the panel “Folders” below My files) asks what to connect: “Folder on this computer …” lets you choose a folder, and the browser asks whether in-browser may view and edit it (only Chrome and Edge on a computer); “WebDAV server …” and “S3 storage …” ask for the address and sign-in data and work in every browser. The connection appears in the panel “Folders” below My files with its name and opens live: you see and change the files right there, nothing is copied into the browser storage and nothing is synced.',
				tip: 'Connect a folder to work on files where they are (e.g. a project folder of another program). Want a copy of My files on your computer instead? Use “Folder on your computer” in the sync settings.',
				link: { href: '/help/connected', label: 'Connected folders' }
			},
			use: {
				title: 'Working in it',
				text: 'Everything works as in My files: opening, preview, uploading, downloading, renaming, moving and copying – also between My files and a connected folder (dragging from one to the other copies, as between drives). The bottom line shows “Live from …” instead of the storage use (for a folder shared with you: “Shared by … – a copy on this device”). Notebooks and projects open right there in their tool.'
			},
			access: {
				title: '“Allow access”',
				text: 'After a restart the browser usually asks again for access. The folder then shows “Allow access” in the panel “Folders” and when you open it; click it and confirm the browser’s question. Messages about a failed action in such a folder carry “Allow access” too.',
				tip: 'Choose “Allow on every visit” – then it stays connected.'
			},
			manage: {
				title: 'Editing and disconnecting',
				text: 'A connected folder is shown with the name of the folder on your computer, a server with the name you gave it. “Edit …” in the menu of a server changes its name, address and sign-in data (the password field stays empty to keep the stored one); when a server refuses the sign-in data, messages offer “Change sign-in data”. “Disconnect” – in the “Connect” tab while the folder is open, or in its menu in the panel “Folders” (right-click, on touch screens its ⋮ button) – removes it from in-browser. Nothing in the folder is deleted.'
			},
			delete: {
				title: 'Deleting in a connected folder',
				text: 'A connected folder or server has no trash of in-browser: “Delete” asks “Delete for good?” first and then deletes right away.'
			},
			share: {
				title: 'Sharing with a guest',
				text: '“Share …” in the “Share” tab shares the selected file or folder, or else the open folder (in My files; otherwise it asks which folder) – also in the menu of a file or folder, and “Share a folder …” in the panel “Shares”. It makes a link and QR code for one browser outside your devices – e.g. a friend’s computer you are visiting – and on request four words to type there. The guest gets only what you shared, as a copy in their browser that is kept in sync with this device and deleted when the share ends; a single file opens there in its tool. Choose “View only” (default) or “Edit” and how long it lasts (a day by default). Your shares appear in the panel “Shares” (green dot: guest connected); a click shows the link again, right-click (or ⋮) offers “End share”.',
				tip: '“View only” to hand over files; “Edit” when the guest should save or upload into the folder. Keep in-browser open here while they use it.',
				link: { href: '/help/connected#share', label: 'Sharing with a guest' }
			},
			guest: {
				title: 'Opening a share',
				text: 'A link someone shared with you opens Files with the folder in the panel “Folders” below My files, named after it and who shares it – the name from their settings, else their device’s (a lock means view only); a single shared file opens right away in its tool. Without the link: “Connect …” (below My files in the panel “Folders”, or the tab “Connect”) → “A share by four words …” asks for the four words the sharing device shows. Your browser remembers the share until it ends, runs out or you choose “Disconnect”; until then it lies as a synced copy in this browser. If another browser is in it right now, Files says so and tries again by itself. Copy files into My files to keep them. When the share ends, Files says so at once; “Remove” takes it out of the panel.',
				link: { href: '/help/connected#share', label: 'Four words instead of the link' }
			},
		}
	},
	folder: {
		title: 'Folder on your computer',
		items: {
			connect: {
				title: 'Syncing with a folder',
				text: '“Sync settings” in the “Sync” tab opens the sync settings; under “Folder on your computer” click “Choose folder” and pick a folder. “Choose folders for …” opens first: each folder with what would come into the browser and what would go into the folder; nothing is copied until “Start syncing” (“Later” keeps it waiting). Later, “Choose folders …” there changes the choice – a deselected folder stays in My files and in the folder on your computer, it just isn’t synced anymore. From then on Files keeps the browser storage and that folder in sync in both directions; when a file was changed on both sides, the newer version wins. Syncing runs while any in-browser tool is open in this browser. Only Chrome and Edge on a desktop computer can do this.',
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
				text: '“Sync now” (in the sync settings, or in the “Sync” tab for the folder and your devices at once) syncs right away instead of waiting for the next change. If single files can’t be synced, a line says how many. “Disconnect” ends syncing with the folder; nothing is deleted, neither in Files nor in the folder, and you can choose a folder again at any time.'
			},
		}
	},
	devices: {
		title: 'Your devices',
		items: {
			where: {
				title: 'Where to find it',
				text: 'The “Sync” tab holds “Sync now”, “Sync settings” (with “Your devices” at the top), “Add device”, “Choose folders” and “Sync on this device”. In every tool the sync symbol at the right end of the bottom line shows the state and a warning symbol when something needs you; its menu leads here with “Manage devices”.',
				link: { href: '/help/sync', label: 'Syncing your devices' }
			},
			first: {
				title: 'Connecting the first devices',
				text: 'On the first device click “Connect devices”: a short explanation, then a name for this device (so you can tell them apart), then “Add device” shows a key as QR code. On the second device either scan the code with the camera, open the link from “Copy link”, or open Files there and type the key under “Enter key”. Keep Files open on the first device until the second one is added. The second device then shows “Choose what this device syncs”: untick what it shouldn’t get and choose “Start syncing” – nothing is transferred before.',
				link: { href: '/help/sync#connect', label: 'Pairing devices' }
			},
			held: {
				title: 'New folders waiting',
				text: 'A new folder that is larger than the size in the settings, or doesn’t fit into the browser’s free storage, waits instead of arriving: the sync settings show it with its size, under “Your devices” or “Folder on your computer”. “Sync” brings it here after all, “Exclude” leaves it out; “Change the limit” opens the settings.',
				link: { href: '/help/sync#changes', label: 'Large new folders wait' }
			},
			add: {
				title: 'Adding more devices',
				text: '“Add device” (“Sync” tab or the sync settings) on any connected device shows a new key. It works once, for 24 hours, and only while the device that shows it is online. Whoever has it can connect a device and read and change all your synced files – share it only with yourself.'
			},
			status: {
				title: 'Status of the devices',
				text: 'The list shows this device (click its name to rename it) and every other one: connected, syncing, when it was last seen or synced. Hints in warning color say when a device is probably not up to date, can’t be reached (often mobile data or a company network) or needs an update. Syncing happens while at least two devices have in-browser open; “Sync now” starts it right away.',
				link: { href: '/help/sync', label: 'When devices don’t sync' }
			},
			folders: {
				title: 'Leaving out folders',
				text: '“Choose folders” (“Sync” tab) shows all folders with their size and where they are; untick one to stop syncing it on this device. For a single folder: select it (or open it) and switch off “Sync on this device” in the “Sync” tab – the same as “Don’t sync on this device” in the menu of a folder; back with “Sync again on this device”. The copy on this device is deleted, the other devices keep the folder. It stays in the tree with a cloud: opening it reads it live from a device that has it, and you can work in it like anywhere else (deleting goes into that device’s trash). If none of them is connected, Files names where the folder is.',
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
			focus: {
				title: 'When they work',
				text: 'The keys for the list work while the list has the focus – after a click on an entry or the free area, or after going to a folder. On a button, a menu entry or in a field Enter and Space press that instead, and while you type or a dialog is open no shortcut applies. Menus and tooltips name the key of each command.'
			},
			move: {
				title: 'Moving through the list',
				text: 'The arrow keys select the previous or next entry; with Shift held they extend the selection from where it started.',
				keys: [['↑'], ['↓'], ['Shift', '↓']]
			},
			open: { title: 'Open', text: 'Opens the selected entry: a folder in Files, a document in its tool, other files in the preview.', keys: [['Enter']] },
			newTab: { title: 'Open in new tab', text: 'Click an entry or a folder in the panel “Folders” with the middle mouse button.' },
			up: { title: 'Up one folder', text: 'Goes to the folder that contains the open one.', keys: [['Backspace'], ['Alt', '↑']] },
			preview: { title: 'Preview', text: 'Shows the selected file in the preview.', keys: [['Space']] },
			selectAll: { title: 'Select all and clear', text: 'Selects every entry of the open folder; Esc clears the selection.', keys: [['Ctrl', 'A'], ['Esc']] },
			clipboard: { title: 'Copy, cut, paste', text: 'Copy or cut the selection, then paste it into the open folder. On a Mac use Cmd instead of Ctrl.', keys: [['Ctrl', 'C'], ['Ctrl', 'X'], ['Ctrl', 'V']] },
			rename: { title: 'Rename', text: 'Renames the selected entry; Enter keeps the new name, Esc cancels.', keys: [['F2']] },
			delete: { title: 'Delete', text: 'Moves the selection into the trash.', keys: [['Del']] },
			undo: { title: 'Undo', text: 'Takes back the last renaming, moving, pasting, duplicating or deleting.', keys: [['Ctrl', 'Z']] },
			ribbon: { title: 'Ribbon', text: 'Ctrl+F1 shows or hides the ribbon’s commands; Alt or F10 show the access keys.', keys: [['Ctrl', 'F1'], ['Alt'], ['F10']] }
		}
	}
} satisfies HelpContent;

export default help;
