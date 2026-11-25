// Help texts of the PDF Editor (English leads; `help.de.ts` must have the same keys): the help window of the tool and
// the page `/help/pdf-editor`. Describe what users see and do: what each option means, what it costs and how to decide.

import type { HelpContent } from '@in-browser/brand/help.js';

const help = {
	start: {
		title: 'Getting started',
		items: {
			startPage: {
				title: 'Start page',
				text: 'The start page starts with “New PDF …”, “Open PDF …” and “Open from the computer …” and lists the PDFs you opened recently, the newest first, with their folder and when they were last changed. Click one to open it; the menu next to it (three dots, a right-click or a long press) has “Open” and “Remove from the list” – removing only forgets it here, the file stays. A PDF that no longer exists drops off the list by itself.'
			},
			newPdf: {
				title: 'New PDF',
				text: '“New PDF …” on the start page (also on the “File” tab) makes an empty PDF to write and draw on – a notebook, a sketch, a slide. Choose its page size and paper, then where to keep it; it opens right away with one page. More pages come from “Blank page” on the tab “Pages”: a click inserts a white page as big as the current one, the arrow next to it one with a paper (“Lined”, “Squared”, “Dotted”). The paper is part of the page like in any PDF, so every program shows and prints it; it can’t be changed afterwards – insert a page with another paper instead. The dialog remembers your last choice on this device.',
				options: {
					paper: { label: 'Page size: paper', text: 'A4 (default; 210 × 297 mm), A5, A6, A3, US Letter, US Legal – each “Portrait” (default) or “Landscape”. For what may be printed.' },
					media: { label: 'Page size: screen and media', text: '“Presentation 16:9” (as slides of presentation programs, 339 × 191 mm), “Presentation 4:3”, “Square 1:1”, “Portrait 9:16” (a phone screen). They have their own shape, so “Orientation” doesn’t apply.' },
					custom: { label: 'Custom size', text: 'Width and height in millimeters, from 10 mm to 2 m.' },
					blank: { label: 'Paper: “Blank” (default)', text: 'A white page – for sketches, slides and everything you lay out yourself.' },
					lined: { label: '“Lined”', text: 'Lines 1 cm apart – for handwriting.' },
					grid: { label: '“Squared”', text: 'Squares of 5 mm – for calculations, tables and technical sketches.' },
					dotted: { label: '“Dotted”', text: 'Dots every 5 mm – guidance for writing and drawing that hardly shows afterwards.' }
				},
				tip: 'For handwritten notes take A4 or A5 with lines or dots; on a tablet held sideways “Landscape” uses the screen best. Choose a presentation size when the pages will be shown on a screen rather than printed.'
			},
			open: {
				title: 'Opening a PDF',
				text: '“Open PDF …” picks a PDF from your files. Files opens PDFs here too when you double-click them. “Open from the computer …” copies a PDF from your computer into your files first and asks where it should be kept: the PDF Editor always works on a file in your files, so it can keep your changes. A PDF shared from another app to the installed in-browser, or opened with it on your computer, is kept the same way.',
				link: { href: '/help/install#system', label: 'With the other apps of your device' }
			},
			layout: {
				title: 'Layout',
				text: 'The top bar only shows the name of the open PDF – it is named after its file; rename it in Files. Below it lies the ribbon: “Undo” and “Redo” on the left, then the tabs “File” (group “PDF”: “New PDF …” makes an empty one, “Download” saves a copy on this device, “Print …” prints it, “Share …” gives it to a guest (a link, a QR code or four words – see the help page on sharing), “Send …” gives a copy to another app on this device (mail, a messenger), “Show in Files” opens its folder in Files; group “New PDF”: extract, merge), “Home” (tools, find; the PDF opens on this tab), “Comment” (mark, note, stamp, draw), “Pages” (rotate, duplicate, move, delete, insert), “Form” (fields), “Present” (speaker notes, steps) and “View” (side panels). Each tab shows its commands in groups with their names below. Tabs set off in color come and go with what you work on: while a tool that draws comments is chosen or comments are selected, a tab for their format appears (“Text box”, “Note”, “Marked text”, “Drawing”, or “Selection” for several kinds), with a selection also “Arrange”. Selecting comments switches to their tab by itself – to “Arrange” if that is the one you used last – and back when the selection ends; a tab that only shows a tool’s format never opens by itself. On the left edge a narrow bar holds the side panels: “Pages”, “Search”, “Stamps”, “Comments”, – when the PDF has them – “Fields”, “Bookmarks”, “Attachments” and “Layers”, and last “Presentation notes” and “Presentation steps”; click one to open it next to the pages, click it again to close it, and drag its right edge to make it wider. At the bottom edge: the arrows to the first, previous, next and last page around the page number (type another one and press Enter to go there) and the number of pages, then “Zoom out”, the zoom and “Zoom in”.'
			},
			ribbon: {
				title: 'Ribbon display',
				text: 'When the window gets narrower, the groups on the right get smaller first: their buttons lose the text below the icon, then their text altogether, and at last a whole group becomes one button that opens it. The button with the bar icon at the right end of the tabs chooses how the ribbon is shown – for every in-browser tool on this device. The arrow next to it collapses the ribbon: only the tabs stay, and a click on a tab opens its commands over the page until you pick one; a double click on a tab or Ctrl+F1 do the same, and the arrow brings the ribbon back as it was.',
				options: {
					classic: { label: 'Classic (default on a computer)', text: 'Commands in three rows with their names, in groups with a name each. Easiest to find things, takes about 130 pixels of height.' },
					simplified: { label: 'Simplified', text: 'One compact row of buttons, without group names. Leaves more room for the pages.' },
					minimal: { label: 'Minimal (default on phones and tablets)', text: 'One row of icons without text; hold the pointer over an icon – or press and hold it – to see its name. Least height with every command in reach.' }
				},
				tip: 'Start with Classic until you know where things are, then switch to Simplified or Minimal – or collapse the ribbon – to see more of the page.',
				keys: [['Ctrl', 'F1']]
			},
			accessKeys: {
				title: 'Access keys',
				text: 'Press and release Alt (or press F10): letters appear on the tabs and numbers on “Undo” and “Redo”. Type a tab’s letter, then the letter shown on a command to run it – everything works without the mouse. Esc goes back one step.',
				keys: [['Alt'], ['F10']]
			},
			phone: {
				title: 'On a phone',
				text: 'On a phone or tablet the ribbon starts as “Minimal”: the tabs in one row, below it the tab’s commands as icons that scroll sideways. Press and hold an icon to see its name. The arrow at the right of the tabs collapses the ribbon when you need the height. Selecting comments switches to their tab by itself; a tool’s format tab is among the tabs. Side panels open over the whole screen from the “View” tab.'
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
				text: 'The pages lie one below the other. Scroll with the mouse wheel or the touchpad, drag with two fingers on a touch screen, or with the “Hand” tool (on the “Home” tab, and first on the “Comment” tab) drag with the mouse. Every PDF opens with “Hand”, whichever tool you used last; the other tools keep their settings. The arrows in the bottom bar jump to the first, previous, next or last page (on a phone only previous and next); between them, type a page number and press Enter.',
				keys: [['Page Up'], ['Page Down'], ['Home'], ['End']]
			},
			zoom: {
				title: 'Zoom',
				text: '“Zoom in” and “Zoom out” – the buttons beside the zoom in the bottom bar – change the size in steps. The zoom itself opens a menu: “Fit width” makes the page as wide as the window, “Whole page” shows the whole page, “Actual size” shows it at 100 %. Pinch with two fingers on a touch screen, or hold Ctrl and turn the mouse wheel, to zoom where you point.',
				keys: [['Ctrl', '+'], ['Ctrl', '-'], ['Ctrl', '0']]
			},
			pages: {
				title: 'Pages panel',
				text: 'Small pictures of all pages; the current one is marked. Click a page to go there. Drag the panel wider to see the pages side by side. To change several pages at once, pick them: Ctrl+click adds or removes a page, Shift+click picks all from the last one clicked – with nothing picked both start from the current page, which is tinted and counts: Ctrl+click another page and both are picked –, Ctrl+A picks all (while the panel has the focus), Esc clears the pick. Right-click a page for its menu, and drag picked pages to another place. On a touch screen, press and hold a page: its menu opens and the selection mode starts – check boxes appear, a tap picks or unpicks a page, “Select all” in the menu picks every page, and “Clear selection” at the top of the panel ends it. The ⋯ button on a page opens its menu too. The line at the top says which page is the current one or, once you picked some, how many are picked.',
				keys: [['Ctrl', 'A'], ['Esc']],
				link: { href: '/help/pdf-editor#changes', label: 'Organizing pages' }
			},
			outline: {
				title: 'Bookmarks',
				text: 'The panel “Bookmarks” is the PDF’s table of contents. A click on a bookmark goes to its place; the arrows open and close the bookmarks inside it. In a PDF you can change, the panel is always there, and while it is open the tab “Bookmarks” appears. “Add bookmark” adds one for the top of the view, right after the current bookmark; it is named after the text you selected on the page (else “Page n”) and its name is ready to type. To rename one, click the name of the current bookmark or press F2; Enter or a click elsewhere keeps the name, Esc puts the old one back. “Set target here” makes the picked bookmarks lead to the top of the view. “Move up”, “Move down”, “Indent” (into the bookmark above) and “Outdent” (out of the one holding it) arrange them – with a mouse you can also drag bookmarks before, after or (in the middle of a row) into another one. “Bold”, “Italic” and “Color” change how they look in every PDF program. “Expand all” and “Collapse all” open and close every bookmark; which ones are open is saved with the PDF, so other programs show them so too. Ctrl+click and Shift+click pick several; the commands then act on all of them. Every change is one step for “Undo”. A bookmark whose page was deleted stays with its name but leads nowhere (shown pale with a crossed-out link); give it a new target with “Set target here”. Bookmarks that open a web address keep it.',
				tip: 'Add the bookmarks of a long PDF in reading order: go to each chapter, select its heading on the page, then “Add bookmark” – the name is already right. Indent the sections under their chapter afterwards.',
				keys: [['↑'], ['↓'], ['←'], ['→'], ['Enter'], ['F2'], ['Del'], ['Ctrl', 'A']]
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
				text: 'Files embedded in the PDF, and below them the files attached to comments (see “Attaching a file to a place”). Each one can be downloaded or saved in your files.'
			},
			layers: {
				title: 'Layers',
				text: 'Some PDFs (plans, maps) have layers that can be shown or hidden. Switch them here; this only changes the view, not the file.'
			},
			print: {
				title: 'Printing',
				text: '“Print …” on the “File” tab (also in the page menu of the panel “Pages”) asks what to print and then opens your browser’s print dialog, where you choose the printer, the paper and the number of copies. Pages: “All”, “Current page”, “Picked pages” (the ones picked in the panel “Pages”) or pages you type, e.g. “1-3, 7” – counted as they are ordered now. The pages are printed as you see them: turned pages turned, filled-in fields with their values, hidden layers left out. They are prepared one after the other as pictures at 200 dpi (“Cancel” stops that), so long PDFs take a moment. Restrictions against printing that need no password are ignored. The dialog remembers the choices under “Content” and “Size” on this device.',
				options: {
					comments: { label: 'Print comments (default: on)', text: 'Prints marked text, notes, text boxes, drawings and the file’s other comments on the pages. Off: the pages without them – form fields and their values are still printed.' },
					list: { label: 'Add a list of the comments (default: off)', text: 'Adds pages after the printed ones that list their comments by page: subject, author, date, status, text and replies. Costs extra paper, but shows what notes say – on the page a note is only its icon.' },
					fit: { label: 'Fit to the paper (default)', text: 'Every page is scaled to fill the paper chosen in the print dialog, inside the printer’s margins, upright or sideways as the page is. Nothing is cut off, but the size on paper differs from the PDF’s.' },
					actual: { label: 'Actual size', text: 'Asks for paper as big as the page and prints without scaling and margins: 1 cm in the PDF is 1 cm on paper. On smaller paper the edges are cut off, and the print dialog’s own scaling must stay at 100 %.' }
				},
				tip: 'Use “Fit to the paper” for reading copies. Choose “Actual size” when measures matter (plans, forms to be scanned, labels) or when you print to a PDF and want pages of the original size.',
				keys: [['Ctrl', 'P']]
			},
			export: {
				title: 'Exporting pages as pictures or a playlist',
				text: '“Export …” on the “File” tab (also “Export as pictures …” in the page menu of the panel “Pages”) saves pages as pictures or as a playlist for JW Library. Pages are chosen as for printing: “All”, “Current page”, “Picked pages” or pages you type, e.g. “1-3, 7”. They are drawn as you see them – turned pages turned, filled-in fields with their values, hidden layers left out – one after the other (“Cancel” stops that). “Save …” asks for a folder in your files (pictures) or a file name (playlist); a file that is already there is never replaced – the new one gets “ (2)” in its name. “Download” saves to your computer’s download folder instead: one picture as it is, several as one ZIP file. The dialog remembers its settings on this device.',
				options: {
					png: { label: 'PNG (default)', text: 'Exact, without loss: text and lines stay crisp. The largest files.' },
					jpeg: { label: 'JPEG', text: 'Much smaller files, slightly soft edges around text. Opens everywhere.' },
					webp: { label: 'WebP', text: 'Smaller than JPEG at the same look. Not every program opens it, and not every browser can write it – then the option is off.' },
					playlist: { label: 'JW Library playlist (.jwlplaylist)', text: 'One file with every page as a picture (JPEG) in order, named after the PDF. In JW Library: “Playlists”, then add a playlist and import the file.' },
					resolution: { label: 'Resolution (default: 150 dpi)', text: 'Pixels per inch of the page: an A4 page at 150 dpi is 1241 × 1754 pixels. Twice the dpi gives four times the pixels and much larger files. The line above the buttons shows the size of the first page; pages that would exceed about 16.8 million pixels are drawn smaller, and it says so.' },
					quality: { label: 'Quality (default: 90 %)', text: 'For JPEG, WebP and the playlist’s pictures: lower makes smaller files with visible blur around text. PNG has no quality – it is always exact.' },
					comments: { label: 'Export comments (default: on)', text: 'Draws marked text, notes, text boxes, drawings and the file’s other comments into the pictures. Off: the pages without them – form fields and their values stay.' },
					background: { label: 'Background (default: white)', text: 'What lies under the page’s content where the PDF paints nothing. “None” gives see-through pictures, and a color with less than full opacity a half see-through background – both only for PNG and WebP; JPEG and the playlist use the color fully opaque and white for “None”. Areas the PDF paints itself (scanned pages, white boxes) stay as they are.' },
					name: { label: 'File name (default: {name}_{page})', text: 'The pictures’ names, with placeholders you insert with the button next to the field: {name} the PDF’s name, {page} the page number (with leading zeros, so the files sort in order), {pages} the number of pages, {date} the date (2026-11-23), {time} the time (14-05). The line above the buttons shows the first name, or what is wrong with it.' },
					steps: { label: 'Each presentation step as a picture (default: off)', text: 'Playlist only, for pages with presentation steps (and “Export comments” on): every step becomes an item of its own – the page as it shows at the start, then after each step, as when presenting. So in JW Library you go through the steps as through pages. Off: one picture per page with all its comments.' },
					seconds: { label: 'Duration (default: 4 s)', text: 'Playlist only: how long JW Library shows a page before the end action follows.' },
					endAction: { label: 'At the end (default: Freeze)', text: 'Playlist only, as JW Library names it: “Continue” goes on to the next page, “Stop” goes back to the playlist, “Freeze” keeps the page on screen until you go on, “Repeat” shows it again. You can change it per item in JW Library later.' }
				},
				tip: 'For screens and presentations 150 dpi is enough; for printing take 300 dpi. Take PNG for text, plans and drawings (with the background “None” for signatures and logos to lay over something), JPEG or WebP for photos or when the files must be small. For a talk in JW Library take the playlist with “Freeze”, so each page stays until you go on.'
			}
		}
	},
	comment: {
		title: 'Commenting',
		items: {
			mark: {
				title: 'Marking text',
				text: 'With “Highlight”, “Underline”, “Wavy underline” or “Strike out” on the “Comment” tab, drag over text: it marks exactly the characters you pass, line by line, and shows them while you drag. A highlight reaches from the bottom of the letters below the line (g, p, y) to the top of the tallest ones, as far as the text’s font says; lines set close together meet without overlapping. Each of the four keeps its own color, set on the tab “Marked text” while the tool is chosen. Marked text belongs to its text: it can be selected, recolored and deleted, but not moved. Scanned pages have no text to mark – there “Highlight area” helps: drag a box open and it is highlighted in the highlight’s color; such an area was drawn by you, so it can be moved like a drawing, and with “Select” its corners and sides change its width and height freely (Shift on a corner keeps the proportions).',
				keys: [['M'], ['U'], ['W'], ['X'], ['A']]
			},
			insert: {
				title: 'Inserting and replacing text',
				text: 'Two tools of the group “Text” say how the text itself should change – as proofreaders mark it; the PDF’s text stays as it is. “Insert text”: click between two characters; a small caret appears there and a field below it takes the text to insert. “Replace text”: drag over the words to replace; they are struck out, a caret stands at their end, and the field takes what should stand there instead – the struck words and the caret are one comment: selected, recolored and deleted together, and listed once in the comments panel as “Replace text” with the old and the new words. The text is saved when you leave the field (click elsewhere or press Esc). To change it later, double-click the caret with “Select” or select it and choose “Edit comment”; resting the mouse on it shows the text. Both use one color, set on the tab “Marked text” while one of the tools is chosen. Like marked text, a caret can be recolored and deleted, but not moved. Other programs list an insertion with your text, and a replacement as one comment too where they know grouped comments (Acrobat, PDF-XChange); simpler viewers show the strike-out and the insertion as two. Replacements of other programs show here as one. The comments panel shows both under “Marked text”.',
				keys: [['I'], ['R']]
			},
			callout: {
				title: 'Callouts',
				text: 'A callout is a text box with a line and an arrow pointing at what it is about. With “Callout” (tab “Comment”, group “Comment”) press where it should point, drag to where its text should stand and let go – or click where it should point and click again where the text should stand (a second click on the same spot puts the box a little to the upper right) – then type. The line leaves the middle of the side of the box facing the tip, 14 points straight, then runs to the tip; it follows when you move or resize the box. With “Select” a selected callout has one more handle at its tip: drag it to point somewhere else. Moving the callout moves the tip along. The box is a text box in every other way (tab “Text box”: font size, colors, alignment, size); it always gets a border – the one chosen for text boxes, else a line in the text’s color – and the line has the border’s color and width. Other programs list it as a callout and can edit it; callouts of other programs show here with their line pointing at the same place.',
				keys: [['C']]
			},
			attach: {
				title: 'Attaching a file to a place',
				text: 'With “Attach file” (tab “Comment”, group “Comment”) click on a page and choose a file from your files: a paper clip marks the place, and the file itself becomes part of the PDF – whoever gets the PDF gets the file with it. Select the paper clip to move it, to give it a comment (double click, or “Edit comment” on the tab “Note”) or a color, and to get the file back: “Download the attached file” at its frame and on the tab “Note”. The side panel “Attachments” lists these files under “Attached to comments” with their page – a click shows the paper clip, the buttons download the file or save it in your files. Deleting the paper clip takes the file out of the PDF. The file is stored as it is, so the PDF grows by its size; above 25 MB you are asked first. Other programs show it as a file attachment comment; such comments of other programs appear here the same way.',
				keys: [['J']]
			},
			measure: {
				title: 'Measuring',
				text: 'Three tools in the group “Measure” (tab “Comment”) draw a shape that says its size. “Distance”: drag from one point to another, or click both – a line with a bar at each end and the length above it. “Perimeter”: click point after point and double-click the last – the path says how long it is in all. “Area”: click the corners of an outline and double-click the last – the area inside is written in its middle. The number follows the shape: with “Select”, drag a point or the whole shape and it measures anew. A measurement is a drawing in every other way (tab “Drawing”: color, width, dashes; an area can get a fill). “Snap” helps to hit corners and to keep lines straight. A PDF has one scale for all its measurements – “Scale …” sets it, “Calibrate” works it out from a distance you know. Other programs show the shapes with their numbers and know the scale; measurements made in other programs appear here as plain shapes that don’t measure anew.',
				options: {
					scale: { label: '“Scale 1 :” and “Unit” (default: 1 : 1 in millimeters)', text: 'How much one unit on paper is in reality – 100 for a plan drawn 1 : 100 – and the unit the numbers are shown in: millimeters, centimeters, meters, inches or points. Changing it makes every measurement of the PDF measure anew, as one step for “Undo”. A new PDF starts with the scale you used last.' },
					calibrate: { label: '“Calibrate”', text: 'For a plan whose scale you don’t know: choose “Calibrate” (group “Measure”) and drag along something whose real length you know (a wall, a scale bar) – or click its two ends, scrolling between them if you need to. Then you are asked “How long is this distance?” – type its “Length” and pick the “Unit”; the scale is worked out from it and shown below. “Apply” sets it for the whole PDF, and the tool changes to “Distance” so you can check with a second known length. The line you drew stays while you are asked and is not kept. “Cancel” leaves the scale as it was.' }
				},
				tip: 'Zoom in before you click the end points – the measurement is as exact as your clicks. A scan may be distorted: calibrate along the direction you measure in, and check with a second known length.',
				keys: [['D']]
			},
			link: {
				title: 'Links',
				text: 'A link is a box on the page that leads somewhere when clicked. To follow one, click it with “Hand” – the pointer turns into a hand with a finger over it; links that were already in the PDF work the same way. A link to another place in the PDF takes you there at once; before a web address is opened, a question shows the full address, and “Open in a new tab” opens it – the PDF stays open. Only web and mail addresses are opened, nothing else a file might name. To make a link, choose “Link” (tab “Comment”, group “Comment”), drag a box over what should be clickable – a word, a picture, a line of a table of contents – and say in the small box below it where it leads; Enter or a click elsewhere keeps it, Esc discards, and a new link left without a target disappears. A link draws nothing on the page and nothing in print: its box is only shown, tinted with a dashed line, while “Link” or “Select” is the tool. With “Select” you move and resize it, delete it, or double-click it (or “Edit link” on the tab “Link”) to change where it leads. Every PDF viewer follows the links you make. Links that other programs put into the PDF can be followed here, but not changed. Links are not comments: the comments panel doesn’t list them.',
				options: {
					url: { label: '“Web address” (default)', text: 'An address on the web or a mail address (mailto:…). Typed without “https://”, it is added for you. The address is written into the PDF as you see it in the question before opening.' },
					page: { label: '“Page of this PDF”', text: 'A page by its number. The link belongs to that page, not to the number: when you move pages, it still leads to the same page; when you delete the page, the link leads nowhere until you give it a new target.' }
				},
				tip: 'For a table of contents, drag one link over each line and choose “Page of this PDF”. For sources and further reading, use “Web address”.',
				keys: [['Y']]
			},
			stamp: {
				title: 'Stamps',
				text: 'With “Stamp” (group “Comment”) click on the page: the chosen stamp is placed with its middle there and selected, so you can move it or drag a corner to resize it. The arrow below the button chooses what is stamped: a text stamp – a text in a frame, to begin with the ten of the PDF standard (“Approved”, “Final”, “Draft”, “For comment”, “As is”, “Not approved”, “Confidential”, “Top secret”, “Expired”, “Sold”), written in your language; “From file …” takes a picture or a PDF from your files (a signature, a logo) and asks which page when the PDF has several – a picture is placed as big as on a screen, a PDF or SVG in its own size, at most half the page; “My stamps …” opens the side panel “Stamps” with the stamps you keep. Before you click, the stamp follows the pointer, so you see what will be placed and where (with a mouse or a pen held above the screen). The tab “Stamp” sets a text stamp’s color, and “Edit text” there – or a double click with “Select” – opens two fields at the stamp for its text and the line below it: Enter or a click elsewhere keeps them, Esc puts back what was there; the stamp gets as wide as its text needs. SVG files, icons and PDF pages are kept as vectors – in the file and in print sharp at every size; on screen they are drawn anew for the zoom you look at them with (a moment after zooming), up to 16 megapixels, so only a very large stamp zoomed in very far gets soft here; an SVG with text, gradients or clipping, and all other pictures, are kept as pixels, with their see-through parts, scaled down to 2000 pixels if larger. Other programs list both as stamps; stamps of other programs are shown as they are and can’t be changed here.',
				options: {
					info: { label: '“Line below the text”: “Name”, “Date”, “Time” (default: all off)', text: 'Each one you switch on is added to a second line below the text, in this order: your name from the suite settings (“Profile → Your name”), today’s date, the time now. Choose any of the three on its own; with none there is no second line. The line is written when the stamp is placed and doesn’t change later – “Edit text” changes it by hand.' },
					mine: { label: 'Side panel “Stamps”', text: 'Shows your own stamps as small pictures and below them the text stamps; a click chooses one and switches to “Stamp”. “Add …” copies a picture, an SVG or a PDF from your files (of a PDF with several pages the page you choose) into a hidden folder of your files, so it travels to your other devices with the sync, and chooses it for the next click; the bin below a stamp deletes it into the trash (with “Undo”); if it was the stamp you were placing, the tool goes back to “Select” instead of placing another one. Stamps already placed stay in their PDFs.' },
					words: { label: 'Your own text stamps', text: 'The list “Text stamps” is yours: “Add text stamp …” below it takes a text and its color; the ⋯ of an entry (or a right click) offers “Edit …” and “Delete” (with “Undo”); “Restore the standard stamps” puts the ten of the standard back and removes your own. Every text is stamped as it is written in the list. The list is kept with “My stamps”, so it is the same on all your devices.' },
					selection: { label: '“Stamp from selection”', text: 'Keeps the selected comments – drawings, shapes, text boxes, notes, marked text, other stamps – together as one new stamp, as vectors. It is in the side panel and in the menu of “Stamp”.' },
					area: { label: '“Stamp from area”', text: 'Drag a box open on a page: everything in it becomes a stamp – the page’s own text, pictures and drawings as vectors, with your comments on top. It works on every PDF, also one you can’t change. Not included: form fields and comments of other programs that can’t be edited here. The stamp holds the whole page’s content clipped to the box, so a stamp of a heavy page is a heavy file.' }
				},
				tip: 'Put your signature or your company seal into “My stamps” once – a PNG with a see-through background looks best on the page – and you have it at hand in every PDF and on every device. A picture you need only once goes through “From file …”.',
				keys: [['K']]
			},
			pictures: {
				title: 'Pictures and icons',
				text: 'Next to “Stamp” (tab “Comment”, group “Comment”): “Picture …” takes a picture from your files (PNG, JPEG, WebP, GIF, AVIF, SVG, or a page of a PDF – it asks which one when there are several) and “Icon” opens the icon library – search it, choose another icon set, or load a whole set. Both put their picture in the middle of the view on the current page and select it, so you can move it and drag a corner to resize it. A picture comes as big as on a screen, at most half the page; an icon 48 points (about 17 mm) wide in the color you gave an icon last (the pen’s color until you did); “Color” on the tab “Stamp” gives a selected icon another color – the next icons then come in it (not icons placed before this was possible, and not the few icons with color gradients, which are kept as pixels). Icons, SVG files and PDFs are saved as vectors, sharp at every size. All are saved as stamps, so every PDF viewer shows them, and other programs list them as stamps. To stamp the same picture many times, use “Stamp” with “From file …” or “My stamps …” instead: there each click places one.'
			},
			barcode: {
				title: 'Barcodes and QR codes',
				text: '“Barcode …” on the tab “Comment” makes a code of what you type and places it in the middle of the view as a picture – select, move and scale it like any picture; it is saved as vectors, so it stays sharp at every size and in print. Choose the kind – more than a hundred, in the groups “2D codes”, “Retail”, “Logistics and industry”, “Postal” and “More” – and type the content; the dialog shows the code as it will look, or says why the content doesn’t fit that kind. For a “QR code”, “Content as” builds the content for you: “Text”, “Web address”, “Wi-Fi” (network name, password, security), “Contact”, “E-mail”, “Phone number” or “Text message” – a phone then offers to open the page, join the network or save the contact. A placed code stays a code: double-click it with “Select”, or select it and choose “Edit barcode” (in the small bar at the code or on the tab “Stamp”), change anything and choose “Apply” – it keeps its place and width, as one step to undo; a code made by a template opens as its text. Kind, colors and options are remembered for the next code, the content never. Nothing is sent anywhere: the code is worked out in your browser.',
				options: {
					color: { label: '“Color” (default: black)', text: 'The color of the bars or squares and of the text below. Scanners need it clearly darker than the background; the dialog warns about little contrast and about light on dark, which many scanners don’t read.' },
					background: { label: '“Background” (default: white)', text: 'The color behind the code, the quiet zone included. “None” leaves it see-through, so the page shows – only on a light, plain page.' },
					ecc: { label: '“Error correction”', text: 'For the kinds that have a choice. QR code: “Low (7 %)”, “Medium (15 %)” (default), “High (25 %)”, “Highest (30 %)” – how much of the code may be dirty or covered and still be read. More makes the code denser.' },
					showText: { label: '“Show text” (default: on)', text: 'Writes the content below a line code, so people can read or type it. 2D codes have no text.' },
					quiet: { label: '“Quiet zone” (default: on)', text: 'The empty margin a scanner needs around the code. Off, the picture ends at the code – then keep a light margin free on the page yourself.' }
				},
				tip: 'Use a QR code for anything people scan with a phone, “Code 128” for numbers a hand scanner reads, “EAN-13” only for real product numbers; for the other kinds, take what the receiving system asks for. Keep “Medium” error correction unless the code will be printed small or may get dirty (then “High”) or holds a lot (then “Low”). Black on white with the quiet zone reads best. Print a QR code at least 2 cm wide and test every code with a phone or scanner before you hand the PDF on.'
			},
			note: {
				title: 'Sticky notes',
				text: 'With “Note” (group “Comment”) click where the note should point: its icon appears there and a field below it takes your comment right away. The comment is saved when you leave the field – click elsewhere or press Esc. To read or change it later, double-click the note with “Select”, click it with “Note”, or select it and choose “Edit comment” (in the small bar at the note or on the tab “Note”, which also sets its icon and color). Resting the mouse on a note shows its comment as a tooltip. Other programs show it as a comment with your text.',
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
				text: 'With “Text box” (group “Comment”) click on the page to type there – the box grows with the longest line (“Auto width”) – or drag a box open to type into exactly that box (“Fixed size”). Enter starts a new line. Leaving the box (Esc or a click elsewhere) keeps the text; a box left empty disappears. To change the text later, double-click it with “Select”, click it with “Text box”, or select it and choose “Edit text”. The tab “Text box” sets “Font”, “Font size”, “Bold”, “Italic”, “Underline” and “Text color” – see “Formatting text” below –, “Background” and “Border” (“None” for each) the border’s “Width” (0.5 to 4 points – the border takes room inside the box, so the lines break anew) and the “Inner margin”: the space between the border (or the box’s edge) and the text, for each side on its own – “Top”, “Right”, “Bottom”, “Left”, 0 to 72 points, 2 by default; with “Same on all sides” on, one field sets all four. Other programs show the margins as here; when they edit the text there, they use their own. The group “Paragraph” aligns the lines in the box: “Align text left” (default), “Center text”, “Align text right” or “Justify” (the words spread over the whole width; the last line of a paragraph stays left). Other programs show all four as here; when they edit the text, they keep left, centered and right, but justified text becomes left-aligned there. Its handles change only the box, never the font: the left and right side set the width (the lines wrap, the height follows the text), the top, bottom and corners a fixed size (Shift keeps a corner’s proportions); text that doesn’t fit a fixed size runs out below the box – in other programs too. Hold K while dragging to scale the font with the box. The group “Size” switches between the three. While “Text box” is the tool, the same tab sets how the next box looks; each new one takes what you chose last. To type into a form that has no fields, set “Background” and “Border” to “None”: the text then stands alone on the page (other programs list it as typewriter text).',
				options: {
					autoWidth: { label: 'Auto width (a click)', text: 'As wide as the longest line; lines break only where you press Enter (and at the page’s edge). For labels and short notes.' },
					autoHeight: { label: 'Auto height (a side dragged)', text: 'Keeps its width; lines wrap and the box grows downwards with the text. For paragraphs.' },
					fixedSize: { label: 'Fixed size (a box dragged open)', text: 'Keeps width and height, e.g. a framed area to fill in later; text that doesn’t fit runs out below.' }
				},
				tip: 'Change the font size on the tab “Text box”, not by dragging – the box then keeps its place and width. Other programs show the text in Helvetica; lines with letters beyond Western European ones (Polish, Czech, Greek, Cyrillic …) carry the few letters they need in a matching font, so they look the same everywhere. Chinese, Japanese, Arabic and emoji appear there as “?” for now; the text itself is kept and shows here.',
				keys: [['T'], ['K']]
			},
			textFormat: {
				title: 'Formatting text',
				text: 'The group “Text” of the tab “Text box” formats text: “Font”, “Font size”, “Bold”, “Italic”, “Underline” and “Text color”. What they act on depends on what you are doing. While you type in a box they act on the text you have selected in it – a word, a sentence, anything across lines; with nothing selected they hold for what you type next. With boxes selected (not typed into) they act on each whole box, and no part of its text differs any more. With “Text box” as the tool and nothing selected they set how the next new box starts. The group “Paragraph” has “Bullets” and “Numbering”: they turn the paragraphs you are in (or all of a selected box) into list items, and back when they already are. In a list Enter starts the next item, Enter on an empty item ends the list, Tab moves an item one level in and Shift+Tab out (up to four levels); numbers count per level. “Line spacing” sets the distance of the lines of the whole box. Text you paste comes in plain and takes the format of where you paste it. Everything is saved into the PDF so that every program shows it the same; programs that let you edit the text of a comment get the formats too, list marks as plain characters.',
				options: {
					font: { label: '“Font”', text: '“Sans-serif” (default; shown as Helvetica elsewhere), “Serif” (Times) or “Monospace” (Courier) – the three every PDF program has, so nothing needs embedding. Below them “My fonts” – the fonts you added in the tool Fonts (“Manage fonts …” at the end of the menu opens it) – and “Fonts of this PDF”: the fonts the PDF itself brings that a browser can draw with, also those inside its text boxes and other comments; a font that can’t be read is left out without keeping the others away. Those are embedded into the PDF with exactly the characters you write in them, so every program shows them; a font marked “!” holds only the characters the PDF used so far, and others appear in the stand-in font. A face a font lacks (bold, italic) is written in its regular one. A font missing on this device is named “(not on this device)” and shows in the stand-in until it is there.' },
					size: { label: '“Font size”', text: 'Opens a field for any size from 1 to 288 points (in half points) – type it and press Enter, use ↑/↓, drag the field’s name sideways or turn the mouse wheel over it – and below it the usual sizes from 6 to 96 points; 12 is the default.' },
					spacing: { label: '“Line spacing”', text: '1.0, 1.2 (default), 1.5 or 2.0 times the font size, for all lines of the box. A line with larger text in it is as high as its largest letters need.' },
					others: { label: 'Text boxes of other programs', text: 'Formats another program saved with its text box (bold, italic, underline, color, size, font) are read and shown; a font we don’t have becomes the nearest of the three. Lines may break in other places than in that program – the box keeps its size.' }
				},
				tip: 'For a slide whose points appear one after the other, use one text box per point (each can be shown and hidden on its own) – a list inside one box always comes as a whole. Bold and italic need Western European letters for now: other letters (Polish, Greek, Cyrillic …) are shown regular in the sans-serif font, here and in every program.',
				keys: [['Ctrl', 'B'], ['Ctrl', 'I'], ['Ctrl', 'U'], ['Tab'], ['Shift', 'Tab']]
			},
			twoClicks: {
				title: 'Two clicks instead of dragging',
				text: 'Whatever two points define can be drawn in two ways. Press, drag and let go – or click once for the first point and once more for the second. Between the two clicks a preview follows the pointer, and you can scroll and zoom (mouse wheel, Ctrl + wheel, the middle mouse button, two fingers) – handy when the two points don’t fit on the screen together or you want to zoom in on each. This works for every shape of “Shapes” (lines, arrows, rectangles, ellipses …), for “Distance” and “Calibrate”, for “Highlight area”, the box of a “Link”, “Stamp from area” and “Callout” (first the tip, then the text). “Snap”, Shift and Alt work as they do while dragging; if you hold the second click down, you can still adjust the point before letting go. Esc takes the first point back. “Polyline”, “Polygon”, “Perimeter” and “Area” are clicked point by point anyway – they show the next piece up to the pointer. “Text box” is the exception: there a click already places a text box.',
				keys: [['Esc']]
			},
			draw: {
				title: 'Drawing on pages',
				text: 'The “Comment” tab also has pen tools: “Pen”, “Highlighter” (paints freely with a wide see-through tip that lets the text shine through – unlike “Highlight”, which follows the text), “Shapes” (the arrow below picks line, arrow, rectangle, ellipse, star, polyline, polygon … – each with a small drawing), and “Eraser” (the arrow below: whole strokes or pixels, and its size); “Hand” and “Select” come first on the tab, in a group of their own – so you can move the pages without leaving the tab. “Only the pen draws” makes fingers only move and zoom the pages from the first touch on – switch it on when you write with a pen and rest your hand on the screen; without it, fingers draw until a pen has been used once. “Smoothing” on the tab “Drawing” (“Off”, “Light”, “Medium”, “Strong”; for pen and highlighter) evens out a shaky line; the stronger, the more the line lags behind the pen. “Polyline” and “Polygon” are drawn point by point: click (or drag) once per corner; a double click, Enter or Esc ends the shape, and a polygon also closes with a click on its first point. Every point is one step for “Undo”. They draw with a pen, a finger or the mouse; on a touch screen two fingers still move and zoom the pages. When you lift the pen after a line, a circle or a box drawn by hand, “Convert to …” offers to turn it into an exact shape. Whatever you draw, move or resize – shapes, text boxes, callouts, stamps, pictures, notes, highlighted areas and the boxes of links – snaps to the edges and center of the page and to the other ones of these on the page; handwriting and marked text are left out. Guide lines show where – the small sign where a line starts is a frame for the page, otherwise the kind of item it comes from – and equal gaps show their size in millimeters. The switch “Snap” in the group “Select” turns this on and off (on by default, remembered); hold Alt while dragging for the opposite.',
				tip: 'Leave “Snap” on to line up shapes and keep equal gaps; turn it off for many small moves where shapes would jump to a guide – or hold Alt for just one drag.',
				keys: [['P'], ['S'], ['E'], ['L'], ['Alt']]
			},
			format: {
				title: 'Color, thickness and style',
				text: 'Every tool that draws comments remembers its own format: choose it, and the tab for its kind (“Drawing”, “Marked text”, “Note”, “Text box”) sets how the next one looks – the pen and the shapes each keep their color and “Thickness”, each marking tool its color. Select comments instead, and the same tab changes them, one undo step per choice. Every color can be see-through – ink, marked text, notes, and a text box’s text, background and border: the percentage next to the colors (drag it or type it) sets how much. A see-through stroke stays even where it crosses itself, on screen and in the saved PDF; a shape’s fill has its own opacity under “Style”. The color field stays open while you try colors; a click outside closes it. “Style” sets how shapes are drawn: fill, solid, dashed or dotted line, hand-drawn, a cloud outline for closed shapes, and what the ends of selected lines and polylines carry (arrow, closed arrow, circle, square, diamond, bar).'
			},
			select: {
				title: 'Changing what you drew',
				text: 'With “Select” (on the “Comment” tab, after “Hand”) tap a stroke, shape, marked text or note, or draw a loop around several – starting beside them. Ctrl+click or Shift+click adds an item to the selection or takes it out again; a loop drawn with Shift or Ctrl held adds what it encloses. Drag an item to move it right away, without selecting it first; drag the frame to move a selection, a corner to scale them (text boxes keep their font – hold K to scale it too); a single shape shows its points to drag, a single text box its corners and sides (see “Text boxes”), a single highlighted area or link box its corners and sides too – they change the box freely, Shift on a corner keeps its proportions. Marked text stays with its text (no handles, it doesn’t move). The small bar at the frame duplicates or deletes (and edits the text of a single text box or note); the format is on the tab that appears for the selection. The arrow keys move the selection by 1 point, with Shift by 10 – without snapping, and holding them down until you let go is one step for “Undo”; marked text stays. Ctrl+A (or “Select all” in the group “Select”) selects everything on the current page. Del or Backspace deletes. Esc ends the selection; without a selection, Esc goes back from any tool to “Select”.',
				keys: [['Ctrl', 'Click'], ['Shift', 'Click'], ['←'], ['→'], ['↑'], ['↓'], ['Shift', '←'], ['Ctrl', 'A'], ['Del'], ['Backspace'], ['Esc']]
			},
			arrange: {
				title: 'Arranging',
				text: 'The tab “Arrange” appears with a selection. “Bring to front”, “Bring forward”, “Send backward” and “Send to back” change which comment lies on top where they overlap – also in other programs. “Align left”, “Align center”, “Align right”, “Align top”, “Align middle” and “Align bottom” line up the selected items with the box around them – a single item with the page (“Align center” puts it in the middle of the page’s width); “Distribute horizontally” and “Distribute vertically” give three or more the same gaps. Marked text is never moved: it stays where it is while the other selected items are aligned, distributed or duplicated.'
			},
			comments: {
				title: 'Comments and replies',
				text: 'The side panel “Comments” lists every comment of the PDF – notes, text boxes, marked text and drawings, yours and those of other programs – with its subject (else its kind), date, author, status and the first line of its text. Click one to go there and select it: then it shows its whole text and its replies. Click its subject to change it. “Reply” opens a field for a reply (“Send” or Ctrl+Enter; “Cancel” or Esc closes it). “Status” sets where the comment stands – each status shows as a badge in its own color (accepted green, rejected red, cancelled grey, completed blue); the ⋯ next to a reply sets its status or deletes it – “Undo” brings everything back. “Find in comments” searches subjects, texts and authors. The two buttons next to it arrange the list: “Sort by” groups the comments by page (default), by day with the newest first, by author, by kind or by status; “Filter” shows only one kind, one author or one status – its icon is tinted while it hides something, and “Show all comments” at its end clears it. Sorting and the kind are remembered on this device; author and status start at “all” with every PDF. New comments and replies carry your name from “Settings” → “Profile” → “Your name” (the gear at the top right) – also in other programs.',
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
				text: 'What you draw is saved as real PDF comments (annotations): every PDF viewer shows it, and programs like Acrobat or PDF-XChange list it as note, text box, stamp, insertion, highlight, underline, wavy underline, strike-out, ink, line, polyline, rectangle, ellipse or polygon comments (a cloud as a cloudy border, line ends as their endings) – marked text with the words it marks. The page itself stays unchanged underneath. Comments already in the PDF – yours from earlier and those of other programs – of these kinds can be selected, changed and deleted like new ones; only what you change is written anew, and what they carry besides (replies, author, notes) stays. Subjects, replies and statuses are the same entries Acrobat and PDF-XChange use, so they show up there too. Other kinds (stamps) and replies to notes are shown as they are and can’t be changed here yet. The page thumbnails show the comments too.'
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
				text: 'What you fill in is saved as the fields’ values, so every PDF program shows it and can change it again. It is written in the font the form sets for each field, at the size the page shows; letters that font can’t write make the PDF ask programs to draw the field themselves. While you type, the field shows a font like the form’s; once you leave it, the page shows the form’s own. Signature fields can’t be signed.'
			},
			scripts: {
				title: 'Calculations and checks',
				text: 'Some forms bring their own little programs: they add up fields (hours, amounts), show numbers in a format (“1.50”) and check what you type. They run here once you leave a field (Tab, Enter or a click elsewhere): totals and formats follow at once and belong to the same step for “Undo” as your input. If a check turns an input down, the field keeps what it held before, and the form’s message shows at the bottom. These programs run sealed off – they see only the form’s fields, never your files, other pages or the internet; asking you something (yes/no, typing a text) is answered with “no”.'
			},
			password: {
				title: 'Password and permissions',
				text: 'A PDF that needs a password to open asks for it when you open it – also when you insert pages from it, merge it or make a stamp of it. Its password to open and the one that lifts its restrictions both work. Check “Remember on this device” and this browser opens it without asking from then on: the password is kept encrypted in this browser only and never travels with the files to your other devices; a password that no longer fits is forgotten. When you present a protected PDF, the slides window gets the password from the editor and doesn’t ask in front of the audience. “Password and permissions …” (tab “File”, group “Protection”) protects the PDF, changes the protection or removes it; it always uses AES with 256 bits. The two check boxes are the switch: what is ticked when you click “Apply” is what the PDF gets, and a line above the buttons says what “Apply” will do. If the PDF already has a password, its field may stay empty (“Unchanged”) to keep the password you opened it with. The PDF is written anew and read again; “Undo” in the message that follows puts back the version from before. Pages you extract from a protected PDF, and a merged PDF made of it, stay protected the same way.',
				options: {
					open: { label: '“Require a password to open”', text: 'Nobody can read the PDF without this password – the content is encrypted with it. If you forget it, the content is lost: write it down somewhere safe.' },
					restrict: { label: '“Restrict what other programs allow”', text: 'The PDF opens for everybody, but programs that follow the restrictions don’t print, copy, change, comment, fill in or rearrange it unless you allow it below – or someone types the second password. The content isn’t protected by this; in-browser itself doesn’t follow such restrictions (“Print in high quality” needs “Print”).' },
					remove: { label: 'Both unticked', text: '“Apply” writes the PDF without any encryption: it opens everywhere without a password.' },
					forget: { label: '“Forget the remembered password”', text: 'This browser asks for the password again the next time.' }
				},
				tip: 'To keep a PDF from being read, set a password to open and send it by another way than the file (a message, a call). Restrictions alone are fine to keep a form from being changed by accident, not to keep it secret.'
			},
			properties: {
				title: 'Properties',
				text: '“Properties …” (tab “File”, group “Protection”) shows and changes the title, author, subject and keywords the PDF describes itself with – what other programs and search engines show for it – and what the file says about itself: the program it was created with, the one that made the PDF, the dates, the PDF version, the pages, the page size of the first page, the file size, its protection and whether it is signed. “Apply” changes the four fields as one step for “Undo”; an empty field takes that property away. Every save that changes the PDF names in-browser as the program that made the PDF and sets the date it was changed; a PDF made here (“New PDF …”, extracted pages, a merged PDF) also names in-browser as the program it was created with and gets your name from the suite settings (“Profile” → “Your name”) as author – extracted and merged ones keep the author of the PDF they came from if it has one.'
			},
			sanitize: {
				title: 'Sanitize',
				text: '“Sanitize …” (tab “File”, group “Protection”) first looks through the PDF and lists what it holds besides the pages: metadata (title, author, the programs and dates, thumbnails, data other programs left), files embedded in it, scripts and actions (that run when the PDF opens, a page shows or a field changes, or that send data away), bookmarks. Pick what should go; earlier versions kept inside the file and objects nothing uses go always. The PDF is written anew and read again; “Undo” in the message that follows puts back the version from before. Comments, speaker notes and filled-in fields stay, and a protected PDF stays protected. The next save after removing the metadata names in-browser as the program that made the PDF again.',
				tip: 'Sanitize a PDF before you send it outside: author names and earlier versions often say more than intended. A form whose fields calculate needs its scripts – leave “Scripts and actions” unchecked for it.'
			},
			limits: {
				title: 'Protected, damaged and signed PDFs',
				text: 'Restrictions that need no password to open the file (no printing, copying or changing) are ignored, as in most viewers: you annotate, fill in and organize such a PDF like any other, and it stays protected as it was. A PDF protected in another way (e.g. with a certificate) can be read but not changed: a bar says so. The same goes for PDFs whose structure is too damaged to add changes to; a PDF whose end is only slightly damaged is written anew the first time it is saved. In a signed PDF your changes come after the signatures, so they keep proving the signed version; before the first change to its pages you are asked, because programs may report pages changed after signing. Editing the pages’ own content (tab “Content”), protecting and sanitizing write the file anew and make the signatures invalid; you are asked before that too.'
			}
		}
	},
	present: {
		title: 'Presenting',
		items: {
			slides: {
				title: 'Slides as a PDF',
				text: 'A presentation here is a PDF: each page is a slide. Make one with “New PDF …” and the page size “Presentation 16:9”, or open a PDF exported from any presentation program. Text boxes, pictures, icons, shapes and drawings are placed on the pages as comments (tab “Comment”); “Duplicate” on the tab “Pages” copies a slide to build the next one from it.'
			},
			steps: {
				title: 'Showing and hiding in steps',
				text: 'So that the audience isn’t ahead of you, the things on a slide can come and go one after the other. A slide is shown in steps: first as it comes, then one step further with every “Next” on it. Select one or more things and open “Show and hide” – on the format tab that opens for the selection. It lists the steps of the slide, each with a switch: “With the page”, “Step 1” (after the first “Next”), “Step 2” and so on. Switch off where the selection should not be seen, on where it should; a switch holds from its step on, until the next step at which the selection changes – so something that comes late takes two clicks: off at “With the page”, on at its step. For one step alone, switch back at the step after it. Steps are added in the side panel “Presentation steps” (below). So something can appear later (off “With the page”, on from “Step 1”), be there first and go (on, then off), or come, go and come again. A step at which nothing changes any more drops away by itself. Things switched alike come and go together. Each switch is one step for “Undo”. While the side panel “Presentation steps” is open, each thing on the pages carries its steps as a small mark – “2” appears at step 2, “–3” goes at step 3, “1–3 · 5” is there from step 1 to 3 and again from 5 – only here, never in print, in pictures or while presenting. In the editor you always see everything.',
				options: {
					panel: { label: 'The side panel “Presentation steps”', text: 'Lists the steps of the page in view (“Presentation steps” on the bar at the left, or on the tab “Present”): “With the page”, then each step with how many things come and go there. “Another step” below the list adds a step to the page – it stays once something comes or goes at it. A click on a step selects the things changing there. The menu of a step (right click, long press or ⋯) changes the steps for everything on the page: “Move up” and “Move down” change the order (with a mouse you can also drag a step to its place), “Insert step before” puts a step in front that shows the same as the one before it – then switch things on or off there with “Show and hide” –, “Delete step” removes it: what came or went there does so one step earlier, the later steps move up. Each is one step for “Undo”. “With the page” always stays first.' },
					what: { label: 'What can come and go', text: 'Everything you place as a comment: text boxes, pictures, icons, stamps, shapes, drawings, notes, marked text. What belongs to the page itself – the PDF’s own text and pictures, or a comment embedded in the page – is always there.' },
					others: { label: 'In other programs', text: 'Other PDF programs know no steps: they show every slide with everything on it, which is what printing and sending the PDF want too.' }
				},
				tip: 'Give each point of a list its own step and leave the title with the page. To swap one picture for another in the same place, hide the first at the step the second appears. If a slide comes from another program as one picture, nothing on it can appear later – make one slide per step there, or rebuild the parts here as text boxes.'
			},
			present: {
				title: 'Presenting',
				text: '“Present” on the tab “Present” (F5) starts with the first slide, “From this page” (Shift+F5) with the current one. The arrow next to each chooses how – your choice is remembered on this device. Everything is saved first. On the slides, a click, →, ↓, Space, Page Down or Enter goes on – to the next step, else the next slide; ←, ↑, Page Up or Backspace go back; Home and End go to the first and last slide; B or the full stop makes the screen black and back. Most presentation clickers send these keys and work as they are. Esc ends the presentation; the editor then shows the slide you stopped at.',
				options: {
					presenter: { label: '“With presenter view” (default)', text: 'The slides open in a window of their own for the projector; this window becomes your presenter view. Where the browser can tell where your screens are, the slides window moves onto the other screen by itself (the browser asks once whether it may) – otherwise drag it there. With one screen only it stays a small window beside this view. Then click “Full screen” on it (the browser needs that click on the window itself). If your browser blocks the window, allow pop-ups for this site. If you reload this window by mistake, the slides stay where they are and the presenter view comes back to them.' },
					display: { label: '“Slides only”', text: 'The slides fill this screen at once. For one screen, or when the projector shows the same as your laptop.' }
				},
				tip: 'With a projector as a second screen, take the presenter view – you see what comes next and your notes, the audience only the slide. When the projector only mirrors your screen, take “Slides only”.',
				keys: [['F5'], ['Shift', 'F5'], ['→'], ['Space'], ['←'], ['B'], ['Esc']]
			},
			presenter: {
				title: 'Presenter view',
				text: 'At the top: the slide and step you are at, the time since the start (pause it or start it anew next to it) and the clock; on the right the pointer (none, “Dot”, “Spotlight”), “Black screen”, “All slides” (click one to go there) and “End”. Below: the current slide large, next to it what comes next – the next step of this slide or the next slide – and your notes (A− and A+ change their size, remembered on this device). “Previous” and “Next” at the bottom; the keys work here as on the slides. The slides window keeps working on its own: if this view is closed, keys and clicks on the slides still go on. If the slides window is closed by mistake, the bar at the top says so – “Open the slides window” brings it back at the same slide. The layout follows the room it has: side by side when wide, one below the other when narrow.',
				keys: [['→'], ['←'], ['Home'], ['End'], ['B'], ['Esc']]
			},
			remote: {
				title: 'Remote control from a phone',
				text: 'Steer the slides on another computer – the one at the projector – from your phone, with the presenter view on the phone. On the phone: open the PDF, “Share …” on the tab “File” (“View only” is enough), then “Show four words”. On the computer: open in-browser, Files, “Connect …” → “A share by four words …”, type the words – the PDF opens there for reading. Choose “Slides only” in the menu of “Present” and start it. The phone then says “Your guest presents …”: “Remote control” opens the presenter view there – current and next slide, your notes, the time, the pointer, “Previous” and “Next”. While the remote control is connected, it alone steers: keys and clicks on the computer don’t move the slides, so nothing pressed there by mistake does (“Full screen” and “End” there still work). “End” on the phone only leaves the remote control – the slides stay where they are and take the computer’s keys again. With your own devices it works without sharing: start presenting on one, and your phone shows the same message.',
				options: {
					stable: { label: 'If the connection drops', text: 'The computer keeps showing the slide; about 5 seconds after the phone was last heard, its keys and a clicker work there again. The phone shows that it is connecting and finds the slides again by itself – within seconds, also after it reloaded or the computer’s browser was restarted (the shared PDF lies there as a copy until the share ends). Commands are places, not steps: a command sent twice never skips a slide.' },
					change: { label: 'Changing something on the way', text: 'Open the PDF on the phone in another tab, change it – a note, a text, when something shows – and it is saved as always. The computer gets the new version through the share and shows it on the slide it is at, without asking; the remote control reads it anew too. Until both have the same version, the remote control says “The slides are being brought up to date …”; if that stays, the two devices don’t reach each other right now – the slides go on with the version they have.' },
					network: { label: 'What the connection needs', text: 'Both devices need the internet to find each other; then they talk directly. If the computer’s network and your phone’s mobile data can’t reach each other (company and hotel networks often block it), the phone says so after about 20 seconds – put the computer into your phone’s hotspot or both into the same Wi-Fi.' }
				},
				tip: 'Try it before the talk on the computer you will use. If its network is strict, start the phone’s hotspot and connect the computer to it – that works almost everywhere. Keep the phone’s screen on; in-browser asks it not to turn off while the remote control is open.'
			},
			pointer: {
				title: 'Pointer',
				text: 'Choose “Dot” or “Spotlight” at the top of the presenter view, then point at the current slide with the mouse (or press and drag with a finger or pen): the audience sees it on the slides. A dot is soft and leaves a short fading trail, calmer than a laser’s jitter; the spotlight darkens the slide but for a circle around the point. Moving the mouse off the slide hides it, and it goes away on its own a second after the last movement. Going to another slide ends it there.',
				tip: 'The dot for showing a detail, the spotlight when everyone should look at one place of a busy slide.'
			},
			notes: {
				title: 'Speaker notes',
				text: 'The side panel “Presentation notes” (on the bar at the left, or on the tab “Present”) holds what you want to say on the current page. Type into it; leaving the field keeps the text (one step for “Undo”), Esc puts back what was there. The notes are kept in the PDF as a hidden part of their page, so they move, are copied and deleted with it and travel with the file – they are never drawn, printed or exported as a picture.',
				tip: 'Keep them short – key words and numbers you don’t want to forget. Other PDF programs may list them as a hidden comment; don’t write in them what the recipients of the PDF must not read.'
			}
		}
	},
	changes: {
		title: 'Changes and saving',
		items: {
			saving: {
				title: 'Saving',
				text: 'Changes save themselves: about 1.5 seconds after the last one (10 seconds for PDFs over 25 MB, since every save writes the whole file), and right away when you leave the page or switch to another app. The icon at the left of the bottom bar shows whether everything is saved; point at it to read the state. The PDF stays a normal PDF in your files: your changes are added to its end, the rest of the file stays exactly as it was. “Undo” until nothing is changed gives back the original file. The one exception: once you change the pages’ own content (tab “Content”), the file is written anew as a whole, so that what you deleted is really gone from it.',
				link: { href: '/help/sync', label: 'How your files travel to your other devices' }
			},
			content: {
				title: 'Editing the page content',
				text: 'The tab “Content” changes what the pages themselves consist of – not your comments on top. It works with objects: a piece of text (as the file sets it, usually a line or part of one), a picture, a graphic (a filled or outlined shape) or an embedded drawing as a whole. Text is never retyped or reflowed. First turn on the switch “Edit content” – it is off whenever a PDF is opened, and while it is off nothing can change what the pages hold (only embedding a comment of yours, below, works without it). Then “Select objects” is the tool: an outline shows the object under the pointer, a click picks it (Shift or Ctrl adds or takes out; dragging a frame beside the objects picks everything wholly inside; “All objects” picks the page’s). Drag what is picked to move it (Shift keeps the axis), drag a corner of the frame to scale it in proportion, or press Del (“Delete object”). The arrow keys move by 1 point, with Shift by 10. While you drag, a slightly see-through picture of what you picked moves along, and with “Snap” on it snaps to the page’s edges and middle and to the other objects of the page (Alt does the opposite); the original stays where it was until you let go, then the page is drawn anew. Every change is one step for “Undo”.',
				options: {
					replace: { label: '“Replace image …”', text: 'With exactly one image of the page picked: choose a picture from your files (also an SVG or a page of a PDF). It is fitted into the place of the old image in proportion and centered there, and drawn where the old one was drawn – what lay over the image stays over it. Afterwards it is an object like any other: move or scale it. The old image leaves the file.' },
					flatten: { label: '“Embed in the page” and “Embed all comments”', text: 'This is how new text and pictures become part of a page: place a text box, a picture, a stamp or a drawing as a comment as usual, select it and choose “Embed in the page” – the button with the layers in the small menu at the selected comment, or on the tab “Content”. Each comment is drawn into the page exactly as it looks and is no comment any more: its comment text, replies and state go, other programs can’t take it off again. Links and files attached to a place stay comments. “Embed all comments” (tab “Content”) takes every comment of the PDF. Both work without the switch “Edit content” – it guards what the page already holds; to move, scale or delete what you embedded, turn it on. Embedding writes the file anew like every change of the content, so a signed PDF asks first. One step for “Undo”, which brings the comment back.' },
					deleted: { label: 'What “deleted” means', text: 'A PDF whose content you changed is written anew as a whole when it saves, with only what is still used: the deleted object is gone from the file – not just hidden – and so are earlier versions that were kept inside the file. Not touched are copies of the same thing elsewhere in the PDF (alternative texts for screen readers, the same picture on another page – metadata, embedded files and bookmarks go with “Sanitize …”) and older versions of the file outside it (the trash, other devices, conflict copies).' },
					signed: { label: 'Signed PDFs', text: 'Writing the file anew makes its signatures invalid. You are asked once, before the switch turns on or before the first comment is embedded.' },
					limits: { label: 'What can’t be picked', text: 'Clipping areas, shadings and anything the file builds in an unusual way stay as they are. An object moved out of a clipped area may be cut off. On a page whose content can’t be read safely the bottom bar says “This page’s content can’t be edited”; pages inserted from other PDFs and blank pages have no content to edit here.' }
				},
				tip: 'Use comments (tab “Comment”) for everything that should stay removable and visible as an addition; edit the content or embed only when the page itself should be different – e.g. before you send a PDF to someone who must not remove your additions. To make sure something is gone, search the saved PDF for it afterwards.',
				keys: [['Del'], ['←', '→', '↑', '↓'], ['Shift', '←'], ['Esc']]
			},
			undo: {
				title: 'Undo and redo',
				text: '“Undo” and “Redo” at the left of the ribbon take back a change and do it again, as far back as the PDF has been open.',
				keys: [['Ctrl', 'Z'], ['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']]
			},
			rotate: {
				title: 'Organizing pages',
				text: 'The “Pages” tab works on the pages picked in the panel “Pages”, or else on the current page – the one in the middle of the window. “Rotate left” and “Rotate right” turn them by a quarter. “Duplicate” puts a copy right after each – with everything drawn on it, its steps and its notes; a copy turns together with its page. “Move up” and “Move down” move them one place (the page menu also has “Move to the start” and “Move to the end”). “Delete pages” removes them together with what is drawn on them; the last page always stays. “Blank page” inserts an empty page after the current one, as big as it; “From PDF …” inserts all pages of another PDF from your files there, “Image …” a picture as a page of its own (as big as the picture, at most A4). Every change is one step for “Undo” and changes the file: other programs show the pages the same way.',
				keys: [['Ctrl', 'Click'], ['Shift', 'Click']]
			},
			pageSize: {
				title: 'Page size and background',
				text: 'On the “Pages” tab, group “Page”, for the pages picked in the panel “Pages”, or else the current page. “Background” puts a color under the page’s content (“None” takes it away again); it is saved into the PDF, so every program shows and prints it, and it is one step for “Undo”. A page whose own content covers it completely – a scan, a slide exported as one picture – hides the color. “Page size …” gives pages another size: choose the format (the same list as for a new PDF, portrait or landscape, or a size typed in millimeters), what happens to the content, and where it lies on the new page – nine positions, the middle by default; the small drawing shows the result for the first page. Comments, form fields and links go along with the content. The page size is changed in the file itself: the PDF is saved, changed and read anew, so “Undo” doesn’t reach back before it – the message that follows offers “Undo” for the change itself.',
				options: {
					keep: { label: '“Keep its size” (default)', text: 'The content stays as large as it is. On a larger page a margin appears around it; on a smaller page what sticks out lies outside the page – no longer visible, but still in the file.' },
					fit: { label: '“Fit to the page”', text: 'The content is scaled until it fits the new page, in proportion – never distorted. Where the shapes differ, room is left on two sides.' },
					pages: { label: '“Pages”', text: 'The picked pages (or the current one) by default, or all pages of the PDF. A PDF may have pages of different sizes afterwards.' }
				},
				tip: 'For room to write next to a page, keep the size and pick a larger format with the content at one side. To turn a document into slides, choose “Presentation 16:9” and fit the content. To remove what sticks out for good, use the content editing – a smaller page alone only hides it.'
			},
			newFile: {
				title: 'New PDFs from pages',
				text: 'On the “File” tab, group “New PDF”: “Extract …” (also in the page menu) saves the pages picked in the panel “Pages” (else the current one) as a new PDF, with what is drawn on them; “Merge …” saves this PDF followed by other PDFs you choose as a new one. You pick where to save it; the PDF open here stays as it is. A message offers to open the new PDF.',
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
				text: 'A PDF that needs a password to open can’t be opened here. Restrictions that need no password to open the file (no printing, copying or changing) are ignored, as in most viewers: you annotate, fill in and organize such a PDF like any other, and it stays protected as it was. A PDF protected in another way (e.g. with a certificate) can be read but not changed: a bar says so. The same goes for PDFs whose structure is too damaged to add changes to; a PDF whose end is only slightly damaged is written anew the first time it is saved. In a signed PDF your changes come after the signatures, so they keep proving the signed version; before the first change to its pages you are asked, because programs may report pages changed after signing. Editing the pages’ own content (tab “Content”) writes the file anew and makes the signatures invalid; you are asked before that too.'
			}
		}
	}
} satisfies HelpContent;

export default help;
