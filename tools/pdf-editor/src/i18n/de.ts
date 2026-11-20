import help from './help.de.js';
import type { Messages } from './index.js';

const de: Messages = {
	common: {
		cancel: 'Abbrechen',
		close: 'Schließen'
	},

	brand: {
		description: 'PDFs ansehen, kommentieren und ausfüllen, Seiten ordnen und zusammenführen – kostenlos und komplett im Browser.'
	},

	home: {
		tagline: 'Kommentiere, fülle aus und ordne PDFs. Deine Dateien bleiben in deinem Browser.',
		open: 'PDF öffnen …',
		openTitle: 'PDF öffnen',
		fromDevice: 'Vom Rechner öffnen …',
		saveTitle: 'Wo soll die PDF liegen?',
		empty: 'Noch keine PDF geöffnet. Öffne eine aus deinen Dateien oder vom Rechner.',
		remove: 'Aus der Liste entfernen',
		failed: (error) => `Das hat nicht geklappt: ${error}`
	},

	editor: {
		loadFailed: (error) => `Die PDF konnte nicht geöffnet werden: ${error}`,
		password: 'Diese PDF ist mit einem Passwort geschützt.',
		invalid: 'Diese Datei ist keine lesbare PDF.',
		openElsewhere: 'Diese PDF ist schon in einem anderen Tab oder Fenster geöffnet.',
		missing: 'Diese PDF gibt es nicht mehr.',
		back: 'Alle PDFs',
		page: (n, total) => `Seite ${n} von ${total}`,
		pageField: 'Seitenzahl',
		zoom: (percent) => `${percent} %`,
		download: 'Herunterladen',
		showInFiles: 'In Dateien zeigen'
	},

	notice: {
		encrypted: 'Diese PDF ist auf eine Weise geschützt, die sich hier nicht ändern lässt: Du kannst sie lesen, aber Änderungen lassen sich nicht speichern.',
		failed: 'Diese PDF lässt sich lesen, aber ihr Aufbau ist zu beschädigt, um Änderungen zu speichern.',
		signed: 'Diese PDF ist signiert. Deine Änderungen kommen nach den Signaturen dazu: Diese belegen weiter die signierte Version.',
		checking: 'Die PDF wird für Änderungen vorbereitet …'
	},

	conflict: {
		changed: (name: string) => `„${name}“ wurde woanders geändert (in einem anderen Tab oder durch das Synchronisieren). Speichern pausiert.`,
		deleted: (name: string) => `„${name}“ wurde gelöscht oder verschoben. Speichern legt die Datei wieder an.`,
		reload: 'Neu laden',
		keepMine: 'Meine Version behalten',
		reloaded: (name: string) => `„${name}“ wurde woanders geändert und neu geladen.`
	},

	questions: {
		signedPages: {
			title: 'Seiten einer signierten PDF ändern?',
			message: 'Die Signaturen bleiben für die signierte Version gültig, aber Programme melden womöglich, dass sich Seiten nach dem Signieren geändert haben.',
			confirm: 'Seiten ändern'
		}
	},

	ribbon: {
		tabs: {
			home: 'Start',
			comment: 'Kommentieren',
			pages: 'Seiten',
			form: 'Formular',
			view: 'Ansicht',
			textbox: 'Textfeld',
			note: 'Notiz',
			markup: 'Markierung',
			drawing: 'Zeichnung',
			selection: 'Auswahl',
			arrange: 'Anordnen'
		},
		groups: {
			pdf: 'PDF',
			tools: 'Werkzeuge',
			zoom: 'Zoom',
			panels: 'Seitenleisten',
			rotate: 'Drehen',
			select: 'Auswahl',
			markup: 'Text',
			notes: 'Kommentar',
			draw: 'Zeichnen',
			format: 'Format',
			find: 'Suchen',
			text: 'Text',
			box: 'Feld',
			object: 'Objekt',
			sizing: 'Größe',
			organize: 'Organisieren',
			insert: 'Einfügen',
			newFile: 'Neue PDF',
			fields: 'Felder'
		}
	},


	comments: {
		find: 'In Kommentaren suchen',
		kind: 'Zeigen',
		all: 'Alle Kommentare',
		notes: 'Notizen',
		texts: 'Textfelder',
		marks: 'Markierter Text',
		drawings: 'Zeichnungen',
		none: 'Noch keine Kommentare. Markiere Text, setze eine Notiz oder zeichne – sie erscheinen hier.',
		noneFound: 'Kein Kommentar passt.',
		page: (n) => `Seite ${n}`,
		unknownAuthor: 'Unbekannt',
		reply: 'Antworten',
		send: 'Senden',
		cancel: 'Abbrechen',
		replyPlaceholder: 'Antwort schreiben',
		replies: (n) => (n === 1 ? '1 Antwort' : `${n} Antworten`),
		deleteReply: 'Antwort löschen',
		replyActions: 'Aktionen für die Antwort',
		readOnly: 'Dieses PDF lässt sich nicht ändern, Antworten sind daher nicht möglich.',
		subject: 'Betreff',
		renameSubject: 'Klicken, um den Betreff zu ändern',
		status: 'Status',
		statusBy: (state, author, when) => `${state}${author ? ` – ${author}` : ''}${when ? `, ${when}` : ''}`,
		states: { None: 'Keiner', Accepted: 'Angenommen', Rejected: 'Abgelehnt', Cancelled: 'Abgebrochen', Completed: 'Erledigt' }
	},

	textbox: {
		label: 'Text des Textfelds',
		edit: 'Text bearbeiten',
		size: 'Größe',
		fontSize: 'Schriftgröße',
		textColor: 'Textfarbe',
		sizeValue: (pt: number) => `${pt} pt`,
		style: 'Hintergrund und Rahmen',
		fill: 'Hintergrund',
		border: 'Rahmen',
		borderWidth: 'Stärke',
		borderWidthValue: (pt: number) => `${String(pt).replace('.', ',')} pt`,
		none: 'Keiner',
		autoWidth: 'Automatische Breite',
		autoWidthTip: 'So breit wie die längste Zeile; neue Zeilen nur, wo du Enter drückst',
		autoHeight: 'Automatische Höhe',
		autoHeightTip: 'Behält seine Breite; die Zeilen brechen um und das Feld wächst mit dem Text',
		fixedSize: 'Feste Größe',
		fixedSizeTip: 'Behält Breite und Höhe; Text, der nicht hineinpasst, ragt unten heraus'
	},

	note: {
		label: 'Kommentar der Notiz',
		placeholder: 'Schreib einen Kommentar …',
		edit: 'Kommentar bearbeiten',
		icon: 'Symbol',
		icons: { Comment: 'Kommentar', Note: 'Notiz', Key: 'Schlüssel', Help: 'Hilfe', NewParagraph: 'Neuer Absatz', Paragraph: 'Absatz', Insert: 'Einfügen' }
	},

	commands: {
		undo: 'Rückgängig',
		redo: 'Wiederholen',
		hand: 'Hand',
		handTip: 'Ziehen, um die Seiten zu verschieben',
		selectText: 'Text auswählen',
		selectTextTip: 'Text auswählen und kopieren, markieren',
		zoomIn: 'Vergrößern',
		zoomOut: 'Verkleinern',
		fitWidth: 'Seitenbreite',
		fitPage: 'Ganze Seite',
		actualSize: 'Originalgröße',
		firstPage: 'Erste Seite',
		previousPage: 'Vorherige Seite',
		nextPage: 'Nächste Seite',
		lastPage: 'Letzte Seite',
		find: 'Suchen',
		markTip: 'Markiert den Text, über den du ziehst',
		highlight: 'Hervorheben',
		underline: 'Unterstreichen',
		strikeout: 'Durchstreichen',
		note: 'Notiz',
		noteTip: 'Setzt einen Notizzettel mit Kommentar dorthin, wo du klickst',
		textbox: 'Textfeld',
		textboxTip: 'Klick oder zieh, um Text auf die Seite zu schreiben',
		rotateLeft: 'Nach links drehen',
		rotateRight: 'Nach rechts drehen',
		rotateTip: 'Dreht die gewählten Seiten (im Panel „Seiten“), sonst die aktuelle Seite, um eine Vierteldrehung',
		deletePages: 'Seiten löschen',
		deletePagesTip: 'Löscht die gewählten Seiten, sonst die aktuelle Seite, mit allem, was darauf gezeichnet ist',
		moveUp: 'Nach vorne',
		moveDown: 'Nach hinten',
		moveFirst: 'An den Anfang',
		moveLast: 'Ans Ende',
		moveTip: 'Verschiebt die gewählten Seiten, sonst die aktuelle Seite',
		insertBlank: 'Leere Seite',
		insertBlankTip: 'Fügt nach der aktuellen Seite eine leere Seite ein, so groß wie sie',
		pageActions: (label) => `Aktionen für Seite ${label}`,
		selectAll: 'Alles auswählen',
		selectAllTip: 'Wählt alles aus, was auf der aktuellen Seite gezeichnet oder geschrieben ist (im Bereich „Seiten“: alle Seiten)',
		picked: (n) => (n === 0 ? 'Keine Seiten gewählt' : n === 1 ? '1 Seite gewählt' : `${n} Seiten gewählt`),
		clearPick: 'Auswahl aufheben',
		pickAll: 'Alle auswählen',
		insertPdf: 'Aus PDF …',
		insertPdfTip: 'Fügt alle Seiten einer anderen PDF nach der aktuellen Seite ein',
		insertPdfTitle: 'Seiten aus PDF einfügen',
		insertImage: 'Bild …',
		insertImageTip: 'Fügt ein Bild als eigene Seite nach der aktuellen Seite ein',
		insertImageTitle: 'Bild als Seite einfügen',
		extract: 'Extrahieren …',
		extractTip: 'Speichert die gewählten Seiten, sonst die aktuelle Seite, als neue PDF',
		extractTitle: 'Seiten als PDF speichern',
		extractName: (stem) => `${stem} (Seiten).pdf`,
		merge: 'Zusammenführen …',
		mergeTip: 'Speichert diese PDF und dahinter andere PDFs als neue PDF',
		mergeTitle: 'PDFs zum Anhängen wählen',
		mergeSaveTitle: 'Zusammengeführte PDF speichern',
		mergeName: (stem) => `${stem} (zusammengeführt).pdf`,
		saved: (name) => `Gespeichert als „${name}“.`,
		openNew: 'Öffnen',
		failed: (error) => `Das hat nicht geklappt: ${error}`,
		protected: 'Diese PDF ist mit einem Passwort geschützt; ihre Seiten lassen sich nicht kopieren.',
		highlightFields: 'Felder hervorheben',
		highlightFieldsTip: 'Tönt die auszufüllenden Felder und rahmt die Pflichtfelder ein',
		clearForm: 'Formular leeren',
		clearFormTip: 'Leert alle ausfüllbaren Felder (ein Schritt zum Rückgängigmachen)'
	},

	panels: {
		pages: 'Seiten',
		outline: 'Lesezeichen',
		search: 'Suche',
		attachments: 'Anhänge',
		layers: 'Ebenen',
		noOutline: 'Diese PDF hat keine Lesezeichen.',
		noAttachments: 'Diese PDF hat keine Anhänge.',
		noLayers: 'Diese PDF hat keine Ebenen.',
		searchPlaceholder: 'In der PDF suchen',
		searching: 'Suche läuft …',
		results: (n) => (n === 1 ? '1 Treffer' : `${n} Treffer`),
		noResults: 'Nichts gefunden.',
		matchCase: 'Groß-/Kleinschreibung beachten',
		previous: 'Vorheriger Treffer',
		next: 'Nächster Treffer',
		pageLabel: (label) => `Seite ${label}`,
		comments: 'Kommentare',
		fields: 'Felder',
		noFields: 'Diese PDF hat keine Formularfelder.',
		fieldsFilled: (filled, total) => `${filled} von ${total} Pflichtfeldern ausgefüllt`,
		required: 'Pflichtfeld',
		empty: 'Leer',
		checked: 'Angekreuzt',
		unchecked: 'Nicht angekreuzt',
		readOnlyField: 'Lässt sich nicht ändern',
		onlyRequired: 'Nur Pflichtfelder',
		download: (name) => `${name} herunterladen`,
		saveInFiles: (name) => `${name} in Dateien speichern`
	},

	help
};

export default de;
