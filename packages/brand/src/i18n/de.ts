import { BRAND } from '../brand.js';
import type { BrandMessages } from './index.svelte.js';

const de: BrandMessages = {
	brand: {
		home: `Zur Übersicht von ${BRAND.suite}`,
		allTools: `Alle Tools von ${BRAND.suite}`,
		toolHome: (tool) => `Zur Startseite von ${tool}`,
		localOnly: 'Läuft lokal im Browser',
		localOnlyHint: 'Keine Uploads – deine Dateien bleiben auf deinem Gerät.'
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
		install: 'Installieren',
		installHint: 'Als App installieren – startet wie ein Programm und funktioniert auch offline.',
		updateReady: 'Eine neue Version ist verfügbar.',
		reload: 'Neu laden',
		later: 'Später'
	}
};

export default de;
