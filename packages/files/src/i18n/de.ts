import type { FilesMessages } from './index.svelte.js';

const de: FilesMessages = {
	root: 'Dateien',
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
		replaces: (name) => `„${name}“ gibt es hier schon und wird ersetzt.`
	},

	errors: {
		notFound: (name) => `„${name}“ gibt es nicht mehr.`,
		exists: (name) => `„${name}“ gibt es schon.`,
		collision: (name) => `Es gibt schon einen Eintrag, der sich von „${name}“ nur in Groß-/Kleinschreibung unterscheidet.`,
		invalidName: (name) => `„${name}“ ist kein gültiger Name.`,
		intoItself: (name) => `„${name}“ lässt sich nicht in sich selbst verschieben oder kopieren.`,
		root: (_name) => 'Mit dem obersten Ordner geht das nicht.'
	},

	indicator: {
		label: 'Abgleich-Status',
		folder: (folder) => `Ordner „${folder}“`,
		synced: 'Aktuell',
		syncing: 'Gleiche ab …',
		paused: 'Pausiert',
		pausedHint: 'Erlaube den Zugriff in Files erneut.',
		failed: (n) => (n === 1 ? '1 Datei nicht abgeglichen' : `${n} Dateien nicht abgeglichen`),
		pendingDeletes: (n) => `${n} Löschungen warten auf deine Bestätigung`,
		lastSync: (ago) => `Zuletzt abgeglichen ${ago}`,
		syncNow: 'Jetzt abgleichen',
		manage: 'In Files verwalten'
	},

	trash: {
		moved: (name) => `„${name}“ liegt im Papierkorb.`,
		movedMany: (n) => `${n} Elemente liegen im Papierkorb.`,
		undo: 'Rückgängig'
	},

	folderSync: {
		browser: 'Browser',
		folder: 'Ordner'
	},

	p2p: {
		conflictLabel: (device) => `Konflikt ${device}`,
		connected: (online, total) => `${online} von ${total} Geräten verbunden`,
		waiting: 'Warte auf deine Geräte',
		syncingWith: (name, done, total) => `Gleiche mit ${name} ab … ${done}/${total}`,
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
		paired: 'Dieses Gerät ist jetzt mit deinen Geräten verbunden.'
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
