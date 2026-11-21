// Help texts of Notes (English leads; `help.de.ts` must have the same keys): the help window of the tool and the
// page `/help/notes`. Describe what users see and do: what each option means, what it costs and how to decide.

import type { HelpContent } from '@in-browser/brand/help.js';

const help = {
	start: {
		title: 'Getting started',
		items: {
			startPage: {
				title: 'Start page',
				text: 'The start page shows every notebook in the browser storage that all in-browser tools share as a card, with its number of pages, when it was last changed and its folder – also notebooks that arrived from your other devices. A click (on a phone or tablet a tap) opens a notebook. “New notebook” asks where it goes and what it is called and starts with one lined A4 page. “Open …” opens a notebook from any folder, “Import PDF” makes a new notebook from a PDF (see “PDF”).'
			},
			deleting: {
				title: 'Deleting notebooks',
				text: 'Every notebook card has a menu – right-click it, press the ⋯ button on it, or on a phone or tablet press and hold it: “Open”, “Show in Files” and “Delete”. “Delete” moves the notebook to the trash; the message that confirms it offers “Undo”. With the keyboard, move to a card with Tab and press Del. A notebook is named after its file: to rename it, use “Show in Files” and rename it there.',
				keys: [['Del']]
			},
			layout: {
				title: 'Layout',
				text: 'The pages lie one below the other below the ribbon: on its left “Undo” and “Redo”, then the tabs “File” (export, show in Files, delete), “Draw” (tools, format, options), “Insert” (images, icons, PDFs, pages), “Pages” (paper, size, order, delete) and “View” (zoom). Each tab shows its commands in groups with their names below. Tabs set off in color come and go with a selection: “Drawing” (only strokes and shapes) or “Selection” (with images or icons), and “Arrange”. The notebook opens on “Draw”. The tab “File”, the first one, holds in its group “Notebook” what you do to the notebook itself: “Export …”, “Show in Files” and “Delete”. The top bar above only shows the notebook’s name. At the bottom edge: the save state, “Page 3 of 12” and the zoom.'
			},
			ribbon: {
				title: 'Ribbon display',
				text: 'When the window gets narrower, the groups on the right get smaller first: their buttons lose the text below the icon, then their text altogether, and at last a whole group becomes one button that opens it. The button with the bar icon at the right end of the tabs chooses how the ribbon is shown – for every in-browser tool on this device. The arrow next to it collapses the ribbon: only the tabs stay, and a click on a tab opens its commands over the page until you pick one; a double click on a tab or Ctrl+F1 do the same, and the arrow brings the ribbon back as it was.',
				options: {
					classic: { label: 'Classic (default on a computer)', text: 'Large buttons in groups with their names. Easiest to find things, takes about 120 pixels of height.' },
					simplified: { label: 'Simplified', text: 'One compact row of buttons, without group names. Leaves more room for the pages.' },
					minimal: { label: 'Minimal (default on phones and tablets)', text: 'One row of icons without text; hold the pointer over an icon – or press and hold it – to see its name. Least height with every command in reach.' }
				},
				tip: 'Start with Classic until you know where things are, then switch to Simplified or Minimal – or collapse the ribbon – to see more of the page.',
				keys: [['Ctrl', 'F1']]
			},
			accessKeys: {
				title: 'Access keys',
				text: 'Press and release Alt (or press F10): letters appear on the tabs and numbers on “Undo” and “Redo”. Type a tab’s letter, then the letter shown on a command to run it. Esc goes back one step.',
				keys: [['Alt'], ['F10']]
			},
			phone: {
				title: 'On a phone',
				text: 'On a phone or tablet the ribbon starts as “Minimal”: the tabs in one row, below it the tab’s commands as icons that scroll sideways. Press and hold an icon to see its name. The arrow at the right of the tabs collapses the ribbon when you need the height. Selecting something switches to the tab of the selection by itself.'
			},
			saving: {
				title: 'Saving',
				text: 'Every change is saved automatically, a moment after you lift the pen; the icon at the bottom left shows whether everything is saved. Nothing is uploaded. A notebook is a file “Name.note” in the browser storage and carries its name; in Files you rename, move, copy, delete or download notebooks like other files. A notebook can be open in only one tab at a time. If it is changed elsewhere (on another device, through sync), Notes asks whether to reload the pages you haven’t changed here (“Reload” / “Don’t reload”, optionally without asking again while it is open); your changes here are kept.',
				tip: 'Browser storage is tied to this browser and can be lost when site data is cleared. Keep a copy in a folder on your computer or on your other devices.',
				link: { href: '/help/storage', label: 'Where your files are kept' }
			},
			connected: {
				title: 'In a connected folder',
				text: 'In the dialogs for a new notebook, “Open …” and importing a PDF, the choice in front of the folder path switches between My files and the folders you connected in Files (“Connected”). A notebook there is saved right in that folder on your computer. The start page lists such notebooks once you have created or opened them here; it doesn’t search connected folders. After a restart the browser may ask again: the start page then shows “Allow access”, and so does a message when saving or opening fails. Folders shown with a cloud (opened live from your other devices) work the same way.',
				link: { href: '/help/connected', label: 'Connected folders' }
			},
			sync: {
				title: 'On all your devices',
				text: 'Notebooks are ordinary files of the shared file system, so they travel with the device sync – write on the tablet, read on the computer.',
				link: { href: '/help/sync', label: 'Sync between devices' }
			},
			install: {
				title: 'Install and offline',
				text: 'Notes works on phones, tablets and computers. When your browser offers it, you can install it like an app; it then also starts without an internet connection.',
				link: { href: '/help/install', label: 'Install, offline and browsers' }
			},
			undo: {
				title: 'Undo',
				text: 'Up to 300 changes can be undone and redone – strokes, erasing, moving, recoloring, inserted pictures and PDFs, page changes. “Undo” and “Redo” are at the left end of the ribbon.',
				keys: [['Ctrl', 'Z'], ['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']]
			}
		}
	},
	writing: {
		title: 'Writing & pens',
		items: {
			pen: {
				title: 'Pen',
				text: 'The pen writes in the chosen color and thickness (five sizes). A stylus with pressure makes the line thicker when you press harder. With a finger, the mouse or a stylus without pressure the width follows the speed instead: fast strokes become thinner, like with a real pen. A hovering stylus (and the mouse) shows where the tip will land and how wide it is.'
			},
			highlighter: {
				title: 'Highlighter',
				text: 'A broad, see-through marker (three widths): what lies underneath – handwriting, an imported PDF – stays readable. The highlighter has its own color and width, separate from the pen.'
			},
			color: {
				title: 'Color and thickness',
				text: 'In the tab “Draw”, group “Format”: “Color” opens the suite’s color field (palette, recently used colors, own colors) for the chosen tool, the arrow on “Thickness” its sizes – five for the pen and shapes, three for the highlighter. Pen and shapes share one color and thickness; the highlighter keeps its own. The percentage next to the colors sets how see-through the ink is (drag it or type it; the highlighter starts at 35 %) – a see-through stroke stays even where it crosses itself, also in the exported PDF. With a selection the same buttons change the selected items instead (see “Selecting”). All settings are remembered for the next notebook.'
			},
			smoothing: {
				title: 'Smoothing',
				text: 'Evens out shaky lines: the line follows the pen with a small delay and so loses small wobbles. When you lift the pen, the line catches up to where you lifted it. “Smoothing” is in the tab “Draw” (group “Format”), for the pen and the highlighter.',
				options: {
					off: { label: 'Off', text: 'The line is exactly where the pen was – every wobble stays.' },
					light: { label: 'Light (default)', text: 'Removes jitter; the delay is hardly noticeable.' },
					medium: { label: 'Medium', text: 'Noticeably rounder lines; small loops and tight corners get softer.' },
					strong: { label: 'Strong', text: 'Very smooth curves, but the line lags behind visibly and small handwriting loses detail.' }
				},
				tip: 'For handwriting keep “Light” or choose “Off” – letters stay crisp. Take “Medium” or “Strong” for drawings, diagrams and large curves, or when you write with a finger or the mouse and the lines get shaky.'
			},
			eraser: {
				title: 'Eraser',
				text: 'Wipe over what should go. The arrow on “Eraser” chooses what it erases and its size (three sizes); the size is measured on the screen, so zooming in lets you erase finer details. Pictures (images, icons) are never erased – select them and delete them instead.',
				options: {
					stroke: { label: 'Whole strokes (default)', text: 'Touching a stroke removes it completely. Quick and tidy for handwriting.' },
					pixel: { label: 'Pixels', text: 'Removes only what is under the eraser; the rest of the stroke stays as separate pieces. A shape touched this way becomes ordinary strokes and loses its point handles and style settings.' }
				},
				tip: 'Take “Whole strokes” to remove words and lines. Switch to “Pixels” only to trim the end of a line or cut a gap into a drawing – and to remove part of a shape, prefer moving its points with “Select”, so it stays a shape.'
			},
			penEraser: {
				title: 'Eraser end and side button of the stylus',
				text: 'If your stylus has an eraser end or a side button and the browser reports it, holding it erases with the eraser’s settings – without switching tools. Not every device and browser passes this on.'
			},
			laser: {
				title: 'Laser pointer',
				text: 'Draws a glowing trail that fades by itself and is never saved – for pointing at something while you present or share your screen.'
			}
		}
	},
	touch: {
		title: 'Stylus, finger and gestures',
		items: {
			finger: {
				title: 'Writing with a finger',
				text: 'Without a stylus, one finger writes with the current tool. Two fingers move and zoom the page: drag to scroll, pinch to zoom. If the second finger lands right after the first, the line the first one started is dropped – a pinch never leaves a dot. After a quick swipe the page glides on.'
			},
			palm: {
				title: 'Palm rejection',
				text: 'As soon as you write with a stylus in an open notebook, fingers no longer draw there: they only scroll and zoom, so your hand can rest on the screen. This holds until you open the notebook again.'
			},
			penOnly: {
				title: 'Only the pen draws',
				text: 'The switch “Only the pen draws” in the tab “Draw” (group “Options”) makes it permanent: fingers always only scroll and zoom, from the first touch on, in every notebook. While it is on, the bar at the bottom says so – tap it there to turn it off.',
				tip: 'Turn it on if you always write with a stylus – then even the very first touch of your palm draws nothing. Leave it off if you also write with a finger sometimes.'
			},
			longPress: {
				title: 'Long press',
				text: 'On a phone or tablet, a long press opens the menus that open with a right-click on a computer – e.g. the menu of a notebook on the start page – and shows the name of a command in the ribbon.'
			}
		}
	},
	select: {
		title: 'Selecting',
		items: {
			selecting: {
				title: 'Select',
				text: 'With “Select” (tab “Draw”) you tap an item to select the topmost one there (a stroke, shape, image or icon), or draw a loop around several (starting beside them): strokes count when at least half of them lies inside the loop, pictures when their center does. Ctrl+click or Shift+click adds an item to the selection or takes it out again; a loop drawn with Shift or Ctrl held adds what it encloses. Dragging an item moves it right away, without selecting it first. A frame with handles appears around the selection. Choosing another tool ends the selection; Esc ends it too, and without a selection Esc goes back from any tool to “Select”.',
				keys: [['Ctrl', 'Click'], ['Shift', 'Click'], ['Esc']]
			},
			moving: {
				title: 'Move and resize',
				text: 'Drag inside the frame to move the selection, drag a corner to resize it – the proportions are kept, and the opposite corner stays in place. Hold Shift while moving to keep to the direction you moved most. Each move or resize is one undo step. With “Snap” on, the selection lines up with the page and other shapes and pictures (see “Shapes”). With a keyboard, the arrow keys move the selection by 1 point, with Shift by 10 – without snapping; holding them down until you let go is one undo step. Ctrl+A (or “Select all” on the tab of a selection) selects everything on the page in view.',
				keys: [['←'], ['→'], ['↑'], ['↓'], ['Shift', '←'], ['Ctrl', 'A']]
			},
			points: {
				title: 'Points of a shape',
				text: 'When exactly one shape is selected, its points appear instead of the corners: the ends of a line or arrow, the corners of a polygon, and for an ellipse or rounded rectangle the corners of its box. Drag a point to reshape the shape.'
			},
			menu: {
				title: 'Formatting a selection',
				text: 'With a selection the tab “Drawing” (only strokes and shapes) or “Selection” (with images or icons) appears – on a phone it opens by itself. Its groups “Format” and “Object” work on the selected items; each change is one undo step. The small menu at the selection holds “Duplicate” and “Delete” as icons.',
				options: {
					color: { label: 'Color', text: 'Recolors strokes, shapes and icons. Images keep their colors.' },
					size: { label: 'Thickness', text: 'The line thickness of selected strokes and shapes, in the five pen sizes.' },
					smoothing: { label: 'Smoothing', text: 'Only for the next strokes – disabled with a selection.' },
					style: { label: 'Style', text: 'Only with shapes: fill, line style, hand-drawn look and, for lines, the arrowheads (see “Shapes”).' },
					duplicate: { label: 'Duplicate', text: 'Places a copy slightly offset on top and selects it, ready to be moved.' },
					delete: { label: 'Delete', text: 'Removes the selection; undo brings it back.' },
					selectAll: { label: 'Select all', text: 'Selects everything on the page in view.' }
				},
				keys: [['Del'], ['Backspace']]
			},
			arrange: {
				title: 'Arrange',
				text: 'The tab “Arrange” appears with a selection. “Bring to front”, “Bring forward”, “Send backward” and “Send to back” change which item lies on top where they overlap. “Align left”, “Align center”, “Align right”, “Align top”, “Align middle” and “Align bottom” line up the selected items with the box around them – a single item with the page; “Distribute horizontally” and “Distribute vertically” give three or more the same gaps. Each is one undo step.'
			}
		}
	},
	shapes: {
		title: 'Shapes',
		items: {
			shapeTool: {
				title: 'Drawing shapes',
				text: 'Choose “Shapes”; the arrow on it lists the twelve shapes: line, arrow, double arrow, rectangle, rounded rectangle, ellipse, triangle, diamond, parallelogram, pentagon, hexagon and star. Drag on the page from one corner (or the start of a line) to the other. Nearly square shapes become a square or circle. A tap without dragging draws nothing. Shapes use the pen’s color and thickness. A shape stays editable: select it to move its points or change its style.'
			},
			style: {
				title: 'Shape style',
				text: '“Style” in the group “Format” (tab “Draw”) sets how the next shape is drawn; with shapes selected, it changes them.',
				options: {
					fill: { label: 'Fill', text: 'A color inside closed shapes, “None” for an empty outline. Lines and arrows have no fill.' },
					line: { label: 'Line', text: '“Solid”, “Dashed” or “Dotted”; the length of dashes and dots follows the thickness.' },
					sketch: { label: 'Hand-drawn', text: 'Draws the outline slightly uneven, like by hand – fits handwritten notes better than exact geometry.' },
					heads: { label: 'Arrowheads', text: 'Only for selected lines and arrows: “None”, “At the end”, “At the start” or “At both ends” – turns a line into an arrow and back.' }
				}
			},
			snap: {
				title: 'Snap',
				text: 'The switch “Snap” in the tab “Draw” (group “Options”, on by default) helps to line things up while dragging: lines and points of shapes jump to 15° steps; the start and end of a new shape, dragged points and moved or resized selections jump to the edges and center of the page and to the edges and centers of other shapes and pictures – handwriting is never a target. Selections also snap to equal spacing between neighbors. Guide lines show what it snaps to: the small sign where a line starts is a frame for the page, otherwise the shape or picture it comes from, which is outlined as well. Equal gaps show their size in millimeters.',
				tip: 'Keep it on for diagrams and tidy layouts. Turn it off when you want to place things freely close to others. With a keyboard, holding Alt while dragging does the opposite of the switch, just for that drag.',
				keys: [['Alt']]
			},
			suggestion: {
				title: 'Turning a stroke into a shape',
				text: 'When you draw something larger than handwriting with the pen – a line, an arrow drawn in one go, a triangle, a rectangle or other four-cornered shape, a circle or an ellipse – a button such as “Convert to arrow” appears above it. Tap it to replace the stroke with an exact shape in the same color and thickness; the shape is selected right away, so you can move its points. If you ignore the button, it disappears at your next action or after a few seconds and the stroke stays as you drew it.'
			}
		}
	},
	insert: {
		title: 'Images & icons',
		items: {
			images: {
				title: 'Images',
				text: '“Image” in the tab “Insert” offers “Image from Files …” and “Image from this device …”; you can also paste an image or drop it on the page. It appears at its natural size, scaled down if it doesn’t fit the page, and is selected right away so you can move and resize it. Very large images are stored scaled down to keep the notebook small. The eraser never touches images – delete them with “Select”.'
			},
			icons: {
				title: 'Icons',
				text: '“Icon” in the tab “Insert” opens a searchable icon picker. The icon takes the current pen color and lands in the middle of the view, selected, so you can move and resize it with the frame. Change its color later with “Color” on the tab “Selection”. Icons stay sharp at any size, also in the export.'
			}
		}
	},
	pages: {
		title: 'Pages & paper',
		items: {
			pageMenu: {
				title: 'The tab “Pages”',
				text: 'The tab “Pages” applies to the current page – the one in the middle of the view (“Page 3 of 12” at the bottom). “Paper” and “Page size” choose from their lists, “Landscape” turns the page. “Add page” inserts a new page after it with the same size and paper (also in the tab “Insert”). “Move page up” and “Move page down” change the order. “Delete page” deletes it with everything on it right away; the message offers “Undo” (Ctrl+Z works too). The last page can’t be deleted.'
			},
			paper: {
				title: 'Paper',
				text: 'The background of the current page; it is printed into the export as well. Imported PDF pages keep the look of the PDF.',
				options: {
					blank: { label: 'Blank', text: 'For sketches and drawings.' },
					lined: { label: 'Lined', text: 'For writing (default of a new notebook).' },
					grid: { label: 'Grid', text: 'For math, tables and diagrams.' },
					dotted: { label: 'Dotted', text: 'Guidance like a grid, but calmer – good for bullet journals and layouts.' }
				}
			},
			size: {
				title: 'Page size',
				text: '“A4”, “A5”, “A3” or “US Letter”, and “Landscape” to turn the page. What is on the page stays where it is, so content can end up outside a smaller page. New notebooks start with A4; new pages take the size of the current one. Imported PDF pages keep their size.'
			},
			zoom: {
				title: 'Zoom and scrolling',
				text: 'The tab “View” holds “Fit width”, “Actual size”, “Zoom in” and “Zoom out”; the zoom value at the bottom opens the same list. On a touch screen, pinch with two fingers. With a mouse, the wheel scrolls (with Shift sideways), Ctrl and the wheel zoom (also a touchpad pinch), and dragging with the middle or right mouse button moves the page.',
				keys: [['Ctrl', '+'], ['Ctrl', '-'], ['Ctrl', '0']]
			}
		}
	},
	pdf: {
		title: 'PDF',
		items: {
			importNew: {
				title: 'PDF as a new notebook',
				text: '“Import PDF” on the start page – “PDF from Files …” or “PDF from this device …” – makes a new notebook from the PDF: every PDF page becomes a page you can write on. You choose where the notebook goes; for a PDF from Files the dialog starts next to it. A double click on a PDF in Files opens it in the PDF Editor, which comments on the PDF itself; for a notebook from it, choose “Open with Notes” in its menu there. Password-protected PDFs can’t be opened.',
				link: { href: '/help/pdf-editor', label: 'PDF Editor' }
			},
			importInto: {
				title: 'PDF pages into a notebook',
				text: '“PDF” in the tab “Insert” – “PDF from Files …” or “PDF from this device …” – or pasting or dropping a PDF inserts all its pages after the current page. One PDF is one undo step.'
			},
			annotate: {
				title: 'Writing on a PDF',
				text: 'A PDF page behaves like paper: write, highlight, draw shapes and insert pictures on it. The PDF itself is never changed – erasing and selecting only affect what you added. The pages stay sharp at every zoom; right after opening or zooming a page may look blurry for a moment until it is drawn in full. Paper and size can’t be changed on PDF pages.'
			},
			export: {
				title: 'Export',
				text: '“Export …” in the tab “File” (group “Notebook”) writes the notebook as a file. When it is ready, “Download” saves it on this device, “Save in Files …” keeps it in the browser storage – by default next to the notebook; the message then offers “Open” (a PDF opens in the PDF Editor, an image in Files).',
				options: {
					pdf: { label: 'PDF – all pages', text: 'Every page in one PDF. Strokes, shapes and imported PDF pages stay sharp at any size; images are embedded as they are.' },
					png: { label: 'PNG – this page', text: 'The current page as an image in print quality (about 216 dpi, at most 4096 pixels on the long side) – for messages, slides or other apps.' }
				},
				tip: 'Take PDF to print, archive or pass on a whole notebook, or to give a filled-in PDF back. Take PNG to share a single page as a picture.'
			}
		}
	},
	keys: {
		title: 'Keyboard shortcuts',
		items: {
			tools: { title: 'Tools', text: '“Pen”, “Highlighter”, “Shapes”, “Eraser”, “Select”, “Laser pointer”.', keys: [['P'], ['H'], ['S'], ['E'], ['L'], ['R']] },
			undo: { title: 'Undo', text: 'Undo the last change.', keys: [['Ctrl', 'Z']] },
			redo: { title: 'Redo', text: 'Redo what was undone.', keys: [['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']] },
			delete: { title: 'Delete selection', text: 'Delete what is selected with “Select”.', keys: [['Del'], ['Backspace']] },
			selectAll: { title: 'Select all', text: 'Select everything on the page in view (the tool becomes “Select”).', keys: [['Ctrl', 'A']] },
			nudge: { title: 'Move the selection', text: 'By 1 point, with Shift by 10, without snapping; one undo step until you let go.', keys: [['←'], ['→'], ['↑'], ['↓'], ['Shift', '←']] },
			deselect: { title: 'End selection', text: 'Deselect everything; without a selection, go back from any tool to “Select”.', keys: [['Esc']] },
			snap: { title: 'Snap the other way', text: 'Hold while dragging a shape, a point or a selection to do the opposite of the switch “Snap”.', keys: [['Alt']] },
			zoom: { title: 'Zoom', text: 'Zoom in, zoom out, back to 100 %.', keys: [['Ctrl', '+'], ['Ctrl', '-'], ['Ctrl', '0']] },
			wheel: { title: 'Mouse wheel', text: 'Ctrl and the wheel zoom at the pointer, Shift and the wheel scroll sideways.', keys: [['Ctrl', 'Wheel'], ['Shift', 'Wheel']] },
			ribbon: { title: 'Ribbon', text: 'Collapse or expand the ribbon; Alt or F10 show the access keys.', keys: [['Ctrl', 'F1'], ['Alt'], ['F10']] },
			home: { title: 'Start page', text: 'Open or delete the notebook in focus.', keys: [['Enter'], ['Del']] }
		}
	}
} satisfies HelpContent;

export default help;
