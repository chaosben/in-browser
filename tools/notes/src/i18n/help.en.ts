// Help texts of Notes (English leads; `help.de.ts` must have the same keys): the help window of the tool and the
// page `/help/notes`. Describe what users see and do: what each option means, what it costs and how to decide.

import type { HelpContent } from '@in-browser/brand/help.js';

const help = {
	start: {
		title: 'Getting started',
		items: {
			startPage: {
				title: 'Start page',
				text: 'The start page lists every notebook in the browser storage that all in-browser tools share, with its number of pages, when it was last changed and its folder – also notebooks that arrived from your other devices. Click a notebook to open it. “New notebook” asks where it goes and what it is called and starts with one lined A4 page. “Open …” opens a notebook from any folder, “Import PDF” makes a new notebook from a PDF (see “PDF”).'
			},
			deleting: {
				title: 'Deleting a notebook',
				text: 'The button with the three dots next to a notebook (or a right-click, or a long press on a phone) opens its menu with “Open” and “Delete”. A deleted notebook goes to the trash; the message that confirms it offers to undo it.'
			},
			layout: {
				title: 'Layout',
				text: 'The pages lie one below the other and fill the window. The floating bar at the bottom holds the tools (“Pen”, “Highlighter”, “Shapes”, “Eraser”, “Select”, “Laser pointer”), then the round button for “Color, thickness and smoothing” of the current tool, “Insert” and “Page”. Tap the active tool again to open or close its options. At the top: the notebook’s name with its menu (arrow) and, on wider screens, “Undo”, “Redo” and “Export”. At the bottom edge: the save state, “Page 3 of 12” and the zoom.'
			},
			saving: {
				title: 'Saving',
				text: 'Every change is saved automatically, a moment after you lift the pen; the icon at the bottom left shows whether everything is saved. Nothing is uploaded. A notebook is a file “Name.note” in the browser storage; click its name in the top bar to rename it. In Files you move, copy, delete or download notebooks like other files. A notebook can be open in only one tab at a time. If it is changed elsewhere (on another device, through sync), the pages you are not working on are reloaded and your changes here are kept.',
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
				text: 'Up to 300 changes can be undone and redone – strokes, erasing, moving, recoloring, inserted pictures and PDFs, page changes. The buttons are in the top bar on wider screens and always in the notebook’s menu (arrow next to its name).',
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
				text: 'The round button after the tools opens the options of the current tool: the suite’s color field (palette, recently used colors, own colors) and the thickness. Pen and shapes share one color and thickness; the highlighter keeps its own. All settings are remembered for the next notebook.'
			},
			smoothing: {
				title: 'Smoothing',
				text: 'Evens out shaky lines: the line follows the pen with a small delay and so loses small wobbles. When you lift the pen, the line catches up to where you lifted it. In the options of the pen and the highlighter.',
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
				text: 'Wipe over what should go. The size (three circles) is measured on the screen, so zooming in lets you erase finer details. Pictures (images, icons) are never erased – select them and delete them instead.',
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
				text: '“Only the pen draws” in the notebook’s menu (arrow next to its name) makes it permanent: fingers always only scroll and zoom, from the first touch on, in every notebook. While it is on, the bottom bar says so – tap it there to turn it off.',
				tip: 'Turn it on if you always write with a stylus – then even the very first touch of your palm draws nothing. Leave it off if you also write with a finger sometimes.'
			},
			longPress: {
				title: 'Long press',
				text: 'On a phone or tablet, a long press opens the menus that open with a right-click on a computer, e.g. the menu of a notebook on the start page.'
			}
		}
	},
	select: {
		title: 'Selecting',
		items: {
			selecting: {
				title: 'Select',
				text: 'With “Select” you tap an item to select the topmost one there (a stroke, shape, image or icon), or draw a loop around several: strokes count when at least half of them lies inside the loop, pictures when their center does. A frame with handles appears around the selection. Choosing another tool ends the selection.',
				keys: [['Esc']]
			},
			moving: {
				title: 'Move and resize',
				text: 'Drag inside the frame to move the selection, drag a corner to resize it – the proportions are kept, and the opposite corner stays in place. Each move or resize is one undo step. With “Snap” on, the selection lines up with the page and other shapes and pictures (see “Shapes”).'
			},
			points: {
				title: 'Points of a shape',
				text: 'When exactly one shape is selected, its points appear instead of the corners: the ends of a line or arrow, the corners of a polygon, and for an ellipse or rounded rectangle the corners of its box. Drag a point to reshape the shape.'
			},
			menu: {
				title: 'Selection menu',
				text: 'A menu floats above the selection (below it at the top of the screen). On phones it shows only icons. Each change there is one undo step.',
				options: {
					color: { label: 'Color', text: 'Recolors strokes, shapes and icons. Images keep their colors.' },
					size: { label: 'Thickness', text: 'The line thickness of selected strokes and shapes, in the five pen sizes.' },
					style: { label: 'Style', text: 'Only with shapes: fill, line style, hand-drawn look and, for lines, the arrowheads (see “Shapes”).' },
					duplicate: { label: 'Duplicate', text: 'Places a copy slightly offset on top and selects it, ready to be moved.' },
					delete: { label: 'Delete', text: 'Removes the selection; undo brings it back.' }
				},
				keys: [['Del'], ['Backspace']]
			}
		}
	},
	shapes: {
		title: 'Shapes',
		items: {
			shapeTool: {
				title: 'Drawing shapes',
				text: 'Choose “Shapes”; its options show the twelve shapes: line, arrow, double arrow, rectangle, rounded rectangle, ellipse, triangle, diamond, parallelogram, pentagon, hexagon and star. Drag on the page from one corner (or the start of a line) to the other. Nearly square shapes become a square or circle. A tap without dragging draws nothing. Shapes use the pen’s color and thickness. A shape stays editable: select it to move its points or change its style.'
			},
			style: {
				title: 'Shape style',
				text: 'Below color and thickness in the options of “Shapes” – and under “Style” in the selection menu for shapes already drawn.',
				options: {
					fill: { label: 'Fill', text: 'A color inside closed shapes, “None” for an empty outline. Lines and arrows have no fill.' },
					line: { label: 'Line', text: '“Solid”, “Dashed” or “Dotted”; the length of dashes and dots follows the thickness.' },
					sketch: { label: 'Hand-drawn', text: 'Draws the outline slightly uneven, like by hand – fits handwritten notes better than exact geometry.' },
					heads: { label: 'Arrowheads', text: 'Only in the selection menu, for lines and arrows: “None”, “At the end”, “At the start” or “At both ends” – turns a line into an arrow and back.' }
				}
			},
			snap: {
				title: 'Snap',
				text: 'The switch “Snap” in the options of “Shapes” and “Select” (on by default) helps to line things up while dragging: lines and points of shapes jump to 15° steps; the start and end of a new shape, dragged points and moved or resized selections jump to the edges and center of the page and to the edges and centers of other shapes and pictures – handwriting is never a target. Selections also snap to equal spacing between neighbors. Guide lines show what it snaps to, equal gaps with their size in millimeters.',
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
				text: '“Insert” offers “Image from Files …” and “Image from this device …”; you can also paste an image or drop it on the page. It appears at its natural size, scaled down if it doesn’t fit the page, and is selected right away so you can move and resize it. Very large images are stored scaled down to keep the notebook small. The eraser never touches images – delete them with “Select”.'
			},
			icons: {
				title: 'Icons',
				text: '“Icon …” in the “Insert” menu opens a searchable icon picker. The icon takes the current pen color and lands in the middle of the view, selected, so you can move and resize it with the frame. Change its color later with “Color” in the selection menu. Icons stay sharp at any size, also in the export.'
			}
		}
	},
	pages: {
		title: 'Pages & paper',
		items: {
			pageMenu: {
				title: 'Page menu',
				text: '“Page” in the bottom bar applies to the current page – the one in the middle of the view (“Page 3 of 12” at the bottom). “Add page” inserts a new page after it, with the same size and paper. “Move page up” and “Move page down” change the order. “Delete page” asks first and can be undone. “Add page” is also in the notebook’s menu.'
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
				text: 'The zoom value at the bottom opens “Fit width”, “100 %”, “Zoom in” and “Zoom out”. On a touch screen, pinch with two fingers. With a mouse, the wheel scrolls (with Shift sideways), Ctrl and the wheel zoom (also a touchpad pinch), and dragging with the middle or right mouse button moves the page.',
				keys: [['Ctrl', '+'], ['Ctrl', '-'], ['Ctrl', '0']]
			}
		}
	},
	pdf: {
		title: 'PDF',
		items: {
			importNew: {
				title: 'PDF as a new notebook',
				text: '“Import PDF” on the start page – “PDF from Files …” or “PDF from this device …” – makes a new notebook from the PDF: every PDF page becomes a page you can write on. You choose where the notebook goes; for a PDF from Files the dialog starts next to it. Opening a PDF in Files does the same. Password-protected PDFs can’t be opened.'
			},
			importInto: {
				title: 'PDF pages into a notebook',
				text: '“PDF from Files …” and “PDF from this device …” in the “Insert” menu – or pasting or dropping a PDF – insert all its pages after the current page. One PDF is one undo step.'
			},
			annotate: {
				title: 'Writing on a PDF',
				text: 'A PDF page behaves like paper: write, highlight, draw shapes and insert pictures on it. The PDF itself is never changed – erasing and selecting only affect what you added. The pages stay sharp at every zoom; right after opening or zooming a page may look blurry for a moment until it is drawn in full. Paper and size can’t be changed on PDF pages.'
			},
			export: {
				title: 'Export',
				text: '“Export” in the top bar (or “Export …” in the notebook’s menu) writes the notebook as a file. When it is ready, “Download” saves it on this device, “Save in Files …” keeps it in the browser storage – by default next to the notebook.',
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
			undo: { title: 'Undo', text: 'Undo the last change.', keys: [['Ctrl', 'Z']] },
			redo: { title: 'Redo', text: 'Redo what was undone.', keys: [['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']] },
			delete: { title: 'Delete selection', text: 'Delete what is selected with “Select”.', keys: [['Del'], ['Backspace']] },
			deselect: { title: 'End selection', text: 'Deselect everything.', keys: [['Esc']] },
			snap: { title: 'Snap the other way', text: 'Hold while dragging a shape, a point or a selection to do the opposite of the switch “Snap”.', keys: [['Alt']] },
			zoom: { title: 'Zoom', text: 'Zoom in, zoom out, back to 100 %.', keys: [['Ctrl', '+'], ['Ctrl', '-'], ['Ctrl', '0']] },
			wheel: { title: 'Mouse wheel', text: 'Ctrl and the wheel zoom at the pointer, Shift and the wheel scroll sideways.', keys: [['Ctrl', 'Wheel'], ['Shift', 'Wheel']] }
		}
	}
} satisfies HelpContent;

export default help;
