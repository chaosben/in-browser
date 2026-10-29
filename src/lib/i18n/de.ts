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
		principlesHeading: 'Warum in-browser.de?'
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
		desktopBrowser: 'Läuft in aktuellen Desktop-Browsern – am besten in Chrome oder Edge'
	},

	requires: {
		desktopBrowser: 'Desktop-Browser'
	},

	tools: {
		screenCapture: {
			name: 'Screen Capture',
			description:
				'Bildschirm aufnehmen, auf mehreren Spuren bearbeiten und als MP4 exportieren – wie ein kleines Camtasia im Browser.',
			features: [
				'Bildschirm, Webcam und Mikrofon gleichzeitig aufnehmen – als verknüpfte, getrennte Spuren',
				'Bearbeiten auf mehreren Spuren: Bild im Bild, Musik und Sprecher mit eigener Lautstärke',
				'Schneiden, Standbilder und Pan & Zoom – synchron über alle Spuren',
				'Pfeile, Rahmen, Text, Textmarker, Spotlight und Weichzeichner',
				'Export als MP4 in wählbarer Auflösung und Qualität'
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
