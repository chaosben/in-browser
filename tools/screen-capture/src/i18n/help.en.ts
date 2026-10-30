// Help window texts (English leads; `help.de.ts` must have the same keys). Describe what users see and do: what
// each option means, what it costs and how to decide.

export interface HelpOption {
	label: string;
	text: string;
}

export interface HelpItem {
	title: string;
	text: string;
	/** Meaning and consequences of each choice */
	options?: Record<string, HelpOption>;
	/** How to decide */
	tip?: string;
	/** Key combinations, each one a list of keys pressed together; alternatives are shown side by side */
	keys?: string[][];
}

export interface HelpTopic {
	title: string;
	items: Record<string, HelpItem>;
}

const help = {
	title: 'Help',
	button: 'Help',
	buttonTitle: 'Help (F1)',
	search: 'Search help',
	noMatches: 'Nothing found.',
	topics: 'Topics',
	move: 'Drag to move the help window',
	tipLabel: 'How to decide',
	sections: {
		start: {
			title: 'Getting started',
			items: {
				layout: {
					title: 'Layout',
					text: 'Left: everything you add (media, annotations, text, icons, zoom). Middle: the preview, below it the timeline with the toolbar. Right: the properties of the selected element – with nothing selected, those of the project.'
				},
				saving: {
					title: 'Saving',
					text: 'Every change is saved automatically – “Saved” next to the project name in the top bar confirms it. Click the name to rename the project. Nothing is uploaded. A project is a file “Name.screencapture” in the browser storage that all in-browser tools share. When you start a project (recording, import, empty project), you choose its folder and name; the dialog starts in the folder you used last. “Save as …” in the menu next to the project name (arrow) makes a copy under a new name or in another folder – you then continue with the copy. Pick an existing project and click “Replace” to overwrite it (not while it is open in another tab). “Open …” on the start page opens any project. In Files you rename, move, copy, delete or download projects like other files.',
					tip: 'Browser storage is tied to this browser and can be lost when site data is cleared. In Files (Chrome and Edge), choose a folder on your computer under “Folder on your computer”: your projects are then kept in sync with it, and a sync tool can bring that folder to your other computers. A project open in one tab cannot be opened in a second one at the same time.'
				},
				storage: {
					title: 'Storage space',
					text: 'The start page shows how much of the browser storage the in-browser tools use. Recordings and imported media are the largest part; deleting a project (on the start page or in Files) frees its space.'
				},
				browser: {
					title: 'Browser',
					text: 'Works best in a current Chrome or Edge on a desktop computer. Firefox works with limits: no system audio, no sync with a folder on your computer, no installation.'
				},
				install: {
					title: 'Install and offline',
					text: 'When your browser offers it (in Chrome and Edge an install icon in the address bar), you can add the app like a program. It then also starts without an internet connection. A new version is announced with a hint – it is never applied without asking, so a running recording is safe.'
				},
				undo: { title: 'Undo', text: 'Up to 100 changes can be undone and redone.', keys: [['Ctrl', 'Z'], ['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']] }
			}
		},
		record: {
			title: 'Recording',
			items: {
				flow: {
					title: 'How a recording works',
					text: 'Choose the sources in the tabs, then “Choose screen or window”: the browser asks which screen, window or tab to share. After the optional 3 second countdown the recording runs. “Pause” stops all sources together (pauses don’t count), “Stop” finishes – so does “Stop sharing” in the browser’s bar. “Discard” deletes the recording.'
				},
				screenQuality: {
					title: 'Screen – Quality',
					text: 'The screen is recorded at constant quality: still parts cost almost nothing and stay sharp, movement gets as much data as it needs. The file size therefore depends on the content.',
					options: {
						low: { label: 'Low', text: 'Smallest files; fine text and fine lines can get blurry.' },
						medium: { label: 'Medium', text: 'Good for large text and slides; small fonts lose some sharpness.' },
						high: { label: 'High (default)', text: 'Sharp text in normal screen work at moderate size.' },
						veryHigh: { label: 'Very high', text: 'Hardly any loss even with small fonts – files grow noticeably with a lot of movement.' }
					},
					tip: 'Take “High” for software demos and anything with text. Choose “Very high” if you use small fonts or plan to zoom in later. “Medium” or “Low” suit long recordings with little text, e.g. a talking head over slides.'
				},
				frameRate: {
					title: 'Screen – Frame rate',
					text: 'How many pictures per second are recorded.',
					options: {
						fps30: { label: '30 fps (default)', text: 'Smooth enough for clicking, typing and scrolling.' },
						fps60: { label: '60 fps', text: 'Smoother fast movement; about 1.5 times the data and more processor load.' }
					},
					tip: 'Stay at 30 for tutorials and presentations. Use 60 only for fast movement such as games or animations – and export with 60 fps as well, otherwise the advantage is lost.'
				},
				encoder: {
					title: 'Screen – Encoder',
					text: 'Which part of the computer compresses the video. The line below shows what is used (“Encoder: AV1 · Hardware”, for example); “Details” lists what your browser supports.',
					options: {
						auto: { label: 'Automatic – low processor load', text: 'Uses the graphics chip if possible. The computer stays responsive, even during long recordings.' },
						sharp: { label: 'Sharpest text – more processor load', text: 'Always compresses on the processor with a method made for screen content. Fine text stays sharpest, but the processor works harder.' }
					},
					tip: 'Keep “Automatic”. Switch to “Sharpest text” only if small text looks smeared and your computer has power to spare. If a warning says there is no hardware encoder, the processor is used anyway – then a lower quality or 30 fps relieves it.'
				},
				growWindow: {
					title: 'Window may get larger while recording',
					text: 'Only matters when you share a single window or tab. The recording has a fixed size from the start. If the window gets larger later, it is scaled down to fit – unless this option is on: then the recording reserves the full screen size, and the larger window stays sharp.',
					tip: 'Leave it off if you don’t resize the window while recording – it saves processor power. Turn it on if you enlarge the window during the recording. Where a smaller window sits in the picture is set later under “Window position” of the clip.'
				},
				estimate: {
					title: 'Size estimate',
					text: '“up to approx. … MB per minute” is an upper bound for the full screen with all chosen sources. Screen recordings with little movement are usually much smaller.'
				},
				systemAudio: {
					title: 'System audio',
					text: 'Records what your computer plays – videos, notification sounds, the other side of a call. The browser only offers it on Windows or when you share a browser tab; Firefox doesn’t at all. It ends up in the same clip as the picture.',
					tip: 'Also turn on audio sharing in the browser’s share dialog, otherwise no sound arrives. Leave the filters off here: they are made for speech and dull music and game audio.'
				},
				microphone: {
					title: 'Microphone',
					text: 'Your voice as its own clip with its own volume. Pick the device in the list – names only appear after you allowed access once. The level meter shows whether the microphone picks you up; speak normally and watch it move clearly without hitting the end all the time.'
				},
				filters: {
					title: 'Microphone filters',
					text: 'Processing by the browser before recording. It cannot be undone later.',
					options: {
						echo: { label: 'Echo cancellation', text: 'Removes the sound from your speakers that the microphone picks up again.' },
						noise: { label: 'Noise suppression', text: 'Reduces constant background noise like fans or traffic; voices can sound a little flatter.' },
						gain: { label: 'Automatic gain control', text: 'Evens out loud and quiet speech automatically; it also lifts background noise in pauses.' }
					},
					tip: 'With speakers: keep echo cancellation on. With a headset in a quiet room you can turn all three off for a more natural sound. Turn gain control off if your distance to the microphone stays the same and you prefer to set the level yourself.'
				},
				audioQuality: {
					title: 'Audio quality',
					text: 'Data rate for the microphone and the system audio, each on its own.',
					options: {
						kbps96: { label: '96 kbit/s', text: 'Enough for speech, smallest files.' },
						kbps128: { label: '128 kbit/s', text: 'Clear speech with reserve.' },
						kbps192: { label: '192 kbit/s (default)', text: 'Safe choice for speech and most audio.' },
						kbps256: { label: '256 kbit/s', text: 'For music where every detail matters.' }
					},
					tip: 'Audio is small compared to video – the default 192 is almost always right. Choose 256 only for music.'
				},
				webcam: {
					title: 'Webcam',
					text: 'Your camera as its own clip, recorded at 30 fps. Check the picture in the preview of the tab before you start.',
					options: {
						res720: { label: 'Resolution 720p (default)', text: 'Plenty for the small picture in the corner.' },
						res1080: { label: 'Resolution 1080p', text: 'Sharper when the webcam is shown large or full screen – files about twice as large.' }
					},
					tip: '720p is enough as long as the webcam is a small picture in the corner. Choose 1080p if you switch to the camera full screen. Keep “Very high” quality for the webcam: camera pictures are noisy and need more data than screen content.'
				},
				countdown: { title: '3 second countdown', text: 'Gives you time to switch to the window you record. Turn it off if you want to start immediately.' },
				result: {
					title: 'After recording',
					text: 'Screen, webcam and microphone become separate clips, linked to each other and appended at the end of the timeline: the webcam bottom right at a quarter of the width with rounded corners, the microphone on its own track. A click selects all of them; “Unlink” separates them.'
				}
			}
		},
		media: {
			title: 'Media & import',
			items: {
				import: {
					title: 'Import',
					text: '“Import from computer” or dropping files onto the editor puts them into the media bin – not into the timeline. “Import from Files” does the same with files from the shared browser storage (several at once with Ctrl or Shift); they are copied into the project, so the originals in Files stay as they are and deleting them there does not harm the project. Videos: MP4, WebM, MOV, MKV. Audio: MP3, WAV, M4A, AAC, OGG, Opus, FLAC. Images: PNG, JPEG, WebP, GIF, SVG. Videos and audio are repackaged to MP4 without changing their quality.'
				},
				newProject: {
					title: 'New project from files',
					text: 'On the start page, “Import from computer”, “Import from Files” or dropping files creates a new project – after asking for its folder and name. Videos and audio become clips in the timeline; images follow the videos one after another, 3 s each, fitted into the canvas (e.g. for a slideshow), and are also in the media bin. The first video sets the canvas size; without a video, the first image does.'
				},
				insert: {
					title: 'Insert',
					text: 'The insert button of an entry puts it at the playhead, in front of everything there; images land in the center at most half the canvas size, never enlarged. You can also drag an entry onto the timeline (at that time) or the preview.'
				},
				drop: {
					title: 'Drop onto the timeline',
					text: 'Files dropped directly onto the timeline are imported and inserted right there; dropped onto the preview, they start at the playhead.'
				},
				delete: {
					title: 'Delete media',
					text: 'Only media that is no longer used in the timeline can be deleted. If undo steps still use it, those steps are lost – you are asked first.'
				},
				icons: {
					title: 'Icons',
					text: 'Each set offers a basic selection of about 230 icons that works offline. “Load all icons” fetches the whole set once; it then stays in the browser, works offline and can be filtered by style (and by category for Material). Search with English names. The icon is stored in the project, so it never depends on a set.',
					options: {
						material: { label: 'Material Symbols', text: 'About 16,000 icons (1.3 MB), styles from regular to outlined, rounded or sharp.' },
						tabler: { label: 'Tabler', text: 'About 6,000 icons (0.3 MB) with even, simple lines; outline or filled.' },
						phosphor: { label: 'Phosphor', text: 'About 9,000 icons (0.9 MB) in six weights from thin to bold, plus duotone.' }
					},
					tip: 'Material has the largest choice. Tabler looks calm and technical. Phosphor fits when you want a particular line weight or two-tone icons. Stick to one set per video for a consistent look.'
				}
			}
		},
		library: {
			title: 'Library',
			items: {
				save: {
					title: 'Save elements',
					text: 'Keep elements you have set up – a styled arrow, a speech bubble with text, a trimmed clip with its annotations – to insert them again. Select them and choose “Add to library …” in the context menu (right click), or drag them from the preview or the timeline onto a section of the open Library group on the left – as soon as you leave the preview or timeline, the element snaps back and hangs at the pointer as a picture with its name; the library sections show dashed frames and the one under the pointer lights up. Released elsewhere, nothing changes. With the library closed, hold the element over its icon on the left for a moment to open it. Give it a name and click the library it goes into – “This project” or “All projects”; Enter takes the one you chose last time. Saved are all selected elements with their settings, text, trimming, links and place in the picture; zoom segments are not.',
					options: {
						project: { label: 'This project', text: 'Stays with the project, also in its copies. Uses the project’s media directly, so media used there cannot be deleted from the media bin.' },
						global: { label: 'All projects', text: 'Available in every project, even after the original project is deleted. Media it uses is copied into the library – for clips the whole media file, not only the trimmed part, so it takes storage space.' }
					},
					tip: 'Save annotations, texts and logos for all projects – they hardly take any space. Keep trimmed clips in the project, unless it is something like an intro that belongs in every video.'
				},
				insert: {
					title: 'Insert',
					text: 'Click a tile to insert it at the playhead, or drag it onto the timeline (it starts where you drop it) or the preview (at the playhead). It keeps its place in the picture and goes in front of what it overlaps; one undo step. Media from the global library is copied into the project and appears in the media bin.'
				},
				manage: {
					title: 'Manage',
					text: 'Right-click a tile to insert, rename, move or copy it into the other library, or remove it. Dragging a tile into the other section moves it; moving into this project copies its media into the media bin. Removing does not affect elements already inserted.',
					tip: 'Library or clipboard? The clipboard is for quickly repeating something now, also into another project. The library is for building blocks you need again and again over time.'
				},
				view: {
					title: 'View and search',
					text: 'The buttons at the top switch between two views; your choice is remembered. The search field next to them narrows both sections to entries whose name or elements match (e.g. “arrow” or a text); Esc clears it.',
					options: {
						list: { label: 'List', text: 'One line per entry with a small preview – many entries at a glance.' },
						grid: { label: 'Tiles', text: 'Two columns with a large preview – easier to recognize what an entry looks like.' }
					},
					tip: 'Use the list once you have many building blocks and know them by name; tiles while you are still collecting them or tell them apart by their look.'
				}
			}
		},
		canvas: {
			title: 'Canvas',
			items: {
				size: {
					title: 'Canvas size',
					text: 'The canvas is the picture of your video: everything is placed on it, and the export uses its size. The first recording or video sets it; an empty project starts with the size you choose.',
					options: {
						landscape: { label: 'Full HD 16:9 (1920×1080)', text: 'Standard for YouTube, presentations and websites. HD (1280×720) is smaller, QHD and 4K larger.' },
						portrait: { label: 'Portrait 9:16 (1080×1920)', text: 'Full-screen on phones: Shorts, Reels, TikTok, stories.' },
						feed: { label: 'Portrait 4:5 and Square 1:1', text: 'Take up a lot of space in social media feeds.' },
						custom: { label: 'Custom', text: 'Any even size from 16 to 7680 pixels.' }
					},
					tip: 'Choose the format of the place where the video will be shown. Larger than your recording doesn’t make it sharper – 4K only pays off if you recorded a 4K screen.'
				},
				change: {
					title: 'Change',
					text: '“Change” in the project properties sets a new size. Everything keeps its size in pixels and stays centered; on a smaller canvas, content can reach over the edge. Can be undone.'
				},
				enlarge: {
					title: 'Enlarge canvas?',
					text: 'If you insert material larger than the canvas, it is shown scaled down, and you are asked whether the canvas should grow.',
					options: {
						grow: { label: 'Enlarge canvas', text: 'The new material is shown 1:1 and sharp; the existing content keeps its size and moves to the center. The export gets larger.' },
						keep: { label: 'Keep size', text: 'The output size stays; the new material stays scaled down.' }
					},
					tip: 'Enlarge if the new material is your main content, e.g. a recording on a larger screen. Keep the size if the video has to fit a fixed format or the material is only a side element. The project properties offer “Enlarge canvas” again later.'
				},
				background: {
					title: 'Background color',
					text: 'Visible wherever nothing covers the canvas: in gaps, around picture-in-picture clips and during fades. Set it in the project properties (nothing selected).'
				}
			}
		},
		timeline: {
			title: 'Timeline',
			items: {
				playhead: {
					title: 'Playhead',
					text: 'Click or drag in the ruler to move the playhead. The arrow keys step one frame, with Shift one second.',
					keys: [['Space'], ['K'], ['←'], ['→'], ['Home'], ['End']]
				},
				tracks: {
					title: 'Tracks',
					text: 'Higher tracks are in front – the top row is the front. Drag an element up or down to another track; if the target is occupied at that time, a new track is created. Ctrl + ↑/↓ moves it one step, with Shift all the way. The “+” row creates a new track in front.',
					keys: [['Ctrl', '↑'], ['Ctrl', '↓']]
				},
				trackStates: {
					title: 'Track header',
					text: 'The buttons in front of each track apply to all elements on it.',
					options: {
						hide: { label: 'Hide track', text: 'No picture and no sound – in the preview and in the export.' },
						mute: { label: 'Mute track', text: 'Only the sound is gone; the picture stays.' },
						lock: { label: 'Lock track', text: 'Elements can no longer be selected, moved or deleted by accident. Deleting time elsewhere still moves them along, so everything stays in sync.' }
					},
					tip: 'Hide a track to compare versions, mute it to judge the rest without its sound, and lock the main recording once it is cut, so you don’t move it while placing annotations.'
				},
				select: {
					title: 'Select',
					text: 'A click selects the element with its linked ones; Alt + click only this one; Ctrl or Shift + click adds or removes. Dragging moves all selected elements together.',
					keys: [['Ctrl', 'A'], ['Esc']]
				},
				move: {
					title: 'Move and trim',
					text: 'Drag an element to move it in time; it stops at its neighbors on the same track and snaps to edges and the playhead (“Snap” above the timeline, Alt does the opposite). Drag the ends of a clip to trim it.'
				},
				ripple: {
					title: 'Delete and trim: what moves',
					text: 'When time is removed, everything later on all tracks moves up – but only where nothing else remains at that time. A picture-in-picture clip or an annotation still lying there keeps the time. When you lengthen a clip, it first fills free space on its track; only what goes beyond pushes everything later on all tracks.',
					options: {
						noGap: { label: 'Normal', text: 'The gap closes as far as possible.' },
						gap: { label: 'With Shift', text: 'A gap remains when deleting; when trimming, the rest stays where it is.' },
						audio: { label: 'Audio clips and annotations', text: 'Deleting them never removes time: background music doesn’t shift your cut.' }
					},
					tip: 'Use the normal way to cut out mistakes. Hold Shift if later elements are already placed exactly in time, e.g. to music.',
					keys: [['Del'], ['Shift', 'Del']]
				},
				split: {
					title: 'Split',
					text: 'Cuts the selected elements under the playhead – with no selection there, all clips under the playhead. There is no fade at the cut.',
					keys: [['S']]
				},
				hold: {
					title: 'Hold frame',
					text: 'Inserts a still frame of the selected clips (or of all clips with a picture) at the playhead; choose its length next to the button (1–8 s). Everything later moves back. Other clips under the playhead – including audio – are split and get a gap; still frames are silent.',
					tip: 'Use it to give viewers time to read something or to explain a step. 2–3 seconds suit a short pause; for longer explanations, record your voice on its own track over the still frame.',
					keys: [['F']]
				},
				link: { title: 'Link', text: 'Links the selected elements, so a click selects, moves and deletes them together.', keys: [['Ctrl', 'G'], ['Ctrl', 'Shift', 'G']] },
				clipboard: {
					title: 'Copy, cut, paste',
					text: 'Copies the selected elements – clips and annotations – and pastes them at the playhead: the earliest one starts there, the spacing between them stays, and they keep their place in the picture. The copy goes in front of everything it overlaps and is selected; one undo step. Linked copies are linked among themselves, never with the originals. Zoom segments are not copied.',
					options: {
						cut: { label: 'Cut', text: 'Copies and then deletes like Del – later elements move up. Elements on locked tracks stay.' },
						other: { label: 'Other project', text: 'The clipboard is shared by all tabs and projects in this browser. Pasting into another project copies the videos, audio files and images it needs into that project’s media bin, so it works on its own afterwards. If a medium no longer exists (project or file deleted), its elements are left out with a message.' }
					},
					tip: 'To repeat an annotation later (e.g. the same arrow style for each step), copy it, move the playhead and paste. For the same element at the same time in another project, place the playhead there first.',
					keys: [['Ctrl', 'C'], ['Ctrl', 'X'], ['Ctrl', 'V']]
				},
				layer: {
					title: 'Change the layer',
					text: 'What is in front is decided by the track: higher tracks are drawn later and cover lower ones – also spotlight and blur only affect what lies below them. Change the layer of the selected element via the context menu, the shortcuts or by dragging its bar up or down in the timeline.',
					options: {
						forward: { label: 'One layer forward / back', text: 'Jumps in front of (behind) the next element that is visible at the same time – not simply one track further, so every step changes what you see.' },
						front: { label: 'To the front / back', text: 'In front of (behind) everything that overlaps it in time.' }
					},
					tip: 'An annotation that should stay bright next to a spotlight (e.g. a frame or arrow) has to be in front of the spotlight. Elements on locked tracks cannot be moved; unlock the track first.',
					keys: [['Ctrl', '↑'], ['Ctrl', '↓'], ['Ctrl', 'Shift', '↑'], ['Ctrl', 'Shift', '↓']]
				},
				menu: {
					title: 'Context menu',
					text: 'A right click on an element – in the timeline or the preview – selects it (unless it already is) and offers cut, copy, paste, delete, changing the layer and adding to the library. On an empty spot in the timeline it moves the playhead there, so “Paste” inserts at that spot.'
				},
				view: {
					title: 'Timeline zoom and height',
					text: 'Ctrl + mouse wheel or the slider zooms the timeline (up to 32×); “Show all” fits everything. Drag the bar above the toolbar to give the timeline more or less height; double-click restores it.'
				}
			}
		},
		preview: {
			title: 'Preview',
			items: {
				edit: {
					title: 'Move and resize',
					text: 'Click an element in the preview to select it, drag it to move it and drag its corners to resize it. A click selects the front-most element under the mouse (covered ones: see below); a click on an empty spot or Esc clears the selection.'
				},
				snap: {
					title: 'Snapping',
					text: 'Elements snap to the canvas edges and center, to the edges and centers of other elements and to equal spacing between them – lines and distances show what they snapped to. The icon on a line tells where it comes from: a frame for the canvas, otherwise the type of the element, which is outlined as well. The “Snap” switch above the timeline turns it on or off for preview and timeline; holding Alt while dragging does the opposite.',
					keys: [['Alt']]
				},
				axis: { title: 'One direction', text: 'Hold Shift while moving to move only horizontally or vertically.', keys: [['Shift']] },
				nudge: {
					title: 'Arrow keys',
					text: 'After clicking into the preview, the arrow keys move the selected element by one canvas pixel, with Shift by ten. A series of key presses is one undo step.',
					keys: [['←'], ['↑'], ['→'], ['↓'], ['Shift', '←']]
				},
				covered: {
					title: 'Select covered elements',
					text: 'A click always hits the front-most element. To reach one below it, there are three ways:',
					options: {
						menu: { label: 'Right click', text: 'The context menu lists under “Select element” everything under the mouse pointer, front-most first. Pointing at an entry highlights the element in the preview, a click selects it.' },
						tab: { label: 'Tab', text: 'After clicking into the preview, Tab selects the next element under the playhead from front to back, Shift+Tab the previous one.' },
						timeline: { label: 'Timeline', text: 'A click on its bar in the timeline.' }
					},
					tip: 'Once selected, a covered element stays on top for editing: you can move and resize it in the preview directly, even though it is still drawn behind the others. A simple click (without dragging) on an element in front of it still selects that one. To bring it to the front for good, change its track (Ctrl+↑).',
					keys: [['Tab'], ['Shift', 'Tab']]
				},
				paused: {
					title: 'While paused',
					text: 'The paused preview shows everything at full opacity and without zoom, so all elements can be edited. The zoom area under the playhead is marked with a dashed frame. Fades, self-drawing shapes and zoom are shown while playing and in the export.'
				}
			}
		},
		clips: {
			title: 'Clips',
			items: {
				placement: {
					title: 'Position in the picture',
					text: 'A clip can be any size anywhere on the canvas (picture in picture). The buttons set it to one of two standard placements.',
					options: {
						fit: { label: 'Fit', text: 'The whole picture is visible; free space shows the background color.' },
						fill: { label: 'Fill', text: 'The canvas is covered completely; edges of the picture may be cut off.' }
					},
					tip: 'Fit for screen recordings – nothing important gets cut off. Fill for camera pictures or when a different aspect ratio must not leave bars.'
				},
				shape: {
					title: 'Shape',
					text: 'How the clip is cut out.',
					options: {
						rect: { label: 'Rectangle', text: 'The full picture.' },
						rounded: { label: 'Rounded', text: 'Rounded corners – a softer look for picture in picture.' },
						circle: { label: 'Circle', text: 'A centered circle; the sides are cut off.' }
					},
					tip: 'A circle suits a webcam picture with your face in the middle; keep the full screen recording a rectangle.'
				},
				windowPosition: {
					title: 'Window position',
					text: 'Only appears if the recorded window changed its size. The clip has the size of the largest window; while the window was smaller, the rest stays empty. The 3×3 grid sets where the smaller window sits.'
				},
				volume: {
					title: 'Volume',
					text: 'Per clip from 0 to 100 %; the button mutes it. The waveform in the timeline follows the volume.',
					tip: 'Turn background music down to 15–30 % so speech stays clear.'
				},
				fades: {
					title: 'Fades',
					text: 'Fade in and out per clip (0 = none): the picture becomes transparent and what is below shows through, the sound gets quieter. Still frames only fade the picture, audio clips only the sound.'
				}
			}
		},
		annotations: {
			title: 'Annotations',
			items: {
				add: {
					title: 'Add',
					text: 'Click a tile on the left to add it at the playhead, or drag it onto the preview or the timeline. Annotations zoom along with the picture.'
				},
				shapes: {
					title: 'Arrow, line, frame, ellipse',
					text: 'Point at or mark something. Color and line width (1 px up to a tenth of the canvas height; the arrowhead grows along) are set in the properties; a line can be dashed, a frame can get rounded corners.'
				},
				pen: {
					title: 'Hand-drawn and drawing itself',
					text: 'Arrow, line, frame and ellipse can look as if drawn with a pen and draw themselves when they appear – e.g. circling something on screen.',
					options: {
						sketch: { label: 'Hand-drawn', text: 'Slightly irregular strokes: an ellipse circles a bit more than once with an overshoot, a frame consists of four strokes reaching over the corners, arrow and line curve slightly and the arrowhead is drawn open. The irregularity is fixed per element, so it looks the same in preview and export and does not change when you move it; a copy gets its own.' },
						drawIn: { label: 'Draw in', text: 'Time in seconds in which the shape draws itself after its start (0 = appears at once). An exact arrow draws its shaft first, then the head appears. Dashed lines stay dashed. In the paused preview the shape is always complete; it draws while playing and in the export.' }
					},
					tip: 'To circle something: ellipse, hand-drawn, draw in 0.5–0.8 s and set the fade-in to 0, so the stroke appears fully colored. Faster than 0.3 s hardly reads as drawing, slower than 1.5 s feels sluggish. An arrow drawing itself in about 0.4 s points the eye in the right direction.'
				},
				highlight: {
					title: 'Highlighter',
					text: 'A colored, translucent area over text or a button. The opacity of the color sets how much shines through (default 40 %).'
				},
				spotlight: {
					title: 'Spotlight',
					text: 'Draws the eye to an area by toning down everything outside it – also clips and annotations on lower tracks. Darkening and blurring work on their own or together.',
					options: {
						color: { label: 'Color', text: 'Darkens (or tints) the surroundings. The opacity of the color is the strength (default black at 60 %); 0 % turns darkening off.' },
						blur: { label: 'Blur', text: 'Blurs the surroundings, in canvas pixels; 0 px (default) turns it off. Higher values make the rest unrecognizable.' },
						shape: { label: 'Shape', text: 'Rectangle (with corner radius; a large radius gives a pill shape) or ellipse filling the frame – with an equally wide and high frame a circle.' }
					},
					tip: 'Darkening at 40–60 % is the clearest guide and keeps the rest readable. Blur only (opacity 0 %) when the surroundings should keep their colors, e.g. a busy desktop next to a dialog. Both together when a restless background still draws attention; then a weaker darkening (20–40 %) is enough. Ellipse for faces, webcam areas and round icons; rectangle with a small radius for buttons, fields and windows.'
				},
				blur: {
					title: 'Blur',
					text: 'Blurs the marked area, e.g. passwords, e-mail addresses or names – also clips and annotations on lower tracks. To blur everything except an area, use the spotlight.',
					options: {
						shape: { label: 'Shape', text: 'Rectangle (with corner radius) or ellipse filling the frame.' }
					},
					tip: 'For sensitive data, use a high strength and make the area a bit larger than the text, and check the result frame by frame in the export. For text, the rectangle is the safest shape – an ellipse leaves the corners sharp. Ellipse for faces.'
				},
				step: {
					title: 'Step',
					text: 'A numbered circle for instructions. New steps get the next number; you can change it. The number is automatically black or white, whichever reads better on the color.'
				},
				image: {
					title: 'Image',
					text: 'Your own images from the media bin, e.g. a logo. They keep their aspect ratio; “Fit” and “Fill” place them on the canvas, the corner radius rounds them. With a transparent PNG or SVG, the shadow follows the outline.'
				},
				icon: {
					title: 'Icon',
					text: 'Icons from the Icons group on the left; the color including opacity is set in the properties.'
				},
				shadow: {
					title: 'Shadow',
					text: 'A soft drop shadow that lifts the element off the picture. On by default; a text with a background starts without, and there the box carries the shadow.',
					tip: 'Keep it on for elements over busy or changing content; turn it off on calm, plain backgrounds for a flat look.'
				},
				fades: {
					title: 'Fades and duration',
					text: 'Each annotation fades in and out over its own duration (default 0.2 s, 0 = off). If both together are longer than the element, they are shortened; if the element gets shorter later, the field turns yellow and the tooltip shows what is actually used.'
				},
				styles: {
					title: 'Remembered settings',
					text: 'What you set in the properties – color, font, size, line width, shadow, fades, duration – and sizes dragged at a corner apply to the next new element of the same type, in all projects. Position, text and step number are not remembered.'
				}
			}
		},
		text: {
			title: 'Text & speech bubble',
			items: {
				box: {
					title: 'Text box',
					text: 'Corners scale the whole text. The sides set a fixed width: the text then wraps. “Auto width” fits the box to the longest line again. The height always follows the text. A box that would get larger than the canvas wraps to the canvas width and, if needed, gets a smaller font.'
				},
				font: {
					title: 'Font',
					text: 'Fonts are included in the app and work offline.',
					options: {
						system: { label: 'System font', text: 'The font of your operating system – neutral and familiar.' },
						inter: { label: 'Inter', text: 'Very readable at small sizes; good for labels.' },
						montserrat: { label: 'Montserrat', text: 'Wide and striking; good for titles.' },
						caveat: { label: 'Caveat', text: 'Handwriting – personal notes and hints.' },
						mono: { label: 'JetBrains Mono', text: 'Same width for every character – code and commands.' }
					},
					tip: 'Use one font for running text and at most a second one for titles. For code, always a monospaced font.'
				},
				align: {
					title: 'Alignment',
					text: 'Left, centered, right or justified. Justified text spreads the words to the full width; the last line of each paragraph stays left-aligned.'
				},
				background: {
					title: 'Background color, corner radius, padding',
					text: 'A box behind the text makes it readable on any picture. Corner radius rounds the box, padding sets the space between box edge and text. A text can do without a background, a speech bubble always has one.',
					tip: 'A dark box at about 65 % opacity (the default) keeps white text readable on any content. Without a background, turn on the shadow.'
				},
				callout: {
					title: 'Speech bubble',
					text: 'A text box with a pointer. Drag the round handle at its tip to point at something; moving the box takes the tip along.'
				}
			}
		},
		zoom: {
			title: 'Zoom',
			items: {
				segments: {
					title: 'Zoom segments',
					text: 'A zoom segment enlarges an area of the picture for a while; it lies on its own track above the others. Between segments the full picture is shown. While paused, the preview shows the full picture with the zoom area as a dashed frame; click its label or edge to select it.'
				},
				level: {
					title: 'Zoom level',
					text: 'How much the area is enlarged: 1.1× to 6× in the properties, up to 10× by dragging the corners in the preview. The area always keeps the canvas’ aspect ratio.',
					tip: '1.5–2.5× is usually enough to make small text readable. Higher levels enlarge the recorded pixels – the picture gets soft, unless you recorded with “Very high” quality on a large screen.'
				},
				transition: {
					title: 'Transition',
					text: 'How long zooming in and out takes, each on its own (default 0.6 s, 0 = hard cut).',
					tip: '0.4–0.8 s feels calm and natural. Use a hard cut only if the change should be abrupt.'
				}
			}
		},
		properties: {
			title: 'Properties',
			items: {
				sections: {
					title: 'Sections',
					text: 'Properties are grouped into sections you can collapse; collapsed sections stay collapsed for all elements. The search field shows only matching properties.'
				},
				numbers: {
					title: 'Number fields',
					text: 'Type a value (comma or point), use ↑/↓ (Shift: ×10) or drag the label left or right (Shift: ×10, Alt: ×0.1). Sizes are in pixels of the canvas.'
				},
				colors: {
					title: 'Colors',
					text: 'Preset colors in the first row, your own colors below – the latest ones you picked and those used in the project. The swatches always show the color opaque, so it stays recognizable; how translucent it is shows the “Opacity” button (color over a checkerboard and percent). The picker on the right offers any color.',
					options: {
						opacity: { label: 'Opacity', text: '100 % is opaque, 0 % invisible. Highlighter and spotlight use it as their strength.' },
						palette: { label: 'Preset colors', text: 'Drag a color from the second row onto a preset to replace it; drag a preset onto another one to swap them. They apply in all color fields and all projects. The button next to the picker restores the default colors (only shown after a change).' }
					},
					tip: 'Put the colors you use again and again – e.g. your brand colors – into the presets once; then they are one click away in every project and do not get pushed out of the recent colors.'
				}
			}
		},
		export: {
			title: 'Export',
			items: {
				start: {
					title: 'Starting the export',
					text: '“Export” sits right next to the project name at the top (on narrow windows in the menu at the project name). It opens the export settings; the video is only rendered when you start it there. While the project is empty, it is grayed out.'
				},
				resolution: {
					title: 'Resolution',
					text: '“Original” is the canvas size. Only smaller sizes can be chosen – the video is never enlarged, because that would only make it bigger, not sharper.',
					tip: 'Keep “Original” unless the file has to be smaller: 1080p is enough for almost every website, 720p for e-mail and chat.'
				},
				quality: {
					title: 'Quality',
					text: 'The data rate of the video. The numbers are for 1080p at 30 fps; smaller resolutions need proportionally less.',
					options: {
						low: { label: 'Low', text: 'About 2.5 Mbit/s – small files, visible loss with movement and fine text.' },
						medium: { label: 'Medium', text: 'About 4.4 Mbit/s – fine for slides and calm screen work.' },
						high: { label: 'High (default)', text: 'About 7.5 Mbit/s – sharp text, good for most videos.' },
						veryHigh: { label: 'Very high', text: 'About 12.4 Mbit/s – for a lot of movement or if the video will be edited again.' },
						custom: { label: 'Custom', text: 'Set the bitrate in Mbit/s yourself.' }
					},
					tip: 'Take “High”. Platforms like YouTube compress again anyway – “Very high” gives them the best starting point. Choose “Medium” or “Low” if the file has to be small.'
				},
				frameRate: {
					title: 'Frame rate',
					text: '15, 24, 30 or 60 pictures per second. 60 fps needs about 1.5 times the data.',
					tip: 'Use the frame rate you recorded with (usually 30). 15 is enough for pure slide shows; 24 gives a film look.'
				},
				audio: {
					title: 'Audio',
					text: 'Data rate of the sound, or “No audio”.',
					tip: '128 kbit/s is enough for speech, 192 (default) is safe for everything, 256 for music.'
				},
				estimate: {
					title: 'Estimated size',
					text: 'Calculated from the data rates and the duration. The real file is often smaller, especially with calm screen content.'
				},
				compatibility: {
					title: 'Compatibility',
					text: 'The result is an MP4 with H.264 video and AAC audio, which plays almost everywhere. If your browser cannot encode H.264 at that size, it uses VP9 or AV1 – those don’t play on every device. If even that fails, a hint asks for a smaller resolution.'
				},
				running: {
					title: 'During the export',
					text: 'Keep the tab open; the export runs in this tab. When it is done, you choose: “Download” saves the file through the browser, “Save in Files …” keeps the video in the browser storage (next to the project by default); pick an existing video and click “Replace” to overwrite it. After “Other settings”, “Back to result” returns to the finished video as long as the dialog is open. Hidden tracks are left out, muted tracks have no sound.'
				}
			}
		},
		shortcuts: {
			title: 'Keyboard shortcuts',
			items: {
				help: { title: 'Help', text: 'Open or close this window', keys: [['F1'], ['?']] },
				play: { title: 'Play / pause', text: 'Start or stop playback', keys: [['Space'], ['K']] },
				frame: { title: 'Step', text: 'One frame back or forward; with Shift one second', keys: [['←'], ['→'], ['Shift', '←'], ['Shift', '→']] },
				ends: { title: 'Start / end', text: 'Jump to the start or end', keys: [['Home'], ['End']] },
				split: { title: 'Split', text: 'At the playhead', keys: [['S']] },
				hold: { title: 'Hold frame', text: 'At the playhead', keys: [['F']] },
				delete: { title: 'Delete', text: 'With Shift a gap remains', keys: [['Del'], ['Shift', 'Del']] },
				undo: { title: 'Undo / redo', text: 'Last change', keys: [['Ctrl', 'Z'], ['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']] },
				all: { title: 'Select all', text: 'All elements', keys: [['Ctrl', 'A']] },
				deselect: { title: 'Deselect', text: 'Clear the selection', keys: [['Esc']] },
				link: { title: 'Link / unlink', text: 'Selected elements', keys: [['Ctrl', 'G'], ['Ctrl', 'Shift', 'G']] },
				track: { title: 'Track', text: 'Forward / backward; with Shift to the front / back', keys: [['Ctrl', '↑'], ['Ctrl', '↓']] },
				clipboard: { title: 'Copy / cut / paste', text: 'Selected elements; pasted at the playhead', keys: [['Ctrl', 'C'], ['Ctrl', 'X'], ['Ctrl', 'V']] },
				nudge: { title: 'Nudge', text: 'In the preview: 1 px, with Shift 10 px', keys: [['←'], ['↑'], ['→'], ['↓']] },
				cycle: { title: 'Next element', text: 'In the preview: front to back under the playhead; with Shift backwards', keys: [['Tab'], ['Shift', 'Tab']] },
				free: { title: 'Snapping', text: 'While dragging: the opposite of the “Snap” switch', keys: [['Alt']] },
				axis: { title: 'One direction', text: 'While moving in the preview', keys: [['Shift']] },
				zoom: { title: 'Timeline zoom', text: 'In the timeline', keys: [['Ctrl', 'Mouse wheel']] }
			}
		}
	} satisfies Record<string, HelpTopic>
};

export default help;
