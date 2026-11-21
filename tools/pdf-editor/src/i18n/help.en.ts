// Help texts of the PDF Editor (English leads; `help.de.ts` must have the same keys): the help window of the tool and
// the page `/help/pdf-editor`. Describe what users see and do: what each option means, what it costs and how to decide.

import type { HelpContent } from '@in-browser/brand/help.js';

const help = {
	start: {
		title: 'Getting started',
		items: {
			startPage: {
				title: 'Start page',
				text: 'The start page lists the PDFs you opened recently, the newest first, with their folder and when they were last changed. Click one to open it; the menu next to it (three dots, a right-click or a long press) has “Open” and “Remove from the list” – removing only forgets it here, the file stays. A PDF that no longer exists drops off the list by itself.'
			},
			open: {
				title: 'Opening a PDF',
				text: '“Open PDF …” picks a PDF from your files. Files opens PDFs here too when you double-click them; “Open with …” in Files still offers Notes, which makes a new notebook from it. “Open from the computer …” copies a PDF from your computer into your files first and asks where it should be kept: the PDF Editor always works on a file in your files, so it can keep your changes.',
				link: { href: '/help/storage', label: 'Where your files are kept' }
			},
			layout: {
				title: 'Layout',
				text: 'The top bar only shows the name of the open PDF – it is named after its file; rename it in Files. Below it lies the ribbon: “Undo” and “Redo” on the left, then the tabs “File” (group “PDF”: “Download” saves a copy on this device, “Show in Files” opens its folder in Files), “Home” (tools, find; the PDF opens on this tab), “Comment” (draw), “Pages” (rotate, move, delete, insert, extract, merge), “Form” (fields) and “View” (side panels). Each tab shows its commands in groups with their names below. Tabs set off in color come and go with what you work on: while a tool that draws comments is chosen or comments are selected, a tab for their format appears (“Text box”, “Note”, “Marked text”, “Drawing”, or “Selection” for several kinds), with a selection also “Arrange”. On the left edge a narrow bar holds the side panels: “Pages”, “Search”, “Comments” and – when the PDF has them – “Fields”, “Bookmarks”, “Attachments” and “Layers”; click one to open it next to the pages, click it again to close it, and drag its right edge to make it wider. At the bottom edge: the arrows to the first, previous, next and last page around the page number (type another one and press Enter to go there) and the number of pages, then “Zoom out”, the zoom and “Zoom in”.'
			},
			ribbon: {
				title: 'Ribbon display',
				text: 'When the window gets narrower, the groups on the right get smaller first: their buttons lose the text below the icon, then their text altogether, and at last a whole group becomes one button that opens it. The button with the bar icon at the right end of the tabs chooses how the ribbon is shown; the arrow next to it switches to “Tabs only” and back.',
				options: {
					classic: { label: 'Classic (default)', text: 'Large buttons in groups with their names. Easiest to find things, takes about 120 pixels of height.' },
					simplified: { label: 'Simplified', text: 'One compact row of buttons, without group names. Leaves more room for the pages.' },
					tabs: { label: 'Tabs only', text: 'Only the tabs; a click on a tab opens its commands over the page until you pick one. Most room for the pages.' }
				},
				tip: 'Start with Classic until you know where things are, then switch to Simplified or Tabs only to see more of the page.',
				keys: [['Ctrl', 'F1']]
			},
			accessKeys: {
				title: 'Access keys',
				text: 'Press and release Alt (or press F10): letters appear on the tabs and numbers on “Undo” and “Redo”. Type a tab’s letter, then the letter shown on a command to run it – everything works without the mouse. Esc goes back one step.',
				keys: [['Alt'], ['F10']]
			},
			phone: {
				title: 'On a phone',
				text: 'On a phone the ribbon is a single bar below the top bar: the button on the left picks the tab, the commands next to it are icons and scroll sideways. Press and hold an icon to see its name. Selecting comments switches to their tab by itself; a tool’s format tab is in the tab picker. Side panels open over the whole screen from the “View” tab.'
			},
			connected: {
				title: 'In a connected folder',
				text: 'In the dialogs the choice in front of the folder path switches between My files and the folders you connected in Files. A PDF there is opened right from that folder on your computer.',
				link: { href: '/help/connected', label: 'Connected folders' }
			},
			sync: {
				title: 'On all your devices',
				text: 'PDFs are ordinary files of the shared file system, so they travel with the device sync.',
				link: { href: '/help/sync', label: 'Sync between devices' }
			},
			install: {
				title: 'Install and offline',
				text: 'When your browser offers it, you can install the PDF Editor like an app; it then also starts without an internet connection.',
				link: { href: '/help/install', label: 'Install, offline and browsers' }
			}
		}
	},
	view: {
		title: 'Viewing',
		items: {
			navigate: {
				title: 'Moving through the pages',
				text: 'The pages lie one below the other. Scroll with the mouse wheel or the touchpad, drag with two fingers on a touch screen, or with the “Hand” tool (on the “Home” tab) drag with the mouse. The arrows in the bottom bar jump to the first, previous, next or last page (on a phone only previous and next); between them, type a page number and press Enter.',
				keys: [['Page Up'], ['Page Down'], ['Home'], ['End']]
			},
			zoom: {
				title: 'Zoom',
				text: '“Zoom in” and “Zoom out” – the buttons beside the zoom in the bottom bar – change the size in steps. The zoom itself opens a menu: “Fit width” makes the page as wide as the window, “Whole page” shows the whole page, “Actual size” shows it at 100 %. Pinch with two fingers on a touch screen, or hold Ctrl and turn the mouse wheel, to zoom where you point.',
				keys: [['Ctrl', '+'], ['Ctrl', '-'], ['Ctrl', '0']]
			},
			pages: {
				title: 'Pages panel',
				text: 'Small pictures of all pages; the current one is marked. Click a page to go there. Drag the panel wider to see the pages side by side. To change several pages at once, pick them: Ctrl+click adds or removes a page, Shift+click picks all from the last one clicked, Ctrl+A picks all (while the panel has the focus), Esc clears the pick. Right-click a page for its menu, and drag picked pages to another place. On a touch screen, press and hold a page: its menu opens and the selection mode starts – check boxes appear, a tap picks or unpicks a page, “Select all” in the menu picks every page, and “Clear selection” at the top of the panel ends it. The ⋯ button on a page opens its menu too. The line at the top always says how many pages are picked.',
				keys: [['Ctrl', 'A'], ['Esc']],
				link: { href: '/help/pdf-editor#changes', label: 'Organizing pages' }
			},
			outline: {
				title: 'Bookmarks',
				text: 'The table of contents the PDF brings along, if it has one. Click an entry to go to its place; the arrows open and close its sub-entries.'
			},
			search: {
				title: 'Search',
				text: 'Finds text in the whole PDF and lists every hit with the words around it; the hits are marked on the pages. Enter or the arrows go to the next and previous hit; “Match case” tells capital and small letters apart. Scanned pages (pictures of text) can’t be searched.',
				keys: [['Ctrl', 'F'], ['Enter'], ['Shift', 'Enter']]
			},
			selectText: {
				title: 'Selecting text',
				text: 'With the tool “Select text” (on the “Home” tab) drag over the text to select it, then copy it. Scanned pages have no text to select. “Hand” switches back to moving the pages by dragging.',
				keys: [['V'], ['H'], ['Ctrl', 'C']]
			},
			attachments: {
				title: 'Attachments',
				text: 'Files embedded in the PDF. Each one can be downloaded or saved in your files.'
			},
			layers: {
				title: 'Layers',
				text: 'Some PDFs (plans, maps) have layers that can be shown or hidden. Switch them here; this only changes the view, not the file.'
			}
		}
	},
	comment: {
		title: 'Commenting',
		items: {
			mark: {
				title: 'Marking text',
				text: 'With “Highlight”, “Underline” or “Strike out” on the “Comment” tab, drag over text: it marks exactly the characters you pass, line by line, and shows them while you drag. A highlight reaches from the bottom of the letters below the line (g, p, y) to the top of the tallest ones, as far as the text’s font says; lines set close together meet without overlapping. Each of the three keeps its own color, set on the tab “Marked text” while the tool is chosen. Marked text belongs to its text: it can be selected, recolored and deleted, but not moved. Scanned pages have no text to mark.',
				keys: [['M'], ['U'], ['X']]
			},
			note: {
				title: 'Sticky notes',
				text: 'With “Note” (group “Comment”) click where the note should point: its icon appears there and a field below it takes your comment right away. The comment is saved when you leave the field – click elsewhere or press Esc. To read or change it later, double-click the note with “Select”, click it with “Note”, or select it and choose “Edit comment” (in the small bar at the note or on the tab “Note”, which also sets its icon and color). Other programs show it as a comment with your text.',
				options: {
					comment: { label: '“Comment” (default)', text: 'A speech bubble – a remark or question.' },
					note: { label: '“Note”', text: 'A sheet of paper – a longer note.' },
					key: { label: '“Key”', text: 'Something important.' },
					help: { label: '“Help”', text: 'A question mark – something is unclear.' },
					newParagraph: { label: '“New paragraph”', text: 'A new paragraph should start here.' },
					paragraph: { label: '“Paragraph”', text: 'About the paragraph as a whole.' },
					insert: { label: '“Insert”', text: 'A caret – something should be inserted here.' }
				},
				tip: '“Icon” on the tab “Note” changes the selected notes, or – with nothing selected – the next one you place. These are the seven icons every PDF program knows, so others see the same symbol.',
				keys: [['N']]
			},
			textbox: {
				title: 'Text boxes',
				text: 'With “Text box” (group “Comment”) click on the page to type there – the box grows with the longest line (“Auto width”) – or drag a box open to type into exactly that box (“Fixed size”). Enter starts a new line. Leaving the box (Esc or a click elsewhere) keeps the text; a box left empty disappears. To change the text later, double-click it with “Select”, click it with “Text box”, or select it and choose “Edit text”. The tab “Text box” sets “Text color”, “Font size” (8 to 48 points), “Background” and “Border” (“None” for each) and the border’s “Width” (0.5 to 4 points – the border takes room inside the box, so the lines break anew). The group “Paragraph” aligns the lines in the box: “Align text left” (default), “Center text”, “Align text right” or “Justify” (the words spread over the whole width; the last line of a paragraph stays left). Other programs show all four as here; when they edit the text, they keep left, centered and right, but justified text becomes left-aligned there. Its handles change only the box, never the font: the left and right side set the width (the lines wrap, the height follows the text), the top, bottom and corners a fixed size (Shift keeps a corner’s proportions); text that doesn’t fit a fixed size runs out below the box – in other programs too. Hold K while dragging to scale the font with the box. The group “Size” switches between the three. While “Text box” is the tool, the same tab sets how the next box looks; each new one takes what you chose last.',
				options: {
					autoWidth: { label: 'Auto width (a click)', text: 'As wide as the longest line; lines break only where you press Enter (and at the page’s edge). For labels and short notes.' },
					autoHeight: { label: 'Auto height (a side dragged)', text: 'Keeps its width; lines wrap and the box grows downwards with the text. For paragraphs.' },
					fixedSize: { label: 'Fixed size (a box dragged open)', text: 'Keeps width and height, e.g. a framed area to fill in later; text that doesn’t fit runs out below.' }
				},
				tip: 'Change the font size on the tab “Text box”, not by dragging – the box then keeps its place and width. Other programs show the text in Helvetica; lines with letters beyond Western European ones (Polish, Czech, Greek, Cyrillic …) carry the few letters they need in a matching font, so they look the same everywhere. Chinese, Japanese, Arabic and emoji appear there as “?” for now; the text itself is kept and shows here.',
				keys: [['T'], ['K']]
			},
			draw: {
				title: 'Drawing on pages',
				text: 'The “Comment” tab also has the same pen tools as Notes: “Pen”, “Shapes” (the arrow below picks line, arrow, rectangle, ellipse, star … – each with a small drawing), and “Eraser” (the arrow below: whole strokes or pixels, and its size); “Select” comes first on the tab, in a group of its own. They draw with a pen, a finger or the mouse; on a touch screen two fingers still move and zoom the pages. When you lift the pen after a line, a circle or a box drawn by hand, “Convert to …” offers to turn it into an exact shape. Shapes you draw, move or resize snap to the edges and center of the page and to other shapes and pictures; guide lines show where – the small sign where a line starts is a frame for the page, otherwise the shape it comes from – and equal gaps show their size in millimeters. The switch “Snap” in the group “Select” turns this on and off (on by default, remembered); hold Alt while dragging for the opposite.',
				tip: 'Leave “Snap” on to line up shapes and keep equal gaps; turn it off for many small moves where shapes would jump to a guide – or hold Alt for just one drag.',
				keys: [['P'], ['S'], ['E'], ['L'], ['Alt']]
			},
			format: {
				title: 'Color, thickness and style',
				text: 'Every tool that draws comments remembers its own format: choose it, and the tab for its kind (“Drawing”, “Marked text”, “Note”, “Text box”) sets how the next one looks – the pen and the shapes each keep their color and “Thickness”, each marking tool its color. Select comments instead, and the same tab changes them, one undo step per choice. Every color can be see-through – ink, marked text, notes, and a text box’s text, background and border: the percentage next to the colors (drag it or type it) sets how much. A see-through stroke stays even where it crosses itself, on screen and in the saved PDF; a shape’s fill has its own opacity under “Style”. The color field stays open while you try colors; a click outside closes it. “Style” sets how shapes are drawn: fill, solid, dashed or dotted line, hand-drawn, and arrowheads of selected lines.'
			},
			select: {
				title: 'Changing what you drew',
				text: 'With “Select” (first on the “Comment” tab) tap a stroke, shape, marked text or note, or draw a loop around several – starting beside them. Ctrl+click or Shift+click adds an item to the selection or takes it out again; a loop drawn with Shift or Ctrl held adds what it encloses. Drag an item to move it right away, without selecting it first; drag the frame to move a selection, a corner to scale them (text boxes keep their font – hold K to scale it too); a single shape shows its points to drag, a single text box its corners and sides (see “Text boxes”). Marked text stays with its text (no handles, it doesn’t move). The small bar at the frame duplicates or deletes (and edits the text of a single text box or note); the format is on the tab that appears for the selection. The arrow keys move the selection by 1 point, with Shift by 10 – without snapping, and holding them down until you let go is one step for “Undo”; marked text stays. Ctrl+A (or “Select all” in the group “Select”) selects everything on the current page. Del or Backspace deletes. Esc ends the selection; without a selection, Esc goes back from any tool to “Select”.',
				keys: [['Ctrl', 'Click'], ['Shift', 'Click'], ['←'], ['→'], ['↑'], ['↓'], ['Shift', '←'], ['Ctrl', 'A'], ['Del'], ['Backspace'], ['Esc']]
			},
			arrange: {
				title: 'Arranging',
				text: 'The tab “Arrange” appears with a selection. “Bring to front”, “Bring forward”, “Send backward” and “Send to back” change which comment lies on top where they overlap – also in other programs. “Align left”, “Align center”, “Align right”, “Align top”, “Align middle” and “Align bottom” line up the selected items with the box around them – a single item with the page (“Align center” puts it in the middle of the page’s width); “Distribute horizontally” and “Distribute vertically” give three or more the same gaps. Marked text is never moved: it stays where it is while the other selected items are aligned, distributed or duplicated.'
			},
			comments: {
				title: 'Comments and replies',
				text: 'The side panel “Comments” lists every comment of the PDF by page – notes, text boxes, marked text and drawings, yours and those of other programs – with its subject (else its kind), date, author, status and the first line of its text. Click one to go there and select it: then it shows its whole text and its replies. Click its subject to change it. “Reply” opens a field for a reply (“Send” or Ctrl+Enter; “Cancel” or Esc closes it). “Status” sets where the comment stands – each status shows as a badge in its own color (accepted green, rejected red, cancelled grey, completed blue); the ⋯ next to a reply sets its status or deletes it – “Undo” brings everything back. “Find in comments” searches subjects, texts and authors, the list next to it shows only one kind. New comments and replies carry your name from “Settings” → “Profile” → “Your name” (the gear at the top right) – also in other programs.',
				options: {
					none: { label: '“None” (default)', text: 'Nothing decided yet; no mark in the list.' },
					accepted: { label: '“Accepted”', text: 'You agree with the comment and will do what it asks.' },
					rejected: { label: '“Rejected”', text: 'You won’t do what it asks.' },
					cancelled: { label: '“Cancelled”', text: 'It no longer applies, e.g. the text it was about is gone.' },
					completed: { label: '“Completed”', text: 'Done – what it asked for has been taken care of.' }
				},
				tip: 'Replies and statuses are saved as real PDF replies: Acrobat and PDF-XChange show them with the comment, a status with who set it and when. Use “Completed” when you work through a review, so the others see what is left. Set your name before you comment – comments already saved keep the name they had.',
				keys: [['Ctrl', 'Enter']]
			},
			annotations: {
				title: 'What others see',
				text: 'What you draw is saved as real PDF comments (annotations): every PDF viewer shows it, and programs like Acrobat or PDF-XChange list it as note, text box, highlight, underline, strike-out, ink, line, rectangle, ellipse or polygon comments – marked text with the words it marks. The page itself stays unchanged underneath. Comments already in the PDF – yours from earlier and those of other programs – of these kinds can be selected, changed and deleted like new ones; only what you change is written anew, and what they carry besides (replies, author, notes) stays. Subjects, replies and statuses are the same entries Acrobat and PDF-XChange use, so they show up there too. Other kinds (stamps, wavy underlines, open polylines) and replies to notes are shown as they are and can’t be changed here yet. The page thumbnails show the comments too.'
			}
		}
	},
	forms: {
		title: 'Filling in forms',
		items: {
			fill: {
				title: 'Filling in fields',
				text: 'The fields of a PDF form can be filled in right on the page with “Hand”, “Select” and “Select text” – the other tools draw over them. Click a text field and type; Tab goes to the next field, also on the next pages, Shift+Tab back. Enter keeps what you typed (in a field of several lines it starts a new line), Esc puts back what was there. Click a check box or a round button to switch it; a list opens its choices. Each change is one step for “Undo” and is saved like everything else. Fields the PDF locks can’t be changed; buttons and signature fields do nothing here.',
				keys: [['Tab'], ['Shift', 'Tab'], ['Esc']]
			},
			highlight: {
				title: 'Highlight fields',
				text: '“Highlight fields” on the “Form” tab tints the fields that can be filled in and frames the required ones, so none is missed. It is remembered for all PDFs.',
				options: {
					on: { label: 'On (default)', text: 'Every field shows where it is, required ones framed. Best for filling in.' },
					off: { label: 'Off', text: 'The page looks as it will be printed; fields show only when you point at them.' }
				}
			},
			panel: {
				title: 'Fields panel',
				text: 'The side panel “Fields” (“Form” tab, or the bar on the left) lists the fields by page with what they ask for and what they hold now; required ones carry a star, and the top says how many of them are filled in. “Only required fields” shows only those. Click a field to go there – it gets the focus, so you can type right away.'
			},
			clear: {
				title: 'Clear form',
				text: '“Clear form” on the “Form” tab empties every field that can be filled in: texts, check boxes, choices. It is one step for “Undo”.'
			},
			others: {
				title: 'What others see',
				text: 'What you fill in is saved as the fields’ values, so every PDF program shows it and can change it again. It is written in the font the form sets for each field, at the size the page shows – like Acrobat or Firefox do; letters that font can’t write make the PDF ask programs to draw the field themselves. While you type, the field shows a font like the form’s; once you leave it, the page shows the form’s own. Signature fields can’t be signed.'
			},
			scripts: {
				title: 'Calculations and checks',
				text: 'Some forms bring their own little programs: they add up fields (hours, amounts), show numbers in a format (“1.50”) and check what you type. They run here as in Acrobat or Firefox, once you leave a field (Tab, Enter or a click elsewhere): totals and formats follow at once and belong to the same step for “Undo” as your input. If a check turns an input down, the field keeps what it held before, and the form’s message shows at the bottom. These programs run sealed off – they see only the form’s fields, never your files, other pages or the internet; asking you something (yes/no, typing a text) is answered with “no”.'
			},
			limits: {
				title: 'What can’t be filled in here',
				text: 'Signature fields show, but can’t be signed. Forms made with Adobe’s XFA (often from LiveCycle; they may say “Please wait …” or that your viewer isn’t supported) can’t be filled in – open those in Acrobat. Buttons that send a form, print or open pages do nothing here. Fields of pages inserted from another PDF stay as they are.'
			}
		}
	},
	changes: {
		title: 'Changes and saving',
		items: {
			saving: {
				title: 'Saving',
				text: 'Changes save themselves: about 1.5 seconds after the last one (10 seconds for PDFs over 25 MB, since every save writes the whole file), and right away when you leave the page or switch to another app. The icon at the left of the bottom bar shows whether everything is saved; point at it to read the state. The PDF stays a normal PDF in your files: your changes are added to its end, the rest of the file stays exactly as it was. “Undo” until nothing is changed gives back the original file.',
				link: { href: '/help/sync', label: 'How your files travel to your other devices' }
			},
			undo: {
				title: 'Undo and redo',
				text: '“Undo” and “Redo” at the left of the ribbon take back a change and do it again, as far back as the PDF has been open.',
				keys: [['Ctrl', 'Z'], ['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']]
			},
			rotate: {
				title: 'Organizing pages',
				text: 'The “Pages” tab works on the pages picked in the panel “Pages”, or else on the current page – the one in the middle of the window. “Rotate left” and “Rotate right” turn them by a quarter. “Move up” and “Move down” move them one place (the page menu also has “Move to the start” and “Move to the end”). “Delete pages” removes them together with what is drawn on them; the last page always stays. “Blank page” inserts an empty page after the current one, as big as it; “From PDF …” inserts all pages of another PDF from your files there, “Image …” a picture as a page of its own (as big as the picture, at most A4). Every change is one step for “Undo” and changes the file: other programs show the pages the same way.',
				keys: [['Ctrl', 'Click'], ['Shift', 'Click']]
			},
			newFile: {
				title: 'New PDFs from pages',
				text: '“Extract …” on the “Pages” tab saves the picked pages (else the current one) as a new PDF, with what is drawn on them; “Merge …” saves this PDF followed by other PDFs you choose as a new one. You pick where to save it; the PDF open here stays as it is. A message offers to open the new PDF.',
				tip: 'To move pages into another PDF, extract them, open the other PDF and insert them there with “From PDF …”. Pages of a PDF that needs a password to open can’t be inserted.'
			},
			conflict: {
				title: 'Changed elsewhere',
				text: 'When the PDF is changed in another tab, on another device or in a synced folder while it is open here and you have no unsaved changes, the editor asks whether to reload it (“Reload” / “Don’t reload”, optionally without asking again while it is open). If you have changes that aren’t saved yet, saving pauses and a bar asks what to do.',
				options: {
					reload: { label: 'Reload', text: 'Shows the other version; your unsaved changes are dropped.' },
					keepMine: { label: 'Keep my version', text: 'The next save replaces the other version with yours.' }
				},
				tip: 'Keep your version when you know the other change doesn’t matter (e.g. you opened the PDF on another device by mistake). Otherwise reload and make your change again.',
				link: { href: '/help/sync', label: 'Sync between devices' }
			},
			limits: {
				title: 'Protected, damaged and signed PDFs',
				text: 'A PDF that needs a password to open can’t be opened here. Restrictions that need no password to open the file (no printing, copying or changing) are ignored, as in most viewers: you annotate, fill in and organize such a PDF like any other, and it stays protected as it was. A PDF protected in another way (e.g. with a certificate) can be read but not changed: a bar says so. The same goes for PDFs whose structure is too damaged to add changes to; a PDF whose end is only slightly damaged is written anew the first time it is saved. In a signed PDF your changes come after the signatures, so they keep proving the signed version; before the first change to its pages you are asked, because programs may report pages changed after signing.'
			}
		}
	}
} satisfies HelpContent;

export default help;
