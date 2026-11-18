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
		selectAll: 'Alles auswählen',
		moveTo: 'Verschieben nach …',
		moveHere: 'Hierher verschieben',
		more: (name) => `Aktionen für „${name}“`,
		selection: 'Aktionen für die Auswahl',
		clearSelection: 'Auswahl aufheben'
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
		moved: (n) => (n === 1 ? '1 Element verschoben' : `${n} Elemente verschoben`),
		zipping: 'Die ZIP-Datei wird vorbereitet …'
	},

	storage: {
		used: (used, quota) => `${used} von ${quota} belegt`
	},

	log: {
		title: 'Fehlersuche',
		record: 'Protokoll des Abgleichs aufzeichnen (Geräte und Ordner)',
		hint: 'Schalte es auf jedem beteiligten Gerät ein, lass das Problem noch einmal auftreten und exportiere dann auf jedem Gerät das Protokoll. Es bleibt auf diesem Gerät, bis du es exportierst, und enthält Datei- und Gerätenamen – schau es dir an, bevor du es weitergibst.',
		count: (n) => (n === 1 ? '1 Eintrag' : `${n} Einträge`),
		export: 'Protokoll exportieren',
		clear: 'Protokoll leeren',
		fileName: (device, date) => `in-browser-sync-log-${device}-${date}.txt`
	},

	syncHub: {
		title: 'Abgleich',
		open: 'Abgleich-Einstellungen öffnen',
		off: 'Nicht eingerichtet',
		devices: (online, total) => `${online} von ${total} Geräten verbunden`,
		alone: 'Warte auf ein zweites Gerät',
		waiting: 'Warte auf deine Geräte',
		removed: 'Aus deinen Geräten entfernt',
		folder: (name) => `Ordner „${name}“`,
		folderPaused: 'Ordner pausiert'
	},

	devices: {
		title: 'Deine Geräte',
		intro: 'Gleiche diese Dateien direkt mit deinen anderen Geräten ab – Handy, Laptop, Tablet. Ohne Cloud, ohne Konto.',
		unsupported: 'Dieser Browser kann nicht mit anderen Geräten abgleichen. Nutze eine aktuelle Version von Chrome, Edge, Firefox oder Safari.',
		connect: 'Geräte verbinden',
		enterKey: 'Schlüssel eingeben',
		howItWorks: 'So funktioniert’s',
		addDevice: 'Gerät hinzufügen',
		chooseFolders: 'Ordner auswählen',
		syncNow: 'Jetzt abgleichen',
		leave: 'Dieses Gerät trennen',
		removeNamed: (name) => `„${name}“ entfernen`,
		remove: 'Gerät entfernen',
		rename: 'Umbenennen',
		thisDevice: 'dieses Gerät',
		online: 'verbunden',
		syncing: (done, total) => `gleiche ab … ${done}/${total}`,
		lastSeen: (ago) => `zuletzt gesehen ${ago}`,
		never: 'noch nicht gesehen',
		unreachable: 'Online, aber nicht erreichbar. Vermutlich blockiert das Netz direkte Verbindungen (z. B. Mobilfunk oder Firmen-WLAN).',
		outdated: 'Braucht ein Update: Öffne dort in-browser und lade die Seite neu.',
		lastSync: (ago) => `zuletzt abgeglichen ${ago}`,
		upToDate: 'aktuell',
		probablyBehind: (changes, ago) => `Wahrscheinlich nicht aktuell: ${changes} seit dem letzten Abgleich ${ago}.`,
		changes: (n, more) => (more ? `mehr als ${n} Änderungen` : n === 1 ? '1 Änderung' : `${n} Änderungen`),
		waiting: 'Warte auf deine anderen Geräte. Öffne in-browser auf einem davon.',
		selfBehind: (ago) =>
			`Dieses Gerät wurde zuletzt ${ago} abgeglichen. Öffne in-browser auf einem deiner anderen Geräte, bevor du hier weiterarbeitest – sonst können Konfliktkopien entstehen.`,
		excludedCount: (n) => (n === 1 ? '1 Ordner wird auf diesem Gerät nicht abgeglichen' : `${n} Ordner werden auf diesem Gerät nicht abgeglichen`),
		pendingDeletes: (n) => `${n} Dateien wurden auf einem anderen Gerät gelöscht. Hier auch löschen?`,
		applyDeletes: 'Hier auch löschen',
		runsWhileOpen: 'Abgeglichen wird, solange in-browser auf mindestens zwei Geräten geöffnet ist – oder ständig mit einer p2p-node auf einem Rechner oder Heimserver.',
		p2pNode: 'p2p-node einrichten',
		removeTitle: (name) => `„${name}“ entfernen?`,
		removeMessage:
			'Es kann sich nicht mehr mit deinen Geräten verbinden und bekommt nichts Neues mehr. Was es schon hat, bleibt dort – aus der Ferne löschen geht nicht.',
		leaveTitle: 'Dieses Gerät trennen?',
		leaveMessage: 'Deine Dateien bleiben hier und auf den anderen Geräten. Dieses Gerät gleicht nur nicht mehr ab; du kannst es später wieder verbinden.',
		removedTitle: 'Dieses Gerät wurde aus deinen Geräten entfernt.',
		removedMessage: 'Es gleicht nicht mehr ab. Die abgeglichenen Dateien bleiben hier, bis du sie löschst.',
		resetKeep: 'Zurücksetzen, Dateien behalten',
		resetDelete: 'Dateien löschen und zurücksetzen',
		resetDeleteTitle: 'Alle Dateien auf diesem Gerät löschen und zurücksetzen?',
		resetDeleteMessage:
			'Das löscht alle Dateien in Files auf diesem Gerät und setzt den Abgleich auf den Anfang zurück. Die anderen Geräte sind nicht betroffen.',
		resetHint: 'Zurücksetzen bringt dieses Gerät auf den Anfang: Du kannst es dann mit einem neuen Schlüssel wieder verbinden.',
		nameLabel: 'Name dieses Geräts',
		nameHint: 'Damit du deine Geräte auseinanderhalten kannst, z. B. „Laptop Büro“.',
		suggestion: (browser, system) => (browser && system ? `${browser} auf ${system}` : browser || system || 'Mein Gerät'),
		phone: 'Android-Handy',
		tablet: 'Android-Tablet',
		next: 'Weiter',
		back: 'Zurück',
		close: 'Schließen',
		cancel: 'Abbrechen',
		start: 'Verbinden',
		failed: (message) => `Das hat nicht geklappt: ${message}`
	},

	pair: {
		title: 'Gerät hinzufügen',
		yourKey: 'Dein Schlüssel',
		scan: 'Scanne den Code mit der Kamera deines Handys oder gib den Schlüssel auf dem anderen Gerät in in-browser ein (Files → Deine Geräte → Schlüssel eingeben).',
		copyLink: 'Link kopieren',
		copied: 'Link kopiert.',
		validity: 'Gilt einmal, 24 Stunden lang, solange dieses Gerät online ist.',
		warning: 'Wer diesen Schlüssel hat, kann ein Gerät verbinden und alle deine abgeglichenen Dateien lesen und ändern.',
		waiting: 'Warte auf das andere Gerät …',
		added: (name) => `${name} wurde hinzugefügt.`,
		addAnother: 'Weiteres Gerät hinzufügen'
	},

	join: {
		title: 'Dieses Gerät verbinden',
		keyLabel: 'Schlüssel',
		keyPlaceholder: 'XXXX-XXXX-XXXX-XXXX-XXXX',
		invalidKey: 'Das ist kein gültiger Schlüssel (20 Zeichen).',
		confirm: 'Dieses Gerät mit deinen Geräten verbinden? Alle Dateien werden mit den anderen Geräten abgeglichen.',
		connecting: 'Verbinde … Lass in-browser auf dem Gerät geöffnet, das den Schlüssel zeigt.',
		timeout: 'Keine Antwort. Ist in-browser auf dem anderen Gerät geöffnet, und gilt der Schlüssel noch?',
		done: 'Verbunden.'
	},

	explain: {
		title: 'So funktioniert’s',
		simple: 'Einfach',
		expert: 'Für Experten',
		points: [
			'Deine Geräte tauschen Dateien **direkt** miteinander aus – verschlüsselt, ohne Cloud.',
			'Abgeglichen wird, **solange mindestens zwei Geräte in-browser geöffnet haben**. Ein Tab mit einem beliebigen Tool genügt, auch im Hintergrund. Am Handy nur, solange die Seite vorne ist. Verpasstes wird nachgeholt. Eine **p2p-node** auf einem Rechner oder Heimserver gleicht auch ab, wenn kein Browser offen ist.',
			'**Jedes Gerät hat seinen eigenen Schlüssel.** Ein neues Gerät kommt nur mit einem Einmal-Schlüssel dazu, den eines deiner Geräte ausstellt. Ein verlorenes Gerät kannst du jederzeit entfernen.',
			'Pro Gerät kannst du Ordner ausnehmen. Sie bleiben dann nur dort, wo sie sind.'
		],
		diagram: 'Drei Geräte, direkt miteinander verbunden, kein Server dazwischen',
		expertSections: [
			['Transport', 'WebRTC-DataChannels (SCTP über DTLS), direkt zwischen den Geräten, jedes mit jedem. STUN über stun.cloudflare.com, kein TURN – strenge NATs (symmetrisches NAT, CGNAT im Mobilfunk) verhindern deshalb oft eine Verbindung.'],
			['Signaling', 'Trystero über öffentliche Nostr-Relays. Sie sehen IP-Adressen, Zeitpunkte und einen Hash des Raums; Angebote und ICE-Kandidaten sind mit einem Schlüssel aus dem Raumgeheimnis verschlüsselt. Jedes Entfernen bringt ein neues Raumgeheimnis.'],
			['Identität', 'Ed25519-Schlüsselpaar pro Gerät (WebCrypto, nicht exportierbar, IndexedDB). Die Geräte-ID ist der Fingerabdruck des öffentlichen Schlüssels. Die Anmeldung signiert eine Zufallszahl zusammen mit den DTLS-Fingerabdrücken der Verbindung, damit kein Relay dazwischen sitzen kann.'],
			['Mitglieder', 'Hash-verkettetes Protokoll signierter Einträge (create, add, remove, rename), bei jedem Kontakt zusammengeführt. Entfernen schlägt gleichzeitige Einträge des entfernten Geräts; gegenseitiges gleichzeitiges Entfernen entfernt beide. Ein Gerät, das offline war, erfährt vom Entfernen über jedes Mitglied – trifft es zuerst das entfernte Gerät, kann dieses bis dahin noch mit ihm abgleichen.'],
			['Einmal-Schlüssel', '100 Bit, einmal und 24 Stunden gültig, nur solange das ausstellende Gerät online ist. Nachweis per HMAC über die DTLS-Fingerabdrücke in beide Richtungen.'],
			['Abgleich', 'Drei-Wege-Vergleich pro Gerätepaar gegen den gespeicherten Stand des letzten Abgleichs; das Gerät mit der kleineren ID steuert. Die neuere Fassung gewinnt, die andere wird zur Konfliktkopie; SHA-256 vermeidet unnötige Übertragungen; viele Löschungen auf einmal warten auf Bestätigung (auf jedem der beiden Geräte). Direkt vor dem Überschreiben oder Löschen wird der Stand mit dem geplanten verglichen – was sich inzwischen geändert hat, bleibt unangetastet. Löschungen und Ersetzungen anderer Geräte werden übernommen (wie bei Syncthing); was du löschst, kommt in den Papierkorb-Ordner, der wie jeder andere abgeglichen wird. Umbenennungen nur in Groß-/Kleinschreibung bleiben Umbenennungen. Ordnerauswahl = Schnittmenge beider Geräte, löst nie ein Löschen aus.'],
			['Wissensstand', 'Änderungsprotokoll mit laufenden Nummern pro Gerät und Versionsvektoren: Grundlage der Hinweise auf Geräte, die wahrscheinlich nicht aktuell sind, auch wenn sie Änderungen indirekt bekommen haben.'],
			['Speicher', 'Dateien im OPFS (dauerhafte Speicherung angefordert); Schlüssel, Mitgliederliste, Abgleichstand und Vektoren in IndexedDB.'],
			['Grenzen', 'Läuft nur in einem offenen Tab, am Handy nur im Vordergrund. Was ein entferntes Gerät schon hat, behält es. Eine p2p-node hebt die erste Grenze auf: ein Node-Prozess (WebRTC über werift), der als Gerät mitmacht und die Dateien in einem Ordner auf der Festplatte hält.']
		],
		p2pNode: 'p2p-node: ein ständig laufendes Gerät für deinen Rechner oder Heimserver',
		source: 'Quellcode des P2P-Moduls',
		diagnostics: 'Diagnose',
		ownFingerprint: 'Dieses Gerät',
		connection: { host: 'direkt im lokalen Netz', srflx: 'über NAT (STUN)', prflx: 'über NAT', relay: 'weitergeleitet (TURN)', unknown: 'unbekannt' },
		rtt: (ms) => `${ms} ms`,
		relays: 'Relays',
		relayConnected: 'verbunden',
		relayDisconnected: 'nicht verbunden',
		noPeers: 'Gerade ist kein Gerät verbunden.',
		copyDiagnostics: 'Diagnose kopieren',
		copied: 'Diagnose kopiert.'
	},

	scope: {
		empty: 'Noch keine Ordner.',
		title: 'Ordner auswählen',
		hint: 'Abgewählte Ordner bleiben auf den anderen Geräten und werden dort weiter abgeglichen – nur dieses Gerät bekommt sie nicht.',
		always: 'Immer abgeglichen (Daten der Tools)',
		onlyOn: (devices) => `nur auf ${devices}`,
		excludeTitle: (name) => `„${name}“ auf diesem Gerät nicht mehr abgleichen?`,
		excludeMessage: 'Die anderen Geräte behalten ihn. Du kannst die Kopie auf diesem Gerät behalten oder hier löschen – das betrifft die anderen Geräte nicht.',
		keepCopy: 'Kopie hier behalten',
		deleteCopy: 'Hier löschen',
		exclude: 'Auf diesem Gerät nicht abgleichen',
		include: 'Auf diesem Gerät wieder abgleichen',
		excluded: 'Wird auf diesem Gerät nicht abgeglichen'
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
	},

	trash: {
		title: 'Papierkorb',
		intro: 'Was du löschst, landet zuerst hier – auf all deinen Geräten, so kannst du es auf jedem zurückholen.',
		elsewhere: 'In einem verbundenen Ordner auf deinem Rechner und beim p2p-node ist es der versteckte Ordner „.in-browser-trash“.',
		summary: (n, size) => (n === 1 ? `1 Element, ${size}` : `${n} Elemente, ${size}`),
		nothing: 'Der Papierkorb ist leer.',
		keep: 'Aufbewahren',
		days: (n) => (n === 1 ? '1 Tag' : `${n} Tage`),
		forever: 'Bis ich ihn leere',
		keepHint: 'Gilt für alle deine Geräte.',
		from: (folder) => `aus ${folder}`,
		when: (time, size) => `gelöscht ${time} · ${size}`,
		restore: 'Wiederherstellen',
		restored: (path) => `Als „${path}“ wiederhergestellt.`,
		remove: 'Endgültig löschen',
		removeTitle: 'Endgültig löschen?',
		removeMessage: (name) => `„${name}“ lässt sich danach nicht mehr wiederherstellen – auf keinem deiner Geräte.`,
		empty: 'Papierkorb leeren',
		emptyTitle: 'Papierkorb leeren?',
		emptyMessage: (n) => (n === 1 ? '1 Element wird endgültig gelöscht, auf all deinen Geräten.' : `${n} Elemente werden endgültig gelöscht, auf all deinen Geräten.`),
		more: (n) => `${n} weitere – stelle zuerst einige wieder her oder lösche sie.`,
		close: 'Schließen'
	}
};

export default de;
