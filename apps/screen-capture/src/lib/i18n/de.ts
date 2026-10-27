import type { Messages } from './index.js';

const de: Messages = {
	common: {
		cancel: 'Abbrechen',
		close: 'Schließen',
		delete: 'Löschen',
		open: 'Öffnen',
		done: 'Fertig',
		untitled: 'Unbenannt',
		denied: 'Zugriff wurde verweigert.',
		aborted: 'Abgebrochen.',
		saving: 'Speichert …',
		saved: 'Gespeichert',
		importing: (name) => `Importiere ${name} …`,
		recordingName: (time) => `Aufnahme ${time}`
	},

	brand: {
		partOf: 'Teil von',
		suiteClaim: 'Werkzeuge, die komplett im Browser laufen',
		description:
			'Bildschirm aufnehmen, mit Markierungen, Text, Standbildern und Zoom bearbeiten und als MP4 exportieren – kostenlos und komplett im Browser.'
	},

	home: {
		tagline: 'Bildschirm aufnehmen, schneiden und als MP4 exportieren – komplett im Browser, nichts verlässt deinen Rechner.',
		unsupported: (missing) =>
			`Dieser Browser unterstützt nicht alles, was die App braucht (${missing}). Bitte einen aktuellen Desktop-Browser verwenden (empfohlen: Chrome oder Edge).`,
		screenCapture: 'Bildschirmaufnahme',
		newRecording: 'Neue Aufnahme',
		importVideo: 'Video importieren',
		openFolder: 'Projektordner öffnen',
		projects: 'Projekte',
		storage: (used, quota) => `${used} GB von ${quota} GB belegt`,
		empty: 'Noch keine Projekte. Starte eine Aufnahme, importiere ein Video oder ziehe eine Videodatei hierher.',
		changed: (date) => `geändert ${date}`,
		confirmDelete: (name) => `Projekt „${name}“ mit allen Aufnahmen löschen?`,
		footer:
			'Projekte werden im Speicher dieses Browsers abgelegt. Zum Sichern oder Weitergeben im Editor „Als Ordner speichern“ verwenden.',
		dropToCreate: 'Loslassen, um ein neues Projekt aus dem Video zu erstellen'
	},

	record: {
		title: 'Neue Aufnahme',
		intro:
			'Nach dem Klick auf „Bildschirm wählen“ fragt der Browser, welcher Bildschirm, welches Fenster oder welcher Tab aufgenommen werden soll.',
		microphone: 'Mikrofon aufnehmen',
		systemAudio: 'System-/Tab-Ton aufnehmen',
		systemAudioHint: 'Funktioniert nur unter Windows oder bei der Aufnahme eines Browser-Tabs.',
		countdown: '3 Sekunden Countdown',
		frameRate: 'Bildrate',
		chooseScreen: 'Bildschirm wählen',
		startingSoon: 'Aufnahme startet gleich …',
		recording: 'Aufnahme läuft',
		paused: 'Pausiert',
		finalizing: 'Wird gespeichert …',
		stopHint: 'Du kannst die Aufnahme auch über „Freigabe beenden“ in der Leiste des Browsers stoppen.',
		pause: 'Pause',
		resume: 'Fortsetzen',
		stop: 'Stopp',
		discard: 'Verwerfen',
		saveFailed: (error) => `Aufnahme konnte nicht gespeichert werden: ${error}`,
		noMicrophone: 'Kein Zugriff auf das Mikrofon – es wird ohne Mikrofon aufgenommen.',
		noSystemAudio: 'Der Browser hat keinen System-/Tab-Ton freigegeben.',
		noScreen: 'Kein Bildschirm ausgewählt.',
		noVideoEncoder: 'Dieser Browser kann kein Video kodieren (WebCodecs fehlt).',
		noAudioEncoder: 'Dieser Browser kann keinen Ton kodieren – es wird ohne Ton aufgenommen.',
		failed: (error) => `Aufnahmefehler: ${error}`,
		camera: 'Webcam aufnehmen',
		separateTracksHint: 'Webcam und Mikrofon werden eigene, verknüpfte Spuren (Bild im Bild, eigene Lautstärke).',
		noCamera: 'Kein Zugriff auf die Webcam – Aufnahme ohne Webcam.',
		microphoneDevice: 'Mikrofon',
		cameraDevice: 'Webcam',
		defaultDevice: 'Standardgerät',
		deviceFallback: (kind, n) => `${kind} ${n}`,
		level: 'Mikrofonpegel',
		tabs: { screen: 'Bildschirm', systemAudio: 'Systemton', microphone: 'Mikrofon', camera: 'Webcam' },
		filters: {
			echoCancellation: 'Echounterdrückung',
			noiseSuppression: 'Rauschunterdrückung',
			autoGainControl: 'Automatische Pegelanpassung'
		},
		filtersHint: 'Für Sprache gedacht – bei Musik oder Spielton ausschalten.',
		videoQuality: 'Qualität',
		resolution: 'Auflösung',
		audioQuality: 'Tonqualität',
		sizePerMinute: (mb) => `ca. ${mb} MB pro Minute`,
		cameraPreview: 'Webcam-Vorschau',
		cameraName: (time) => `Webcam ${time}`,
		micName: (time) => `Mikrofon ${time}`
	},

	export: {
		title: 'Video exportieren',
		resolution: 'Auflösung',
		original: (w, h) => `Original (${w}×${h})`,
		quality: 'Qualität',
		qualities: { low: 'Niedrig', medium: 'Mittel', high: 'Hoch', 'very-high': 'Sehr hoch', custom: 'Benutzerdefiniert' },
		bitrate: 'Bitrate',
		frameRate: 'Bildrate',
		audio: 'Ton',
		noAudio: 'Ohne Ton',
		output: 'Ausgabe',
		duration: 'Dauer',
		videoBitrate: 'Video-Bitrate',
		estimatedSize: 'Geschätzte Größe',
		export: 'Exportieren',
		rendering: 'Video wird gerendert …',
		finalizing: 'Datei wird abgeschlossen …',
		keepTabOpen: 'Bitte diesen Tab geöffnet lassen.',
		finished: 'Export fertig – der Download sollte automatisch starten.',
		renderedIn: (time) => `gerendert in ${time}`,
		otherSettings: 'Andere Einstellungen',
		downloadAgain: 'Erneut herunterladen',
		canceled: 'Export abgebrochen',
		cannotEncode: (w, h) => `Der Browser kann ${w}×${h} nicht kodieren. Bitte eine kleinere Auflösung wählen.`,
		frameRateUnsupported: (w, h) => `Die gewählte Bildrate wird bei ${w}×${h} nicht unterstützt.`,
		emptyTimeline: 'Die Timeline ist leer.',
		noCanvas: 'Canvas nicht verfügbar.',
		missingSource: 'Quelle fehlt im Projekt.',
		noVideoTrack: 'Quelle ohne Videospur.'
	},

	editor: {
		title: 'Editor',
		loadFailed: (error) => `Projekt konnte nicht geladen werden: ${error}`,
		backToOverview: 'Zur Übersicht',
		projectName: 'Projektname',
		addRecording: 'Aufnahme hinzufügen',
		importVideo: 'Video importieren',
		saveFolder: 'Als Ordner speichern',
		savedToFolder: (name) => `Projekt im Ordner „${name}“ gespeichert`,
		export: 'Exportieren',
		recordingAdded: 'Aufnahme hinzugefügt',
		add: (what) => `${what} hinzufügen`,
		dragHint: 'Klicken: am Abspielkopf einfügen · Ziehen: in Vorschau oder Timeline ablegen',
		zoomSegment: 'Zoom-Abschnitt',
		holdFrame: 'Frame halten',
		holdFrameTitle: 'Frame am Abspielkopf halten (F)',
		freezeDuration: 'Dauer des Standbilds',
		playheadAtEnd: 'Der Abspielkopf steht am Ende – bitte weiter vorne platzieren.',
		zoomExists: 'An dieser Stelle liegt schon ein Zoom-Abschnitt.',
		properties: 'Eigenschaften',
		toStart: 'Zum Anfang',
		play: 'Abspielen',
		pause: 'Pause',
		split: 'Teilen',
		delete: 'Löschen',
		deleteTitle: 'Auswahl löschen – Späteres rückt nach (Umschalt: Lücke lassen)',
		undo: 'Rückgängig',
		redo: 'Wiederholen',
		dropToImport: 'Zum Importieren loslassen',
		playbackFailed: (reason) => `Wiedergabe nicht möglich: ${reason}`,
		nothingToPlay: (duration) => `Die Timeline hat keine abspielbare Länge (${duration}).`
	},

	tools: {
		groups: { media: 'Medien', annotations: 'Markierungen', text: 'Text', zoom: 'Zoom' },
		collapse: 'Seitenleiste einklappen',
		dropHint: 'Oder Videodateien einfach auf den Editor ziehen.'
	},

	keys: { del: 'Entf' },

	timeline: {
		zoom: 'Zoom',
		zoomLabel: 'Timeline-Zoom',
		fitAll: 'Alles zeigen',
		hint: 'Strg + Mausrad zoomt · Klick wählt verknüpfte Clips (Alt: nur diesen, Strg/Umschalt: hinzufügen) · ziehen zum Verschieben oder auf eine andere Spur · Kanten ziehen zum Trimmen (Umschalt: Rest bleibt stehen)',
		hideTrack: 'Spur ausblenden (kein Bild, kein Ton)',
		muteTrack: 'Spur stumm schalten',
		lockTrack: 'Spur sperren',
		zoomTrack: 'Zoom-Spur',
		newTrack: 'Neue Spur ganz vorne',
		track: (n) => `Spur ${n}`,
		front: 'vorne',
		moveStart: 'Anfang verschieben',
		moveEnd: 'Ende verschieben',
		zoomSegment: 'Zoom-Abschnitt',
		freeze: 'Standbild',
		missingSource: 'Quelle fehlt',
		trimStart: 'Anfang trimmen',
		trimEnd: 'Ende trimmen',
		changeDuration: 'Dauer ändern'
	},

	inspector: {
		text: 'Text',
		fontSize: 'Schriftgröße',
		background: 'Hintergrund',
		none: 'Keiner',
		opacity: 'Deckkraft',
		color: 'Farbe',
		colorValue: (c) => `Farbe ${c}`,
		customColor: 'Eigene Farbe',
		recentColors: 'Zuletzt verwendete und Projektfarben',
		lineWidth: 'Linienstärke',
		radius: 'Eckenradius',
		strength: 'Stärke',
		blurArea: 'Weichzeichnen',
		blurInside: 'Bereich',
		blurOutside: 'Umgebung',
		start: 'Start (s)',
		duration: 'Dauer (s)',
		fade: 'Weich ein- und ausblenden',
		shadow: 'Schatten',
		font: 'Schrift',
		dashed: 'Gestrichelt',
		stepNumber: 'Nummer',
		size: 'Größe',
		zoomSegment: 'Zoom-Abschnitt',
		zoomHint: 'Den Ausschnitt in der Vorschau verschieben oder an den Ecken größer und kleiner ziehen.',
		zoomLevel: 'Zoomstufe',
		ease: 'Übergang',
		freeze: 'Standbild',
		clip: 'Clip',
		audioClip: 'Tonclip',
		source: 'Quelle',
		range: 'Von – bis',
		frameAt: 'Frame bei',
		nothing: 'Nichts ausgewählt.',
		nothingHint:
			'Klicke einen Clip, eine Markierung oder einen Zoom-Abschnitt in der Timeline an, oder füge über die Leiste links etwas Neues hinzu.',
		shortcuts: {
			split: 'Teilen',
			hold: 'Frame halten',
			delete: 'Löschen',
			deleteGap: 'Löschen, Lücke lassen',
			deselect: 'Auswahl aufheben'
		},
		project: 'Projekt',
		placement: 'Position im Bild',
		fit: 'Einpassen',
		fill: 'Füllen',
		placementHint:
			'In der Vorschau verschieben oder an den Ecken größer und kleiner ziehen (Bild im Bild). Bildfüllende Clips per Doppelklick in der Vorschau auswählen.',
		shape: 'Form',
		shapeRect: 'Rechteck',
		shapeRounded: 'Abgerundet',
		shapeCircle: 'Kreis',
		volume: 'Lautstärke',
		mute: 'Stumm',
		unlink: 'Verknüpfung lösen',
		selected: (n) => `${n} Elemente ausgewählt`,
		alsoSelected: (n) => `${n} weitere mit ausgewählt (verknüpft) – werden gemeinsam verschoben und gelöscht. Alt+Klick wählt einzeln.`,
		multipleHint: 'In der Timeline ziehen verschiebt sie gemeinsam. Teilen, Frame halten und Löschen wirken auf alle.'
	},

	kinds: {
		arrow: 'Pfeil',
		rect: 'Rahmen',
		highlight: 'Textmarker',
		spotlight: 'Spotlight',
		blur: 'Weichzeichnen',
		text: 'Text',
		line: 'Linie',
		ellipse: 'Ellipse',
		step: 'Schritt',
		stepN: (n) => `Schritt ${n}`,
		callout: 'Sprechblase'
	},

	fonts: {
		system: 'Systemschrift'
	},

	mediaBin: {
		dragHint: 'In die Timeline ziehen, um an dieser Stelle einzufügen',
		empty: 'Noch keine Medien.',
		noAudio: 'ohne Ton',
		insert: 'Einfügen',
		insertTitle: 'Am Abspielkopf einfügen (vor allem, was dort liegt)',
		deleteForever: 'Endgültig löschen',
		audioOnly: 'nur Ton',
		inUse: 'Wird in der Timeline verwendet',
		confirmDelete: (name) => `„${name}“ endgültig löschen? Das kann nicht rückgängig gemacht werden.`,
		confirmDeleteHistory: (name) =>
			`„${name}“ endgültig löschen? Rückgängig-Schritte, die diese Datei noch verwenden, gehen dabei verloren. Das kann nicht rückgängig gemacht werden.`
	},

	preview: {
		zoom: (level) => `${level}× Zoom`
	},

	errors: {
		noMediaTrack: 'Die Datei enthält weder eine Video- noch eine Tonspur.',
		fontFailed: (font, error) => `Schrift „${font}“ konnte nicht geladen werden: ${error}`,
		codecUnsupported: (codec) => `Der Videocodec „${codec}“ kann von diesem Browser nicht dekodiert werden.`,
		unsupportedFormat: (name) => `„${name}“ ist kein unterstütztes Videoformat.`,
		cannotImport: (reasons) => `Die Datei kann nicht übernommen werden (${reasons}).`,
		noProjectJson: (folder) => `Im Ordner „${folder}“ wurde keine project.json gefunden.`,
		unknownFormat: 'Unbekanntes Projektformat.',
		newerVersion: 'Das Projekt stammt aus einer neueren Version der App.',
		cannotPlay: (name) => `Quelle „${name}“ lässt sich nicht abspielen.`
	}
};

export default de;
