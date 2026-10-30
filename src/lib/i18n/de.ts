import type { Messages } from './index.svelte.js';

const de: Messages = {
	brand: {
		claim: 'Werkzeuge, die komplett im Browser laufen',
		description:
			'Kostenlose Werkzeuge, die komplett im Browser laufen: keine Uploads, kein Konto – deine Dateien bleiben auf deinem Gerät.'
	},

	home: {
		title: 'Werkzeuge, die komplett im Browser laufen',
		tagline: 'Keine Uploads, kein Konto – deine Dateien bleiben auf deinem Gerät.',
		toolsHeading: 'Tools',
		open: 'Öffnen',
		openTool: (name) => `${name} öffnen`,
		principlesHeading: 'Warum in-browser?'
	},

	principles: {
		local: {
			title: 'Keine Uploads',
			text: 'Alles wird direkt auf deinem Gerät verarbeitet. Deine Dateien verlassen nie den Browser.'
		},
		account: {
			title: 'Kein Konto',
			text: 'Seite öffnen und loslegen – ohne Anmeldung, ohne E-Mail-Adresse.'
		},
		tracking: {
			title: 'Kein Tracking',
			text: 'Keine Cookies, keine Analyse-Dienste, keine Werbung.'
		},
		offline: {
			title: 'Installierbar & offline',
			text: 'Jedes Tool lässt sich als App installieren und funktioniert danach auch ohne Internet.'
		},
		openSource: {
			title: 'Open Source',
			text: 'Der gesamte Code ist öffentlich unter MIT-Lizenz – prüf selbst, was mit deinen Dateien passiert.',
			link: 'Quellcode auf GitHub'
		}
	},

	footer: {
		openSource: 'Open Source auf GitHub'
	},

	requiresHint: {
		desktopBrowser: 'Läuft in aktuellen Desktop-Browsern – am besten in Chrome oder Edge',
		anyBrowser: 'Läuft in aktuellen Browsern – der Abgleich mit einem Ordner braucht Chrome oder Edge'
	},

	requires: {
		desktopBrowser: 'Desktop-Browser',
		anyBrowser: 'Jeder aktuelle Browser'
	},

	tools: {
		screenCapture: {
			name: 'Screen Capture',
			description:
				'Bildschirm aufnehmen, auf mehreren Spuren bearbeiten und als MP4, WebM oder GIF exportieren – wie ein kleines Camtasia im Browser.',
			features: [
				'Bildschirm, Webcam und Mikrofon gleichzeitig aufnehmen – als verknüpfte, getrennte Spuren',
				'Bearbeiten auf mehreren Spuren: Bild im Bild, Musik und Sprecher mit eigener Lautstärke',
				'Schneiden, Standbilder und Pan & Zoom – synchron über alle Spuren',
				'Pfeile, Rahmen, Text, Textmarker, Spotlight und Weichzeichner',
				'Export als MP4 oder WebM in wählbarer Auflösung und Qualität oder als GIF'
			]
		},
		files: {
			name: 'Files',
			description:
				'Der Dateimanager für alles, was du mit den Tools von in-browser erstellst – und die Brücke zu einem Ordner auf deinem Rechner.',
			features: [
				'Ordner, Umbenennen, Kopieren, Verschieben, Löschen – mit Drag & Drop und Rechtsklick',
				'Dateien und Ordner hochladen, als Datei oder ZIP herunterladen',
				'Vorschau für Bilder, Videos, Ton und Text',
				'Öffnet Projekte direkt in ihrem Tool',
				'Gleicht alles mit einem Ordner auf deinem Rechner ab – die neuere Fassung gewinnt'
			]
		},
		textEditor: {
			name: 'Text Editor',
			description:
				'Notizen, Markdown, JSON, YAML, CSV und Code bearbeiten – mit Tabs, Syntax-Hervorhebung und Live-Vorschau für Markdown.',
			features: [
				'Mehrere Dateien nebeneinander in Tabs, ungespeicherte Änderungen überstehen das Schließen des Browsers',
				'Syntax-Hervorhebung für Markdown, JSON, YAML, HTML, CSS, JavaScript, Python, Shell und mehr',
				'Suchen und Ersetzen, mehrere Cursor, Zeilenumbruch',
				'Behält Kodierung und Zeilenenden – UTF-8, UTF-16 und Windows-1252, mit oder ohne BOM',
				'Öffnet Textdateien aus Files per Doppelklick und merkt, wenn sie woanders geändert werden'
			]
		}
	},

	error: {
		notFound: 'Diese Seite gibt es nicht.',
		other: 'Etwas ist schiefgelaufen.',
		back: 'Zur Übersicht'
	}
};

export default de;
