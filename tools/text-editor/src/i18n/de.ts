import type { Messages } from './index.js';

// German texts (same keys as en.ts).

const de: Messages = {
	common: {
		cancel: 'Abbrechen',
		untitled: (n) => (n > 1 ? `Unbenannt ${n}` : 'Unbenannt')
	},

	brand: {
		partOf: 'Teil von',
		suiteClaim: 'Tools, die komplett in deinem Browser laufen',
		description:
			'Text, Markdown, JSON, YAML, CSV und Code bearbeiten – mit Tabs, Syntax-Hervorhebung und Markdown-Vorschau, kostenlos und komplett im Browser.'
	},

	home: {
		tagline: 'Text, Markdown, JSON, YAML und Code – mit Tabs, Syntax-Hervorhebung und Vorschau. Deine Dateien bleiben in deinem Browser.',
		unsupported: 'Dieser Browser hat kein Dateisystem für Webseiten (OPFS). Bitte nutze einen aktuellen Browser.',
		recent: 'Zuletzt geöffnet',
		noRecent: 'Dateien, die du öffnest, erscheinen hier.',
		inFolder: (folder) => `in ${folder}`,
		dropHint: 'Oder zieh Textdateien von deinem Rechner hierher.'
	},

	actions: {
		new: 'Neu',
		open: 'Öffnen',
		openFromFiles: 'Aus Files öffnen …',
		openFromComputer: 'Vom Rechner öffnen …',
		save: 'Speichern',
		saveTo: 'Speichern …',
		saveAs: 'Speichern unter …',
		rename: 'Umbenennen',
		download: 'Herunterladen',
		showInFiles: 'In Files zeigen',
		close: 'Schließen',
		closeOthers: 'Andere schließen'
	},

	edit: {
		undo: 'Rückgängig',
		redo: 'Wiederholen',
		search: 'Suchen',
		find: 'Suchen',
		replace: 'Ersetzen',
		gotoLine: 'Gehe zu Zeile'
	},

	format: {
		title: 'Formatierung',
		bold: 'Fett',
		italic: 'Kursiv',
		link: 'Link',
		paragraph: 'Absatz',
		heading: (level) => `Überschrift ${level}`,
		bulletList: 'Aufzählung',
		numberedList: 'Nummerierte Liste',
		taskList: 'Aufgabe',
		quote: 'Zitat',
		codeBlock: 'Code-Block',
		inlineCode: 'Code im Text'
	},

	view: {
		title: 'Ansicht',
		wrap: 'Zeilenumbruch',
		preview: 'Markdown-Vorschau',
		fontLarger: 'Schrift größer',
		fontSmaller: 'Schrift kleiner',
		fontReset: 'Standard-Schriftgröße'
	},

	dialogs: {
		open: 'Textdateien öffnen',
		saveAs: 'Speichern unter'
	},

	drop: {
		release: 'Loslassen zum Öffnen'
	},

	status: {
		position: (line, column) => `Zeile ${line}, Spalte ${column}`,
		selected: (chars) => `${chars} ausgewählt`,
		plainText: 'Nur Text',
		saving: 'Speichern …',
		saved: 'Gespeichert',
		notSaved: 'Noch nicht gespeichert',
		deleted: 'Gelöscht',
		lineEnding: 'Zeilenende',
		encoding: 'Kodierung'
	},

	encoding: {
		withBom: (name) => `${name} mit BOM`,
		reopen: 'Mit Kodierung neu öffnen',
		saveWith: 'Mit Kodierung speichern'
	},

	conflict: {
		changed: (name) => `„${name}“ wurde woanders geändert (in einem anderen Tab oder durch den Abgleich). Speichern pausiert.`,
		deleted: (name) => `„${name}“ wurde gelöscht oder verschoben. Speichern legt die Datei wieder an.`,
		reload: 'Neu laden',
		keepMine: 'Meine Version behalten'
	},

	problem: {
		unmappable: (count, encoding) =>
			`${count === 1 ? 'Ein Zeichen lässt' : `${count} Zeichen lassen`} sich in ${encoding} nicht speichern. Speichern pausiert.`,
		asUtf8: 'Als UTF-8 speichern'
	},

	questions: {
		discard: {
			title: 'Änderungen verwerfen?',
			message: (name) => `„${name}“ hat Änderungen, die nicht gespeichert sind. Sie gehen verloren.`,
			confirm: 'Verwerfen'
		},
		overwrite: {
			title: 'Neuere Version ersetzen?',
			message: (name) => `„${name}“ wurde woanders geändert, seit du die Datei geöffnet hast. Speichern ersetzt diese Version.`,
			confirm: 'Ersetzen'
		},
		unmappable: {
			title: 'Manche Zeichen lassen sich nicht speichern',
			message: (count, encoding) =>
				`${count === 1 ? 'Ein Zeichen lässt' : `${count} Zeichen lassen`} sich in ${encoding} nicht darstellen und würden zu „?“. Stattdessen als UTF-8 speichern?`,
			confirm: 'Als UTF-8 speichern'
		}
	},

	toasts: {
		saved: (name) => `„${name}“ gespeichert.`,
		reloaded: (name) => `„${name}“ wurde woanders geändert und neu geladen.`,
		binary: (name) => `„${name}“ ist keine Textdatei.`,
		tooLarge: (name, max) => `„${name}“ ist zu groß für den Editor (mehr als ${max}).`,
		notFound: (name) => `„${name}“ gibt es nicht mehr.`,
		foldersSkipped: (count) => (count === 1 ? 'Ein Ordner wurde übersprungen.' : `${count} Ordner wurden übersprungen.`),
		failed: (error) => `Das hat nicht geklappt: ${error}`
	},

	phrases: {
		Find: 'Suchen',
		Replace: 'Ersetzen',
		next: 'Weiter',
		previous: 'Zurück',
		all: 'Alle',
		'match case': 'Groß-/Kleinschreibung',
		regexp: 'Regulärer Ausdruck',
		'by word': 'Ganzes Wort',
		replace: 'Ersetzen',
		'replace all': 'Alle ersetzen',
		close: 'Schließen',
		'current match': 'Aktueller Treffer',
		'on line': 'in Zeile',
		'replaced $ matches': '$ Treffer ersetzt',
		'replaced match on line $': 'Treffer in Zeile $ ersetzt',
		'Go to line': 'Gehe zu Zeile',
		go: 'Los',
		'Selection deleted': 'Auswahl gelöscht',
		'Control character': 'Steuerzeichen',
		'folded code': 'Eingeklappter Text',
		unfold: 'Ausklappen'
	},

	preview: {
		title: 'Markdown-Vorschau'
	}
};

export default de;
