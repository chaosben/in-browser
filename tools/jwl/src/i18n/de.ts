import type { Messages } from './index.js';
import help from './help.de.js';

const de: Messages = {
	common: {
		cancel: 'Abbrechen',
		close: 'Schließen',
		done: 'Fertig'
	},

	brand: {
		description: 'Sicherungen und Playlists von JW Library in deinem Browser: hineinschauen, aufräumen, die Sicherungen deiner Geräte zusammenführen, Playlists bearbeiten – hochgeladen wird nichts.'
	},

	home: {
		tagline: 'Sicherungen und Playlists von JW Library zusammenführen, aufräumen und bearbeiten.',
		open: 'Öffnen …',
		newPlaylist: 'Neue Playlist …',
		newPlaylistTitle: 'Neue Playlist',
		newPlaylistName: 'Playlist',
		openTitle: 'Sicherung oder Playlist öffnen',
		fromDevice: 'Vom Gerät importieren …',
		saveTitle: 'Wo soll die Datei liegen?',
		empty: 'Noch nichts hier. Teile eine Sicherung aus JW Library mit in-browser oder öffne eine.',
		kept: (name) => `„${name}“ liegt in deinen Dateien.`,
		onlyFirst: (name) => `Nur „${name}“ wurde übernommen – eine Datei nach der anderen.`,
		remove: 'Aus der Liste entfernen',
		failed: (error) => `Die Datei konnte nicht abgelegt werden: ${error}`,
		hint: 'Eine aus JW Library geteilte Sicherung landet hier: lege sie als neue Datei ab oder führe sie mit der zusammen, die du aufbewahrst. Geöffnet wird sie nicht.'
	},

	ribbon: {
		tabs: { file: 'Datei', home: 'Start', notes: 'Notizen', highlights: 'Markierungen', tags: 'Tags', bookmarks: 'Lesezeichen', playlist: 'Playlist' },
		groups: {
			file: 'Datei',
			share: 'Weitergeben',
			export: 'Exportieren',
			show: 'Anzeigen',
			select: 'Auswahl',
			note: 'Notiz',
			filter: 'Filter',
			tags: 'Tags',
			color: 'Farbe',
			tidy: 'Aufräumen',
			tag: 'Tag',
			playlists: 'Playlists',
			items: 'Einträge',
			order: 'Reihenfolge'
		}
	},

	views: {
		overview: 'Überblick',
		notes: 'Notizen',
		highlights: 'Markierungen',
		bookmarks: 'Lesezeichen',
		tags: 'Tags',
		playlists: 'Playlists'
	},

	commands: {
		undo: 'Rückgängig',
		redo: 'Wiederholen',
		download: 'Herunterladen',
		downloadTip: 'Legt die Datei im Download-Ordner dieses Geräts ab – von dort öffnet JW Library sie',
		showInFiles: 'In Dateien zeigen',
		exportNotes: 'Notizen als Text …',
		exportNotesTip: 'Die Notizen (die ausgewählten, sonst alle) als Textdatei in deinen Dateien',
		delete: 'Löschen',
		selectAll: 'Alle auswählen',
		clearSelection: 'Auswahl aufheben',
		editNote: 'Notiz bearbeiten …',
		tagNotes: 'Tags',
		filterTags: 'Nach Tags filtern',
		filterTagsTip: 'Nur die Notizen mit den Tags zeigen, die du wählst',
		newTag: 'Neuer Tag',
		newPlaylist: 'Neue Playlist',
		newPlaylistTip: 'Eine leere Playlist in dieser Sicherung – benenne sie, dann füge Bilder und Videos hinzu',
		recolor: 'Farbe',
		cleanUp: 'Aufräumen',
		cleanUpTip: 'Entfernt Markierungen ohne Text und Tags, die an nichts hängen',
		rename: 'Umbenennen',
		mergeInto: 'Zusammenlegen mit',
		openPlaylist: 'Öffnen',
		backToPlaylists: 'Alle Playlists',
		addMedia: 'Bilder und Videos …',
		addMediaTip: 'Bilder und Videos aus deinen Dateien werden Einträge am Ende der Playlist',
		addFromDevice: 'Vom Gerät …',
		moveUp: 'Nach oben',
		moveDown: 'Nach unten',
		removeItems: 'Entfernen',
		importPlaylist: 'Playlist hinzufügen …',
		importPlaylistTip: 'Eine .jwlplaylist aus deinen Dateien wird eine Playlist dieser Sicherung',
		exportPlaylist: 'Als Playlist-Datei speichern …',
		exportPlaylistTip: 'Die geöffnete Playlist als eigene .jwlplaylist-Datei',
		appendPlaylist: 'Playlist anhängen …',
		appendPlaylistTip: 'Die Einträge einer anderen .jwlplaylist ans Ende dieser',
		deletePlaylist: 'Playlist löschen',
		trim: 'Schneiden …',
		trimTip: 'Nur einen Teil des ausgewählten Videos oder Musikstücks abspielen'
	},

	editor: {
		back: 'Zurück zu JWL-Dateien',
		openElsewhere: 'Diese Datei ist in einem anderen Tab geöffnet. Schließe sie dort, um sie hier zu bearbeiten.',
		loadFailed: (error) => `Die Datei konnte nicht geöffnet werden: ${error}`,
		archive: 'Das ist keine Datei von JW Library (keine Sicherung, keine Playlist).',
		database: 'Die Datenbank in dieser Datei lässt sich nicht lesen.',
		schema: 'Diese Datei stammt von einem neueren JW Library, als JWL-Dateien kennt. Es wurde nichts geändert.',
		changed: (name) => `„${name}“ wurde woanders geändert, und dieser Tab hat noch nicht gespeicherte Änderungen.`,
		reload: 'Neu laden',
		keepMine: 'Meine Fassung behalten',
		reloaded: (name) => `„${name}“ wurde neu gelesen.`,
		warnings: (n) => (n === 1 ? '1 Eintrag verweist auf etwas Fehlendes und wurde weggelassen.' : `${n} Einträge verweisen auf etwas Fehlendes und wurden weggelassen.`),
		readOnly: 'Zum Ansehen mit dir geteilt: du kannst schauen, nicht ändern.'
	},

	overview: {
		backup: 'Sicherung von JW Library',
		playlist: 'Playlist von JW Library',
		device: 'Erstellt auf',
		modified: 'Zuletzt geändert',
		schema: 'Datenbank-Version',
		merged: 'Von in-browser zusammengeführt',
		counts: {
			notes: 'Notizen',
			highlights: 'Markierungen',
			bookmarks: 'Lesezeichen',
			tags: 'Tags',
			playlists: 'Playlists',
			items: 'Einträge',
			inputs: 'Ausgefüllte Felder'
		},
		mergeHint: 'Um die Sicherung eines anderen Geräts hier hineinzuführen, teile sie aus JW Library mit in-browser und wähle diese Datei – oder nimm „Zusammenführen mit …“ im Tab „Datei“.',
		backHint: 'Zurück zu JW Library: „Senden …“, wo das Gerät es anbietet, sonst „Herunterladen“ und die Datei aus der Download-Meldung oder dem Download-Ordner öffnen.'
	},

	notes: {
		search: 'Notizen durchsuchen',
		empty: 'Keine Notizen.',
		none: 'Keine Notiz passt.',
		untitled: 'Ohne Titel',
		title: 'Titel',
		text: 'Text',
		editTitle: 'Notiz bearbeiten',
		tagsNone: 'Noch keine Tags – lege einen unter „Tags“ an.',
		tagsButton: 'Tags',
		clearFilter: 'Alle Notizen zeigen',
		removeFilter: (name) => `Nicht mehr nach „${name}“ filtern`,
		match: 'Notizen mit',
		matchAll: 'allen davon',
		matchAny: 'einem davon',
		exported: (name) => `Als „${name}“ gespeichert.`,
		fileName: (name) => `${name} – Notizen.txt`
	},

	highlights: {
		empty: 'Keine Markierungen.',
		publication: 'Publikation',
		color: 'Farbe',
		count: 'Markierungen',
		colors: ['Keine', 'Gelb', 'Grün', 'Blau', 'Rosa', 'Orange', 'Lila'],
		style: { 0: 'Markierung', 1: 'Unterstreichung' },
		cleaned: (n) => (n === 1 ? '1 Eintrag entfernt.' : `${n} Einträge entfernt.`),
		nothingToClean: 'Nichts aufzuräumen.'
	},

	bookmarks: {
		empty: 'Keine Lesezeichen.',
		slot: (n) => `Lesezeichen ${n + 1}`
	},

	tags: {
		empty: 'Keine eigenen Tags.',
		count: (n) => (n === 1 ? '1 Eintrag' : `${n} Einträge`),
		newName: 'Neuer Tag',
		rename: (name) => `„${name}“ umbenennen`
	},

	playlists: {
		empty: 'Keine Playlists.',
		newName: 'Neue Playlist',
		rename: (name) => `„${name}“ umbenennen`,
		taken: (name) => `Es gibt schon eine Playlist „${name}“.`,
		emptyItems: 'Diese Playlist ist leer. Füge Bilder oder Videos hinzu.',
		items: (n) => (n === 1 ? '1 Eintrag' : `${n} Einträge`),
		label: 'Name',
		seconds: 'Sekunden',
		endAction: 'Am Ende',
		endActions: ['Weiter', 'Stopp', 'Standbild', 'Wiederholen'],
		video: 'Video',
		audio: 'Musik',
		picture: 'Bild',
		trimmed: (from, to) => `Geschnitten: ${from}–${to}`,
		other: 'Eintrag einer Publikation',
		adding: 'Wird hinzugefügt …',
		addFailed: (name) => `„${name}“ konnte nicht hinzugefügt werden.`,
		exported: (name) => `Als „${name}“ gespeichert.`,
		imported: (name) => `„${name}“ hinzugefügt.`,
		notPlaylist: 'Das ist keine Playlist von JW Library.',
		saveTitle: 'Playlist speichern unter',
		openTitle: 'Playlist wählen',
		mediaTitle: 'Bilder und Videos wählen'
	},

	trim: {
		title: (label) => `„${label}“ schneiden`,
		publication: 'Dieses Video oder Musikstück stammt aus einer Publikation – JW Library hat es, darum gibt es hier keine Vorschau. Gib ein, wo es anfangen und enden soll (Minuten:Sekunden).',
		start: 'Anfang',
		end: 'Ende',
		startHere: 'Anfang hier',
		endHere: 'Ende hier',
		play: 'Ab hier abspielen',
		length: (part, of) => `Spielt ${part} von ${of}.`,
		invalid: 'Das Ende muss nach dem Anfang liegen.',
		reset: 'Ungeschnitten'
	},

	status: {
		selected: (n) => `${n} ausgewählt`,
		shown: (n, of) => (n === of ? `${of}` : `${n} von ${of}`)
	},

	help
};

export default de;
