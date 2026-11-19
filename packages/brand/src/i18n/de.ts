import { BRAND } from '../brand.js';
import type { BrandMessages } from './index.svelte.js';

const de: BrandMessages = {
	common: {
		cancel: 'Abbrechen'
	},

	tools: {
		files: 'Dateien',
		notes: 'Notizen',
		'text-editor': 'Texteditor',
		'screen-capture': 'Bildschirmaufnahme'
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
		actions: (name) => `Aktionen für „${name}“`,
		rename: 'Zum Umbenennen klicken'
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
