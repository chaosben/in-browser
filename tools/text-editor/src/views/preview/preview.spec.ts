import { describe, expect, it } from 'vitest';
import { htmlDocument, previewDocument } from './preview';

const colors = { background: '#fff', text: '#000', muted: '#666', border: '#ccc', surface: '#eee', link: '#00f' };

describe('previewDocument', () => {
	it('locks the frame down: no scripts, no external requests, links in a new tab', () => {
		const html = previewDocument('<script>alert(1)</script>', colors, 'de');
		expect(html).toContain(`content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"`);
		expect(html).toContain('<base target="_blank">');
	});
});

describe('htmlDocument', () => {
	it('puts the CSP first and removes refresh redirects', () => {
		const html = htmlDocument('<!doctype html><html><head><meta http-equiv="refresh" content="0; url=https://x.test"></head><body>Hi</body></html>');
		expect(html.startsWith(`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`)).toBe(true);
		expect(html).not.toContain('refresh');
		expect(html).toContain('<body>Hi</body>');
	});
});
