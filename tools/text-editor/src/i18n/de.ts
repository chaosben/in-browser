import help from './help.de.js';
import type { Messages } from './index.js';

// German texts (same keys as en.ts).

const de: Messages = {
	common: {
		cancel: 'Abbrechen',
		untitled: 'Unbenannt'
	},

	brand: {
		description:
			'Text, Markdown, JSON, YAML, CSV und Code bearbeiten – mit Syntax-Hervorhebung, CSV als Tabelle, JSON, YAML und XML als Baum, beides bearbeitbar – kostenlos und komplett im Browser.'
	},

	home: {
		tagline:
			'Text, Markdown, JSON, YAML, CSV und Code – mit Syntax-Hervorhebung, Vorschau, Tabellen und Bäumen. Deine Dateien bleiben in deinem Browser.',
		noRecent: 'Dateien, die du öffnest, erscheinen hier.',
		dropHint: 'Oder zieh Textdateien von deinem Rechner hierher.'
	},

	actions: {
		new: 'Neu',
		open: 'Öffnen',
		openFromFiles: 'Aus Dateien öffnen …',
		openFromComputer: 'Vom Rechner öffnen …',
		save: 'Speichern',
		saveAs: 'Speichern unter …',
		download: 'Herunterladen',
		showInFiles: 'In Dateien zeigen',
		close: 'Schließen',
		removeRecent: 'Aus Liste entfernen'
	},

	edit: {
		undo: 'Rückgängig',
		redo: 'Wiederholen',
		find: 'Suchen',
		replace: 'Ersetzen',
		gotoLine: 'Gehe zu Zeile',
		cut: 'Ausschneiden',
		copy: 'Kopieren',
		paste: 'Einfügen',
		selectAll: 'Alles auswählen',
		toggleComment: 'Kommentar',
		toggleCommentTip: 'Kommentiert die Zeilen aus oder wieder ein (in Code)',
		indent: 'Einrücken',
		outdent: 'Ausrücken',
		lineUp: 'Zeile nach oben',
		lineDown: 'Zeile nach unten',
		clipboardFailed: 'Der Browser hat den Zugriff auf die Zwischenablage nicht erlaubt.'
	},

	format: {
		bold: 'Fett',
		italic: 'Kursiv',
		link: 'Link',
		heading: (level) => `Überschrift ${level}`,
		bulletList: 'Aufzählung',
		numberedList: 'Nummerierte Liste',
		taskList: 'Aufgabe',
		quote: 'Zitat',
		codeBlock: 'Code-Block',
		inlineCode: 'Code im Text',
		onlyMarkdown: 'Nur in Markdown-Dateien'
	},

	view: {
		wrap: 'Zeilenumbruch',
		textOnly: 'Nur Text',
		split: 'Nebeneinander',
		viewOnly: 'Nur Ansicht',
		viewType: 'Ansichtsart',
		fontLarger: 'Schrift größer',
		fontSmaller: 'Schrift kleiner',
		fontReset: 'Standard-Schriftgröße'
	},

	ribbon: {
		tabs: {
			home: 'Start',
			format: 'Format',
			view: 'Ansicht',
			table: 'Tabelle',
			tree: 'Baum'
		},
		groups: {
			new: 'Neu',
			file: 'Datei',
			clipboard: 'Zwischenablage',
			find: 'Suchen',
			edit: 'Bearbeiten',
			text: 'Text',
			paragraph: 'Absatz',
			lists: 'Listen',
			layout: 'Layout',
			cell: 'Zelle',
			rows: 'Zeilen',
			columns: 'Spalten',
			sortFilter: 'Sortieren & Filtern',
			options: 'Optionen',
			selection: 'Auswahl',
			insert: 'Einfügen',
			arrange: 'Anordnen',
			show: 'Anzeigen'
		}
	},

	editor: {
		openElsewhere: 'Diese Datei ist schon in einem anderen Tab oder Fenster geöffnet.',
		loadFailed: (error) => `Die Datei konnte nicht geöffnet werden: ${error}`,
		back: 'Zur Startseite'
	},

	dialogs: {
		open: 'Textdatei öffnen',
		saveAs: 'Speichern unter'
	},

	drop: {
		release: 'Loslassen zum Öffnen'
	},

	status: {
		position: (line, column) => `Zeile ${line}, Spalte ${column}`,
		selected: (chars) => `${chars} ausgewählt`,
		plainText: 'Nur Text',
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
		changed: (name) => `„${name}“ wurde woanders geändert (in einem anderen Tab oder durch das Synchronisieren). Speichern pausiert.`,
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
		onlyFirst: (name) => `Nur „${name}“ wurde geöffnet – eine Datei auf einmal.`,
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

	views: {
		markdown: 'Markdown-Vorschau',
		html: 'HTML-Vorschau',
		svg: 'Bild',
		table: 'Tabelle',
		tree: 'Baum',
		divider: 'Trennlinie zwischen Text und Ansicht',
		loadFailed: 'Die Ansicht konnte nicht geladen werden.',
		svgBroken: 'Das Bild lässt sich nicht anzeigen – prüfe den SVG-Text.',
		error: (line) => `Der Text hat einen Fehler in Zeile ${line}. Behebe ihn, um hier wieder zu bearbeiten.`,
		errorStale: (line) =>
			`Der Text hat einen Fehler in Zeile ${line}. Hier steht der letzte Stand ohne Fehler; behebe ihn, um hier wieder zu bearbeiten.`,
		showError: 'Im Text zeigen',
		apply: 'Übernehmen',
		selectAll: 'Alles auswählen',
		clearSelection: 'Auswahl aufheben'
	},

	table: {
		title: 'Tabelle',
		column: 'Spalte',
		rowTitle: (n) => `Zeile ${n}`,
		rowsTitle: (n) => `${n} Zeilen`,
		columnMenu: (name) => `Spalte „${name}“: sortieren, filtern, einfügen …`,
		rowMenu: (n) => `Zeile ${n}: einfügen, verschieben, löschen …`,
		cellLabel: (column, row) => `${column}, Zeile ${row}`,
		edit: 'Zelle bearbeiten',
		clearCells: 'Zellen leeren',
		sortUp: 'Aufsteigend sortieren',
		sortDown: 'Absteigend sortieren',
		filter: 'Filtern …',
		filterPlaceholder: 'enthält …',
		filterLabel: (column) => `Spalte „${column}“ filtern`,
		removeFilter: 'Filter entfernen',
		removeFilters: 'Alle Filter entfernen',
		rename: 'Spalte umbenennen',
		insertLeft: 'Spalte links einfügen',
		insertRight: 'Spalte rechts einfügen',
		moveLeft: 'Nach links verschieben',
		moveRight: 'Nach rechts verschieben',
		removeColumn: 'Spalte löschen',
		insertAbove: 'Zeile oberhalb einfügen',
		insertBelow: 'Zeile unterhalb einfügen',
		moveUp: 'Nach oben verschieben',
		moveDown: 'Nach unten verschieben',
		removeRows: 'Zeilen löschen',
		addRow: 'Zeile hinzufügen',
		newColumn: 'Spalte',
		header: 'Erste Zeile als Spaltennamen',
		delimiter: 'Trennzeichen',
		delimiterAuto: 'Automatisch erkennen',
		delimiters: { ',': 'Komma', ';': 'Semikolon', '\t': 'Tabulator', '|': 'Senkrechter Strich' },
		empty: 'Die Tabelle ist leer.',
		size: (rows, columns) => `${rows} ${rows === 1 ? 'Zeile' : 'Zeilen'} × ${columns} ${columns === 1 ? 'Spalte' : 'Spalten'}`,
		filtered: (shown, rows) => `${shown} von ${rows} Zeilen`
	},

	tree: {
		title: 'Baum',
		menu: 'Aktionen',
		expand: 'Öffnen',
		collapse: 'Schließen',
		edit: 'Wert bearbeiten',
		rename: 'Umbenennen',
		addEntry: 'Eintrag hinzufügen',
		addItem: 'Listeneintrag hinzufügen',
		addElement: 'Element hinzufügen',
		addAttribute: 'Attribut hinzufügen',
		addText: 'Text hinzufügen',
		addSection: 'Abschnitt hinzufügen',
		insert: 'Einfügen',
		newSection: 'abschnitt',
		insertBefore: 'Davor einfügen',
		insertAfter: 'Danach einfügen',
		duplicate: 'Duplizieren',
		moveUp: 'Nach oben verschieben',
		moveDown: 'Nach unten verschieben',
		type: 'Typ',
		types: { string: 'Text', number: 'Zahl', boolean: 'Ja/Nein (Boolean)', null: 'Leer (null)', object: 'Objekt', array: 'Liste' },
		remove: 'Löschen',
		newKey: 'schlüssel',
		newElement: 'element',
		newAttribute: 'name',
		newText: 'Text',
		keyLabel: 'Schlüssel',
		valueLabel: 'Wert',
		emptyValue: '(leer)',
		document: (n) => `Dokument ${n}`,
		entries: (n) => `{${n}}`,
		items: (n) => `[${n}]`,
		children: (n) => (n === 1 ? '1 Kind' : `${n} Kinder`),
		expandAll: 'Alle öffnen',
		collapseAll: 'Alle schließen',
		filter: 'Filtern …',
		filterPlaceholder: 'Schlüssel oder Wert enthält …',
		removeFilter: 'Filter entfernen',
		matches: (n) => (n === 1 ? '1 Zeile' : `${n} Zeilen`),
		noMatches: 'Nichts passt zum Filter.',
		empty: 'Noch leer.'
	},

	help
};

export default de;
