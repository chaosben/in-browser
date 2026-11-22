import { BRAND } from '../brand.js';
import type { BrandMessages } from './index.svelte.js';

const de: BrandMessages = {
	common: {
		cancel: 'Abbrechen'
	},

	tools: {
		files: 'Dateien',
		'text-editor': 'Texteditor',
		'screen-capture': 'Bildschirmaufnahme',
		'pdf-editor': 'PDF-Editor'
	},

	brand: {
		home: `Zur Übersicht von ${BRAND.suite}`,
		allTools: `Alle Tools von ${BRAND.suite}`,
		toolHome: (tool) => `Zur Startseite von ${tool}`
	},

	save: {
		saving: 'Speichert …',
		saved: 'Gespeichert',
		notSaved: 'Noch nicht gespeichert'
	},

	bar: {
		settings: 'Einstellungen'
	},

	ribbon: {
		label: 'Befehle',
		tabs: 'Registerkarten',
		file: 'Datei',
		more: 'Mehr',
		options: 'Gruppenoptionen',
		display: 'Menüband-Anzeige',
		modes: { classic: 'Klassisch', simplified: 'Vereinfacht', minimal: 'Minimal' },
		collapse: 'Menüband zusammenklappen',
		expand: 'Menüband aufklappen'
	},

	pick: {
		actions: (name) => `Aktionen für „${name}“`,
		clear: 'Auswahl aufheben',
		selectAll: 'Alles auswählen'
	},

	inspector: {
		label: 'Eigenschaften',
		close: 'Eigenschaften ausblenden',
		resize: 'Breite der Eigenschaften',
		search: 'Eigenschaften durchsuchen',
		clearSearch: 'Suche leeren',
		noMatches: 'Keine passende Eigenschaft.'
	},

	panels: {
		label: 'Seitenleisten',
		close: 'Seitenleiste schließen',
		resize: 'Breite der Seitenleiste',
		failed: 'Die Seitenleiste konnte nicht geladen werden.'
	},

	keys: {
		ctrl: 'Strg',
		shift: 'Umschalt',
		alt: 'Alt',
		named: {
			Delete: 'Entf',
			Backspace: 'Rücktaste',
			Home: 'Pos1',
			End: 'Ende',
			PageUp: 'Bild↑',
			PageDown: 'Bild↓',
			' ': 'Leertaste',
			Escape: 'Esc',
			Enter: 'Eingabe',
			ArrowLeft: '←',
			ArrowRight: '→',
			ArrowUp: '↑',
			ArrowDown: '↓'
		}
	},

	theme: {
		label: 'Darstellung',
		system: 'System',
		light: 'Hell',
		dark: 'Dunkel'
	},

	build: {
		version: (version) => `Version ${version}`,
		sourceHint: 'Quellcode auf GitHub'
	},

	help: {
		title: 'Hilfe',
		button: 'Hilfe',
		buttonTitle: 'Hilfe (F1)',
		search: 'Hilfe durchsuchen',
		noMatches: 'Nichts gefunden.',
		topics: 'Themen',
		move: 'Ziehen, um das Hilfefenster zu verschieben',
		close: 'Hilfe schließen',
		tipLabel: 'So entscheidest du',
		asPage: 'Als Seite öffnen',
		copy: 'Kopieren',
		copied: 'Kopiert'
	},

	pwa: {
		updateReady: 'Eine neue Version ist verfügbar.',
		reload: 'Neu laden',
		later: 'Später'
	}
};

export default de;
