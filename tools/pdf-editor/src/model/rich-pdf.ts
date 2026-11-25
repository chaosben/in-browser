// Formatted text as PDF programs exchange it in a `/FreeText`: `/RC` holds the text as a small XHTML document –
// paragraphs of spans with CSS for weight, slant, underline, color, size and family –, `/DS` the style that holds
// where it says nothing. We write both next to the appearance (which is what every viewer shows) and read them from
// text boxes of other programs. Read as XML and only for these few things: never put into the page as HTML.

import { asDocumentFont, DOCUMENT_FONTS, isCustomFont, markerOf, tidy, type DocumentFont, type FontFamily, type FullStyle, type RichText, type TextStyle } from '@in-browser/graphics/rich-text.js';
import { customLabel } from '@in-browser/graphics/fonts.js';

/** The names PDF programs know the three families by */
const FAMILY_NAME: Record<DocumentFont, string> = { sans: 'Helvetica', serif: 'Times', mono: 'Courier' };

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const css = (style: FullStyle) =>
	[
		`font-family:${familyCss(style.font)}`,
		`font-size:${style.size}pt`,
		`color:${style.color.slice(0, 7)}`,
		`font-weight:${style.bold ? 'bold' : 'normal'}`,
		`font-style:${style.italic ? 'italic' : 'normal'}`,
		`text-decoration:${style.underline ? 'underline' : 'none'}`
	].join(';');

/** `/DS` of a box of style `base` */
export const defaultStyleOf = (base: FullStyle, align: string) => `font:${base.italic ? 'italic ' : ''}${base.bold ? 'bold ' : ''}${base.size}pt ${familyCss(base.font)};text-align:${align};color:${base.color.slice(0, 7)}`;

/** A family as other programs read it: one of ours by its standard name, a user's or a PDF's by its own (quoted),
 * the standard sans-serif one after it */
function familyCss(font: FontFamily): string {
	if (!isCustomFont(font)) return FAMILY_NAME[asDocumentFont(font)];
	return `'${customLabel(font).replace(/['\\]/g, '')}',${FAMILY_NAME.sans}`;
}

/** `/RC` of formatted text; list items carry their mark as text (the format knows no lists) */
export function richContentsOf(rich: RichText, base: FullStyle): string {
	const paragraphs = rich.map((p, i) => {
		const mark = markerOf(rich, i);
		const spans = [...(mark ? [{ text: `${'    '.repeat(p.level ?? 0)}${mark} ` }] : []), ...p.spans];
		return `<p dir="ltr">${spans.map((s) => `<span style="${css({ ...base, ...s })}">${escape(s.text)}</span>`).join('')}</p>`;
	});
	return `<?xml version="1.0"?><body xmlns="http://www.w3.org/1999/xhtml" xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:APIVersion="Acrobat:11.0.0" xfa:spec="2.0.2">${paragraphs.join('')}</body>`;
}

/** What a CSS declaration list says about a text's style (only what it names) */
function styleOfCss(text: string): TextStyle {
	const out: TextStyle = {};
	for (const declaration of text.split(';')) {
		const at = declaration.indexOf(':');
		if (at < 0) continue;
		const key = declaration.slice(0, at).trim().toLowerCase();
		const value = declaration.slice(at + 1).trim().toLowerCase();
		if (key === 'font-weight' || key === 'font') {
			if (/\bbold\b|\b[6-9]00\b/.test(value)) out.bold = true;
			else if (key === 'font-weight') out.bold = false;
		}
		if (key === 'font-style' || key === 'font') {
			if (/\bitalic\b|\boblique\b/.test(value)) out.italic = true;
			else if (key === 'font-style') out.italic = false;
		}
		if (key === 'text-decoration' || key === 'text-decoration-line') out.underline = /\bunderline\b/.test(value);
		if (key === 'color') {
			const hex = /^#([0-9a-f]{6})$/.exec(value) ?? /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(value);
			const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(value);
			if (hex) out.color = hex.length === 2 ? `#${hex[1]}` : `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
			else if (rgb) out.color = `#${rgb.slice(1).map((v) => Math.min(255, Number(v)).toString(16).padStart(2, '0')).join('')}`;
		}
		if (key === 'font-size' || key === 'font') {
			const size = /([\d.]+)\s*pt\b/.exec(value);
			if (size && Number(size[1]) > 0) out.size = Number(size[1]);
		}
		if (key === 'font-family' || key === 'font') {
			const family = key === 'font' ? value.replace(/^.*?[\d.]+\s*pt\s*/, '') : value;
			if (/courier|mono|consolas|menlo/.test(family)) out.font = 'mono';
			else if (/sans|helvetica|arial|verdana|calibri|tahoma|segoe/.test(family)) out.font = 'sans';
			else if (/times|serif|georgia|garamond|cambria|palatino|minion/.test(family)) out.font = 'serif';
		}
	}
	return out;
}

/**
 * Formatted text from `/RC` (with `/DS`): paragraphs (`p`; text outside one is its own), spans with their CSS, and
 * `b`, `i`, `u` – each span with what differs from `base`. Null when it can't be read (the caller takes the plain text).
 */
export function richFromContents(rc: string, ds: string | undefined, base: FullStyle): RichText | null {
	let body: Element | null;
	try {
		const parsed = new DOMParser().parseFromString(rc.replace(/^\s*<\?xml[^>]*\?>/, ''), 'application/xml');
		if (parsed.querySelector('parsererror')) return null;
		body = parsed.documentElement;
	} catch {
		return null;
	}
	if (!body) return null;
	const own = { ...styleOfCss(ds ?? ''), ...styleOfCss(body.getAttribute('style') ?? '') };
	const differing = (style: TextStyle): TextStyle => {
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(style)) if (value !== (base as unknown as Record<string, unknown>)[key]) out[key] = value;
		if (out.font && !DOCUMENT_FONTS.includes(out.font as DocumentFont)) delete out.font;
		return out as TextStyle;
	};
	const paragraphs: RichText = [];
	let current: RichText[number] | null = null;
	const walk = (node: Node, style: TextStyle) => {
		if (node.nodeType === 3) {
			const text = (node.nodeValue ?? '').replace(/[\r\n\t]+/g, ' ');
			if (!text) return;
			current ??= paragraphs[paragraphs.push({ spans: [] }) - 1];
			current.spans.push({ ...differing(style), text });
			return;
		}
		if (node.nodeType !== 1) return;
		const el = node as Element;
		const name = el.localName.toLowerCase();
		if (name === 'br') {
			current = null;
			paragraphs.push({ spans: [] });
			current = paragraphs.at(-1)!;
			return;
		}
		const next = { ...style, ...styleOfCss(el.getAttribute('style') ?? ''), ...(name === 'b' || name === 'strong' ? { bold: true } : {}), ...(name === 'i' || name === 'em' ? { italic: true } : {}), ...(name === 'u' ? { underline: true } : {}) };
		const block = name === 'p' || name === 'div';
		if (block) current = paragraphs[paragraphs.push({ spans: [] }) - 1];
		for (const child of el.childNodes) walk(child, next);
		if (block) current = null;
	};
	for (const child of body.childNodes) walk(child, own);
	if (!paragraphs.length) return null;
	return tidy(paragraphs);
}
