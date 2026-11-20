import help from './help.de.js';
import type { Messages } from './index.js';

const de: Messages = {
	common: {
		cancel: 'Abbrechen',
		delete: 'Löschen'
	},

	brand: {
		description: 'Handschriftliche Notizen mit Stift, Textmarker und Radierer – gemacht für Stift und Touch, kostenlos und komplett im Browser.'
	},

	home: {
		tagline: 'Schreib und skizziere von Hand – mit Stift, Finger oder Maus. Deine Notizbücher bleiben in deinem Browser.',
		newNotebook: 'Neues Notizbuch',
		open: 'Öffnen …',
		newTitle: 'Wohin soll das neue Notizbuch?',
		openTitle: 'Notizbuch öffnen',
		untitled: 'Notizbuch',
		notebooks: 'Notizbücher',
		empty: 'Noch keine Notizbücher. Leg eins an, um loszuschreiben.',
		pages: (n) => (n === 1 ? '1 Seite' : `${n} Seiten`),
		loadFailed: (error) => `Die Notizbücher konnten nicht aufgelistet werden: ${error}`,
		showInFiles: 'In Dateien zeigen',
		failed: (error) => `Das hat nicht geklappt: ${error}`,
		importPdf: 'PDF importieren'
	},

	editor: {
		loadFailed: (error) => `Das Notizbuch konnte nicht geöffnet werden: ${error}`,
		openElsewhere: 'Dieses Notizbuch ist schon in einem anderen Tab oder Fenster geöffnet.',
		unknownFormat: 'Das ist kein Notizbuch, das diese App lesen kann.',
		newerVersion: 'Das Notizbuch wurde mit einer neueren Version der App erstellt. Lade die Seite neu, um sie zu bekommen.',
		pageFailed: (error) => `Eine Seite konnte nicht geladen werden: ${error}`,
		changedElsewhere: 'Das Notizbuch wurde woanders geändert. Deine Änderungen hier bleiben erhalten.',
		undo: 'Rückgängig',
		redo: 'Wiederholen',
		pageOf: (n, total) => `Seite ${n} von ${total}`,
		zoom: (percent) => `${percent} %`,
		zoomMenu: 'Zoom',
		fitWidth: 'An Breite anpassen',
		actualSize: 'Originalgröße',
		zoomIn: 'Vergrößern',
		zoomOut: 'Verkleinern',
		penOnly: 'Nur der Stift zeichnet',
		penOnlyTip: 'Finger scrollen und zoomen nur, schon bei der ersten Berührung',
		penOnlyOn: 'Nur der Stift zeichnet – Finger verschieben die Seite',
		selectAll: 'Alles auswählen',
		selectAllTip: 'Alles auf der Seite, die du siehst',
		showInFiles: 'In Dateien zeigen',
		back: 'Alle Notizbücher'
	},

	ribbon: {
		tabs: { draw: 'Zeichnen', insert: 'Einfügen', pages: 'Seiten', view: 'Ansicht', drawing: 'Zeichnung', selection: 'Auswahl', arrange: 'Anordnen' },
		groups: {
			notebook: 'Notizbuch',
			tools: 'Werkzeuge',
			format: 'Format',
			options: 'Optionen',
			object: 'Objekt',
			pictures: 'Bilder',
			pages: 'Seiten',
			page: 'Seite',
			organize: 'Organisieren',
			zoom: 'Zoom'
		}
	},

	insert: {
		image: 'Bild',
		pdf: 'PDF',
		imageFromFiles: 'Bild aus Dateien …',
		imageFromDevice: 'Bild von diesem Gerät …',
		icon: 'Icon',
		pdfFromFiles: 'PDF aus Dateien …',
		pdfFromDevice: 'PDF von diesem Gerät …',
		choosePdf: 'PDF auswählen',
		pdfInserted: (n) => (n === 1 ? '1 Seite eingefügt' : `${n} Seiten eingefügt`),
		pdfPassword: (name) => `„${name}“ ist mit einem Passwort geschützt und kann nicht geöffnet werden.`,
		pdfError: (error) => `Das PDF konnte nicht geöffnet werden: ${error}`,
		pdfFailed: (name) => `„${name}“ konnte nicht gelesen werden – ist es ein PDF?`,
		chooseImage: 'Bild auswählen',
		iconHint: 'Das Icon bekommt die Stiftfarbe. Verschiebe und skaliere es mit dem Rahmen.',
		imageFailed: (name) => `„${name}“ konnte nicht eingefügt werden – ist es ein Bild?`
	},

	export: {
		title: 'Exportieren',
		menu: 'Exportieren …',
		format: 'Format',
		pdf: 'PDF – alle Seiten',
		png: 'PNG – diese Seite',
		pdfHint: 'Striche und importierte PDF-Seiten bleiben in jeder Größe scharf.',
		pngHint: (n) => `Seite ${n} als Bild.`,
		export: 'Exportieren',
		running: 'Wird exportiert …',
		done: (name, size) => `${name} (${size}) ist fertig.`,
		download: 'Herunterladen',
		saveToFiles: 'In Dateien speichern …',
		savedToFiles: (path) => `Als ${path} gespeichert`,
		open: 'Öffnen',
		pageFile: (name, n) => `${name} – Seite ${n}`,
		failed: (error) => `Exportieren fehlgeschlagen: ${error}`,
		close: 'Schließen'
	},

	page: {
		add: 'Seite hinzufügen',
		delete: 'Seite löschen',
		deleteTip: 'Löscht die Seite, die du siehst, mit allem darauf – die Meldung bietet an, das rückgängig zu machen',
		deleted: (n) => `Seite ${n} gelöscht`,
		moveUp: 'Seite nach oben',
		moveDown: 'Seite nach unten',
		paper: 'Papier',
		papers: { blank: 'Blanko', lined: 'Liniert', grid: 'Kariert', dotted: 'Gepunktet' },
		size: 'Seitengröße',
		sizes: { a4: 'A4', a5: 'A5', a3: 'A3', letter: 'US Letter' },
		landscape: 'Querformat'
	},

	perf: {
		frame: 'Frame',
		latency: 'Eingabe → Pixel',
		rate: 'Punkte/s',
		tiles: 'Kacheln'
	},

	help
};

export default de;
