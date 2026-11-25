// Texts of the shared graphics components (color field, icon picker). English leads: de.ts has the same keys.

const en = {
	barcode: {
		kind: 'Kind',
		groups: { matrix: '2D codes', retail: 'Retail', industry: 'Logistics and industry', post: 'Postal', more: 'More' },
		// Names of kinds that differ from the standard's (`BarcodeType.name`)
		names: {} as Record<string, string>,
		content: 'Content',
		contentAs: 'Content as',
		templates: { text: 'Text', url: 'Web address', wifi: 'Wi-Fi', contact: 'Contact', email: 'E-mail', phone: 'Phone number', sms: 'Text message' },
		fields: {
			text: 'Text',
			url: 'Address',
			ssid: 'Network name',
			password: 'Password',
			security: 'Security',
			hidden: 'Hidden network',
			name: 'Name',
			org: 'Company',
			phone: 'Phone number',
			email: 'E-mail address',
			address: 'Postal address',
			subject: 'Subject',
			body: 'Message',
			message: 'Message'
		},
		securities: { WPA: 'WPA, WPA2, WPA3', WEP: 'WEP', nopass: 'None' },
		color: 'Color',
		background: 'Background',
		ecc: 'Error correction',
		eccLevels: { L: 'Low (7 %)', M: 'Medium (15 %)', Q: 'High (25 %)', H: 'Highest (30 %)' } as Record<string, string>,
		eccLevel: (level: string) => `Level ${level}`,
		showText: 'Show text',
		quiet: 'Quiet zone',
		problems: {
			empty: 'Type what the code should hold.',
			characters: 'This kind doesn’t take some of these characters.',
			length: 'This kind needs another number of characters.',
			checkDigit: 'The check digit doesn’t fit the other digits.',
			invalid: 'This content doesn’t fit this kind of code.'
		},
		detail: (text: string, detail: string) => `${text} (${detail})`,
		risks: {
			inverted: 'Light on dark: many scanners don’t read that.',
			contrast: 'Little contrast: scanners may not read that.',
			quiet: 'Without the quiet zone the code needs a light margin on the page.'
		},
		preview: (kind: string, text: string) => `${kind}: ${text}`,
		title: 'Barcode',
		insert: 'Insert',
		edit: 'Edit barcode',
		apply: 'Apply'
	},
	color: {
		none: 'None',
		opacity: 'Opacity',
		value: (c: string) => `Color ${c}`,
		custom: 'Custom color',
		recent: 'Recent and project colors',
		paletteHint: 'drag a color here to replace it',
		resetPalette: 'Restore default colors'
	},

	text: {
		font: 'Font',
		fonts: { sans: 'Sans-serif', serif: 'Serif', mono: 'Monospace', system: 'System font', inter: 'Inter', montserrat: 'Montserrat', caveat: 'Caveat', 'jetbrains-mono': 'JetBrains Mono' },
		fontSize: 'Font size',
		bold: 'Bold',
		italic: 'Italic',
		underline: 'Underline',
		lineHeight: 'Line spacing',
		lineHeightValue: (n: number) => n.toLocaleString('en', { minimumFractionDigits: 1 }),
		bulleted: 'Bullets',
		numbered: 'Numbering',
		myFonts: 'My fonts',
		documentFonts: 'Fonts of this PDF',
		manageFonts: 'Manage fonts …',
		missingFont: (name: string) => `${name} (not on this device)`
	},

	insets: {
		same: 'Same on all sides',
		top: 'Top',
		right: 'Right',
		bottom: 'Bottom',
		left: 'Left'
	},

	icons: {
		searchSet: (set: string) => `Search ${set} (English names)`,
		source: 'Icon set',
		variant: 'Style',
		category: 'Category',
		all: 'All',
		insert: (name: string) => `Insert icon ${name}`,
		categories: { arrows: 'Arrows', notices: 'Notices', status: 'Status', input: 'Mouse & keyboard', objects: 'Objects', people: 'People' },
		noResults: 'No matching icon.',
		count: (n: number) => `${n.toLocaleString('en')} icons`,
		load: (size: string) => `Load all icons (approx. ${size})`,
		loadHint: (count: number) =>
			`Loads about ${count.toLocaleString('en')} icons once – afterwards they are kept in the browser and work offline. Then you can filter by style.`,
		license: (set: string, license: string) => `${set} · ${license} license`,
		offline: 'Loading an icon set needs an internet connection.',
		loadFailed: (error: string) => `The icons could not be loaded: ${error}`
	}
};

export default en;
