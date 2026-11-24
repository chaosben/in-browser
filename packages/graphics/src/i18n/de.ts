import type { GraphicsMessages } from './index.svelte.js';

const de: GraphicsMessages = {
	barcode: {
		kind: 'Art',
		groups: { matrix: '2D-Codes', retail: 'Handel', industry: 'Logistik und Industrie', post: 'Post', more: 'Weitere' },
		names: {
			qrcode: 'QR-Code',
			microqrcode: 'Micro-QR-Code',
			swissqrcode: 'Swiss-QR-Code',
			gs1qrcode: 'GS1-QR-Code',
			datamatrixrectangular: 'Data Matrix (rechteckig)',
			code39ext: 'Code 39 (voller ASCII-Satz)'
		},
		content: 'Inhalt',
		contentAs: 'Inhalt als',
		templates: { text: 'Text', url: 'Webadresse', wifi: 'WLAN', contact: 'Kontakt', email: 'E-Mail', phone: 'Telefonnummer', sms: 'SMS' },
		fields: {
			text: 'Text',
			url: 'Adresse',
			ssid: 'Name des Netzwerks',
			password: 'Passwort',
			security: 'Sicherheit',
			hidden: 'Verstecktes Netzwerk',
			name: 'Name',
			org: 'Firma',
			phone: 'Telefonnummer',
			email: 'E-Mail-Adresse',
			address: 'Anschrift',
			subject: 'Betreff',
			body: 'Nachricht',
			message: 'Nachricht'
		},
		securities: { WPA: 'WPA, WPA2, WPA3', WEP: 'WEP', nopass: 'Keine' },
		color: 'Farbe',
		background: 'Hintergrund',
		ecc: 'Fehlerkorrektur',
		eccLevels: { L: 'Niedrig (7 %)', M: 'Mittel (15 %)', Q: 'Hoch (25 %)', H: 'Sehr hoch (30 %)' },
		eccLevel: (level) => `Stufe ${level}`,
		showText: 'Text anzeigen',
		quiet: 'Ruhezone',
		problems: {
			empty: 'Gib ein, was der Code enthalten soll.',
			characters: 'Diese Art nimmt einige dieser Zeichen nicht.',
			length: 'Diese Art braucht eine andere Anzahl an Zeichen.',
			checkDigit: 'Die Prüfziffer passt nicht zu den anderen Ziffern.',
			invalid: 'Dieser Inhalt passt nicht zu dieser Art von Code.'
		},
		detail: (text, detail) => `${text} (${detail})`,
		risks: {
			inverted: 'Hell auf dunkel: Viele Scanner lesen das nicht.',
			contrast: 'Wenig Kontrast: Scanner lesen das womöglich nicht.',
			quiet: 'Ohne Ruhezone braucht der Code einen hellen Rand auf der Seite.'
		},
		preview: (kind, text) => `${kind}: ${text}`,
		title: 'Barcode',
		insert: 'Einfügen',
		edit: 'Barcode bearbeiten',
		apply: 'Übernehmen'
	},
	color: {
		none: 'Keine',
		opacity: 'Deckkraft',
		value: (c) => `Farbe ${c}`,
		custom: 'Eigene Farbe',
		recent: 'Zuletzt genutzte und Projektfarben',
		paletteHint: 'Farbe hierher ziehen, um sie zu ersetzen',
		resetPalette: 'Standardfarben wiederherstellen'
	},

	text: {
		font: 'Schriftart',
		fonts: { sans: 'Serifenlos', serif: 'Serifen', mono: 'Feste Breite', system: 'Systemschrift', inter: 'Inter', montserrat: 'Montserrat', caveat: 'Caveat', 'jetbrains-mono': 'JetBrains Mono' },
		fontSize: 'Schriftgröße',
		bold: 'Fett',
		italic: 'Kursiv',
		underline: 'Unterstrichen',
		lineHeight: 'Zeilenabstand',
		lineHeightValue: (n) => n.toLocaleString('de', { minimumFractionDigits: 1 }),
		bulleted: 'Aufzählung',
		numbered: 'Nummerierung'
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
