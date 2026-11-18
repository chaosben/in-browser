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
				text: 'With no file open you see the start page: “New” starts an empty text, “Open from Files …” picks files from the browser storage that all in-browser tools share, “Open from computer …” reads files from your computer. Below, “Recently opened” lists the last ten files with their folder – a click opens one again. You can also drag text files from your computer onto the page. Text files you open in Files (“Open with Text Editor”) open here as well.'
			},
			tabs: {
				title: 'Tabs',
				text: 'Every open file gets a tab above the text. Click a tab to show it, click its × or the middle mouse button to close it; a right click (on touch screens a long press) offers “Close”, “Close others” and “Show in Files”. A dot in the tab means: changed and not saved, and it won’t save itself – the file has no place yet, or saving is paused. Opening a file that is already open just switches to its tab. A fresh, empty “Untitled” tab gives way to the first file you open.'
			},
			fileMenu: {
				title: 'The file name in the top bar',
				text: 'The name of the shown file stands in the top bar. Click it to rename the file (only files with a place in the browser storage). The arrow next to it opens the menu with every action for this file: saving, undo, search, formatting (Markdown), “Rename”, “Download”, “Show in Files”, “New”, opening and “Close”. The most used ones also sit as buttons next to the name; on narrow screens they are only in this menu.'
			},
			restore: {
				title: 'Coming back',
				text: 'Your open tabs come back the next time you open the Text Editor – including changes that were not saved yet, also in “Untitled” texts and files from your computer. These unsaved changes are kept privately in this browser: they don’t appear in Files and are not synced. A tab of a file that no longer exists only comes back if it had unsaved changes.',
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
				text: '“Open” in the top bar has two ways: “Open from Files …” chooses one or more files in the browser storage – they open with their place, so every change is saved there. “Open from computer …” (or dragging files onto the page) reads a copy of the files: they open without a place, and nothing is written until you save them. Dragged folders are skipped. Files larger than 20 MB and files that are not text (pictures, programs) are not opened.',
				tip: 'Want to keep editing a file from your computer here, also on other devices? Open it from the computer and save it once with “Save …” – from then on it saves itself. If you only need a quick change, edit it and use “Download”.'
			},
			autosave: {
				title: 'Automatic saving',
				text: 'A file with a place in the browser storage saves itself about a second after you stop typing, and right away when you switch tabs, close the tab or leave the page. The icon at the left of the bottom bar shows the state: saved, saving, not saved yet – hover over it for the text. Saving keeps the file’s encoding and line ending, so an unchanged file stays exactly as it was. Nothing is uploaded.',
				link: { href: '/help/storage', label: 'Where your files are kept' }
			},
			saveNew: {
				title: 'Saving a new text',
				text: '“Untitled” texts and files opened from your computer have no place yet: the button “Save …” in the top bar (and Ctrl+S) asks for folder and name in the browser storage. The dialog starts in the folder you used last. After that the file saves itself like any other. The ending of the name decides the highlighting – “notes.md” becomes Markdown.'
			},
			saveAs: {
				title: 'Save as',
				text: '“Save as …” in the menu at the file name writes the text under a new name or into another folder – the tab then continues with the new file, the old one stays as it was. Choosing an existing file replaces it.'
			},
			rename: {
				title: 'Rename, download, show in Files',
				text: 'Click the file name in the top bar (or “Rename” in its menu) to rename the file in its folder; with a new ending the highlighting changes along. “Download” saves a copy to your computer’s download folder, in the current encoding and line ending – also for texts that have no place yet. “Show in Files” opens Files in a new browser tab, in the folder of the file.'
			},
			close: {
				title: 'Closing',
				text: '“Close” saves a file with a place first. Only when that is not possible – the text has no place yet, or saving is paused – you are asked “Discard changes?”; “Discard” throws the changes away.'
			},
			conflicts: {
				title: 'Changed elsewhere',
				text: 'The same file can change in another browser tab or through the sync with your other devices. If you have no unsaved changes, the editor simply reloads the file and says so. If you have, a yellow bar says the file “was changed elsewhere” and automatic saving pauses: “Reload” takes the other version and drops yours, “Keep my version” saves yours over it. If the file was deleted or moved, the bar says so and the next save creates it again. Saving by hand (Ctrl+S) over a newer version asks “Replace the newer version?” first.',
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
				text: 'The editor opens plain text files: .txt, .log, .csv, .tsv, Markdown, JSON, YAML, TOML, INI and other settings files, HTML, CSS, XML, JavaScript, TypeScript, Svelte, Python and shell scripts. The ending of the file name decides how the text is colored; the bottom bar shows the language (“Plain text” without one). CSV and TSV open as plain text – the editor does not show them as a table.'
			},
			highlighting: {
				title: 'Syntax highlighting and code help',
				text: 'In code and data files keywords, strings, numbers and comments get their own colors. Brackets and quotes close themselves, the matching bracket is marked, and new lines keep the indentation. The arrows next to the line numbers fold a block (a function, a section) away and back.'
			},
			preview: {
				title: 'Markdown preview',
				text: 'For Markdown files (.md, .markdown) the preview shows the formatted text next to the editor and follows your typing. Tables, task lists and strikethrough are shown as well. Links open in a new browser tab. For safety the preview runs nothing and loads nothing from outside: pictures from the web or next to the file are not shown, only pictures embedded in the text itself. Turn it on or off with “Markdown preview” in the menu “View”.'
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
				text: '“Undo” and “Redo” are buttons next to the file name and in its menu. Every tab keeps its own history; it is lost when you close the tab or reload the page.',
				keys: [['Ctrl', 'Z'], ['Ctrl', 'Y']]
			},
			formatting: {
				title: 'Markdown formatting',
				text: 'In Markdown files the top bar shows “Bold”, “Italic” and “Link”. They work on the selection: bold and italic put the marks around it, or remove them when they are already there. “Link” turns the selected text into a link and puts the cursor where the address goes; a selected web address becomes the address of the link.',
				keys: [['Ctrl', 'B'], ['Ctrl', 'I'], ['Ctrl', 'K']]
			},
			paragraph: {
				title: 'Paragraph menu',
				text: 'The menu “Paragraph” (also in the menu at the file name) changes whole lines: “Heading 1” to “Heading 3”, “Bulleted list”, “Numbered list”, “Task” (a checkbox item), “Quote”, “Code block” and “Inline code”. It acts on every line of the selection – empty lines are skipped, numbered lists are counted up. If all lines already have this format, it is removed; another heading level or list type is replaced.'
			},
			lines: {
				title: 'Working with lines',
				text: 'Move the current line (or all selected lines) up or down, copy it above or below, delete it, or indent it. Tab indents the selection, Shift+Tab takes the indentation back. Ctrl+/ comments lines out in code and back in.',
				keys: [['Alt', '↑'], ['Alt', '↓'], ['Shift', 'Alt', '↓'], ['Ctrl', 'Shift', 'K'], ['Tab'], ['Shift', 'Tab'], ['Ctrl', '/']]
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
				text: '“Find” (under “Search” in the top bar) opens a bar above the text. Every match is marked; Enter or “next” jumps to the next one, Shift+Enter or “previous” back, “all” selects all matches so you can edit them together. The options: “match case” tells capital and small letters apart, “by word” finds only whole words, “regexp” takes the search as a regular expression. Esc closes the bar. Selecting a word also marks its other occurrences, even without the bar.',
				keys: [['Ctrl', 'F'], ['Enter'], ['Shift', 'Enter'], ['F3'], ['Esc']]
			},
			replace: {
				title: 'Replace',
				text: '“Replace” opens the same bar with the cursor in the replace field. “replace” replaces the current match and moves on, “replace all” replaces every match at once – it can be undone in one step. With “regexp” on, $1, $2 … in the replacement insert the parts of the match in brackets.',
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
				text: '“Word wrap” in the menu “View” breaks long lines at the edge of the window instead of scrolling sideways. It only changes the display, not the file. It is on by default on phones and narrow windows and applies to all tabs.',
				tip: 'Turn it on for prose and Markdown, where a paragraph is one long line. Turn it off for code and tables, where the line structure matters.'
			},
			fontSize: {
				title: 'Text size',
				text: '“Larger text” and “Smaller text” in the menu “View” change the size of the text in the editor step by step; “Default text size” goes back. The setting applies to all tabs and is remembered in this browser.'
			},
			preview: {
				title: 'Preview side by side',
				text: 'On wide screens the Markdown preview stands to the right of the text; “Markdown preview” in the menu “View” turns it on and off – remembered for next time. On narrow screens there is no room for both: the preview button in the top bar switches between text and preview.'
			},
			statusBar: {
				title: 'Bottom bar',
				text: 'At the left of the bottom bar: the save state, the cursor position (line and column), how many characters are selected, the language, the line ending and the encoding. Line ending and encoding are buttons that change them. At the right the state of the sync with your other devices.',
				link: { href: '/help/sync', label: 'Syncing your devices' }
			}
		}
	},
	keys: {
		title: 'Keyboard shortcuts',
		items: {
			note: {
				title: 'On a Mac',
				text: 'Where it says Ctrl, press Cmd on a Mac. Redo there is Cmd+Shift+Z, folding the block at the cursor Cmd+Alt+[ and Cmd+Alt+], while folding everything stays Ctrl+Alt+[ and Ctrl+Alt+]. New tab and closing use Alt, because Ctrl+N and Ctrl+W belong to the browser.'
			},
			files: {
				title: 'Files and tabs',
				text: 'Save (“Save …” for a text without a place), Save as, Open from Files, New, Close',
				keys: [['Ctrl', 'S'], ['Ctrl', 'Shift', 'S'], ['Ctrl', 'O'], ['Alt', 'N'], ['Alt', 'W']]
			},
			undo: { title: 'Undo and redo', text: 'Per tab', keys: [['Ctrl', 'Z'], ['Ctrl', 'Y']] },
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
			}
		}
	},
	phones: {
		title: 'Phones and tablets',
		items: {
			touch: {
				title: 'Using it by touch',
				text: 'Everything works without a keyboard. Tap the arrow next to the file name in the top bar: its menu holds every action for the file, including those that are buttons on wide screens (undo, search, formatting) and “New” and opening. Hold a finger on a tab for its menu (“Close others”, “Show in Files”). In the bottom bar tap the line ending or encoding to change it.'
			},
			mobileView: {
				title: 'Reading and writing on a small screen',
				text: 'Word wrap is on by default, so nothing scrolls sideways. In Markdown files the preview button in the top bar switches between text and preview, as there is no room for both. “View” makes the text larger if it is hard to read.'
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
