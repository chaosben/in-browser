// Help pages of the whole suite (`/help/…`), English leads; `help.de.ts` must have the same keys. The help of each
// tool comes from the tool (`@in-browser/<tool>/i18n/help.en.js`). Describe what users see and do, with the labels
// of the UI in quotes; no internals.

import { BRAND } from '@in-browser/brand/brand.js';
import type { HelpContent } from '@in-browser/brand/help.js';

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
							text: 'Every in-browser tool saves into one storage of your browser on this device. Nothing is uploaded – there is no server that could store your files. All tools share this storage: a notebook from Notes, a project from Screen Capture and a text from the Text Editor are all files there. Files shows and manages them, like the file manager of your computer.'
						},
						perBrowser: {
							title: 'One storage per browser',
							text: 'The storage belongs to this browser on this device. Another browser, another browser profile or a private window has its own, empty storage. Clearing the site data of this site, resetting or uninstalling the browser deletes it.',
							tip: 'Keep a copy elsewhere – in a folder on your computer or on your other devices – if your files matter to you.'
						},
						kept: {
							title: 'Kept permanently',
							text: 'in-browser asks the browser to keep its storage even when space runs low. Most browsers agree without asking. Safari may delete the data of sites you haven’t used for a few weeks; added to the home screen (iPhone, iPad) or the Dock (Mac), a site keeps its data.'
						},
						tabs: {
							title: 'Several tabs',
							text: 'All tabs of this browser see the same files. Changes from another tab appear by themselves. A document that is open for editing in one tab may be locked in a second one – the tool then says so.'
						}
					}
				},
				copy: {
					title: 'Keeping a copy',
					items: {
						folder: {
							title: 'Folder on your computer',
							text: 'In Files, choose “Folder on your computer” → “Choose folder”. From then on the files are kept in sync with this real folder in both directions: the newer version wins, deletions in the folder are confirmed before they apply here. The sync runs while any in-browser tool is open in this browser. Only Chrome and Edge on a computer can access folders.',
							tip: 'Choose a folder your sync program (Syncthing, Nextcloud, Dropbox …) or your backup already covers – then your files reach your other computers and your backup by themselves. When the browser asks again for access, choose “Allow on every visit”, so the sync continues without asking.'
						},
						devices: {
							title: 'On your other devices',
							text: 'Connect your phone, laptop or tablet in Files under “Your devices”: the files then sync directly between them, without a cloud. Each device keeps a full copy.',
							link: { href: '/help/sync', label: 'Sync between your devices' }
						},
						download: {
							title: 'Download',
							text: 'In Files, select files and choose “Download”, or “Download as ZIP” for a folder or several files. Most tools also export their documents in common formats, e.g. Notes as PDF, Screen Capture as MP4.'
						}
					}
				},
				space: {
					title: 'Storage space',
					items: {
						quota: {
							title: 'How much fits',
							text: 'Browsers give a site a share of the free space on the device – usually a large part of it. The footer of Files shows how much in-browser uses and how much the browser allows. Recordings and imported videos take the most space, text and notebooks very little.'
						},
						free: {
							title: 'Freeing space',
							text: 'What you delete goes into the trash first and still takes space there. It is freed when the trash is emptied – by hand in Files (“Trash” → “Empty trash”) or by itself after the time chosen under “Keep for”.',
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
						when: {
							title: 'When devices sync',
							text: 'Two devices sync while both have in-browser open – one tab with any tool is enough, also in the background. On a phone the page has to be in front. What a device missed is caught up the next time it meets one of the others; the hint “Probably not up to date” in Files shows which device may still lack changes.',
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
						folders: {
							title: 'Choosing folders',
							text: 'Under “Choose folders” you decide per device which folders it gets. Folders you deselect stay on the other devices and keep syncing there – only this device doesn’t get them. Leaving out a folder never deletes it anywhere else.',
							tip: 'Leave out large folders (e.g. screen recordings) on a phone with little space.'
						}
					}
				},
				changes: {
					title: 'Changes, conflicts and deletions',
					items: {
						newer: {
							title: 'The newer version wins',
							text: 'When a file changed on two devices since they last synced, the newer version keeps the name and the other one is kept as a conflict copy next to it. Nothing is lost; look at both and delete the one you don’t need.',
							tip: 'Before you continue on a device that wasn’t open for a while, open in-browser on one of your other devices first and let it sync. Files warns you when this device is probably behind.'
						},
						safe: {
							title: 'Nothing changed in between is overwritten',
							text: 'Right before a device overwrites or deletes a file, it checks that the file is still the version it planned with. If you changed it in the meantime, your change stays and syncs on the next round.'
						},
						deletions: {
							title: 'Deleting',
							text: 'What you delete on one device is deleted on the others too and goes into the trash. When many files were deleted at once on another device, Files asks first: “Delete here too”.'
						}
					}
				},
				trash: {
					title: 'Trash',
					items: {
						everywhere: {
							title: 'On all your devices',
							text: 'What you delete in Files – or a notebook or project in its tool – lands in the trash, on every device. So you can get it back on any of them: Files → “Trash” → “Restore”.'
						},
						keep: {
							title: 'How long',
							text: 'Under “Keep for” in the trash you choose how long deleted items stay. The setting applies to all your devices.',
							options: {
								d7: { label: '7 days', text: 'Frees space soonest.' },
								d30: { label: '30 days (default)', text: 'Time enough to notice a mistake.' },
								d90: { label: '90 days', text: 'For files you rarely look at.' },
								never: { label: 'Until I empty it', text: 'Nothing goes by itself – empty the trash now and then.' }
							}
						},
						folder: {
							title: 'In a folder on disk',
							text: 'In a connected folder on your computer and with a p2p-node, the trash is the hidden folder “.in-browser-trash”. Files you delete in such a folder with another program are synced as deletions – the trash of your system keeps those.'
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
							title: '“Needs an update”',
							text: 'The other device runs an older version. Open in-browser there and reload the page.'
						},
						diagnostics: {
							title: 'Diagnostics',
							text: 'In Files, “Your devices” → “How it works” → “For experts” shows how each device is connected and whether the relays are reachable. “Copy diagnostics” copies it for a bug report.'
						}
					}
				}
			} satisfies HelpContent
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
								pair: { label: 'pair <name> <link>', text: 'Adds a new instance as a device. “--folder <dir>” picks the synced folder (default: inside the data folder), “--name <device name>” the name your devices see.' },
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
							text: 'Installed from the overview, you get in-browser with all tools. Each tool can also be installed on its own – then it opens straight into that tool.'
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
