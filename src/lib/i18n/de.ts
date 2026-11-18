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
		searchLabel: 'Tools suchen',
		searchPlaceholder: 'Tools suchen …',
		noMatch: (query) => `Kein Tool passt zu „${query}“.`,
		recent: 'Zuletzt benutzt',
		principlesHeading: 'Warum in-browser?'
	},

	categories: {
		media: 'Medien',
		writing: 'Schreiben',
		drawing: 'Zeichnen',
		organize: 'Organisieren'
	},

	principles: {
		local: { title: 'Keine Uploads', text: 'deine Dateien bleiben auf deinem Gerät' },
		account: { title: 'Kein Konto', text: 'Seite öffnen und loslegen' },
		tracking: { title: 'Kein Tracking', text: 'keine Cookies, keine Werbung' },
		devices: { title: 'Abgleich ohne Cloud', text: 'direkt zwischen deinen Geräten' },
		offline: { title: 'Installierbar & offline', text: 'läuft auch ohne Internet' },
		openSource: { title: 'Open Source', text: 'MIT-Lizenz', link: 'Quellcode auf GitHub' }
	},

	footer: {
		openSource: 'Open Source auf GitHub',
		licenses: 'Lizenzen'
	},

	requires: {
		displayCapture: { legend: 'Läuft nur am Computer', label: '(nur am Computer)' }
	},

	tools: {
		screenCapture: {
			name: 'Screen Capture',
			summary: 'Bildschirm aufnehmen, bearbeiten und als Video oder GIF exportieren',
			keywords: 'aufnehmen, aufzeichnen, bildschirmaufnahme, bildschirmvideo, video, webcam, mikrofon, schneiden, anleitung'
		},
		files: {
			name: 'Files',
			summary: 'Deine Dateien verwalten, abgleichen und herunterladen',
			keywords: 'dateien, dateimanager, explorer, ordner, abgleich, synchronisieren, hochladen, herunterladen, vorschau, geräte'
		},
		textEditor: {
			name: 'Text Editor',
			summary: 'Markdown, JSON, YAML und Code mit Syntax-Hervorhebung bearbeiten',
			keywords: 'texteditor, textdatei, notizblock, markdown, json, yaml, csv, code, quelltext'
		},
		notes: {
			name: 'Notes',
			summary: 'Handschriftliche Notizbücher für Stift, Finger oder Maus',
			keywords: 'notizen, handschrift, notizbuch, stift, eingabestift, skizzieren, zeichnen, pdf, kommentieren, tafel'
		}
	},

	error: {
		notFound: 'Diese Seite gibt es nicht.',
		other: 'Etwas ist schiefgelaufen.',
		back: 'Zur Übersicht'
	}
};

export default de;
