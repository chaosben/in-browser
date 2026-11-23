import { describe, expect, it } from 'vitest';
import { EMPTY_QR_FIELDS, qrContent } from './qr-content.js';

// A code that says something else than what was typed joins the wrong Wi-Fi or saves a wrong contact.

describe('QR code contents', () => {
	it('escapes what separates the parts of a Wi-Fi code and of a contact', () => {
		expect(qrContent('wifi', { ...EMPTY_QR_FIELDS, ssid: 'Café; "Guests"', password: 'a:b\\c,d' })).toBe('WIFI:T:WPA;S:Café\\; \\"Guests\\";P:a\\:b\\\\c\\,d;;');
		expect(qrContent('wifi', { ...EMPTY_QR_FIELDS, ssid: 'Open', password: 'unused', security: 'nopass', hidden: true })).toBe('WIFI:T:nopass;S:Open;H:true;;');
		expect(qrContent('contact', { ...EMPTY_QR_FIELDS, name: 'Ada Maria Example', org: 'Example; Ltd', phone: '+49 (30) 1234-5', address: 'Main St 1\n12345 Town' })).toBe(
			'BEGIN:VCARD\nVERSION:3.0\nN:Example;Ada Maria\nFN:Ada Maria Example\nORG:Example\\; Ltd\nTEL:+493012345\nADR:;;Main St 1\\n12345 Town;;;;\nEND:VCARD'
		);
	});

	it('writes addresses the way phones open them', () => {
		expect(qrContent('url', { ...EMPTY_QR_FIELDS, url: ' example.org/a b ' })).toBe('https://example.org/a b');
		expect(qrContent('url', { ...EMPTY_QR_FIELDS, url: 'http://example.org' })).toBe('http://example.org');
		expect(qrContent('email', { ...EMPTY_QR_FIELDS, email: 'a@example.org', subject: 'Hi & bye', body: 'Line 1\nLine 2' })).toBe('mailto:a@example.org?subject=Hi%20%26%20bye&body=Line%201%0ALine%202');
		expect(qrContent('sms', { ...EMPTY_QR_FIELDS, phone: '0170 123', message: 'On my way' })).toBe('SMSTO:0170123:On my way');
		expect(qrContent('wifi', EMPTY_QR_FIELDS)).toBe('');
	});
});
