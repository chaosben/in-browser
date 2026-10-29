import { BRAND } from '../brand.js';
import type { BrandMessages } from './index.svelte.js';

const de: BrandMessages = {
	common: {
		cancel: 'Abbrechen'
	},

	brand: {
		home: `Zur Übersicht von ${BRAND.suite}`,
		allTools: `Alle Tools von ${BRAND.suite}`,
		toolHome: (tool) => `Zur Startseite von ${tool}`
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

	pwa: {
		updateReady: 'Eine neue Version ist verfügbar.',
		reload: 'Neu laden',
		later: 'Später'
	}
};

export default de;
