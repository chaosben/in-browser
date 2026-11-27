// Help texts of the Text Editor (English leads; `help.de.ts` must have the same keys): the help window of the tool
// and the page `/help/text-editor`. Describe what users see and do: what each function does, where it is and what
// follows from it.

import type { HelpContent } from '@in-browser/brand/help.js';

const help = {
	start: {
		title: 'Getting started',
		items: {
			startPage: {
				title: 'Start page',
				text: 'The Text Editor opens on its start page: “New” starts an empty text, “Open from Files …” picks a file from the browser storage that all in-browser tools share, “Open from computer …” reads a file from your computer. Below, “Recently opened” shows the last ten files as cards with their last change and folder – a click opens one again (files that are gone drop off the list), a middle click or “Open in new tab” of your browser opens it in a new browser tab. Each card’s menu – right click, its ⋯ button, or a long press on touch screens – offers “Open”, “Show in Files” and “Remove from list”; removing only takes it off the list, the file stays. You can also drag a text file from your computer onto the page. Text files you open in Files (“Open with Text Editor”) open here as well.'
			},
			onePage: {
				title: 'One file per page',
				text: 'The editor shows one file at a time, with its own address in the browser – you can bookmark it or reload the page. “New” or “Open” in the tab “File” replace the shown file in the same browser tab; it is saved first. To see several files side by side, open each in its own browser tab or window (e.g. a middle click on a card of the start page). A file can only be edited in one browser tab at a time: opening it in a second one shows “This file is already open in another tab or window.” – go back to the first one, or close it there.',
				tip: 'Comparing two files or copying between them? Open the second one in a new browser tab and put the two windows next to each other.'
			},
			fileMenu: {
				title: 'The tab “File”',
				text: 'The top bar only shows where you are: the name of the shown file stands after “Text Editor”. What you do to the file itself is in the first tab of the ribbon, “File”: the group “New” with “New” and “Open” (“Open from Files …”, “Open from computer …”), the group “File” with “Save”, “Save as …”, “Download”, “Share …” (the file for a guest – a link, a QR code or four words; see the help page on sharing), “Send …” (a copy for another app on this device – mail, a messenger; greyed out for types the browser doesn’t send), “Show in Files” and “Close”. What doesn’t work for this file is greyed out – a text without a place can’t be shown in Files yet. The editor opens on the tab “Home”, where you work on the text. A file is named after its file in the browser storage; to rename it, rename it in Files.'
			},
			ribbon: {
				title: 'The ribbon',
				text: 'Below the top bar lies the ribbon: “Undo” and “Redo” on the left, then the tabs “File” (new, open, save, download, close), “Home” (clipboard; “Find”, whose arrow offers “Replace” and “Go to line”; editing lines), “Format” (Markdown formatting) and “View” (layout, word wrap, text size). Tabs set off in color come with the view next to the text: “Table” while a table is shown, “Tree” while a tree is shown; picking a cell or an entry there switches to that tab by itself. Each tab shows its commands in groups with their names below; what can’t be used right now is greyed out, so nothing moves. When the window gets narrower, the groups on the right get smaller first, and at last a whole group becomes one button that opens it. The button at the right end of the tabs chooses how the ribbon is shown – for every in-browser tool on this device. The arrow next to it collapses the ribbon: only the tabs stay, and a click on a tab opens its commands over the text until you pick one; a double click on a tab or Ctrl+F1 do the same, and the arrow brings the ribbon back as it was.',
				options: {
					classic: { label: 'Classic (default on a computer)', text: 'Commands in three rows with their names, in groups with a name each. Easiest to find things, takes about 130 pixels of height.' },
					simplified: { label: 'Simplified', text: 'One compact row of buttons, without group names. Leaves more room for the text.' },
					minimal: { label: 'Minimal (default on phones and tablets)', text: 'One row of icons without text; hold the pointer over an icon – or press and hold it – to see its name. Least height with every command in reach.' }
				},
				tip: 'Start with Classic until you know where things are, then switch to Simplified or Minimal – or collapse the ribbon – to see more of the text.',
				keys: [['Ctrl', 'F1']]
			},
			accessKeys: {
				title: 'Access keys',
				text: 'Press and release Alt (or press F10): letters appear on the tabs and numbers on “Undo” and “Redo”. Type a tab’s letter, then the letter shown on a command to run it – everything works without the mouse. Esc goes back one step.',
				keys: [['Alt'], ['F10']]
			},
			restore: {
				title: 'Unsaved changes and new texts',
				text: 'What you type is kept in this browser as a draft until it is saved, so closing the browser tab loses nothing. A file with a place gets its changes back the next time you open it. A new text (“New”, or a file opened from your computer) has its own address with a draft number; reloading the page or coming back to that address in your browser’s history brings it back as you left it. Drafts are kept privately in this browser: they don’t appear in Files and are not synced. A file that was deleted meanwhile comes back with its changes and the bar “was deleted or moved”.',
				tip: 'This is a safety net, not a place to keep work. Save texts you want to keep (“Save …”), so they are real files that you can find in Files and that reach your other devices.'
			},
			install: {
				title: 'Install, offline and browsers',
				text: 'When your browser offers it, you can install the Text Editor like a program; it then also starts without an internet connection. Syntax highlighting for a language is loaded the first time you open such a file – offline, a file of a language never used before shows without colors until you are online again.',
				link: { href: '/help/install', label: 'Install, offline and supported browsers' }
			}
		}
	},
	files: {
		title: 'Opening and saving',
		items: {
			open: {
				title: 'Opening files',
				text: '“Open” in the tab “File” has two ways: “Open from Files …” chooses a file in the browser storage – it opens with its place, so every change is saved there. “Open from computer …” (or dragging a file onto the page) reads a copy of the file: it opens as a new text without a place, and nothing is written until you save it. One file opens at a time: of several dragged files only the first opens, dragged folders are skipped. The file replaces the shown one in this browser tab (which is saved first). Files larger than 20 MB and files that are not text (pictures, programs) are not opened. A text file or text shared from another app to the installed in-browser, or a file opened with it on your computer, opens the same way: as a new text without a place.',
				link: { href: '/help/install#system', label: 'With the other apps of your device' },
				tip: 'Want to keep editing a file from your computer here, also on other devices? Open it from the computer and save it once with “Save” – from then on it saves itself. If you only need a quick change, edit it and use “Download”.'
			},
			autosave: {
				title: 'Automatic saving',
				text: 'A file with a place in the browser storage saves itself about a second after you stop typing, and right away when you open another file, close it or leave the page. The icon at the left of the bottom bar shows the state: saved, saving, not saved yet – hover over it for the text. Saving keeps the file’s encoding and line ending, so an unchanged file stays exactly as it was. Nothing is uploaded.',
				link: { href: '/help/storage', label: 'Where your files are kept' }
			},
			connected: {
				title: 'Texts in a connected folder',
				text: 'The choice in front of the folder path of the open and save dialog switches between My files and the folders you connected in Files (“Connected”). A text from a connected folder opens and saves right there on your computer, also automatically. When the browser no longer allows access (usually after a restart), the save icon in the bottom bar shows an error, and a message offers “Allow access”; your changes are kept until then and saved after you allow it. Opening or reloading such a file shows the same message and tries again once you allow access. The same goes for folders shown with a cloud (opened live from your other devices) and folders a guest share gives you.',
				link: { href: '/help/connected', label: 'Connected folders' }
			},
			saveNew: {
				title: 'Saving a new text',
				text: '“Untitled” texts and files opened from your computer have no place yet: “Save” in the tab “File” (or Ctrl+S) asks for folder and name in the browser storage. The dialog starts in the folder you used last (if it is gone, in the next folder above it). A message then names the file and offers “Show in Files”. After that the file saves itself like any other, and the page’s address becomes the file’s. The ending of the name decides the highlighting – “notes.md” becomes Markdown.'
			},
			saveAs: {
				title: 'Save as',
				text: '“Save as …” in the tab “File” writes the text under a new name or into another folder – the editor then continues with the new file, the old one stays as it was. Choosing an existing file replaces it. The message afterwards offers “Show in Files”.'
			},
			rename: {
				title: 'Download, show in Files, rename',
				text: '“Download” in the tab “File” saves a copy to your computer’s download folder, in the current encoding and line ending – also for texts that have no place yet. “Show in Files” goes to Files, to the folder of the file, in the same browser tab as in every tool (the text is saved first; one without a place is kept and comes back when you return) – rename or move the file there; the Text Editor doesn’t rename files.'
			},
			close: {
				title: 'Closing',
				text: '“Close” in the tab “File” (Alt+W) goes back to the start page; the file is saved first. Only when that is not possible – the text has no place yet, or saving is paused – you are asked “Discard changes?”; “Discard” throws the changes away, “Cancel” keeps the file open. “New” and “Open” ask the same before they replace such a text. Leaving the page otherwise (closing the browser tab, the browser’s back button) keeps the changes as a draft.'
			},
			conflicts: {
				title: 'Changed elsewhere',
				text: 'The same file can change in another browser tab or through the sync with your other devices. If you have no unsaved changes, the editor asks whether to reload the file (“Reload” / “Don’t reload”, optionally without asking again while it is open). If you have, a yellow bar says the file “was changed elsewhere” and automatic saving pauses: “Reload” takes the other version and drops yours, “Keep my version” saves yours over it. If the file was deleted or moved, the bar says so and the next save creates it again. Saving by hand (Ctrl+S) over a newer version asks “Replace the newer version?” first.',
				tip: 'Not sure which version is right? Copy your text (Ctrl+A, Ctrl+C) before “Reload”, so you can put parts of it back.',
				link: { href: '/help/sync', label: 'Syncing your devices' }
			}
		}
	},
	formats: {
		title: 'Formats',
		items: {
			types: {
				title: 'File types',
				text: 'The editor opens plain text files: .txt, .log, .csv, .tsv, Markdown, JSON, JSON Lines (.jsonl, .ndjson), YAML, TOML, INI and other settings files, HTML, CSS, XML, JavaScript, TypeScript, Svelte, Python and shell scripts. The ending of the file name decides how the text is colored and which view it gets next to the text: a table, a tree or a preview (see below); the bottom bar shows the language (“Plain text” without one). SVG images open in Files as a picture – choose “Open with Text Editor” in the menu of the file to edit their text here, with the picture next to it. Settings files called .env (also .env.local …) are hidden in Files; open them with “Open from computer …”.'
			},
			table: {
				title: 'Table (CSV, TSV, JSON Lines)',
				text: 'CSV and TSV files show as a table next to the text, JSON Lines files (one JSON object per line) too – their columns are the keys of the objects. While a table is shown, the ribbon has the tab “Table”. Click a cell to make it the current one; double-click it (or press Enter, F2, or just start typing) to change it; Enter saves and goes down, Tab goes right, Esc cancels. A cell may have several lines: Shift+Enter or Alt+Enter starts a new one (on touch screens Enter does, and ✓ below the field saves); in the table its lines are joined by ⏎. Rows are picked like entries in Files: a click on a cell or row number picks its row, Ctrl+click adds or removes a row, Shift+click (or Shift+↑/↓) picks the rows in between, Ctrl+A all rows shown; picked rows are tinted. With nothing picked, the row of the current cell counts: Ctrl+click adds to it, Shift+click picks from it. The tab “Table” acts on the picked rows, else on the current cell: “Cell” – “Edit cell”, “Clear cells” (the cells of the current column in the picked rows, also Del); “Rows” – “Insert row above”, “Insert row below”, “Move up”, “Move down” (also Alt+↑/↓), “Delete rows”; “Columns” – “Insert column left”, “Insert column right”, “Rename column”, “Move left”, “Move right”, “Delete column” for the column of the current cell; “Sort & filter” – “Sort ascending” and “Sort descending” put the rows in that order in the file (numbers by their value, also with a decimal comma, text alphabetically with “2” before “10”, empty cells last; the column names stay on top), “Filter …” only hides rows: a field above the table keeps rows whose cell contains the text (capital or small letters don’t matter); its × or Esc in the field removes it, “Remove filters” removes all of them, and the bottom bar says “3 of 40 rows”; “Selection” – “Select all”, “Clear selection”. Every command is one step for “Undo”, also for many rows at once; a new column and the name you type for it are one step too. The column title opens the menu of its column; a right click on a cell or row number (on touch screens a long press) opens the menu with the commands for the cell, its rows and its column. Esc ends a selection of several rows; pressed again, it puts the cursor into the text.',
				options: {
					header: { label: 'First row as column names (default)', text: 'In the group “Options” of the tab “Table”: the first row of a CSV file is the title of each column. Turned off, the columns are called A, B, C … and the first row is data like all others.' },
					delimiter: { label: 'Delimiter', text: 'Also in “Options”: “Detect automatically” (default) reads the first lines and picks comma, semicolon, tab or vertical bar; choose one yourself if the table looks wrong. TSV files always use the tab. This only changes how the file is read, not the file.' }
				},
				tip: 'A table with one column where you expect several? Pick the delimiter in “Options” of the tab “Table” – German Excel, for example, writes semicolons. Lines of a JSON Lines file that aren’t objects show in italics and can only be changed in the text.'
			},
			tree: {
				title: 'Tree (JSON, YAML, TOML, INI, XML …)',
				text: 'JSON, YAML, TOML, XML, INI and .properties files and .env files show as a tree next to the text (JSON Lines and SVG can switch to one with “View type” in the tab “View”). While a tree is shown, the ribbon has the tab “Tree”. The arrows open and close a level; the first level starts open. Click a row to make it the current one; Ctrl+click, Shift+click (or Shift+↑/↓) and Ctrl+A pick several, as in Files; with nothing picked, the current row counts: Ctrl+click adds to it, Shift+click picks from it. Double-click a value (or press Enter) to change it, double-click a key or name (or press F2) to rename it; Enter saves, Esc cancels, Shift+Enter or Alt+Enter starts a new line in a value (on touch screens Enter does, and ✓ saves). Text values stay text; in other values numbers, true/false and null are recognized as such. The tab “Tree”: “Edit” – “Edit value”, “Rename”, “Duplicate”, “Delete” (also Del); “Insert” – an entry, item, element, attribute or text inside the current node, “Insert before”, “Insert after”, and in INI files “Add section”; “Arrange” – “Move up”, “Move down” (also Alt+↑/↓) and “Type” (text, number, yes/no, empty, object, list); “Show” – “Open all”, “Close all” and “Filter …”, which shows rows whose key or value contains the text, with the levels above them (Esc in the field closes it); “Selection” – “Select all”, “Clear selection”. Duplicating, deleting, moving and changing the type act on all picked nodes as one undo step; a new node and the name you type for it are one step too. The ⋯ button of a row (or a right click, on touch screens a long press) opens its menu with the same commands. Esc ends a selection of several nodes; pressed again, it puts the cursor into the text.',
				tip: 'What a format can’t do is not offered: TOML has no “empty” value, INI values are always text, XML comments, YAML aliases (*name) and the order of TOML tables can only be changed in the text.'
			},
			bothSides: {
				title: 'Editing on both sides',
				text: 'The text and the table or tree are the same file: whatever you change on one side shows on the other right away, and saving, “Undo” and the sync work the same for both – every change in the table or tree is one undo step. A change there only rewrites the place it concerns; the rest of the text, with its indentation, comments, quotes and empty lines, stays exactly as it was. Clicking a cell or row in the view puts the cursor of the text there, and moving the cursor in the text marks the cell or row. If the text has an error (a missing quote or bracket), a yellow bar names the line and the view shows the last version without errors, unchanged, until the text is fixed; “Show in text” jumps there.'
			},
			highlighting: {
				title: 'Syntax highlighting and code help',
				text: 'In code and data files keywords, strings, numbers and comments get their own colors. Brackets and quotes close themselves, the matching bracket is marked, and new lines keep the indentation. The arrows next to the line numbers fold a block (a function, a section) away and back.'
			},
			preview: {
				title: 'Previews: Markdown, HTML, SVG',
				text: 'Markdown files (.md, .markdown) show their formatted text next to the editor, HTML files the page, SVG files the picture – each follows your typing and can only be read there; you write in the text. Markdown tables, task lists and strikethrough are shown as well. Links open in a new browser tab. For safety the previews run nothing and load nothing from outside: scripts of an HTML page don’t run, and pictures, styles or fonts from the web or next to the file are not shown – only what is in the text itself. Transparent parts of an SVG show a checkerboard.'
			},
			encoding: {
				title: 'Encoding',
				text: 'How the characters are stored as bytes. The editor detects it when opening and keeps it when saving; the bottom bar shows it (e.g. “UTF-8”). Click it for two lists: “Reopen with encoding” reads the file again in another encoding (only files with a place; unsaved changes are lost after asking), “Save with encoding” stores the text in another one from the next save on.',
				options: {
					utf8: { label: 'UTF-8', text: 'Holds every character of every language. The standard today and the choice for new files.' },
					bom: { label: '… with BOM', text: 'Adds an invisible mark at the beginning that announces the encoding. A few programs need it, others show it as stray characters.' },
					utf16: { label: 'UTF-16 LE / UTF-16 BE', text: 'Every character in two or more bytes; used by some Windows programs and exports.' },
					legacy: { label: 'Windows-1252 / ISO-8859-1', text: 'Older encodings for Western European languages: one byte per character, but no emoji, no Greek, Cyrillic or Asian characters.' }
				},
				tip: 'Keep what the file has. If umlauts look broken (“Ã¤” instead of “ä”, or “�”), the guess was wrong: try “Reopen with encoding” → Windows-1252 or UTF-8. Choose “UTF-8 with BOM” for CSV files that Excel should open with the right umlauts. If a character can’t be stored in the chosen encoding, a bar says so and automatic saving pauses – “Save as UTF-8” solves it.'
			},
			lineEnding: {
				title: 'Line ending',
				text: 'The bottom bar shows how lines end in this file – “LF” or “CRLF” – detected when opening and kept when saving. Click it to change it; the change is saved like an edit.',
				options: {
					lf: { label: 'LF', text: 'Usual on macOS, Linux, the web and in code projects. New texts use it.' },
					crlf: { label: 'CRLF', text: 'Usual on Windows. Some Windows tools and older programs expect it.' }
				},
				tip: 'Keep what the file has, so other people see only your real changes. Choose CRLF only when a Windows program needs it, e.g. batch files (.bat).'
			}
		}
	},
	edit: {
		title: 'Editing and formatting',
		items: {
			undo: {
				title: 'Undo',
				text: '“Undo” and “Redo” are the arrows at the left of the ribbon (on phones too). The history is lost when you open another file or reload the page.',
				keys: [['Ctrl', 'Z'], ['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']]
			},
			clipboard: {
				title: 'Clipboard',
				text: '“Paste”, “Cut” and “Copy” in the tab “Home” do what the keys do – handy on touch screens. “Cut” and “Copy” need selected text. The browser may ask once whether the page may read the clipboard; without that permission “Paste” shows a message, and the keys still work.',
				keys: [['Ctrl', 'V'], ['Ctrl', 'X'], ['Ctrl', 'C']]
			},
			formatting: {
				title: 'Markdown formatting',
				text: 'The tab “Format” of the ribbon formats Markdown files; in other files its commands are greyed out. The group “Text” – “Bold”, “Italic”, “Inline code” and “Link” – works on the selection: bold, italic and code put the marks around it, or remove them when they are already there. “Link” turns the selected text into a link and puts the cursor where the address goes; a selected web address becomes the address of the link.',
				keys: [['Ctrl', 'B'], ['Ctrl', 'I'], ['Ctrl', 'K']]
			},
			paragraph: {
				title: 'Paragraphs and lists',
				text: 'The groups “Paragraph” (“Heading 1” to “Heading 3”, “Quote”, “Code block”) and “Lists” (“Bulleted list”, “Numbered list”, “Task” – a checkbox item) of the tab “Format” change whole lines. They act on every line of the selection – empty lines are skipped, numbered lists are counted up. If all lines already have this format, it is removed; another heading level or list type is replaced. “Code block” puts fences around the selected lines.'
			},
			lines: {
				title: 'Working with lines',
				text: 'The group “Edit” of the tab “Home”: “Move line up” and “Move line down” move the current line (or all selected lines), “Indent” and “Outdent” change their indentation, “Comment” comments them out in code and back in, “Select all” selects the whole text. With the keyboard you can also copy a line above or below or delete it; Tab and Shift+Tab indent as well.',
				keys: [['Alt', '↑'], ['Alt', '↓'], ['Ctrl', ']'], ['Ctrl', '['], ['Ctrl', '/'], ['Shift', 'Alt', '↓'], ['Ctrl', 'Shift', 'K'], ['Tab'], ['Shift', 'Tab']]
			},
			multi: {
				title: 'Several cursors',
				text: 'You can type in several places at once. Ctrl+click adds a cursor, Ctrl+D adds the next occurrence of the selected word to the selection, Ctrl+Alt+↑/↓ adds a cursor in the line above or below. Drag with Alt held to select a rectangular block, e.g. one column of a table. Esc goes back to a single cursor.',
				keys: [['Ctrl', 'D'], ['Ctrl', 'Alt', '↑'], ['Ctrl', 'Alt', '↓'], ['Esc']]
			}
		}
	},
	search: {
		title: 'Search and replace',
		items: {
			find: {
				title: 'Find',
				text: '“Find” in the tab “Home” opens a bar above the text. Every match is marked; Enter or “next” jumps to the next one, Shift+Enter or “previous” back, “all” selects all matches so you can edit them together. The options: “match case” tells capital and small letters apart, “by word” finds only whole words, “regexp” takes the search as a regular expression. Esc closes the bar. Selecting a word also marks its other occurrences, even without the bar. The arrow next to “Find” offers “Replace” and “Go to line”.',
				keys: [['Ctrl', 'F'], ['Enter'], ['Shift', 'Enter'], ['F3'], ['Esc']]
			},
			replace: {
				title: 'Replace',
				text: '“Replace” (under the arrow next to “Find”) opens the same bar with the cursor in the replace field. “replace” replaces the current match and moves on, “replace all” replaces every match at once – it can be undone in one step. With “regexp” on, $1, $2 … in the replacement insert the parts of the match in brackets.',
				keys: [['Ctrl', 'H']]
			},
			gotoLine: {
				title: 'Go to line',
				text: '“Go to line” asks for a line number and jumps there. “12:5” also goes to column 5, “+10” or “-10” moves relative to the current line, “50%” to the middle of the text.',
				keys: [['Ctrl', 'G']]
			}
		}
	},
	view: {
		title: 'View',
		items: {
			wrap: {
				title: 'Word wrap',
				text: '“Word wrap” in the tab “View” (group “Text”) breaks long lines at the edge of the window instead of scrolling sideways. It only changes the display, not the file. It is on by default on phones and narrow windows and applies to all files.',
				tip: 'Turn it on for prose and Markdown, where a paragraph is one long line. Turn it off for code and tables, where the line structure matters.'
			},
			fontSize: {
				title: 'Text size',
				text: '“Larger text” and “Smaller text” in the tab “View” change the size of the text in the editor step by step; “Default text size” goes back. The setting applies to all files and is remembered in this browser.'
			},
			preview: {
				title: 'Text, view or both',
				text: 'Files with a table, tree or preview choose in the group “Layout” of the tab “View” what is shown – remembered for next time and for all files; for other files these buttons are greyed out. Where a file type has several views (JSON Lines: table or tree, SVG: picture or tree), “View type” picks one.',
				options: {
					text: { label: 'Text only', text: 'Only the text, as for every other file.' },
					split: { label: 'Side by side (default)', text: 'Text on the left, view on the right. Drag the line between them (or select it and use the arrow keys) to share the width differently; a double-click shares it half and half.' },
					view: { label: 'View only', text: 'The whole width for the table or tree – good for wide tables. The text stays open in the background; undo works as usual.' }
				},
				tip: 'Working mostly with the table or tree? Choose “View only” and go back to “Side by side” when you need the text. On narrow screens there is no room for both: “Side by side” is greyed out, and you switch between “Text only” and “View only”.'
			},
			statusBar: {
				title: 'Bottom bar',
				text: 'At the left of the bottom bar: the save state, the cursor position (line and column), how many characters are selected, the language, what the view shows (“12 rows × 4 columns”, “3 of 40 rows” while filtering, or the path of the selected entry such as “server.ports[0]”), the line ending and the encoding. Line ending and encoding are buttons that change them. At the right the state of the sync with your other devices.',
				link: { href: '/help/sync', label: 'Syncing your devices' }
			}
		}
	},
	keys: {
		title: 'Keyboard shortcuts',
		items: {
			note: {
				title: 'On a Mac',
				text: 'Where it says Ctrl, press Cmd on a Mac. Redo there is Cmd+Shift+Z, folding the block at the cursor Cmd+Alt+[ and Cmd+Alt+], while folding everything stays Ctrl+Alt+[ and Ctrl+Alt+]. New and Close use Alt, because Ctrl+N and Ctrl+W belong to the browser.'
			},
			files: {
				title: 'Files',
				text: 'Save (asks for a place for a text without one), Save as, Open from Files, New, Close – these also work while you type',
				keys: [['Ctrl', 'S'], ['Ctrl', 'Shift', 'S'], ['Ctrl', 'O'], ['Alt', 'N'], ['Alt', 'W']]
			},
			undo: { title: 'Undo and redo', text: 'In the text and its view', keys: [['Ctrl', 'Z'], ['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']] },
			search: {
				title: 'Search',
				text: 'Find, Replace, Go to line; in the search bar next/previous match',
				keys: [['Ctrl', 'F'], ['Ctrl', 'H'], ['Ctrl', 'G'], ['F3'], ['Shift', 'F3']]
			},
			select: {
				title: 'Selection',
				text: 'Select all, add the next occurrence, select all occurrences of the selection, back to one cursor',
				keys: [['Ctrl', 'A'], ['Ctrl', 'D'], ['Ctrl', 'Shift', 'L'], ['Esc']]
			},
			lines: {
				title: 'Lines',
				text: 'Move up/down, copy down, delete, new line below without splitting the current one',
				keys: [['Alt', '↑'], ['Alt', '↓'], ['Shift', 'Alt', '↓'], ['Ctrl', 'Shift', 'K'], ['Ctrl', 'Enter']]
			},
			indent: {
				title: 'Indent and comment',
				text: 'Indent more/less, comment lines in or out (in code)',
				keys: [['Tab'], ['Shift', 'Tab'], ['Ctrl', ']'], ['Ctrl', '['], ['Ctrl', '/']]
			},
			fold: {
				title: 'Folding',
				text: 'Fold or unfold the block at the cursor, fold or unfold all',
				keys: [['Ctrl', 'Shift', '['], ['Ctrl', 'Shift', ']'], ['Ctrl', 'Alt', '['], ['Ctrl', 'Alt', ']']]
			},
			markdown: {
				title: 'Markdown',
				text: 'Bold, italic, link (only in Markdown files)',
				keys: [['Ctrl', 'B'], ['Ctrl', 'I'], ['Ctrl', 'K']]
			},
			table: {
				title: 'Table',
				text: 'Move between cells (also by page), pick rows (Shift with the arrows), pick all rows, edit the cell (or just type), save and go down or right, new line in the cell, cancel or end the selection, empty the cells, move the rows',
				keys: [['↑'], ['↓'], ['←'], ['→'], ['Page ↑'], ['Page ↓'], ['Shift', '↑'], ['Shift', '↓'], ['Ctrl', 'A'], ['Enter'], ['F2'], ['Tab'], ['Shift', 'Enter'], ['Alt', 'Enter'], ['Esc'], ['Del'], ['Alt', '↑'], ['Alt', '↓']]
			},
			tree: {
				title: 'Tree',
				text: 'Move between rows, pick (Shift with the arrows), pick all, open/close (or go to the level above/below), edit the value, rename, move the entries, delete, end the selection',
				keys: [['↑'], ['↓'], ['Shift', '↑'], ['Shift', '↓'], ['Ctrl', 'A'], ['→'], ['←'], ['Space'], ['Enter'], ['F2'], ['Alt', '↑'], ['Alt', '↓'], ['Del'], ['Esc']]
			},
			ribbon: {
				title: 'Ribbon',
				text: 'Collapse or expand the ribbon, access keys',
				keys: [['Ctrl', 'F1'], ['Alt'], ['F10']]
			}
		}
	},
	phones: {
		title: 'Phones and tablets',
		items: {
			touch: {
				title: 'Using it by touch',
				text: 'Everything works without a keyboard. On a phone or tablet the ribbon starts as “Minimal”: the tabs in one row (“File”, “Home”, “Format”, “View”, and “Table” or “Tree” while such a view is shown), below it the tab’s commands as icons that scroll sideways – press and hold one to see its name. The arrow at the right of the tabs collapses the ribbon when you need the height. New, open, save and close are in the tab “File”; the shown tab has a ⋯ button with the menu of the file plus “Close others”. In a table or tree a tap selects, a second tap on the same cell, key or value edits it. A long press opens the menu and starts the selection mode: check boxes appear (in the row numbers of a table, at the start of the rows of a tree), taps pick and unpick, and the commands of the tab “Table” or “Tree” act on what is picked; “Clear selection” there ends it. A tap on a row number opens the menu of its row, the ⋯ of a tree row its menu. In the bottom bar tap the line ending or encoding to change it.'
			},
			mobileView: {
				title: 'Reading and writing on a small screen',
				text: 'Word wrap is on by default, so nothing scrolls sideways. In files with a view (Markdown, CSV, JSON …) there is no room for both: “Text only” and “View only” in the tab “View” switch between the text and the preview, table or tree. Wide tables scroll sideways with the row numbers staying in place. “Larger text” in “View” helps if the text is hard to read.'
			},
			fromPhone: {
				title: 'Files from the phone',
				text: '“Open from computer …” opens the phone’s file picker – also for files from other apps or cloud storage. To get a text back out, use “Download”, or keep it in the browser storage and let it reach your other devices through the sync.',
				link: { href: '/help/sync', label: 'Syncing your devices' }
			}
		}
	}
} satisfies HelpContent;

export default help;
