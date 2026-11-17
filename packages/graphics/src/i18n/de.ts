import type { GraphicsMessages } from './index.svelte.js';

const de: GraphicsMessages = {
	color: {
		none: 'Keine',
		opacity: 'Deckkraft',
		value: (c) => `Farbe ${c}`,
		custom: 'Eigene Farbe',
		recent: 'Zuletzt genutzte und Projektfarben',
		paletteHint: 'Farbe hierher ziehen, um sie zu ersetzen',
		resetPalette: 'Standardfarben wiederherstellen'
	},

	icons: {
		searchSet: (set) => `${set} durchsuchen (englische Namen)`,
		source: 'Icon-Set',
		variant: 'Stil',
		category: 'Kategorie',
		all: 'Alle',
		insert: (name) => `Icon ${name} einfügen`,
		categories: { arrows: 'Pfeile', notices: 'Hinweise', status: 'Status', input: 'Maus & Tastatur', objects: 'Objekte', people: 'Personen' },
		noResults: 'Kein passendes Icon.',
		count: (n) => `${n.toLocaleString('de')} Icons`,
		load: (size) => `Alle Icons laden (ca. ${size.replace('.', ',')})`,
		loadHint: (count) =>
			`Lädt einmalig rund ${count.toLocaleString('de')} Icons – danach bleiben sie im Browser gespeichert und funktionieren auch offline. Dann lässt sich auch nach Stil filtern.`,
		license: (set, license) => `${set} · ${license}-Lizenz`,
		offline: 'Zum Laden eines Icon-Sets braucht es eine Internetverbindung.',
		loadFailed: (error) => `Die Icons konnten nicht geladen werden: ${error}`
	}
};

export default de;
