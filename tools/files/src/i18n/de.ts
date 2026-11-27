import help from './help.de.js';
import type { Messages } from './index.js';

const de: Messages = {
	common: {
		cancel: 'Abbrechen',
		close: 'Schließen',
		rename: 'Umbenennen',
		download: 'Herunterladen'
	},

	brand: {
		description:
			'Verwalte die Dateien deiner in-browser-Tools im Browserspeicher und synchronisiere sie mit einem Ordner auf deinem Rechner.'
	},

	toolbar: {
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

	commands: {
		undo: 'Rückgängig',
		undoTip: 'Nimmt das letzte Umbenennen, Verschieben, Einfügen oder Duplizieren zurück',
		openWith: 'Öffnen mit',
		downloadTip: 'Die Auswahl, sonst den offenen Ordner (mehrere Einträge und Ordner als ZIP)',
		shareTip: 'Gibt den ausgewählten Ordner, sonst den offenen, für einen Gast frei',
		syncSettings: 'Sync-Einstellungen',
		syncHere: 'Auf diesem Gerät synchronisieren',
		syncHereTip: 'Ob der ausgewählte Ordner, sonst der offene, auf diesem Gerät gehalten wird',
		up: 'Einen Ordner nach oben'
	},

	ribbon: {
		tabs: {
			home: 'Start',
			share: 'Freigeben',
			connect: 'Verbinden',
			sync: 'Sync',
			view: 'Ansicht',
			selection: 'Auswahl',
			trash: 'Papierkorb'
		},
		groups: {
			new: 'Neu',
			clipboard: 'Zwischenablage',
			organize: 'Organisieren',
			select: 'Auswählen',
			find: 'Suchen',
			share: 'Freigeben',
			download: 'Herunterladen',
			sync: 'Sync',
			devices: 'Geräte',
			trash: 'Papierkorb',
			show: 'Anzeigen',
			panels: 'Seitenleisten',
			open: 'Öffnen',
			entries: 'Einträge'
		}
	},

	panels: {
		folders: 'Ordner'
	},

	view: {
		sortBy: 'Sortieren nach',
		ascending: 'Aufsteigend',
		descending: 'Absteigend'
	},

	columns: {
		name: 'Name',
		kind: 'Art',
		size: 'Größe',
		modified: 'Geändert',
		origin: 'Ursprünglicher Ort',
		deleted: 'Gelöscht'
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
		clearSelection: 'Auswahl aufheben'
	},

	list: {
		loading: 'Wird geladen …',
		unsupported: 'Deinem Browser fehlt der Speicher, den dieses Tool braucht (Origin Private File System). Nutze einen aktuellen Browser.',
		empty: 'Dieser Ordner ist leer. Leg Dateien hier ab oder nutze „Hochladen“.',
		noMatch: 'Nichts passt zu deiner Suche.',
		items: (n) => (n === 1 ? '1 Element' : `${n} Elemente`),
		selected: (n) => `${n} ausgewählt`,
		newFolderName: 'Neuer Ordner',
		newTextFileName: 'Neue Textdatei.txt',
		dropHere: (folder) => `Loslassen, um nach „${folder}“ hochzuladen`,
		hint: 'Doppelklick öffnet, Rechtsklick zeigt alle Aktionen, ein Klick auf den Namen des ausgewählten Elements benennt es um. Zieh Elemente auf einen Ordner, um sie zu verschieben; mit Strg kopierst du sie.'
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
		copied: (n) => (n === 1 ? '1 Element kopiert' : `${n} Elemente kopiert`),
		duplicated: (n) => (n === 1 ? '1 Element dupliziert' : `${n} Elemente dupliziert`),
		renamed: (name) => `Umbenannt in „${name}“`,
		undo: 'Rückgängig',
		zipping: 'Die ZIP-Datei wird vorbereitet …'
	},

	storage: {
		used: (used, quota) => `${used} von ${quota} belegt`,
		notKept: 'Der Browser kann diesen Speicher leeren',
		notKeptHint: 'Dieser Browser hat nicht zugesagt, den Speicher von in-browser zu behalten. Behalte eine Kopie – mit einem Ordner oder einem anderen Gerät synchronisieren – oder installiere in-browser. Öffnet die Hilfe.'
	},

	share: {
		action: 'Freigeben …',
		title: (folder) => `„${folder}“ freigeben`,
		intro: 'Ein Gast bekommt diesen Ordner mit einem Link oder QR-Code in seinen Browser: Er wird auf sein Gerät kopiert und abgeglichen, solange in-browser hier offen ist. Endet die Freigabe, wird die Kopie dort gelöscht.',
		mode: 'Der Gast darf',
		view: 'Nur ansehen',
		viewHint: 'Dateien öffnen, ansehen und herunterladen (Standard).',
		edit: 'Bearbeiten',
		editHint: 'Auch speichern, hochladen, umbenennen und löschen – Gelöschtes landet hier im Papierkorb.',
		untilEnded: 'Bis du sie beendest',
		validity: 'Der Link funktioniert, bis du die Freigabe beendest. Wer ihn hat, kommt hinein, solange niemand sonst verbunden ist – gib ihn nur deinem Gast.',
		create: 'Freigeben',
		link: 'Link für den Gast',
		qr: 'QR-Code des Freigabe-Links',
		copy: 'Link kopieren',
		copied: 'Link kopiert.',
		waiting: 'Wartet auf den Gast – jeweils ein Browser kann den Link öffnen.',
		connected: 'Gast verbunden.',
		away: 'Der Gast ist gerade nicht verbunden.',
		end: 'Freigabe beenden',
		endTitle: 'Freigabe beenden?',
		endMessage: (folder) => `Der Gast kann „${folder}“ dann nicht mehr öffnen. Im Ordner ändert sich nichts.`,
		shared: 'freigegeben',
		guestConnected: 'Gast verbunden',
		guestWaiting: 'Kein Gast verbunden',
		menu: (folder) => `Aktionen für die Freigabe von „${folder}“`,
		ended: 'Die Freigabe wurde beendet.',
		endedHint: 'Ihre Kopie auf diesem Gerät wurde gelöscht. Was du nach Meine Dateien kopiert hast, bleibt.',
		remove: 'Entfernen',
		show: 'Link zeigen',
		panelLabel: 'Für einen Gast freigegebene Ordner',
		section: 'Freigaben',
		new: 'Ordner freigeben …',
		chooseTitle: 'Ordner zum Freigeben auswählen',
		chooseConfirm: 'Diesen Ordner freigeben',
		notRoot: 'Meine Dateien als Ganzes lassen sich nicht freigeben – wähle einen Ordner darin.',
		notShareable: 'Dieser Ordner liegt nicht auf diesem Gerät (er ist hier vom Synchronisieren ausgenommen) und lässt sich deshalb nicht von hier freigeben.',
		help: 'So funktioniert das Freigeben für einen Gast',
		unsupported: 'Dieser Browser kann keine Ordner freigeben. Nimm eine aktuelle Version von Chrome, Edge, Firefox oder Safari.'
	},

	remote: {
		live: 'Live von deinen anderen Geräten',
		unreachable: (name, devices) =>
			devices.length
				? `„${name}“ ist gerade nicht erreichbar – der Ordner liegt auf ${devices.join(', ')}, und keins davon ist verbunden.`
				: `„${name}“ ist gerade nicht erreichbar – keins deiner verbundenen Geräte hat ihn.`,
		help: 'So funktionieren Ordner, die hier nicht synchronisiert werden'
	},

	connected: {
		title: 'Verbunden',
		connect: 'Verbinden …',
		connectHint: 'Öffnet einen Ordner auf deinem Rechner, einen WebDAV-Server oder S3-Speicher live – nichts wird in den Browser kopiert.',
		kinds: {
			folder: 'Ordner auf diesem Rechner …',
			folderUnsupported: 'Ordner auf diesem Rechner (braucht Chrome oder Edge am Computer)',
			webdav: 'WebDAV-Server …',
			s3: 'S3-Speicher …'
		},
		edit: 'Bearbeiten …',
		noAccess: (name) => `Der Browser braucht für „${name}“ wieder deine Erlaubnis.`,
		allow: 'Zugriff erlauben',
		allowHint: 'Tipp: Wähle „Bei jedem Besuch erlauben“, dann bleibt er verbunden.',
		disconnect: 'Trennen',
		disconnectTitle: 'Ordner trennen?',
		disconnectMessage: (name) =>
			`In „${name}“ wird nichts gelöscht. Er taucht hier nur nicht mehr auf; du kannst ihn jederzeit wieder verbinden.`,
		alsoSynced: (name) => `Meine Dateien werden schon mit „${name}“ synchronisiert – sein Inhalt erscheint jetzt doppelt.`,
		live: (name) => `Live aus „${name}“ auf deinem Rechner`,
		liveServer: (name) => `Live aus „${name}“`,
		sharedCopy: (host) => (host ? `Freigegeben von ${host} – eine Kopie auf diesem Gerät` : 'Freigegeben – eine Kopie auf diesem Gerät'),
		help: 'So funktionieren verbundene Ordner'
	},

	log: {
		title: 'Fehlersuche',
		record: 'Sync-Protokoll aufzeichnen (Geräte und Ordner)',
		hint: 'Schalte es auf jedem beteiligten Gerät ein, lass das Problem noch einmal auftreten und exportiere dann auf jedem Gerät das Protokoll. Es bleibt auf diesem Gerät, bis du es exportierst, und enthält Datei- und Gerätenamen – schau es dir an, bevor du es weitergibst.',
		count: (n) => (n === 1 ? '1 Eintrag' : `${n} Einträge`),
		export: 'Protokoll exportieren',
		clear: 'Protokoll leeren',
		fileName: (device, date) => `in-browser-sync-log-${device}-${date}.txt`
	},

	syncHub: {
		title: 'Sync'
	},

	devices: {
		title: 'Deine Geräte',
		intro: 'Synchronisiere diese Dateien direkt mit deinen anderen Geräten – Handy, Laptop, Tablet. Ohne Cloud, ohne Konto.',
		unsupported: 'Dieser Browser kann nicht mit anderen Geräten synchronisieren. Nutze eine aktuelle Version von Chrome, Edge, Firefox oder Safari.',
		connect: 'Geräte verbinden',
		enterKey: 'Schlüssel eingeben',
		howItWorks: 'So funktioniert’s',
		addDevice: 'Gerät hinzufügen',
		chooseFolders: 'Ordner auswählen',
		syncNow: 'Jetzt synchronisieren',
		leave: 'Dieses Gerät trennen',
		removeNamed: (name) => `„${name}“ entfernen`,
		remove: 'Gerät entfernen',
		rename: 'Umbenennen',
		thisDevice: 'dieses Gerät',
		online: 'verbunden',
		syncing: (done, total) => `synchronisiere … ${done}/${total}`,
		lastSeen: (ago) => `zuletzt gesehen ${ago}`,
		lastSeenVia: (ago, via) => `zuletzt ${ago} von ${via} gesehen`,
		never: 'noch nicht gesehen',
		unreachable: 'Online, aber nicht erreichbar. Vermutlich blockiert das Netz direkte Verbindungen (z. B. Mobilfunk oder Firmen-WLAN).',
		outdated: 'Braucht ein Update: Öffne dort in-browser und lade die Seite neu.',
		newer: 'Hat eine neuere Version: Lade diese Seite neu.',
		lastSync: (ago) => `zuletzt synchronisiert ${ago}`,
		upToDate: 'aktuell',
		probablyBehind: (changes, ago) => `Wahrscheinlich nicht aktuell: ${changes} seit dem letzten Sync ${ago}.`,
		changes: (n, more) => (more ? `mehr als ${n} Änderungen` : n === 1 ? '1 Änderung' : `${n} Änderungen`),
		waiting: 'Warte auf deine anderen Geräte. Öffne in-browser auf einem davon.',
		allUpToDate: 'Alle deine Geräte sind aktuell. Änderungen wandern, sobald in-browser auf zweien davon geöffnet ist.',
		ahead: 'Hat Änderungen, die diesem Gerät noch fehlen.',
		selfAhead:
			'Eines deiner anderen Geräte hat Änderungen, die diesem Gerät noch fehlen. Öffne in-browser dort (oder auf einem Gerät, das damit synchronisiert hat), bevor du hier weiterarbeitest – sonst können Konfliktkopien entstehen.',
		selfBehind: (ago) =>
			`Dieses Gerät wurde zuletzt ${ago} synchronisiert. Öffne in-browser auf einem deiner anderen Geräte, bevor du hier weiterarbeitest – sonst können Konfliktkopien entstehen.`,
		excludedCount: (n) => (n === 1 ? '1 Ordner wird auf diesem Gerät nicht synchronisiert' : `${n} Ordner werden auf diesem Gerät nicht synchronisiert`),
		pendingDeletes: (n) => `${n} Dateien wurden auf einem anderen Gerät gelöscht. Hier auch löschen?`,
		applyDeletes: 'Hier auch löschen',
		runsWhileOpen: 'Synchronisiert wird, solange in-browser auf mindestens zwei Geräten geöffnet ist – oder ständig mit einem p2p-node auf einem Rechner oder Heimserver.',
		p2pNode: 'p2p-node einrichten',
		removeTitle: (name) => `„${name}“ entfernen?`,
		removeMessage:
			'Es kann sich nicht mehr mit deinen Geräten verbinden und bekommt nichts Neues mehr. Was es schon hat, bleibt dort – aus der Ferne löschen geht nicht.',
		leaveTitle: 'Dieses Gerät trennen?',
		leaveMessage: 'Deine Dateien bleiben hier und auf den anderen Geräten. Dieses Gerät synchronisiert nur nicht mehr; du kannst es später wieder verbinden.',
		removedTitle: 'Dieses Gerät wurde aus deinen Geräten entfernt.',
		removedMessage: 'Es synchronisiert nicht mehr. Die synchronisierten Dateien bleiben hier, bis du sie löschst.',
		resetKeep: 'Zurücksetzen, Dateien behalten',
		resetDelete: 'Dateien löschen und zurücksetzen',
		resetDeleteTitle: 'Alle Dateien auf diesem Gerät löschen und zurücksetzen?',
		resetDeleteMessage:
			'Das löscht alle Dateien unter „Meine Dateien“ auf diesem Gerät und setzt das Synchronisieren auf den Anfang zurück. Die anderen Geräte sind nicht betroffen.',
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
		scan: 'Scanne den Code mit der Kamera deines Handys oder gib den Schlüssel auf dem anderen Gerät in in-browser ein (Dateien → Deine Geräte → Schlüssel eingeben).',
		copyLink: 'Link kopieren',
		copied: 'Link kopiert.',
		validity: 'Gilt einmal, 24 Stunden lang, solange dieses Gerät online ist.',
		warning: 'Wer diesen Schlüssel hat, kann ein Gerät verbinden und alle deine synchronisierten Dateien lesen und ändern.',
		waiting: 'Warte auf das andere Gerät …',
		added: (name) => `${name} wurde hinzugefügt.`,
		addAnother: 'Weiteres Gerät hinzufügen'
	},

	shareLink: {
		title: 'Diese Freigabe öffnen?',
		message: 'Dieser Link öffnet einen Ordner oder eine Datei, die jemand mit dir teilt. Dein Browser verbindet sich direkt mit dem Gerät dieser Person und kopiert das Freigegebene auf dieses Gerät. Öffne ihn nur, wenn du weißt, von wem der Link stammt.',
		replaces: 'Die Freigabe, die jetzt in diesem Browser offen ist, wird geschlossen und ihre Kopie hier gelöscht.',
		open: 'Freigabe öffnen'
	},

	join: {
		title: 'Dieses Gerät verbinden',
		keyLabel: 'Schlüssel',
		keyPlaceholder: 'XXXX-XXXX-XXXX-XXXX-XXXX',
		invalidKey: 'Das ist kein gültiger Schlüssel (20 Zeichen).',
		confirm: 'Dieses Gerät mit deinen Geräten verbinden? Alle Dateien werden mit den anderen Geräten synchronisiert.',
		connecting: 'Verbinde … Lass in-browser auf dem Gerät geöffnet, das den Schlüssel zeigt.',
		timeout: 'Keine Antwort. Ist in-browser auf dem anderen Gerät geöffnet, und gilt der Schlüssel noch?',
	},

	explain: {
		title: 'So funktioniert’s',
		simple: 'Einfach',
		expert: 'Für Experten',
		points: [
			'Deine Geräte tauschen Dateien **direkt** miteinander aus – verschlüsselt, ohne Cloud.',
			'Synchronisiert wird, **solange mindestens zwei Geräte in-browser geöffnet haben**. Ein Tab mit einem beliebigen Tool genügt, auch im Hintergrund. Am Handy nur, solange die Seite vorne ist. Verpasstes wird nachgeholt. Eine **p2p-node** auf einem Rechner oder Heimserver synchronisiert auch, wenn kein Browser offen ist.',
			'**Jedes Gerät hat seinen eigenen Schlüssel.** Ein neues Gerät kommt nur mit einem Einmal-Schlüssel dazu, den eines deiner Geräte ausstellt. Ein verlorenes Gerät kannst du jederzeit entfernen.',
			'Pro Gerät kannst du Ordner ausnehmen. Sie bleiben dann nur dort, wo sie sind.'
		],
		diagram: 'Drei Geräte, direkt miteinander verbunden, kein Server dazwischen',
		expertSections: [
			['Transport', 'WebRTC-DataChannels (SCTP über DTLS), direkt zwischen den Geräten, jedes mit jedem. STUN über stun.cloudflare.com und stun.l.google.com, kein TURN – strenge NATs (symmetrisches NAT, CGNAT im Mobilfunk) verhindern deshalb oft eine Verbindung. Ein p2p-node nutzt die festen UDP-Ports 29400–29449 und lässt sie vom Router weiterleiten (UPnP), damit er von überall erreichbar ist.'],
			['Signaling', 'Trystero über öffentliche Nostr-Relays. Sie sehen IP-Adressen, Zeitpunkte und einen Hash des Raums; Angebote und ICE-Kandidaten sind mit einem Schlüssel aus dem Raumgeheimnis verschlüsselt. Jedes Entfernen bringt ein neues Raumgeheimnis.'],
			['Identität', 'Ed25519-Schlüsselpaar pro Gerät (WebCrypto, nicht exportierbar, IndexedDB). Die Geräte-ID ist der Fingerabdruck des öffentlichen Schlüssels. Die Anmeldung signiert eine Zufallszahl zusammen mit den DTLS-Fingerabdrücken der Verbindung, damit kein Relay dazwischen sitzen kann.'],
			['Mitglieder', 'Hash-verkettetes Protokoll signierter Einträge (create, add, remove, rename), bei jedem Kontakt zusammengeführt. Entfernen schlägt gleichzeitige Einträge des entfernten Geräts; gegenseitiges gleichzeitiges Entfernen entfernt beide. Ein Gerät, das offline war, erfährt vom Entfernen über jedes Mitglied – trifft es zuerst das entfernte Gerät, kann dieses bis dahin noch mit ihm synchronisieren.'],
			['Einmal-Schlüssel', '100 Bit, einmal und 24 Stunden gültig, nur solange das ausstellende Gerät online ist. Nachweis per HMAC über die DTLS-Fingerabdrücke in beide Richtungen.'],
			['Sync', 'Drei-Wege-Vergleich pro Gerätepaar gegen den gespeicherten Stand des letzten Syncs; das Gerät mit der kleineren ID steuert. Die neuere Fassung gewinnt, die andere wird zur Konfliktkopie; SHA-256 vermeidet unnötige Übertragungen; viele Löschungen auf einmal warten auf Bestätigung (auf jedem der beiden Geräte). Direkt vor dem Überschreiben oder Löschen wird der Stand mit dem geplanten verglichen – was sich inzwischen geändert hat, bleibt unangetastet. Löschungen und Ersetzungen anderer Geräte werden übernommen (wie bei Syncthing); was du löschst, kommt in den Papierkorb-Ordner, der wie jeder andere synchronisiert wird. Umbenennungen nur in Groß-/Kleinschreibung bleiben Umbenennungen. Ordnerauswahl = Schnittmenge beider Geräte, löst nie ein Löschen aus.'],
			['Wissensstand', 'Änderungsprotokoll mit laufenden Nummern pro Gerät und Versionsvektoren: Grundlage der Hinweise auf Geräte, die wahrscheinlich nicht aktuell sind, auch wenn sie Änderungen indirekt bekommen haben.'],
			['Speicher', 'Dateien im OPFS (dauerhafte Speicherung angefordert); Schlüssel, Mitgliederliste, Sync-Stand und Vektoren in IndexedDB.'],
			['Grenzen', 'Läuft nur in einem offenen Tab, am Handy nur im Vordergrund. Was ein entferntes Gerät schon hat, behält es. Ein p2p-node hebt die erste Grenze auf: ein Node-Prozess (WebRTC über werift), der als Gerät mitmacht und die Dateien in einem Ordner auf der Festplatte hält.']
		],
		more: 'Mehr zum Synchronisieren in der Hilfe',
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

	connect: {
		webdav: 'WebDAV-Server verbinden',
		editWebdav: 'WebDAV-Server bearbeiten',
		s3: 'S3-Speicher verbinden',
		editS3: 'S3-Speicher bearbeiten',
		webdavIntro: 'Ein Ordner auf Nextcloud, ownCloud, einem NAS oder einem anderen WebDAV-Server öffnet sich hier live – nichts wird in den Browser kopiert.',
		s3Intro: 'Ein Bucket von AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO oder anderem S3-kompatiblem Speicher öffnet sich hier live.',
		url: 'Adresse des Ordners',
		username: 'Benutzername',
		password: 'Passwort oder App-Passwort',
		provider: 'Anbieter',
		providers: { aws: 'Amazon S3', r2: 'Cloudflare R2', b2: 'Backblaze B2', wasabi: 'Wasabi', other: 'Anderer (MinIO …)' },
		region: 'Region',
		bucket: 'Bucket',
		endpoint: 'Endpunkt',
		prefix: 'Ordner im Bucket',
		prefixPlaceholder: 'leer: der ganze Bucket',
		pathStyle: 'Bucket im Pfad (Path-Style-Adressen)',
		accessKeyId: 'Zugriffsschlüssel-ID',
		secretKey: 'Geheimer Zugriffsschlüssel',
		keepSecret: 'unverändert',
		name: 'Name',
		namePlaceholder: 'optional',
		httpsOnly: 'Nur HTTPS-Adressen funktionieren (oder ein Server auf diesem Rechner).',
		secretStays: 'Das Passwort bleibt verschlüsselt auf diesem Gerät. Es wird nie synchronisiert.',
		unreachable: 'Der Server ist nicht erreichbar oder erlaubt keinen Zugriff aus dem Browser (CORS).',
		wrongCredentials: 'Der Server hat Benutzername oder Passwort nicht angenommen.',
		corsHelp: 'So richtest du es ein',
		notFound: 'Der Server hat geantwortet, aber diesen Ordner oder Bucket gibt es nicht.',
		cancel: 'Abbrechen',
		connect: 'Verbinden',
		save: 'Speichern'
	},

	scopeSetup: {
		titleFolder: (folder) => `Ordner für „${folder}“ auswählen`,
		titleDevice: 'Wähle, was dieses Gerät synchronisiert',
		hintSetup: 'Nichts wird übertragen, bis du startest. Große Ordner und solche, die nicht passen, sind abgewählt – das kannst du ändern.',
		hintFolder: 'Abgewählte Ordner bleiben, wo sie sind – in Meine Dateien und im Ordner auf deinem Rechner. Sie werden nur nicht abgeglichen.',
		hintDevice: 'Abgewählte Ordner bleiben auf deinen anderen Geräten; hier öffnest du sie live von dort.',
		comesHere: (size) => `Kommt hierher: ${size}`,
		goesThere: (size) => `Geht dorthin: ${size}`,
		free: (size) => `Frei im Browser: ${size}`,
		incoming: (size) => `${size} kommt hierher`,
		outgoing: (size) => `${size} geht dorthin`,
		toDevices: (size) => `${size} geht an deine Geräte`,
		both: (size) => `${size} auf beiden Seiten`,
		large: 'groß',
		full: 'passt nicht',
		start: 'Synchronisieren starten',
		apply: 'Übernehmen',
		later: 'Später',
		cancel: 'Abbrechen',
		waitingForDevices: 'Wartet auf deine anderen Geräte – lass in-browser auf einem davon geöffnet …',
		unreadable: 'Der Ordner auf deinem Rechner kann gerade nicht gelesen werden. Erlaube zuerst wieder den Zugriff.'
	},

	held: {
		waiting: (name, size) => `Neuer Ordner „${name}“ (${size}) wartet auf deine Bestätigung.`,
		why: (limit) => `Er ist größer als ${limit}.`,
		full: 'Er passt nicht in den freien Speicher des Browsers.',
		sync: 'Synchronisieren',
		exclude: 'Ausschließen',
		limit: 'Grenze ändern'
	},

	scope: {
		empty: 'Noch keine Ordner.',
		asking: 'Frage deine anderen Geräte …',
		failed: (error: string) => `Die Ordner konnten nicht gelesen werden: ${error}`,
		title: 'Ordner auswählen',
		hint: 'Abgewählte Ordner bleiben auf den anderen Geräten und werden dort weiter synchronisiert – nur dieses Gerät bekommt sie nicht.',
		always: 'Immer synchronisiert (Daten der Tools)',
		onlyOn: (devices) => `nur auf ${devices}`,
		excludeTitle: (name) => `„${name}“ auf diesem Gerät nicht mehr synchronisieren?`,
		excludeMessage: 'Die Kopie auf diesem Gerät wird gelöscht – der Ordner bleibt auf deinen anderen Geräten, und hier öffnest du ihn live von einem davon (es muss verbunden sein).',
		exclude: 'Auf diesem Gerät nicht synchronisieren',
		include: 'Auf diesem Gerät wieder synchronisieren',
	},

	sync: {
		title: 'Ordner auf deinem Rechner',
		intro:
			'Synchronisiere diese Dateien mit einem echten Ordner, z. B. einem, den dein Sync-Tool (Syncthing, Nextcloud, Dropbox …) auf deine anderen Rechner bringt. Die neuere Fassung gewinnt.',
		unsupported: 'Dein Browser kann nicht auf Ordner deines Rechners zugreifen. Nutze dafür Chrome oder Edge.',
		connect: 'Ordner wählen',
		connected: (folder) => `Synchronisiert mit „${folder}“`,
		paused: (folder) => `Pausiert: Der Browser braucht wieder deine Erlaubnis für „${folder}“.`,
		renew: 'Zugriff erlauben',
		renewHint: 'Tipp: Wähle „Bei jedem Besuch zulassen“, dann läuft das Synchronisieren von selbst weiter.',
		syncing: 'Wird synchronisiert …',
		syncNow: 'Jetzt synchronisieren',
		disconnect: 'Trennen',
		disconnectTitle: 'Ordner trennen?',
		disconnectMessage: (folder) =>
			`Es wird nichts gelöscht – weder hier noch in „${folder}“. Das Synchronisieren hört nur auf; du kannst jederzeit wieder einen Ordner wählen.`,
		lastSync: (time) => `Zuletzt synchronisiert ${time}`,
		failed: (n) => (n === 1 ? '1 Datei ließ sich nicht synchronisieren.' : `${n} Dateien ließen sich nicht synchronisieren.`),
		confirmDeletes: (n) => `Im Ordner auf deinem Rechner wurden ${n} Dateien gelöscht. Sollen sie auch hier gelöscht werden?`,
		applyDeletes: 'Auch hier löschen',
		restoreInstead: 'Stattdessen wiederherstellen',
		chooseFolders: 'Ordner auswählen …',
		setup: 'Wartet auf deine Auswahl: Nichts wird synchronisiert, bis du die Ordner ausgewählt hast.',
		runsWhileOpen: 'Das Synchronisieren läuft, solange ein Tool von in-browser in diesem Browser offen ist.'
	},

	trash: {
		title: 'Papierkorb',
		intro: 'Was du löschst, landet zuerst hier – auf all deinen Geräten, so kannst du es auf jedem zurückholen.',
		localOnly: 'nur auf diesem Gerät',
		elsewhere: 'Im synchronisierten Ordner auf deinem Rechner und beim p2p-node ist es der versteckte Ordner „.in-browser-trash“.',
		summary: (n, size) => (n === 1 ? `1 Element, ${size}` : `${n} Elemente, ${size}`),
		nothing: 'Der Papierkorb ist leer.',
		kept: (days) => (days === null ? 'Einträge bleiben, bis du den Papierkorb leerst.' : `Einträge bleiben ${days} Tage, dann werden sie endgültig entfernt.`),
		changeKept: 'In den Einstellungen ändern',
		from: (folder) => `aus ${folder}`,
		when: (time, size) => `gelöscht ${time} · ${size}`,
		restore: 'Wiederherstellen',
		restored: (path) => `Als „${path}“ wiederhergestellt.`,
		restoredMany: (n) => `${n} Elemente wiederhergestellt.`,
		picked: (n) => (n === 0 ? 'Wähle Elemente aus, um sie wiederherzustellen oder zu löschen' : `${n} ausgewählt`),
		remove: 'Endgültig löschen',
		removeTitle: 'Endgültig löschen?',
		removeMessage: (name) => `„${name}“ lässt sich danach nicht mehr wiederherstellen – auf keinem deiner Geräte.`,
		removeMessageMany: (n) => `${n} Elemente lassen sich danach nicht mehr wiederherstellen – auf keinem deiner Geräte.`,
		empty: 'Papierkorb leeren',
		emptyTitle: 'Papierkorb leeren?',
		emptyMessage: (n) => (n === 1 ? '1 Element wird endgültig gelöscht, auf all deinen Geräten.' : `${n} Elemente werden endgültig gelöscht, auf all deinen Geräten.`),
		more: (n) => `${n} weitere – stelle zuerst einige wieder her oder lösche sie.`,
		close: 'Schließen'
	},

	versions: {
		action: 'Frühere Versionen …',
		tip: 'Was eine Synchronisation auf diesem Gerät ersetzt hat – als Kopie wiederherstellen',
		title: (name) => `Frühere Versionen von „${name}“`,
		intro: 'Ersetzt oder löscht eine Synchronisation diese Datei, weil sie auf einem anderen Gerät oder im synchronisierten Ordner geändert wurde, bleibt die Fassung von hier erhalten – nur auf diesem Gerät.',
		none: 'Keine früheren Versionen auf diesem Gerät.',
		replaced: (time) => `ersetzt ${time}`,
		deleted: (time) => `gelöscht ${time}`,
		restore: 'Wiederherstellen',
		restored: (path) => `Als „${path}“ wiederhergestellt.`,
		open: 'Öffnen'
	},

	help
};

export default de;
