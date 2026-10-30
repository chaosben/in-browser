import { describe, expect, it } from 'vitest';
import { previewDocument } from './preview';

const colors = { background: '#fff', text: '#000', muted: '#666', border: '#ccc', surface: '#eee', link: '#00f' };

describe('previewDocument', () => {
	it('renders Markdown', () => {
		const html = previewDocument('# Title\n\n- **bold**\n\n| a | b |\n|---|---|\n| 1 | 2 |', colors, 'en');
		expect(html).toContain('<h1>Title</h1>');
		expect(html).toContain('<strong>bold</strong>');
		expect(html).toContain('<table>');
	});
	it('locks the frame down: no scripts, no external requests, links in a new tab', () => {
		const html = previewDocument('<script>alert(1)</script>', colors, 'de');
		expect(html).toContain(`content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"`);
		expect(html).toContain('<base target="_blank">');
		expect(html).toContain('lang="de"');
	});
});
