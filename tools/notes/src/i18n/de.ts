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
		unsupported: 'Dieser Browser hat kein Dateisystem für Websites (OPFS). Nutze bitte einen aktuellen Browser.',
		newNotebook: 'Neues Notizbuch',
		open: 'Öffnen …',
		openNotebook: 'Öffnen',
		newTitle: 'Wohin soll das neue Notizbuch?',
		openTitle: 'Notizbuch öffnen',
		untitled: 'Notizbuch',
		notebooks: 'Notizbücher',
		empty: 'Noch keine Notizbücher. Leg eins an, um loszuschreiben.',
		pages: (n) => (n === 1 ? '1 Seite' : `${n} Seiten`),
		loadFailed: (error) => `Die Notizbücher konnten nicht aufgelistet werden: ${error}`,
		actions: (name) => `Aktionen für ${name}`,
		deleteQuestion: {
			title: 'Notizbuch löschen?',
			message: (name) => `„${name}“ wird mit allen Seiten gelöscht.`,
			confirm: 'Löschen'
		},
		failed: (error) => `Das hat nicht geklappt: ${error}`,
		importPdf: 'PDF importieren',
		importing: 'PDF wird gelesen …'
	},

	editor: {
		loadFailed: (error) => `Das Notizbuch konnte nicht geöffnet werden: ${error}`,
		openElsewhere: 'Dieses Notizbuch ist schon in einem anderen Tab oder Fenster geöffnet.',
		unknownFormat: 'Das ist kein Notizbuch, das diese App lesen kann.',
		newerVersion: 'Das Notizbuch wurde mit einer neueren Version der App erstellt. Lade die Seite neu, um sie zu bekommen.',
		pageFailed: (error) => `Eine Seite konnte nicht geladen werden: ${error}`,
		saveFailed: (error) => `Speichern fehlgeschlagen: ${error}`,
		changedElsewhere: 'Das Notizbuch wurde woanders geändert. Deine Änderungen hier bleiben erhalten.',
		saving: 'Speichert …',
		saved: 'Gespeichert',
		notSaved: 'Noch nicht gespeichert',
		rename: 'Umbenennen',
		renameFailed: (error) => `Umbenennen fehlgeschlagen: ${error}`,
		undo: 'Rückgängig',
		redo: 'Wiederholen',
		pageOf: (n, total) => `Seite ${n} von ${total}`,
		zoom: (percent) => `${percent} %`,
		zoomMenu: 'Zoom',
		fitWidth: 'An Breite anpassen',
		actualSize: '100 %',
		zoomIn: 'Vergrößern',
		zoomOut: 'Verkleinern',
		penOnly: 'Nur der Stift zeichnet',
		penOnlyOn: 'Nur der Stift zeichnet – Finger verschieben die Seite',
		back: 'Alle Notizbücher'
	},

	tools: {
		label: 'Werkzeuge',
		pen: 'Stift',
		highlighter: 'Textmarker',
		shape: 'Formen',
		eraser: 'Radierer',
		lasso: 'Lasso',
		laser: 'Laserpointer',
		eraserMode: 'Radiert',
		eraserModes: { stroke: 'Ganze Striche', pixel: 'Pixel' },
		color: 'Farbe',
		size: 'Stärke',
		sizeValue: (n) => `Stärke ${n}`,
		options: 'Farbe, Stärke und Glättung',
		smoothing: 'Glättung',
		smoothingLevels: ['Aus', 'Leicht', 'Mittel', 'Stark'],
		smoothingHint: 'Glattere Linien, die dem Stift mit kleiner Verzögerung folgen',
		shapes: {
			line: 'Linie',
			arrow: 'Pfeil',
			doubleArrow: 'Doppelpfeil',
			rect: 'Rechteck',
			roundedRect: 'Abgerundetes Rechteck',
			ellipse: 'Ellipse',
			triangle: 'Dreieck',
			diamond: 'Raute',
			parallelogram: 'Parallelogramm',
			pentagon: 'Fünfeck',
			hexagon: 'Sechseck',
			star: 'Stern'
		},
		shapeHint: 'Zieh die Form auf der Seite auf. Fast quadratische Formen werden zu Quadrat oder Kreis, Linien rasten in 15°-Schritten ein.'
	},

	selection: {
		label: (n) => (n === 1 ? '1 Element ausgewählt' : `${n} Elemente ausgewählt`),
		color: 'Farbe',
		duplicate: 'Duplizieren',
		delete: 'Löschen'
	},

	insert: {
		menu: 'Einfügen',
		imageFromFiles: 'Bild aus Files …',
		imageFromDevice: 'Bild von diesem Gerät …',
		icon: 'Icon …',
		pdfFromFiles: 'PDF aus Files …',
		pdfFromDevice: 'PDF von diesem Gerät …',
		choosePdf: 'PDF auswählen',
		pdfInserted: (n) => (n === 1 ? '1 Seite eingefügt' : `${n} Seiten eingefügt`),
		pdfPassword: (name) => `„${name}“ ist mit einem Passwort geschützt und kann nicht geöffnet werden.`,
		pdfError: (error) => `Das PDF konnte nicht geöffnet werden: ${error}`,
		pdfFailed: (name) => `„${name}“ konnte nicht gelesen werden – ist es ein PDF?`,
		chooseImage: 'Bild auswählen',
		iconsTitle: 'Icon einfügen',
		iconHint: 'Das Icon bekommt die Stiftfarbe. Verschiebe und skaliere es mit dem Rahmen.',
		close: 'Schließen',
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
		saveToFiles: 'In Files speichern …',
		savedToFiles: (path) => `Als ${path} gespeichert`,
		pageFile: (name, n) => `${name} – Seite ${n}`,
		failed: (error) => `Exportieren fehlgeschlagen: ${error}`,
		close: 'Schließen'
	},

	page: {
		menu: 'Seite',
		add: 'Seite hinzufügen',
		delete: 'Seite löschen',
		moveUp: 'Seite nach oben',
		moveDown: 'Seite nach unten',
		paper: 'Papier',
		papers: { blank: 'Blanko', lined: 'Liniert', grid: 'Kariert', dotted: 'Gepunktet' },
		size: 'Seitengröße',
		sizes: { a4: 'A4', a5: 'A5', a3: 'A3', letter: 'US Letter' },
		landscape: 'Querformat',
		deleteQuestion: {
			title: 'Seite löschen?',
			message: (n) => `Seite ${n} wird mit allem darauf gelöscht. Du kannst das rückgängig machen.`,
			confirm: 'Löschen'
		}
	},

	perf: {
		frame: 'Frame',
		latency: 'Eingabe → Pixel',
		rate: 'Punkte/s',
		tiles: 'Kacheln'
	}
};

export default de;
