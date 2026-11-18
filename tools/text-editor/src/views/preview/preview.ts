import { marked } from 'marked';

// Markdown and HTML previews as complete documents for a sandboxed `<iframe srcdoc>`. All tools share one origin, so
// the HTML must never run in the page itself: the frame has no scripts and an opaque origin, and its own CSP allows
// nothing but inline styles and data: images (no external requests either).

export interface PreviewColors {
	background: string;
	text: string;
	muted: string;
	border: string;
	surface: string;
	link: string;
}

const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";
const LOCK = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;

/**
 * An HTML file as it is, locked down: our CSP comes first (a page can only add stricter ones), links open in a new
 * tab, and `<meta http-equiv="refresh">` is taken out (it would navigate the frame away).
 */
export function htmlDocument(html: string): string {
	const body = html.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, '');
	// After a doctype, which must stay first (otherwise the page renders in quirks mode)
	const doctype = /^\s*<!doctype[^>]*>/i.exec(body)?.[0] ?? '';
	return `${doctype}${LOCK}<base target="_blank">${body.slice(doctype.length)}`;
}

export function previewDocument(markdown: string, colors: PreviewColors, lang: string): string {
	const body = marked.parse(markdown, { async: false, gfm: true });
	return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
${LOCK}
<base target="_blank">
<style>
:root { color-scheme: light dark; }
body { margin: 0; padding: 1.25rem 1.5rem; background: ${colors.background}; color: ${colors.text};
	font: 15px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; overflow-wrap: break-word; }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.4em 0 0.5em; }
h1, h2 { padding-bottom: 0.25em; border-bottom: 1px solid ${colors.border}; }
body > :first-child { margin-top: 0; }
a { color: ${colors.link}; }
img { max-width: 100%; }
code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.875em; }
code { background: ${colors.surface}; padding: 0.1em 0.3em; border-radius: 4px; }
pre { background: ${colors.surface}; padding: 0.75em 1em; border-radius: 6px; overflow: auto; }
pre code { background: none; padding: 0; }
blockquote { margin: 0; padding: 0 1em; color: ${colors.muted}; border-left: 4px solid ${colors.border}; }
table { border-collapse: collapse; }
th, td { border: 1px solid ${colors.border}; padding: 0.3em 0.7em; }
hr { border: none; border-top: 1px solid ${colors.border}; }
</style></head><body>${body}</body></html>`;
}
