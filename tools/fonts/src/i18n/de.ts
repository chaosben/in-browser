import type { Messages } from './index.js';
import help from './help.de.js';

const de: Messages = {
	common: {
		cancel: 'Abbrechen'
	},

	brand: {
		description: 'Deine eigenen Schriften für jedes Tool von in-browser – aus deinen Dateien hinzugefügt oder aus einem Katalog freier Schriften installiert, aufbewahrt bei deinen Dateien.'
	},

	ribbon: {
		tabs: { home: 'Start' },
		groups: { add: 'Hinzufügen', organize: 'Organisieren', preview: 'Vorschau', select: 'Auswahl' }
	},

	commands: {
		addFromFiles: 'Aus Dateien hinzufügen …',
		addFromFilesTip: 'Schriftdateien (TrueType, OpenType) aus deinen Dateien werden zu Schriften jedes Tools',
		addFromComputer: 'Vom Rechner importieren …',
		catalog: 'Online suchen',
		catalogTip: 'Freie Schriften aus dem Katalog von Fontsource – nur durchsucht, wenn du es willst',
		remove: 'Löschen',
		open: 'Öffnen',
		selectAll: 'Alles auswählen',
		clearSelection: 'Auswahl aufheben',
		sample: 'Beispieltext',
		sampleDefault: 'Franz jagt im komplett verwahrlosten Taxi quer durch Bayern',
		size: 'Größe',
		install: 'Installieren',
		installed: 'Installiert',
		myFonts: 'Meine Schriften'
	},

	home: {
		search: 'Schrift suchen',
		empty: 'Du hast noch keine eigenen Schriften. Füge Schriftdateien aus deinen Dateien oder vom Rechner hinzu oder durchsuche den Katalog online.',
		noMatch: 'Keine Schrift passt.',
		faces: (n: number) => (n === 1 ? '1 Datei' : `${n} Dateien`),
		count: (n: number) => (n === 1 ? '1 Schrift' : `${n} Schriften`),
		picked: (n: number) => `${n} ausgewählt`,
		added: (n: number) => (n === 1 ? 'Schrift hinzugefügt' : `${n} Schriftdateien hinzugefügt`),
		notFonts: 'Diese Dateien sind keine verwendbaren Schriften (TrueType oder OpenType).',
		dropHint: 'Oder zieh Schriftdateien hierher.'
	},

	family: {
		missing: 'Diese Schrift ist (nicht mehr) unter deinen Schriften.',
		faces: { regular: 'Normal', bold: 'Fett', italic: 'Kursiv', boldItalic: 'Fett kursiv' },
		used: 'Verwendet für',
		notUsed: 'Nicht verwendet',
		style: 'Schnitt',
		weight: 'Stärke',
		file: 'Datei',
		glyphs: 'Zeichen',
		version: 'Version',
		designer: 'Gestaltung',
		copyright: 'Urheberrecht',
		license: 'Lizenz',
		embedding: 'Sagt über sich',
		embeddings: {
			installable: 'Darf in Dokumente eingebettet werden',
			editable: 'Darf in bearbeitbare Dokumente eingebettet werden',
			preview: 'Darf nur zum Ansehen und Drucken eingebettet werden',
			restricted: 'Bittet, nicht in Dokumente eingebettet zu werden'
		},
		embeddingHint: 'in-browser zeigt, was die Datei sagt, hält dich aber nicht ab: Ob du eine Schrift verwenden darfst, regeln du und ihre Lizenz.',
		removed: (name: string) => `„${name}“ gelöscht`
	},

	file: {
		missing: 'Diese Datei gibt es nicht mehr.',
		notFont: 'Diese Datei ist keine verwendbare Schrift (TrueType oder OpenType).',
		install: 'Zu meinen Schriften hinzufügen',
		already: 'Diese Datei ist eine deiner Schriften.',
		added: (name: string) => `„${name}“ ist jetzt eine deiner Schriften`
	},

	catalog: {
		title: 'Katalog',
		privacy:
			'Suchen und Installieren fragen bei Fontsource (api.fontsource.org) nach, die Dateien kommen von jsDelivr: Sie sehen deine IP-Adresse, wonach du suchst und welche Schrift du installierst. Von deinen Dateien wird nichts gesendet. Vor dem Suchen wird nichts gefragt.',
		search: 'Suchen',
		category: 'Art der Schrift',
		allCategories: 'Alle',
		placeholder: 'Name einer Schrift',
		searching: 'Suche läuft …',
		results: (n: number) => (n === 1 ? '1 Schrift' : `${n} Schriften`),
		more: (n: number) => `Die ersten ${n} – tippe mehr, um einzugrenzen.`,
		none: 'Keine Schrift dieses Namens im Katalog.',
		failed: (error: string) => `Der Katalog ist nicht erreichbar: ${error}`,
		categories: { 'sans-serif': 'Serifenlos', serif: 'Serifen', display: 'Auszeichnung', handwriting: 'Handschrift', monospace: 'Feste Breite', other: 'Andere' } as Record<string, string>,
		styles: (n: number) => (n === 1 ? '1 Schnitt' : `${n} Schnitte`),
		subset: 'Zeichen',
		subsetHint: 'Jede Datei enthält einen Zeichensatz: Wähle den, den deine Sprache braucht („latin“ deckt westeuropäische Sprachen ab, „latin-ext“ den Rest Europas).',
		preview: 'Die Vorschau wird geladen …',
		installing: 'Wird installiert …',
		installed: (name: string) => `„${name}“ ist installiert`,
		license: (license: string) => `Lizenz: ${license}`
	},

	help
};

export default de;
