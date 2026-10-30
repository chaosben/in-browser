import type { Messages } from './index.js';

const de: Messages = {
	common: {
		cancel: 'Abbrechen',
		close: 'Schließen',
		open: 'Öffnen',
		delete: 'Löschen',
		rename: 'Umbenennen',
		download: 'Herunterladen'
	},

	brand: {
		partOf: 'Teil von',
		suiteClaim: 'Tools, die komplett im Browser laufen',
		description:
			'Verwalte die Dateien deiner in-browser-Tools im Browserspeicher und gleiche sie mit einem Ordner auf deinem Rechner ab.'
	},

	toolbar: {
		up: 'Einen Ordner nach oben',
		newFolder: 'Neuer Ordner',
		newTextFile: 'Neue Textdatei',
		upload: 'Hochladen',
		uploadFiles: 'Dateien hochladen',
		uploadFolder: 'Ordner hochladen',
		search: 'In diesem Ordner suchen',
		list: 'Liste',
		grid: 'Kacheln',
		refresh: 'Aktualisieren'
	},

	columns: {
		name: 'Name',
		kind: 'Art',
		size: 'Größe',
		modified: 'Geändert'
	},

	menu: {
		open: 'Öffnen',
		openWith: (tool) => `Mit ${tool} öffnen`,
		preview: 'Vorschau',
		download: 'Herunterladen',
		downloadZip: 'Als ZIP herunterladen',
		rename: 'Umbenennen',
		duplicate: 'Duplizieren',
		copy: 'Kopieren',
		cut: 'Ausschneiden',
		paste: 'Einfügen',
		delete: 'Löschen',
		properties: 'Eigenschaften',
		selectAll: 'Alles auswählen'
	},

	list: {
		loading: 'Wird geladen …',
		unsupported: 'Deinem Browser fehlt der Speicher, den Files braucht (Origin Private File System). Nutze einen aktuellen Browser.',
		empty: 'Dieser Ordner ist leer. Leg Dateien hier ab oder nutze „Hochladen“.',
		noMatch: 'Nichts passt zu deiner Suche.',
		items: (n) => (n === 1 ? '1 Element' : `${n} Elemente`),
		selected: (n) => `${n} ausgewählt`,
		newFolderName: 'Neuer Ordner',
		newTextFileName: 'Neue Textdatei.txt',
		dropHere: (folder) => `Loslassen, um nach „${folder}“ hochzuladen`,
		hint: 'Doppelklick öffnet, Rechtsklick zeigt alle Aktionen. Zieh Elemente auf einen Ordner, um sie zu verschieben; mit Strg kopierst du sie.'
	},

	confirm: {
		deleteTitle: 'Endgültig löschen?',
		deleteOne: (name) => `„${name}“ wird mit allem, was darin liegt, gelöscht. Das lässt sich nicht rückgängig machen.`,
		deleteMany: (n) => `${n} Elemente werden mit allem, was darin liegt, gelöscht. Das lässt sich nicht rückgängig machen.`
	},

	properties: {
		title: 'Eigenschaften',
		kind: 'Art',
		location: 'Ort',
		size: 'Größe',
		modified: 'Geändert',
		contents: 'Inhalt',
		counts: (files, folders) =>
			`${files === 1 ? '1 Datei' : `${files} Dateien`}, ${folders === 1 ? '1 Ordner' : `${folders} Ordner`}`,
		calculating: 'Wird berechnet …'
	},

	preview: {
		none: 'Für diese Datei gibt es keine Vorschau.',
		tooLarge: 'Die Datei ist zu groß für eine Textvorschau.'
	},

	toasts: {
		uploaded: (n) => (n === 1 ? '1 Datei hochgeladen' : `${n} Dateien hochgeladen`),
		uploading: (name) => `${name} wird hochgeladen …`,
		pasted: (n) => (n === 1 ? '1 Element eingefügt' : `${n} Elemente eingefügt`),
		zipping: 'Die ZIP-Datei wird vorbereitet …'
	},

	storage: {
		used: (used, quota) => `${used} von ${quota} belegt`
	},

	sync: {
		title: 'Ordner auf deinem Rechner',
		intro:
			'Gleiche diese Dateien mit einem echten Ordner ab, z. B. einem, den dein Sync-Tool (Syncthing, Nextcloud, Dropbox …) auf deine anderen Rechner bringt. Die neuere Fassung gewinnt.',
		unsupported: 'Dein Browser kann nicht auf Ordner deines Rechners zugreifen. Nutze dafür Chrome oder Edge.',
		connect: 'Ordner wählen',
		connected: (folder) => `Abgeglichen mit „${folder}“`,
		paused: (folder) => `Pausiert: Der Browser braucht wieder deine Erlaubnis für „${folder}“.`,
		renew: 'Zugriff erlauben',
		renewHint: 'Tipp: Wähle „Bei jedem Besuch zulassen“, dann läuft der Abgleich von selbst weiter.',
		syncing: 'Wird abgeglichen …',
		syncNow: 'Jetzt abgleichen',
		disconnect: 'Trennen',
		disconnectTitle: 'Ordner trennen?',
		disconnectMessage: (folder) =>
			`Es wird nichts gelöscht – weder hier noch in „${folder}“. Der Abgleich hört nur auf; du kannst jederzeit wieder einen Ordner verbinden.`,
		lastSync: (time) => `Zuletzt abgeglichen ${time}`,
		failed: (n) => (n === 1 ? '1 Datei ließ sich nicht abgleichen.' : `${n} Dateien ließen sich nicht abgleichen.`),
		confirmDeletes: (n) => `Im Ordner auf deinem Rechner wurden ${n} Dateien gelöscht. Sollen sie auch hier gelöscht werden?`,
		applyDeletes: 'Auch hier löschen',
		restoreInstead: 'Stattdessen wiederherstellen',
		runsWhileOpen: 'Der Abgleich läuft, solange ein Tool von in-browser in diesem Browser offen ist.'
	}
};

export default de;
