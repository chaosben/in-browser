import type { FilesMessages } from './index.svelte.js';

const de: FilesMessages = {
	root: 'Meine Dateien',
	kinds: {
		folder: 'Ordner',
		file: 'Datei',
		fileType: (ext) => `${ext}-Datei`,
		package: (tool) => `${tool}-Projekt`
	},

	dialog: {
		titleOpen: 'Öffnen',
		titleSave: 'Speichern unter',
		titleFolder: 'Ordner wählen',
		chooseFolder: 'Diesen Ordner wählen',
		open: 'Öffnen',
		openCount: (n) => `Öffnen (${n})`,
		save: 'Speichern',
		cancel: 'Abbrechen',
		up: 'Einen Ordner nach oben',
		newFolder: 'Neuer Ordner',
		folderName: 'Name des neuen Ordners',
		create: 'Anlegen',
		name: 'Name',
		empty: 'Hier ist noch nichts.',
		exists: (name) => `„${name}“ gibt es hier schon. Wähle einen anderen Namen.`,
		replace: 'Ersetzen',
		replaces: (name) => `„${name}“ gibt es hier schon und wird ersetzt.`,
		place: 'Ort'
	},

	errors: {
		notFound: (name) => `„${name}“ gibt es nicht mehr.`,
		exists: (name) => `„${name}“ gibt es schon.`,
		collision: (name) => `Es gibt schon einen Eintrag, der sich von „${name}“ nur in Groß-/Kleinschreibung unterscheidet.`,
		invalidName: (name) => `„${name}“ ist kein gültiger Name.`,
		intoItself: (name) => `„${name}“ lässt sich nicht in sich selbst verschieben oder kopieren.`,
		root: (_name) => 'Mit dem obersten Ordner geht das nicht.',
		offline: (name) => `„${name}“ ist gerade nicht erreichbar.`,
		denied: (name) => `Der Browser erlaubt gerade keinen Zugriff auf „${name}“. Erlaube ihn in Dateien unter „Verbunden“.`,
		readOnly: (name) => `„${name}“ lässt sich nur lesen.`,
		ended: (_name) => 'Die Freigabe wurde beendet.',
		taken: (_name) => 'Diese Freigabe ist gerade in einem anderen Browser geöffnet. Versuch es später noch einmal.',
	},

	indicator: {
		label: 'Sync-Status',
		folder: (folder) => `Ordner „${folder}“`,
		synced: 'Aktuell',
		syncing: 'Synchronisiere …',
		paused: 'Pausiert',
		pausedHint: 'Erlaube den Zugriff in Dateien erneut.',
		failed: (n) => (n === 1 ? '1 Datei nicht synchronisiert' : `${n} Dateien nicht synchronisiert`),
		pendingDeletes: (n) => `${n} Löschungen warten auf deine Bestätigung`,
		lastSync: (ago) => `Zuletzt synchronisiert ${ago}`,
		syncNow: 'Jetzt synchronisieren',
		manage: 'In Dateien verwalten',
		help: 'So funktioniert das Synchronisieren'
	},

	trash: {
		moved: (name) => `„${name}“ liegt im Papierkorb.`,
		movedMany: (n) => `${n} Elemente liegen im Papierkorb.`,
		undo: 'Rückgängig',
		forGoodTitle: 'Endgültig löschen?',
		forGood: (name) => `„${name}“ liegt in einem verbundenen Ordner, der keinen Papierkorb hat. Es wird endgültig gelöscht.`,
		forGoodMany: (n) => `${n} Elemente liegen in einem verbundenen Ordner, der keinen Papierkorb hat. Sie werden endgültig gelöscht.`,
		forGoodConfirm: 'Löschen'
	},

	document: {
		saveFailed: (error) => `Speichern fehlgeschlagen: ${error}`,
		changedTitle: (name) => `„${name}“ wurde woanders geändert`,
		changedMessage: 'Eine andere Version wurde gespeichert – auf einem anderen Gerät, in einem anderen Tab oder von einem anderen Programm. Lade neu, um sie hier zu sehen; ungespeicherte Änderungen hast du keine.',
		reload: 'Neu laden',
		keep: 'Nicht neu laden',
		dontAsk: 'Nicht mehr fragen, solange die Datei offen ist'
	},

	connected: {
		allow: 'Zugriff erlauben',
		noAccess: (name) => `Der Browser braucht für „${name}“ wieder deine Erlaubnis.`
	},

	start: {
		recent: 'Zuletzt geöffnet',
		unsupported: 'Dieser Browser hat kein Dateisystem für Websites (OPFS). Bitte nutze einen aktuellen Browser.',
		open: 'Öffnen'
	},

	share: {
		connection: (folder, host) => (host ? `${folder} von ${host}` : folder),
		pending: 'Freigegebener Ordner',
		viewOnly: 'Nur ansehen'
	},

	folderSync: {
		browser: 'Browser',
		folder: 'Ordner'
	},

	p2p: {
		conflictLabel: (device) => `Konflikt ${device}`,
		connected: (online, total) => `${online} von ${total} Geräten verbunden`,
		waiting: 'Warte auf deine Geräte',
		syncingWith: (name, done, total) => `Synchronisiere mit ${name} … ${done}/${total}`,
		upToDate: 'Aktuell',
		probablyBehind: (name) => `${name} wahrscheinlich nicht aktuell`,
		selfBehind: 'Dieses Gerät ist nicht aktuell',
		removed: 'Dieses Gerät wurde aus deinen Geräten entfernt',
		online: 'verbunden',
		lastSeen: (ago) => `zuletzt gesehen ${ago}`,
		never: 'noch nicht gesehen',
		unreachable: 'online, aber nicht erreichbar',
		outdated: 'braucht ein Update von in-browser',
		missing: (n, more) => (more ? `mehr als ${n} Änderungen fehlen` : n === 1 ? '1 Änderung fehlt' : `${n} Änderungen fehlen`),
		pendingDeletes: (n) => `${n} Löschungen warten auf deine Bestätigung`,
		manage: 'Geräte verwalten',
		conflicts: (names) =>
			names.length === 1
				? `„${names[0]}“ wurde auf zwei Geräten geändert – beide Fassungen sind erhalten.`
				: `${names.length} Dateien wurden auf zwei Geräten geändert – beide Fassungen sind erhalten.`,
		added: (name) => `${name} wurde zu deinen Geräten hinzugefügt.`,
		removedDevice: (name) => `${name} wurde aus deinen Geräten entfernt.`,
		paired: 'Dieses Gerät ist jetzt mit deinen Geräten verbunden.',
		oldCopy: (name) =>
			`„${name}“ wird auf diesem Gerät nicht synchronisiert und öffnet sich jetzt live von deinen anderen Geräten – die alte Kopie, die noch hier lag, ist im Papierkorb.`
	},

	settings: {
		title: 'Einstellungen',
		open: 'Einstellungen',
		close: 'Schließen',
		back: 'Alle Einstellungen',
		categoriesLabel: 'Kategorien',
		synced: 'Gilt auf allen deinen Geräten.',
		saveFailed: (error) => `Die Einstellung konnte nicht gespeichert werden: ${error}`,
		categories: { profile: 'Profil', trash: 'Papierkorb' },
		profile: {
			name: { label: 'Dein Name' }
		},
		trash: {
			days: {
				label: 'Gelöschtes endgültig entfernen nach',
				option: (days) => (days === null ? 'Nie' : `${days} Tagen`)
			}
		}
	},

	names: {
		empty: 'Gib einen Namen ein.',
		dots: '„.“ und „..“ sind nicht erlaubt.',
		chars: 'Diese Zeichen sind nicht erlaubt: \\ / : * ? " < > |',
		reserved: 'Dieser Name ist unter Windows reserviert.',
		trailing: 'Der Name darf nicht mit einem Leerzeichen beginnen und nicht mit Leerzeichen oder Punkt enden.',
		long: 'Der Name ist zu lang.'
	}
};

export default de;
