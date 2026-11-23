// What a QR code says when it is more than a text: the formats phones understand for an address, a Wi-Fi, a
// contact, an e-mail, a phone number and a text message. Pure.

export const QR_TEMPLATES = ['text', 'url', 'wifi', 'contact', 'email', 'phone', 'sms'] as const;
export type QrTemplate = (typeof QR_TEMPLATES)[number];

export const WIFI_SECURITIES = ['WPA', 'WEP', 'nopass'] as const;

/** Everything the templates ask for; each uses its own fields */
export interface QrFields {
	text: string;
	url: string;
	ssid: string;
	password: string;
	security: (typeof WIFI_SECURITIES)[number];
	hidden: boolean;
	name: string;
	org: string;
	phone: string;
	email: string;
	address: string;
	subject: string;
	body: string;
	message: string;
}

export const EMPTY_QR_FIELDS: QrFields = { text: '', url: '', ssid: '', password: '', security: 'WPA', hidden: false, name: '', org: '', phone: '', email: '', address: '', subject: '', body: '', message: '' };

/** The fields a template shows, in their order */
export const QR_TEMPLATE_FIELDS: Record<QrTemplate, readonly (keyof QrFields)[]> = {
	text: ['text'],
	url: ['url'],
	wifi: ['ssid', 'password', 'security', 'hidden'],
	contact: ['name', 'org', 'phone', 'email', 'address'],
	email: ['email', 'subject', 'body'],
	phone: ['phone'],
	sms: ['phone', 'message']
};

/** A Wi-Fi code's values: its separators and the backslash are escaped */
const wifi = (value: string) => value.replace(/([\\;,:"])/g, '\\$1');
/** A vCard's values */
const card = (value: string) => value.replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
const number = (value: string) => value.replace(/[^\d+*#]/g, '');

/** The text a QR code of a template holds; empty while what it needs is missing */
export function qrContent(template: QrTemplate, f: QrFields): string {
	switch (template) {
		case 'text':
			return f.text;
		case 'url': {
			const url = f.url.trim();
			return !url || /^[a-z][a-z\d+.-]*:/i.test(url) ? url : `https://${url}`;
		}
		case 'wifi': {
			if (!f.ssid) return '';
			const open = f.security === 'nopass';
			return `WIFI:T:${f.security};S:${wifi(f.ssid)};${open ? '' : `P:${wifi(f.password)};`}${f.hidden ? 'H:true;' : ''};`;
		}
		case 'contact': {
			const name = f.name.trim();
			if (!name) return '';
			// The last word is the family name
			const at = name.lastIndexOf(' ');
			const [given, family] = at < 0 ? [name, ''] : [name.slice(0, at), name.slice(at + 1)];
			return [
				'BEGIN:VCARD',
				'VERSION:3.0',
				`N:${card(family)};${card(given)}`,
				`FN:${card(name)}`,
				f.org.trim() && `ORG:${card(f.org.trim())}`,
				f.phone.trim() && `TEL:${number(f.phone)}`,
				f.email.trim() && `EMAIL:${card(f.email.trim())}`,
				f.address.trim() && `ADR:;;${card(f.address.trim())};;;;`,
				'END:VCARD'
			]
				.filter(Boolean)
				.join('\n');
		}
		case 'email': {
			const to = f.email.trim();
			if (!to) return '';
			const query = [f.subject && `subject=${encodeURIComponent(f.subject)}`, f.body && `body=${encodeURIComponent(f.body)}`].filter(Boolean).join('&');
			return `mailto:${to}${query ? `?${query}` : ''}`;
		}
		case 'phone':
			return number(f.phone) && `tel:${number(f.phone)}`;
		case 'sms':
			return number(f.phone) && `SMSTO:${number(f.phone)}:${f.message}`;
	}
}
