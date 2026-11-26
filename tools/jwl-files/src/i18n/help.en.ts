// Help texts of JWL Files (English leads; `help.de.ts` must have the same keys): the help window of the tool and the
// page `/help/jwl-files`. Describe what users see and do.

import type { HelpContent } from '@in-browser/brand/help.js';

const help = {
	start: {
		title: 'Backups and playlists',
		items: {
			what: {
				title: 'What JWL Files is for',
				text: 'JW Library saves your notes, highlights, bookmarks, tags and playlists in a backup (.jwlibrary) and hands single playlists over as .jwlplaylist files. JWL Files opens both: it shows what is inside, lets you tidy up and edit, and merges the backups of your devices into one. Everything happens in this browser – the files are never uploaded. The start page lists the files opened or imported recently; “Open …” takes one of your files, “New playlist …” makes an empty playlist file, “Import from the device …” takes a file of this device: it is kept in your files, where you say, and listed on the start page – it isn’t opened.'
			},
			receive: {
				title: 'From JW Library to in-browser',
				text: 'In JW Library make a backup (or share a playlist) and share it with in-browser – on Android and on the computer the installed in-browser is offered for it. On an iPhone or iPad save it in “Files” and choose “Import from the device …” here (or “Upload” in in-browser’s Files). A file that arrives asks where it should be kept, like every file. It is not opened – a backup or a playlist: a message says where it is kept (with “Open”), and it stands first on the start page. To bring a new backup into the one you keep, open that one and choose “Merge with …” (below).',
				link: { href: '/help/install', label: 'Installing in-browser' }
			},
			send: {
				title: 'Back to JW Library',
				text: 'In the tab “File”, “Send …” hands the file to another app of the device – JW Library among them – where the browser allows it; Chrome on Android doesn’t for these files, so the button stays off there. “Download” saves the file in the device’s download folder: open it from the download message or the folder, and JW Library restores the backup or adds the playlist. On the computer drag it from the download folder into JW Library, or open it there with “Restore backup”.'
			}
		}
	},
	merge: {
		title: 'Merging backups',
		items: {
			manual: {
				title: '“Merge with …”',
				text: 'Open the backup you keep and choose “Merge with …” in the tab “File”, then another backup of your files – the new one from a device, or a copy the sync kept when two devices changed the backup at once (“… (conflict …)”). What it has is taken into the open backup as one change: a message names what is new and changed, “Undo” in it (or Ctrl+Z) takes it back, and it is saved like every change. The other file stays as it is. If the open backup has everything already, nothing changes.',
				tip: 'Keep one backup for all your devices (e.g. “JW Library.jwlibrary”), merge each new backup into it, and restore that one on every device.'
			},
			how: {
				title: 'What merging takes over',
				text: 'Merging never just puts one file over the other: it goes through each note, highlight, bookmark, input field, tag and playlist item. What only one of the two files has is kept – so merging never deletes anything.'
			},
			conflicts: {
				title: 'When both have the same thing differently',
				text: 'The newer one counts: a note by its own time of change, everything else by the time the file was last changed. The message says how many were different. Highlights are taken per paragraph, as a whole, from the newer file – those of the other file are added where they don’t overlap, so highlights never end up on top of each other. If both files have a bookmark in the same place, the other one moves to a free place of the same publication (there are ten); with all ten taken it is left out.'
			},
			deleted: {
				title: 'Deleted things come back',
				text: 'Merging only adds: something you deleted on one device comes back from a backup that still has it. Delete it in the merged backup (here in JWL Files, or in JW Library after restoring it there and making a new backup).',
				tip: 'Merge first, then delete – and restore the result on your devices, so that no older backup brings it back.'
			}
		}
	},
	edit: {
		title: 'Looking inside and tidying up',
		items: {
			show: {
				title: 'What is shown',
				text: 'The group “Show” of the tab “Home” switches between “Overview” (what kind of file, from which device, when, and how many of each), “Notes”, “Highlights”, “Bookmarks”, “Tags” and “Playlists”. A click selects an entry, Ctrl+click and Shift+click several, Ctrl+A all; on a touch screen a long press opens an entry’s menu and starts selecting, each entry has a ⋯ too. “Delete” (or Del) removes what is selected. Every change is saved by itself and can be undone (Ctrl+Z, Ctrl+Y).',
				keys: [['Ctrl', 'A'], ['Del'], ['Ctrl', 'Z'], ['Ctrl', 'Y']]
			},
			notes: {
				title: 'Notes',
				text: 'The list shows each note with its title, the start of its text and where it belongs; the field above it searches title and text. “Edit note …” (or a double click) opens title and text – “Done” keeps, Esc puts back. “Tags” puts one of your tags on the selected notes or takes it off. “Tags ▾” next to the search field (or “Filter by tags” in the tab “Notes”) shows only the notes with the tags you tick – each one a chip below the field, × takes it away. With several tags, “Notes with all of them” (default) shows those that have every one, “one of them” those that have any; “Show all notes” ends the filter. “Notes as text …” (tab “File”) saves the selected notes – else all – as a text file in your files.'
			},
			highlights: {
				title: 'Highlights',
				text: 'Highlights are listed by publication and color with their number. “Color” gives the selected groups another color, “Delete” removes them (notes on them stay where they are). “Clean up” removes highlights that cover no text and tags that are on nothing.'
			},
			tags: {
				title: 'Tags and bookmarks',
				text: '“New tag” adds a tag and lets you name it. “Rename” (or F2, or a click on the name of the selected tag) renames it – a name another tag has puts both together. “Merge into” moves everything of the selected tags onto another one. Bookmarks can be looked at and deleted.',
				keys: [['F2']]
			}
		}
	},
	playlists: {
		title: 'Playlists',
		items: {
			create: {
				title: 'A new playlist',
				text: '“New playlist …” on the start page asks where the new .jwlplaylist file should go and what it is called – the playlist takes the file’s name – and opens it empty: add pictures and videos, then hand it to JW Library. In an open backup, “New playlist” (tab “Playlist”) adds an empty playlist to it and lets you name it right away.'
			},
			list: {
				title: 'Playlists in a backup',
				text: '“Playlists” lists them with their number of items; open one with a click (or “Open”), rename it with “Rename” (or F2). “Add playlist …” takes a .jwlplaylist of your files into the backup (under a free name), “Save as playlist file …” saves the open playlist as a .jwlplaylist of its own, “Delete playlist” removes it with its items.'
			},
			trim: {
				title: 'Trimming a video or a piece of music',
				text: '“Trim …” (tab “Playlist”, or the menu of an item) plays only a part of the selected video or piece of music – as “Trim” in JW Library does, and what is trimmed there shows here (the scissors next to the length). Type “Start” and “End” as minutes:seconds (e.g. 1:43.5). For a video of your own a preview plays above them: “Start here” and “End here” take its position, ▷ plays from the start or shortly before the end. Videos and music from publications lie in JW Library, so they have no preview here – only the times. “Untrimmed” plays the whole again; “Done” keeps it, as one step to undo. Pictures aren’t trimmed: their “Seconds” say how long they are shown.'
			},
			items: {
				title: 'Items',
				text: 'A playlist shows its items in order with their picture, name, length and what happens at their end. Change the name in its field, a picture’s seconds (how long it is shown) and “At the end” right there. “Move up” and “Move down” move the selected items (on the computer also drag them), “Remove” takes them out. “Pictures and videos …” adds pictures and videos of your files at the end, “From the device …” those of this device; “Append playlist …” the items of another .jwlplaylist. Videos and music from publications, added in JW Library, show their kind and length.',
				options: {
					continue: { label: '“Continue”', text: 'the next item follows by itself.' },
					stop: { label: '“Stop”', text: 'the playlist stops; the screen goes back to the list.' },
					freeze: { label: '“Freeze”', text: 'the item stays on screen until you go on – for pictures during a talk.' },
					repeat: { label: '“Repeat”', text: 'the item starts again.' }
				},
				tip: 'For pictures shown while you speak take “Freeze”: they stay until you tap on. For a slideshow running by itself, “Continue” with the seconds each picture should stay.'
			}
		}
	}
} satisfies HelpContent;

export default help;
