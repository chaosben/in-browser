// Help texts of the tool Fonts (English leads; `help.de.ts` must have the same keys): the help window of the tool and
// the page `/help/fonts`. Describe what users see and do.

import type { HelpContent } from '@in-browser/brand/help.js';

const help = {
	start: {
		title: 'Your fonts',
		items: {
			what: {
				title: 'What “Fonts” is for',
				text: 'Fonts you add here are “My fonts” in every tool that formats text – the PDF Editor’s text boxes and Screen Capture’s text and speech bubbles: the menu “Font” lists them below the fonts the tool brings, and “Manage fonts …” at its end opens this tool in a new tab. The start page shows your fonts as cards, each written in itself; a click opens a font with its files. They are kept as files in a hidden folder of your files, so they reach your other devices like your files do (see the help on syncing); a font missing on a device is named in the menu with “(not on this device)” and the text shows in a stand-in until it arrives.',
				link: { href: '/help/sync', label: 'Sync between devices' }
			},
			add: {
				title: 'Adding fonts',
				text: '“Add from Files …” (tab “Home”) takes font files of your files, “Import from the computer …” files of your computer; you can also drag font files onto the page, or open a font file in Files (“Open with Fonts”) and choose “Add to my fonts”. TrueType (.ttf) and OpenType (.otf) files work. Files of the same family – by the name in the file – make one font with up to four faces: regular, bold, italic and bold italic (of several weights the ones nearest to normal and bold). A face the font lacks is drawn in its regular one, here and in documents alike.',
				tip: 'Add all four files of a family (regular, bold, italic, bold italic): then bold and italic in your texts look as the designer drew them.'
			},
			family: {
				title: 'A font and its files',
				text: 'The page of a font shows each face in a sample, and every file with its style, weight, number of characters, version, designer, copyright and license as the file gives them. “Says about itself” shows the file’s own flag about being embedded in documents. in-browser shows it, but never stops you – whether you may use a font is between you and its license.'
			},
			organize: {
				title: 'Selecting and deleting',
				text: 'A click opens a font; Ctrl+click or Shift+click select several, Ctrl+A all of them. “Delete” moves the files of the selected fonts into the trash – “Undo” in the message brings them back. On a touch screen a long press opens a font’s menu and starts selecting; each card has a ⋯ button too. The field in the group “Preview” changes the sample text of the cards, the size field its size; both are kept on this device.',
				keys: [['Ctrl', 'A'], ['Del']]
			}
		}
	},
	catalog: {
		title: 'The catalog',
		items: {
			search: {
				title: 'Searching and installing',
				text: '“Search online” opens the catalog of free fonts (Fontsource – the fonts of Google Fonts and more). Nothing is asked until you search or pick a kind of font: type a name and press “Search”, or choose a kind in the row of buttons above the list – “All”, “Sans-serif”, “Serif”, “Display”, “Handwriting”, “Monospace”, “Other”; a kind without a name lists all of its fonts, a name searches within the kind. The kind you chose is remembered. Up to 150 results are shown; type more of the name to narrow them down. On a wide screen the list and the preview scroll on their own; on a phone the chosen font stays above the list. A click on a result shows it in a preview; pick the characters it should hold and press “Install” – its regular, bold, italic and bold italic files (as far as the font has them) are added to your fonts, and work offline from then on.',
				options: {
					subset: { label: '“Characters”', text: 'The catalog splits a font into sets of characters. “latin” holds the letters of Western European languages (German, French, Spanish …), “latin-ext” those of the rest of Europe (Polish, Czech, Turkish …); other sets for Greek, Cyrillic and more where the font has them.' }
				},
				tip: 'For German or English text “latin” is enough; for a text with Polish or Czech names take “latin-ext”, which holds the letters of “latin” too where the font has them.'
			},
			privacy: {
				title: 'What the catalog sees',
				text: 'Searching (also picking a kind of font) asks Fontsource (api.fontsource.org) for the list of fonts, installing loads the files from jsDelivr. Both see your IP address, the search and the font you install – nothing of your files. Only this page of the tool reaches them; no other page of in-browser does.'
			}
		}
	}
} satisfies HelpContent;

export default help;
