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
		merge: 'Zusammenführen',
		mergeOrReplace: (name: string) => `„${name}“ gibt es hier schon: führe beide darin zusammen oder ersetze sie.`,
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
		credentials: (name) => `Der Server von „${name}“ hat die Anmeldedaten nicht angenommen. Ändere sie in Dateien unter „Verbunden“.`,
		full: (name) => `„${name}“ passt nicht mehr: Der Speicher dieses Browsers ist voll. Schaffe Platz in Dateien, z. B. mit „Papierkorb leeren“.`,
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
		setup: 'Wartet auf deine Auswahl',
		heldFolders: (n, name) => (n === 1 ? `Neuer Ordner „${name}“ wartet` : `${n} neue Ordner warten`),
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
		noAccess: (name) => `Der Browser braucht für „${name}“ wieder deine Erlaubnis.`,
		notAllowed: (name) => `Der Browser hat den Zugriff auf „${name}“ nicht erlaubt. Hat er dich nicht gefragt, gibt es den Ordner vielleicht nicht mehr oder der Browser unterdrückt die Frage – wähle den Ordner neu.`,
		notAnswering: (name) => `Der Browser hat die Frage für „${name}“ noch nicht beantwortet. Siehst du keine Frage, lade die Seite neu und wähle wieder „Zugriff erlauben“ – du wählst den Ordner dann neu.`,
		reload: 'Seite neu laden',
		chooseAgain: 'Ordner neu wählen',
		editCredentials: 'Anmeldedaten ändern'
	},

	start: {
		recent: 'Zuletzt geöffnet',
		unsupported: 'Dieser Browser hat kein Dateisystem für Websites (OPFS). Bitte nutze einen aktuellen Browser.',
		open: 'Öffnen'
	},

	share: {
		connection: (folder, host) => (host ? `${folder} von ${host}` : folder),
		pending: 'Freigegebener Ordner',
		viewOnly: 'Nur ansehen',
		guest: 'Gast',
		host: 'Freigabe',
		syncing: (done, total) => (total ? `Die Freigabe wird geholt … ${done}/${total}` : 'Die Freigabe wird geholt …'),
		connecting: 'Das freigebende Gerät wird gesucht …',
		offline: 'Das freigebende Gerät ist gerade nicht erreichbar – du siehst die Freigabe so, wie sie zuletzt war.',
		taken: 'Die Freigabe ist gerade in einem anderen Browser geöffnet – dieser versucht es von selbst wieder.',
		ask: (size) => `Die Freigabe ist ${size} groß. Auf dieses Gerät holen?`,
		askFull: (size) => `Die Freigabe ist ${size} groß und passt nicht in den freien Speicher dieses Browsers.`,
		fetch: 'Holen',
		failed: (n) => (n === 1 ? '1 Datei konnte nicht abgeglichen werden.' : `${n} Dateien konnten nicht abgeglichen werden.`)
	},

	shareDialog: {
		action: 'Freigeben …',
		tip: 'Ein Gast öffnet diese Datei in seinem Browser – mit einem Link, einem QR-Code oder vier Wörtern',
		title: (name) => `„${name}“ freigeben`,
		introFolder: 'Ein Gast bekommt diesen Ordner in seinen Browser: Er wird auf sein Gerät kopiert und abgeglichen, solange in-browser hier offen ist. Endet die Freigabe, wird die Kopie dort gelöscht.',
		introFile: 'Ein Gast bekommt diese Datei in seinen Browser: Sie wird auf sein Gerät kopiert und abgeglichen, solange in-browser hier offen ist. Endet die Freigabe, wird die Kopie dort gelöscht.',
		mode: 'Der Gast darf',
		view: 'Nur ansehen',
		viewHint: 'Öffnen, ansehen und herunterladen (Standard).',
		edit: 'Bearbeiten',
		editHint: 'Auch speichern, hochladen, umbenennen und löschen – Gelöschtes landet hier im Papierkorb.',
		duration: 'Die Freigabe endet',
		durations: ['Nach einer Stunde', 'Nach einem Tag (Standard)', 'Nach einer Woche', 'Wenn du sie beendest'],
		create: 'Freigeben',
		link: 'Link für den Gast',
		qr: 'QR-Code des Freigabe-Links',
		copy: 'Link kopieren',
		copied: 'Link kopiert.',
		showWords: 'Vier Wörter zeigen',
		wordsHint: 'Einfacher an einem anderen Rechner: Öffne dort in-browser, wähle „Freigabe öffnen“ und tippe diese Wörter.',
		wordsLabel: 'Wörter für den Gast',
		wordsLeft: (minutes) => (minutes <= 1 ? 'Sie gelten noch weniger als eine Minute, einmal.' : `Sie gelten noch ${minutes} Minuten, einmal.`),
		wordsUsed: 'Die Wörter wurden benutzt oder sind abgelaufen.',
		newWords: 'Neue Wörter',
		waiting: 'Wartet auf den Gast – jeweils ein Browser kann sie öffnen.',
		connected: 'Gast verbunden.',
		away: 'Der Gast ist gerade nicht verbunden.',
		untilEnded: 'Bis du sie beendest',
		endsAt: (at) => `Endet ${at.toLocaleString('de', { dateStyle: 'medium', timeStyle: 'short' })}`,
		end: 'Freigabe beenden',
		endTitle: 'Freigabe beenden?',
		endMessage: (name) => `Der Gast kann „${name}“ dann nicht mehr öffnen. Hier ändert sich daran nichts.`,
		help: 'So funktioniert das Freigeben für einen Gast',
		cancel: 'Abbrechen',
		close: 'Schließen',
		unavailable: 'Von hier lassen sich nur Dateien aus Meine Dateien auf diesem Gerät freigeben.'
	},

	live: {
		present: (title, peer) => (peer ? `${peer} präsentiert „${title}“` : `Dein Gast präsentiert „${title}“`),
		control: 'Fernsteuern',
		join: 'Teilnehmen'
	},

	openShare: {
		title: 'Freigabe öffnen',
		menu: 'Freigabe mit vier Wörtern …',
		intro: 'Tippe die vier Wörter, die das freigebende Gerät zeigt – Groß- und Kleinschreibung ist egal.',
		label: 'Vier Wörter',
		placeholder: 'z. B. apfel fluss wolke stein',
		open: 'Öffnen',
		opening: 'Frage beim freigebenden Gerät an …',
		notWords: 'Das sind keine vier bekannten Wörter. Prüfe jedes einzelne.',
		ended: 'Diese Wörter öffnen (mehr) keine Freigabe: Sie gelten einmal und 10 Minuten lang. Lass dir neue geben.',
		offline: 'Das freigebende Gerät hat nicht geantwortet. Prüfe die Wörter; dort muss in-browser offen sein, und beide Geräte brauchen Internet, um sich zu finden.',
		cancel: 'Abbrechen'
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
		newer: 'hat eine neuere Version – lade diese Seite neu',
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
		categories: { profile: 'Profil', trash: 'Papierkorb', sync: 'Synchronisieren' },
		profile: {
			name: { label: 'Dein Name' }
		},
		trash: {
			days: {
				label: 'Gelöschtes endgültig entfernen nach',
				option: (days) => (days === null ? 'Nie' : `${days} Tagen`)
			}
		},
		sync: {
			askAbove: {
				label: 'Vor dem Synchronisieren neuer Ordner fragen ab',
				option: (bytes) => (bytes === null ? 'Nie fragen' : bytes >= 1e9 ? `${bytes / 1e9} GB` : `${bytes / 1e6} MB`)
			}
		}
	},

	send: {
		action: 'Senden …',
		tip: 'Gibt die Datei an eine andere App auf diesem Gerät – Mail, einen Messenger …',
		failed: 'Die Datei konnte nicht gesendet werden.',
		ready: (n) => (n === 1 ? 'Die Datei ist bereit zum Senden.' : `Die ${n} Dateien sind bereit zum Senden.`),
		now: 'Senden'
	},

	merge: {
		action: 'Zusammenführen mit …',
		tip: 'Übernimmt, was eine andere Datei dieser Art hat, in diese – ersetzt wird nichts',
		chooseTitle: (name: string) => `Mit „${name}“ zusammenführen`,
		same: 'Wähle eine andere Datei – eine Datei lässt sich nicht mit sich selbst zusammenführen.',
		unchanged: (name: string) => `„${name}“ hat schon alles – nichts geändert.`,
		done: (name: string, c: { added: number; changed: number; removed: number }) =>
			`In „${name}“ zusammengeführt: ${c.added} neu, ${c.changed} geändert, ${c.removed} entfernt.`,
		undo: 'Rückgängig',
		undone: (name: string) => `„${name}“ ist wieder wie vor dem Zusammenführen.`,
		lossTitle: 'So viel entfernen?',
		loss: (name: string, removed: number, of: number) =>
			`Beim Zusammenführen würden ${removed} der ${of} Markierungen und Notizen in „${name}“ entfernt – die andere Datei hat sie gelöscht. Trotzdem zusammenführen?`,
		anyway: 'Trotzdem zusammenführen',
		notMerged: 'Nicht zusammengeführt – nichts geändert.',
		failed: (name: string) => `Zusammenführen in „${name}“ hat nicht geklappt.`
	},

	receive: {
		saveTitle: 'Wo soll die Datei liegen?',
		folderTitle: (n) => `Wo sollen die ${n} Dateien liegen?`,
		notSaved: 'Nicht abgelegt – es wurde nichts gespeichert.'
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
