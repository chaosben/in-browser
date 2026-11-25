// Help pages of the whole suite (`/help/…`), English leads; `help.de.ts` must have the same keys. The help of each
// tool comes from the tool (`@in-browser/<tool>/i18n/help.en.js`). Describe what users see and do, with the labels
// of the UI in quotes; no internals.

import { BRAND } from '@in-browser/brand/brand.js';
import type { HelpContent } from '@in-browser/brand/help.js';

/** CORS rule a bucket needs for the site (help page “Connected folders”) */
const s3Cors = JSON.stringify([{ AllowedOrigins: [BRAND.suiteUrl], AllowedMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'], AllowedHeaders: ['*'], ExposeHeaders: ['ETag'], MaxAgeSeconds: 3600 }]);

const install = {
	unix: `curl -fsSL ${BRAND.suiteUrl}/p2p-node/install.sh | sh`,
	windows: `irm ${BRAND.suiteUrl}/p2p-node/install.ps1 | iex`
};

const help = {
	title: 'Help',
	intro: 'How the in-browser tools work, where your files are kept and how your devices sync.',
	searchLabel: 'Search help',
	searchPlaceholder: 'Search all help …',
	noMatch: (query: string) => `Nothing in the help matches “${query}”.`,
	suite: 'Everything in-browser',
	tools: 'Tools',
	toolTitle: (tool: string) => `${tool} help`,
	toolSummary: (tool: string) => `Everything about ${tool}, step by step`,
	openTool: (tool: string) => `Open ${tool}`,
	contents: 'Contents',
	allHelp: 'All help',

	pages: {
		storage: {
			title: 'Your files and storage',
			summary: 'Where your files are kept, how much space they take and how to keep a copy',
			topics: {
				where: {
					title: 'Where your files are',
					items: {
						browser: {
							title: 'In your browser, not on a server',
							text: 'Every in-browser tool saves into one storage of your browser on this device. Nothing is uploaded – there is no server that could store your files. All tools share this storage: a PDF from the PDF Editor, a project from Screen Capture and a text from the Text Editor are all files there. Files shows and manages them, like the file manager of your computer.'
						},
						perBrowser: {
							title: 'One storage per browser',
							text: 'The storage belongs to this browser on this device. Another browser, another browser profile or a private window has its own, empty storage. Clearing the site data of this site, resetting or uninstalling the browser deletes it.',
							tip: 'Keep a copy elsewhere – in a folder on your computer or on your other devices – if your files matter to you.'
						},
						kept: {
							title: 'Kept permanently',
							text: 'When you first save something, in-browser asks the browser to keep its storage even when space runs low. Chrome and Edge decide by themselves (sooner for a site you use often or have installed), Firefox asks you. Safari deletes the data of sites you haven’t opened for seven days; added to the home screen (iPhone, iPad) or the Dock (Mac), a site keeps its data. As long as the browser hasn’t agreed and nothing syncs, the footer of Files says “The browser may clear this storage”.',
							tip: 'Don’t rely on the browser alone: sync with a folder on your computer or with another device. Then a cleared storage costs you nothing.'
						},
						tabs: {
							title: 'Several tabs',
							text: 'All tabs of this browser see the same files. Changes from another tab appear by themselves. A document that is open for editing in one tab may be locked in a second one – the tool then says so.'
						},
						connected: {
							title: 'Folders that stay on your computer',
							text: 'Besides My files, Files can open folders on your computer live (“Connected”). They take no space in the browser storage.',
							link: { href: '/help/connected', label: 'Connected folders' }
						}
					}
				},
				copy: {
					title: 'Keeping a copy',
					items: {
						folder: {
							title: 'Folder on your computer',
							text: 'In Files, choose “Folder on your computer” → “Choose folder”. Before anything is copied, “Choose folders” shows what would come here and what would go there; “Start syncing” begins. From then on the files are kept in sync with this real folder in both directions: the newer version wins, deletions in the folder are confirmed before they apply here. The sync runs while in-browser is open in this browser – the overview or any tool. After a restart the browser may ask again for access: the sync settings then say “Paused”, and “Allow access” continues. If the browser says no, a message offers “Choose folder again”: pick the same folder, and the sync goes on where it was – nothing is set up or compared anew. If it doesn’t answer at all, the message offers “Reload page”; after that “Allow access” lets you pick the folder anew. Don’t use “Disconnect” for this: choosing the folder after it starts the setup from the beginning. A project of Screen Capture lies there as a folder, e.g. “Trip.screencapture”, with its recordings inside – leave what is in it as it is. Only Chrome and Edge on a computer can access folders.',
							tip: 'Choose a folder your sync program (Syncthing, Nextcloud, Dropbox …) or your backup already covers – then your files reach your other computers and your backup by themselves. When the browser asks again for access, choose “Allow on every visit”, so the sync continues without asking.'
						},
						devices: {
							title: 'On your other devices',
							text: 'Connect your phone, laptop or tablet in Files under “Your devices”: the files then sync directly between them, without a cloud. Each device keeps a full copy.',
							link: { href: '/help/sync', label: 'Sync between your devices' }
						},
						download: {
							title: 'Download',
							text: 'In Files, select files and choose “Download”, or “Download as ZIP” for a folder or several files. Most tools also export their documents in common formats, e.g. Screen Capture as MP4.'
						}
					}
				},
				space: {
					title: 'Storage space',
					items: {
						quota: {
							title: 'How much fits',
							text: 'Browsers give a site a share of the free space on the device – usually a large part of it. The footer of Files shows how much in-browser uses and how much the browser allows. Recordings and imported videos take the most space, texts very little. When the storage is full, saving says so (“… doesn’t fit: the storage of this browser is full”), and the sync leaves out files that don’t fit until there is room.'
						},
						free: {
							title: 'Freeing space',
							text: 'What you delete goes into the trash first and still takes space there. It is freed when the trash is emptied – by hand in Files (“Trash” → “Empty trash”) or by itself after the time chosen in the settings (“Trash”).',
							link: { href: '/help/sync#trash', label: 'How the trash works' }
						}
					}
				}
			} satisfies HelpContent
		},

		sync: {
			title: 'Sync between your devices',
			summary: 'Connect your phone, laptop and tablet – directly, encrypted, without a cloud',
			topics: {
				basics: {
					title: 'How it works',
					items: {
						direct: {
							title: 'Directly between your devices',
							text: 'Your devices exchange their files directly with each other, encrypted, without a cloud and without an account. Each device keeps a full copy of the synced files and works without the others.'
						},
						connected: {
							title: 'Only My files',
							text: 'What syncs is My files. Folders under “Connected” stay where they are and don’t travel to your other devices.',
							link: { href: '/help/connected', label: 'Connected folders' }
						},
						when: {
							title: 'When devices sync',
							text: 'Two devices sync while both have in-browser open – one tab is enough, the overview or any tool, also in the background. On a phone the page has to be in front. What a device missed is caught up the next time it meets one of the others; the hint “Probably not up to date” in Files shows which device may still lack changes.',
							tip: 'If your devices are rarely open at the same time, set up a p2p-node on a computer or home server that is always on: it syncs with each device whenever that one is open.'
						},
						p2pNode: {
							title: 'Always on: the p2p-node',
							text: 'A small program for a computer or home server that joins your devices like a browser and keeps the files in an ordinary folder. Changes then travel even when your other devices are never online at the same time.',
							link: { href: '/help/p2p-node', label: 'Set up a p2p-node' }
						},
						browsers: {
							title: 'Browsers',
							text: 'Syncing devices works in current versions of Chrome, Edge, Firefox and Safari, on computers and phones.'
						}
					}
				},
				connect: {
					title: 'Connecting a device',
					items: {
						first: {
							title: 'On a device you already use',
							text: 'Open Files, then “Your devices” → “Connect devices”. Give this device a name you recognize, e.g. “Laptop office”, and choose “Connect”. A QR code and a key appear. For further devices later: “Your devices” → “Add device”.'
						},
						second: {
							title: 'On the new device',
							text: 'Scan the QR code with the camera of your phone – the link opens in-browser there. Or open Files on the new device, choose “Your devices” → “Enter key” and type the key. Keep in-browser open on the first device until the new one is connected.'
						},
						key: {
							title: 'The key',
							text: 'A key works once, for 24 hours, and only while the device that shows it is online.',
							tip: 'Whoever has the key can connect a device and read and change all your synced files. Only enter it on your own devices and never send it to anyone.'
						},
						setup: {
							title: 'Look first, then sync',
							text: 'Right after connecting, the new device shows “Choose what this device syncs”: every folder with what would come here (“… comes here”), what only this device has (“… goes to your devices”) and the free space in the browser. Nothing is transferred until you choose “Start syncing”. Folders that reach the size from the settings (“large”) or don’t fit into the free space (“doesn’t fit”) are deselected at first – tick them if you want them here. “Later” keeps the device waiting; “Your devices” → “Choose folders …” brings the choice back.',
							tip: 'On a phone, deselect what you don’t need there (recordings, archives) – you can still open it live. Folders that exist only on the new device can’t be deselected: they always go to your other devices.',
							link: { href: '/help/settings#sync', label: 'Size from which to ask' }
						},
						folders: {
							title: 'Choosing folders',
							text: 'Under “Choose folders” you decide per device which folders it gets. Folders you deselect stay on the other devices and keep syncing there – only this device doesn’t get them, and its copy is deleted here. Leaving out a folder never deletes it anywhere else. A project of Screen Capture is one document and not in this list: it goes with the folder it lies in.',
							tip: 'Leave out large folders (e.g. screen recordings) on a phone with little space – you can still open them live.'
						},
						live: {
							title: 'Live from your devices',
							text: 'A folder this device doesn’t sync still shows up in Files, with a cloud instead of the folder icon. Opening it reads it live from one of your devices that has it – a p2p-node or a browser with in-browser open. Every tool works there: open, save, upload, rename, delete (into the trash of that device). Videos play while they load, only the part you watch is fetched. The changes sync from that device to the others. If none of them is connected, Files says so and names where the folder is.',
							tip: 'For folders you rarely need on this device, leave them out and open them live. Sync the folder again (“Sync again on this device”) if you need it without the other devices.'
						}
					}
				},
				changes: {
					title: 'Changes, conflicts and deletions',
					items: {
						newer: {
							title: 'The newer version wins',
							text: 'When a file changed on two devices since they last synced, the newer version keeps the name and the other one is kept as a conflict copy next to it. A project of Screen Capture is one document: there the whole document as it was on this device is kept as a copy, e.g. “Trip (conflict Laptop)” next to “Trip”. Nothing is lost; look at both and delete the one you don’t need.',
							tip: 'Before you continue on a device that wasn’t open for a while, open in-browser on one of your other devices first and let it sync. Files warns you when this device is probably behind.'
						},
						open: {
							title: 'A file that is open',
							text: 'When a file you have open in a tool is changed elsewhere – on another device, in another tab or by another program – and you have no unsaved changes, the tool asks “… was changed elsewhere” before it shows the other version. Every tool asks the same way, once per version. If you do have unsaved changes, the tool keeps them and tells you (the Text Editor and the PDF Editor pause saving and let you choose in a bar).',
							options: {
								reload: { label: 'Reload', text: 'Shows the other version. Nothing of yours is lost – there were no unsaved changes.' },
								keep: { label: 'Don’t reload', text: 'Keeps showing your version. If you change it, the tool tells you before your version replaces the other one (Screen Capture writes over it).' },
								dontAsk: { label: 'Don’t ask again while it is open', text: 'Takes the same choice for further changes without asking, until you close the file. Opened again, it asks again.' }
							},
							tip: 'Working on the same file on two devices at once? Choose “Reload” and “Don’t ask again” on the one you only look at.'
						},
						safe: {
							title: 'Nothing changed in between is overwritten',
							text: 'Right before a device overwrites or deletes a file, it checks that the file is still the version it planned with. If you changed it in the meantime, your change stays and syncs on the next round.'
						},
						deletions: {
							title: 'Deleting',
							text: 'What you delete on one device is deleted on the others too and goes into the trash. When many files were deleted at once on another device, Files asks first: “Delete here too”.'
						},
						large: {
							title: 'Large new folders wait',
							text: 'When a new folder would come to a device and it is larger than the size in the settings, or doesn’t fit into the browser’s free space, it waits: the sync dialog in Files says “New folder … waits for your confirmation”, the footer of every tool “New folder … waits”. Everything else keeps syncing. The same applies to the folder on your computer: there, what comes into the browser counts. A p2p-node never waits, it has the disk to itself.',
							options: {
								sync: { label: 'Sync', text: 'The folder comes to this device after all.' },
								exclude: { label: 'Exclude', text: 'This device leaves the folder out (it stays on the other devices, and here it opens live). For the folder on your computer: it stays in both places and just isn’t synced.' }
							},
							tip: 'Choose “Sync” if the device has the space and you want the folder offline; otherwise “Exclude”. If it asks too often, raise the size with “Change the limit”.',
							link: { href: '/help/settings#sync', label: 'Ask before syncing new folders larger than' }
						}
					}
				},
				trash: {
					title: 'Trash',
					items: {
						everywhere: {
							title: 'On all your devices',
							text: 'What you delete in Files – or a project in its tool – lands in the trash, on every device. So you can get it back on any of them: Files → “Trash” → “Restore”.'
						},
						keep: {
							title: 'How long',
							text: 'How long deleted items stay (30 days unless you change it) is set under “Settings” (the gear at the top right) → “Trash”, for all your devices.',
							link: { href: '/help/settings#trash', label: 'Choosing how long' }
						},
						folder: {
							title: 'In a folder on disk',
							text: 'In the synced folder on your computer and with a p2p-node, the trash is the hidden folder “.in-browser-trash”. Files you delete in such a folder with another program are synced as deletions – the trash of your system keeps those.'
						}
					}
				},
				devices: {
					title: 'Managing devices',
					items: {
						remove: {
							title: 'Removing a device',
							text: 'In Files under “Your devices”, open the menu of a device and choose “Remove device”. It can no longer connect and gets nothing new. What it already has stays on it – deleting remotely isn’t possible.',
							tip: 'Lost a phone? Remove it right away from another device; the remaining devices then use new connection secrets.'
						},
						leave: {
							title: 'Disconnecting this device',
							text: '“Disconnect this device” stops syncing here. Your files stay on this device and on the others; you can connect it again later with a new key.'
						}
					}
				},
				privacy: {
					title: 'Privacy and security',
					items: {
						encrypted: {
							title: 'Encrypted end to end',
							text: 'Files travel directly between your devices over encrypted connections (WebRTC). Each device has its own key pair that never leaves it; a device only joins with a one-time key from one of your devices.'
						},
						relays: {
							title: 'What third parties see',
							text: 'To find each other, devices post encrypted connection offers on public Nostr relays. The relays see IP addresses and timing, but not your files, file names or device names. A STUN server of Cloudflare tells each device its public address.'
						}
					}
				},
				trouble: {
					title: 'When devices don’t connect',
					items: {
						unreachable: {
							title: '“Online, but can’t be reached”',
							text: 'Both devices are online, but the network blocks direct connections – often mobile data, company or hotel networks. There is no relay server for files. Try the same Wi-Fi, or set up a p2p-node at home with forwarded ports: devices can reach it from almost anywhere.'
						},
						outdated: {
							title: '“Needs an update” or “Runs a newer version”',
							text: 'Devices only sync while they run the same version. “Needs an update”: the other device runs an older one – open in-browser there and reload the page. “Runs a newer version”: this device is the older one – reload this page. A p2p-node updates itself within the hour.'
						},
						diagnostics: {
							title: 'Diagnostics',
							text: 'In Files, “Your devices” → “How it works” → “For experts” shows how each device is connected and whether the relays are reachable. “Copy diagnostics” copies it for a bug report.'
						}
					}
				}
			} satisfies HelpContent
		},

		connected: {
			title: 'Connected folders',
			summary: 'Open a folder on your computer, a WebDAV server or S3 storage live in every tool – and share files with a guest',
			topics: {
				basics: {
					title: 'My files and Connected',
					items: {
						rule: {
							title: 'Two kinds of storage',
							text: '“My files” lie in the storage of your browser and travel with your devices. What stands under “Connected” is not part of them and never travels with your devices. A folder on your computer or a server stays where it is: in-browser opens it live, reads and saves right there and keeps no copy. What a guest share gives you is the one exception: it is copied into this browser so it works without the sharing device, kept apart from My files and deleted when the share ends. Disconnect either and nothing of it is left in the browser.'
						},
						everywhere: {
							title: 'In every tool',
							text: 'Connected folders appear in Files in the panel “Folders” below My files and in the open and save dialog of the tools (the choice in front of the folder path). Every tool opens and saves there directly: texts in the Text Editor, PDFs in the PDF Editor, projects and recordings in Screen Capture. The start page of Screen Capture lists projects from connected folders once you have created or opened them there – connected folders are not searched, they can be large.'
						},
						notSynced: {
							title: 'Not synced',
							text: 'A connected folder is neither synced with your other devices nor with the folder you sync My files with. Each device has its own connections.',
							tip: 'Want a folder on your computer to hold a copy of My files? Use the sync with a folder instead (Files → “Sync” → “Folder on your computer”). Want to work on files where they are, e.g. a project folder of another program? Connect it.',
							link: { href: '/help/sync', label: 'Sync between your devices' }
						}
					}
				},
				use: {
					title: 'Connecting a folder',
					items: {
						connect: {
							title: 'Connect',
							text: 'In Files, click “Connect …” (tab “Connect”, or in the panel “Folders” below My files) and choose what to connect: “Folder on this computer …”, “WebDAV server …” or “S3 storage …”. For a folder, the browser asks whether in-browser may view and edit it; only Chrome and Edge on a computer can do this. Servers work in every browser, also on phones. The connection then appears in the panel “Folders” below My files with its name.'
						},
						access: {
							title: 'Access after a restart',
							text: 'Browsers usually ask again for access after a restart. The folder then shows “Allow access”; one click and it is back. Tools that save there say so in their save state, and their messages, open dialogs and start pages offer “Allow access” as well. If the browser says no, a message offers “Choose folder again”: pick the same folder, and the connection continues with its name and its remembered documents. If it doesn’t answer at all, the message offers “Reload page”; after that “Allow access” lets you pick the folder anew.',
							tip: 'Choose “Allow on every visit” when the browser asks – then it stays connected.'
						},
						manage: {
							title: 'Name and disconnecting',
							text: 'A connected folder is always shown with the name of the folder on your computer; a server with the name you gave it (“Edit …” in its menu changes it, together with address and sign-in data). “Disconnect” – in the menu of the connected folder (right-click in the panel “Folders”) or in the tab “Connect” while it is open – removes it from in-browser without deleting anything in it.'
						},
						deleting: {
							title: 'Deleting',
							text: 'A connected folder has no trash of in-browser. Deleting there asks first and then deletes for good; the trash of your system doesn’t get it either. On a server it is gone as well – Nextcloud and ownCloud keep deleted files in their own trash on the server.'
						}
					}
				},
				servers: {
					title: 'WebDAV and S3',
					items: {
						webdav: {
							title: 'WebDAV server',
							text: '“Connect …” → “WebDAV server …” asks for the address of a folder on the server, your user name and password. For Nextcloud the address is shown under “Files settings” → “WebDAV”, e.g. https://cloud.example.com/remote.php/dav/files/anna/. “Connect” tries it first and keeps the connection only when the folder can be listed.',
							tip: 'Use an app password (Nextcloud, ownCloud: Settings → Security) instead of your real password – you can revoke it any time without changing anything else.'
						},
						s3: {
							title: 'S3 storage',
							text: '“Connect …” → “S3 storage …” takes a bucket of Amazon S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO or other S3-compatible storage. “Provider” fills in endpoint, region and addressing; for R2 put your account ID into the endpoint. “Folder in the bucket” opens only that folder; empty, the whole bucket.',
							options: {
								bucket: { label: 'Bucket and region', text: 'As shown by your provider. R2 takes “auto” as region.' },
								pathStyle: { label: 'Bucket in the path (path-style addresses)', text: 'On for MinIO and most self-hosted storage; off for AWS (the default of each provider is preset).' },
								keys: { label: 'Access key ID and secret access key', text: 'Create a key that may only read and write this bucket.' }
							},
							tip: 'Give in-browser its own key with access to this one bucket only – if the device is lost, you delete just that key.'
						},
						cors: {
							title: 'The server must allow the browser (CORS)',
							text: 'A browser may only talk to a server that allows in-browser. Without that, “Connect” says “The server can’t be reached, or it doesn’t allow access from the browser (CORS)”. For S3, add a CORS rule to the bucket that allows the origin of in-browser (shown below), the methods GET, HEAD, PUT, POST and DELETE, all headers and exposes the header ETag. For WebDAV, the server must answer the methods OPTIONS, PROPFIND, GET, PUT, MKCOL, DELETE and MOVE from that origin and allow the headers Authorization, Depth, Destination, Overwrite, Range, If-Match and Content-Type.',
							code: s3Cors
						},
						https: {
							title: 'HTTPS only',
							text: 'Browsers don’t let an HTTPS site use a plain HTTP server, so a NAS at http://192.168.… can’t be connected. Use its HTTPS address with a valid certificate. A server on this computer (http://localhost) works.'
						},
						secrets: {
							title: 'Password and keys',
							text: 'The password or secret key stays on this device, encrypted with a key the browser keeps and never hands out. It is never synced – connect the server on each device you want it on. If the server refuses them later, messages offer “Change sign-in data”.'
						},
						changes: {
							title: 'Changes on the server',
							text: 'A server doesn’t tell the browser when something changes there. Files looks again when you come back to the tab and every 30 seconds while it is open.'
						}
					}
				},
				share: {
					title: 'Sharing with a guest',
					items: {
						start: {
							title: 'Share a folder or a file',
							text: 'Choose “Share …” in the menu of a folder or file in Files, “Share a folder …” under “Shares” in its sidebar – or “Share …” on the tab “File” of the PDF Editor, the Text Editor and Screen Capture for the open document. Pick what the guest may and how long it lasts, then “Share”: the dialog shows a link and a QR code, and “Show four words” gives words to type instead. The guest opens it in any current browser – no account, not one of your devices. What you share is copied into the guest’s browser and kept in sync with this device while in-browser is open here; a single file opens there right away in its tool, and the guest gets only that file, never what lies next to it.',
							options: {
								view: { label: '“View only” (default)', text: 'Open, preview and download. Nothing changes here.' },
								edit: { label: '“Edit”', text: 'Also save, upload, rename and delete. What the guest deletes goes into the trash here; a shared file itself can’t be deleted or moved.' }
							},
							tip: 'Share for viewing to hand over photos or documents – or a presentation to a computer at a projector; choose “Edit” when the guest should bring files back.'
						},
						words: {
							title: 'Four words instead of the link',
							text: 'A computer without a camera can’t scan the QR code, and the link is long to type. “Show four words” in the share dialog shows four short words in your language. On the other computer, open in-browser, choose “Connect …” in Files (below My files in the panel “Folders”, or the tab “Connect”), then “A share by four words …”, and type them – in German or English, upper or lower case, ä or ae alike; the word being typed is completed. The words work once and for 10 minutes; “New words” makes new ones. They only hand the share’s real key over: nobody can guess them in time, and after use they open nothing.',
							tip: 'Read the words out or show your screen – they never travel over a chat. If they ran out before the other side typed them, just make new ones.'
						},
						valid: {
							title: 'How long and for whom',
							text: 'When you share, you choose how long it lasts: an hour, a day (default), a week, or until you end it – a forgotten share ends by itself. One browser at a time can use it: while a guest is connected, a second browser is told the share is open in another browser and tries again by itself. So whoever has the link gets in while nobody else is – give it only to your guest and end shares you no longer need. Keep in-browser open on this device until the guest has everything and whenever changes should travel – in the same Wi-Fi the connection is fastest and most reliable. What the guest already has stays usable there while this device is away.'
						},
						guest: {
							title: 'As a guest',
							text: 'A shared folder appears in Files in the panel “Folders” below My files as “Folder from” whoever shares it – the name from their settings (“Profile” → “Your name”), else their device’s –, with a lock if you may only view – then the menus there have no “Cut”, “Duplicate”, “Move to …”, “Rename” or “Delete”, and nothing can be dropped or uploaded into it. You can open the files in every tool, download them or copy them into your own files. What is shared is copied into your browser and kept in sync with the sharing device; a line above the list says what is happening (“Fetching the share …”, or that the sharing device can’t be reached right now – then you see the share as it last was and can go on using it). Before a share that is large (1 GB by default, the setting “Ask before syncing new folders larger than” under “Sync”) or doesn’t fit your browser’s free storage is fetched, you are asked: “Fetch” starts it. Your browser remembers the share – also after it was closed – until it ends, runs out or you choose “Disconnect”. When the sharing device ends it, you see “The share has ended.” right away and its copy is deleted from your browser – “Remove” takes the entry away; what you copied into your own files stays.'
						},
						copies: {
							title: 'What stays with the guest',
							text: 'Everything you share is copied into the guest’s browser – you gave it to them on purpose, and so it still opens when this device can’t be reached. With “View only” the copy only follows this device: the guest can’t change it there, and nothing of theirs ever comes back. With “Edit” changes travel both ways; if both sides changed the same file, the newer version holds and the other is kept next to it as a copy named “(conflict …)”. The copy lies apart from the guest’s own files: it is not part of their “My files”, never syncs to their other devices and never lands in a folder on their computer. It is deleted when the share ends or runs out, or when the guest chooses “Disconnect” – unless the guest’s browser isn’t opened again, then it is deleted the next time it is. What the guest copied into their own files or downloaded stays with them.',
							tip: 'Share with a duration when you hand files to a computer that isn’t yours – the copy goes with the share. Share only what the guest may keep: a copy made while the share lasted can’t be taken back.'
						},
						live: {
							title: 'Live with a guest or your devices',
							text: 'When the guest – or one of your own devices – starts something live with what you share, e.g. presents a PDF, every in-browser tool on your side says so in a message (“Your guest presents …”) with the way in (“Remote control”) – in a tab that was in the back as soon as you come back to it; while it lasts, the menu of the sync symbol at the bottom right lists it too. These live connections are direct between the two browsers like the share itself and need in-browser open on both. The page you open for it takes over the connections of this browser from its other tabs, so a phone keeps them even when those tabs sleep.',
							link: { href: '/help/pdf-editor#present', label: 'Presenting with a remote control' }
						},
						end: {
							title: 'Ending a share',
							text: 'Your active shares are in Files under “Shares”, with a dot that turns green while a guest is connected. A click shows the link and QR code again; right-click (or press and hold) for “End share”. Ending disconnects the guest at once and tells them so; nothing of what you shared changes. A share with a duration ends by itself.'
						}
					}
				}
			}
		},
		p2pNode: {
			title: 'p2p-node: an always-on device',
			summary: 'Keep your files syncing on a computer or home server, even when no browser is open',
			topics: {
				about: {
					title: 'What it is',
					items: {
						what: {
							title: 'An always-on device',
							text: 'Your devices only sync while at least two of them have in-browser open. The p2p-node is a small program for a computer or home server that is always on: it joins your devices like a browser and keeps the files in an ordinary folder. Changes then reach your other devices even when they are never online at the same time, and you can work in that folder with any program.'
						},
						needs: {
							title: 'What you need',
							text: 'A computer with Linux, macOS or Windows that stays on, with Node.js 26 or newer. No root or admin rights are needed.'
						}
					}
				},
				install: {
					title: 'Install',
					items: {
						unix: {
							title: 'Linux and macOS',
							text: 'Run this in a terminal:',
							code: install.unix
						},
						windows: {
							title: 'Windows',
							text: 'Run this in PowerShell:',
							code: install.windows
						},
						where: {
							title: 'What it installs',
							text: 'The starter for your user only – in “~/.local/share/in-browser-p2p-node”, on Windows in “%LOCALAPPDATA%\\in-browser-p2p-node” – and the command “in-browser-p2p-node”. The sync itself is loaded and kept up to date by the starter.'
						}
					}
				},
				pair: {
					title: 'Connect and run',
					items: {
						link: {
							title: '1. Get a link',
							text: 'In Files on one of your devices, open “Your devices” → “Add device” and choose “Copy link”.'
						},
						pair: {
							title: '2. Add the computer',
							text: 'Paste the link in place of <link>. “home” is the name of this instance; the computer appears among your devices under its own name.',
							code: 'in-browser-p2p-node pair home "<link>"'
						},
						service: {
							title: '3. Keep it running',
							text: 'Installs a background service: a systemd user service on Linux, a task at logon on Windows.',
							code: 'in-browser-p2p-node install home',
							tip: 'On Linux, a user service stops when you log out. On a server, allow it to keep running with “loginctl enable-linger $USER”.'
						},
						commands: {
							title: 'Commands',
							text: 'All commands take the name of the instance.',
							options: {
								pair: { label: 'pair <name> <link>', text: 'Adds a new instance as a device. “--folder <dir>” picks the synced folder (default: inside the data folder), “--name <device name>” the name your devices see, “--exclude <folder>” leaves a folder of My files out (repeat it for more, e.g. “--exclude Videos --exclude Photos/2019”). Without “--exclude” the computer gets everything.' },
								run: { label: 'run <name>', text: 'Runs an instance in the foreground, e.g. to watch it.' },
								install: { label: 'install <name>', text: 'Runs it in the background and at every start. “uninstall <name>” stops that and keeps the data.' },
								status: { label: 'status [<name>]', text: 'Shows devices, folder and trash of one or all instances.' },
								update: { label: 'update', text: 'Looks for a new version now instead of within the hour.' }
							}
						},
						several: {
							title: 'Several people, one server',
							text: 'Each instance is a device of its own with its own folder. One server can keep the files of several people: “pair anna …”, “pair ben …”.'
						},
						logs: {
							title: 'Logs',
							text: 'On Linux with “journalctl --user -u in-browser-p2p-node@home -f”; on every system in the file “node.log” in the folder of the instance.'
						},
						remove: {
							title: 'Removing it',
							text: 'Remove the computer in Files under “Your devices” like any other device; the instance then stops by itself.'
						},
						trash: {
							title: 'Trash in the folder',
							text: 'The trash of your devices is the hidden folder “.in-browser-trash” inside the synced folder: one folder per deleted item. The node empties it after the time chosen in Files. Files you delete in the folder yourself are synced as deletions – your system’s trash keeps them.',
							link: { href: '/help/sync#trash', label: 'How the trash works' }
						}
					}
				},
				outside: {
					title: 'Reachable from outside',
					items: {
						why: {
							title: 'Why it matters',
							text: 'Devices connect directly, without a relay server. At home that always works. From outside – a phone on mobile data, a laptop in a hotel – the connection only gets through your router if the node can be reached there.'
						},
						upnp: {
							title: 'Automatic: UPnP',
							text: 'The node always uses the UDP ports 29400–29449 and asks your router to forward them to itself. Its log says whether that worked, e.g. “Router: UDP 29400-29449 forwarded to 192.168.178.20 via UPnP”.'
						},
						fritzbox: {
							title: 'FRITZ!Box and other routers',
							text: 'FRITZ!Box: under “Home Network” → “Network”, open this computer and check “Permit independent port sharing”. Other routers: turn on UPnP (port forwarding requested by devices).'
						},
						manual: {
							title: 'By hand',
							text: 'Without UPnP, forward UDP 29400–29449 in your router to this computer; the log names its address.'
						},
						firewall: {
							title: 'Firewall',
							text: 'If the computer has a firewall of its own, allow the same range there too, e.g. with ufw:',
							code: 'sudo ufw allow 29400:29449/udp'
						},
						cgnat: {
							title: 'DS-Lite and carrier-grade NAT',
							text: 'Forwarding needs a public IPv4 address at home. Behind DS-Lite or carrier-grade NAT it can’t help – the log says so. Devices with IPv6 on both ends may still connect.'
						},
						debug: {
							title: 'Finding the cause',
							text: 'Set IN_BROWSER_DEBUG=1 in the environment of the service (Linux: “systemctl --user edit in-browser-p2p-node@home”, then “Environment=IN_BROWSER_DEBUG=1” under “[Service]”) and watch the log for “peer.unreachable”. IN_BROWSER_ICE_PORTS=off turns the fixed ports and forwarding off.'
						}
					}
				},
				security: {
					title: 'Updates and security',
					items: {
						updates: {
							title: 'Updates',
							text: 'The starter looks for a new version every hour, and right away when another device runs a newer one. It waits until a running sync is done. If a new version keeps crashing, it goes back to the previous one and skips the broken one.'
						},
						signed: {
							title: 'Signed',
							text: 'A version is only taken with a valid signature of the release key, and every file only with its signed checksum. Whoever controls the website alone can’t run code on your computer. The installer itself is trusted on first use, like any installer you download.'
						},
						sandbox: {
							title: 'Sandboxed',
							text: 'The sync runs in Node’s permission model: it can only read and write its own data and the synced folder, plus use the network.'
						},
						router: {
							title: 'Router',
							text: 'The node only forwards its own UDP range to itself, for an hour at a time and renewed while it runs.'
						},
						unencrypted: {
							title: 'Files on disk',
							text: 'The files are stored unencrypted in the folder, like any other file on that computer.',
							tip: 'On a laptop or a computer others can get at, turn on the disk encryption of your system.'
						}
					}
				}
			} satisfies HelpContent
		},

		settings: {
			title: 'Settings',
			summary: 'Your name, how long the trash keeps things – for all your devices',
			topics: {
				open: {
					title: 'Opening the settings',
					items: {
						where: {
							title: 'The gear at the top right',
							text: 'Every tool and the overview have a gear at the right end of the top bar. It opens “Settings”: the categories on the left, the settings of the chosen one on the right; on a phone the categories first, then the chosen one as a page of its own (the arrow goes back). Some places open a category directly, e.g. “Change” next to your name in the comments of the PDF Editor.'
						},
						saved: {
							title: 'Saved right away, on all devices',
							text: 'There is no “OK”: every change counts at once. The settings are kept with your files and sync like them – to your other devices, into the synced folder on your computer and to a p2p-node. Only the theme (light, dark) is chosen per device, with the switch next to the gear.',
							link: { href: '/help/sync', label: 'How syncing works' }
						}
					}
				},
				profile: {
					title: 'Profile',
					items: {
						name: {
							title: 'Your name',
							text: 'Where a tool writes a name, it takes this one – for example as the author of your comments and replies in the PDF Editor, which others see in Acrobat or PDF-XChange too. Empty: no name is written.',
							tip: 'Use the name the people you share files with know you by, e.g. your full name at work.'
						}
					}
				},
				trash: {
					title: 'Trash',
					items: {
						days: {
							title: 'Remove deleted items for good after',
							text: 'How long what you delete stays in the trash before it is removed by itself – on every device and on a p2p-node.',
							options: {
								d7: { label: '7 days', text: 'Frees space soon; a mistake has to be noticed within a week.' },
								d30: { label: '30 days (default)', text: 'Enough time to notice a mistake, without filling the storage for long.' },
								d90: { label: '90 days', text: 'For documents you rarely look at; deleted media keep using space for a long time.' },
								never: { label: 'Never', text: 'Nothing is removed by itself – you empty the trash yourself (Files → “Trash”).' }
							},
							tip: 'Keep 30 days. Take 7 days if storage gets tight (large recordings), 90 days or “Never” if you work with documents you only check now and then.'
						}
					}
				},
				sync: {
					title: 'Sync',
					items: {
						askAbove: {
							title: 'Ask before syncing new folders larger than',
							text: 'A new folder that would come to a device and is at least this large waits for your confirmation – when a device starts syncing and later whenever such a folder appears. A folder that doesn’t fit into the browser’s free space always waits, whatever you choose here.',
							options: {
								mb100: { label: '100 MB', text: 'Asks often – for phones with little space.' },
								gb1: { label: '1 GB (default)', text: 'Documents and photos flow freely; recordings and archives wait.' },
								gb10: { label: '10 GB', text: 'Only very large folders wait.' },
								never: { label: 'Never ask', text: 'Every new folder comes at once, as long as it fits.' }
							},
							tip: 'Keep 1 GB. Take 100 MB if one of your devices is a phone that is often full, “Never ask” if all your devices have plenty of space.',
							link: { href: '/help/sync', label: 'Sync between your devices' }
						}
					}
				}
			}
		},
		install: {
			title: 'Install, offline and browsers',
			summary: 'Use in-browser like an app, without internet, in the browser you have',
			topics: {
				install: {
					title: 'Install as an app',
					items: {
						how: {
							title: 'How',
							text: 'When your browser offers it, add in-browser like a program: in Chrome and Edge on a computer the install icon in the address bar, on Android “Install app” in the browser menu, on iPhone and iPad “Share” → “Add to Home Screen”, in Safari on the Mac “File” → “Add to Dock”. The app then opens in its own window.'
						},
						which: {
							title: 'The whole suite or one tool',
							text: 'Installed from the overview, you get in-browser with all tools. Each tool can also be installed on its own – then it opens straight into that tool.',
							tip: 'Install the whole suite: only the app “in-browser” appears in the share menu and under “Open with” of your device. An app of a single tool doesn’t.'
						}
					}
				},
				system: {
					title: 'With the other apps of your device',
					items: {
						share: {
							title: 'Share to in-browser',
							text: 'On Android, the installed app “in-browser” appears in the share menu of other apps. Share a PDF and it opens in the PDF Editor, a text file or a text in the Text Editor; other files land in Files. Before it is kept, you choose where – the file is copied into your files, nothing is uploaded.',
							options: {
								where: { label: 'Where it works', text: 'Chrome and Samsung Internet on Android, with in-browser installed. Not on iPhone and iPad – there, save the file and upload it in Files.' }
							}
						},
						openWith: {
							title: 'Open with in-browser',
							text: 'On a computer, “Open with” → “in-browser” opens PDFs in the PDF Editor and text files in the Text Editor – also from the download bar of the browser, and as the default app if you choose it. A PDF is copied into your files first (you choose where), a text opens as a new text that you save where you like. The file on your computer stays as it was.',
							options: {
								where: { label: 'Where it works', text: 'Chrome and Edge on a computer, with in-browser installed. The first time, the browser asks whether in-browser may open such files.' }
							}
						},
						send: {
							title: 'Send to another app',
							text: '“Send …” in the tab “File” of the PDF Editor and the Text Editor, in Files (tab “Share”, the menu of files) and in the PDF Editor’s “Export …” gives files to another app of your device – mail, a messenger, JW Library. Unlike “Share …”, which opens a file for a guest in their browser, the app gets a copy.',
							options: {
								where: { label: 'Where it works', text: 'On phones and tablets, on Windows and on the Mac. Each browser sends only the types it allows – Chrome e.g. pictures, videos, sound, PDFs and plain text, but no playlists; for those “Send …” stays disabled.' }
							},
							tip: 'After a longer export, the browser no longer counts your click: a message “… ready to send” then offers “Send”.'
						}
					}
				},
				offline: {
					title: 'Offline and updates',
					items: {
						offline: {
							title: 'Without internet',
							text: 'After the first visit, in-browser and its tools also start without an internet connection – installed or not. Your files are on the device anyway. Only syncing between devices needs a network.'
						},
						updates: {
							title: 'New versions',
							text: 'A new version is announced with “A new version is available.” – “Reload” applies it, “Later” keeps working with the current one. It is never applied without asking, so a running recording or unsaved input is safe.'
						}
					}
				},
				browsers: {
					title: 'Browsers',
					items: {
						supported: {
							title: 'Supported browsers',
							text: 'The latest two versions of Chrome, Edge, Firefox and Samsung Internet, and the latest two major versions of Safari – on computers, phones and tablets. On iPhone and iPad all browsers use Safari’s engine.',
							tip: 'Keep your browser up to date. In an older one, single functions may be missing; the tools then say so.'
						},
						differences: {
							title: 'What differs',
							text: 'Some functions need what not every browser has. The tools hide what yours lacks or explain it.',
							options: {
								folder: { label: 'Folder on your computer', text: 'Only Chrome and Edge on a computer.' },
								screen: { label: 'Screen recording', text: 'Only on a computer; system audio and installing not in Firefox.' },
								sync: { label: 'Sync between devices', text: 'All supported browsers; on phones only while the page is in front.' }
							}
						},
						language: {
							title: 'Language',
							text: 'in-browser follows the language of your browser: German or English, otherwise English.'
						}
					}
				},
				privacy: {
					title: 'Privacy',
					items: {
						nothing: {
							title: 'No account, no tracking',
							text: 'There is no account, no cookies, no analytics and no ads. The website only delivers the program; everything else happens on your device.'
						},
						open: {
							title: 'Open source',
							text: 'The source code of in-browser is public under the MIT license – anyone can check what it does.'
						}
					}
				}
			} satisfies HelpContent
		}
	}
};

export default help;
