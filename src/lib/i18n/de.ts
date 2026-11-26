import brand from '@in-browser/brand/i18n/de.js';
import help from './help.de.js';
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
		organize: 'Organisieren',
		special: 'Spezial-Editoren'
	},

	principles: {
		local: { title: 'Keine Uploads', text: 'deine Dateien bleiben auf deinem Gerät' },
		account: { title: 'Kein Konto', text: 'Seite öffnen und loslegen' },
		tracking: { title: 'Kein Tracking', text: 'keine Cookies, keine Werbung' },
		devices: { title: 'Sync ohne Cloud', text: 'direkt zwischen deinen Geräten' },
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
			name: brand.tools['screen-capture'],
			summary: 'Bildschirm aufnehmen, bearbeiten und als Video oder GIF exportieren',
			keywords: 'screen capture, aufnehmen, aufzeichnen, bildschirmaufnahme, bildschirmvideo, video, webcam, mikrofon, schneiden, anleitung'
		},
		files: {
			name: brand.tools['files'],
			summary: 'Deine Dateien verwalten, synchronisieren und herunterladen',
			keywords: 'files, dateimanager, explorer, ordner, abgleich, synchronisieren, hochladen, herunterladen, vorschau, geräte'
		},
		textEditor: {
			name: brand.tools['text-editor'],
			summary: 'Markdown, JSON, YAML und Code mit Syntax-Hervorhebung bearbeiten',
			keywords: 'text editor, textdatei, notizblock, markdown, json, yaml, csv, code, quelltext'
		},
		pdfEditor: {
			name: brand.tools['pdf-editor'],
			summary: 'PDFs beschreiben und kommentieren, Formulare ausfüllen, Seiten ordnen',
			keywords: 'pdf editor, pdf, kommentieren, markieren, hervorheben, stempel, drucken, formular, ausfüllen, zusammenführen, teilen, seiten, drehen, acrobat, betrachter, handschrift, notizbuch, stift, eingabestift, skizzieren, zeichnen'
		},
		fonts: {
			name: brand.tools['fonts'],
			summary: 'Eigene Schriften für jedes Tool hinzufügen oder freie installieren',
			keywords: 'fonts, schrift, schriften, schriftart, ttf, otf, installieren, google fonts, fontsource, typografie'
		},
		'jwl-files': {
			name: brand.tools['jwl-files'],
			summary: 'Sicherungen und Playlists von JW Library zusammenführen, aufräumen und bearbeiten',
			keywords: 'jw library, jwlibrary, jwlplaylist, sicherung, backup, zusammenführen, notizen, markierungen, lesezeichen, tags, playlist, jwl files, jwl-dateien'
		}
	},

	error: {
		notFound: 'Diese Seite gibt es nicht.',
		other: 'Etwas ist schiefgelaufen.',
		back: 'Zur Übersicht'
	},

	help
};

export default de;
