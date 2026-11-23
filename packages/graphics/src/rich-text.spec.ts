import { describe, expect, it } from 'vitest';
import { insertText, isPlain, layoutRich, plainOf, rangeStyle, richOf, styleRange, tidy, withLevel, withList, type FullStyle, type RichText } from './rich-text.js';
import { wrapText } from './text-box.js';

// Formatted text is saved with its box: a format on the wrong characters, or lines broken elsewhere than plain text
// breaks them, changes what a document says and where it stands.

const base: FullStyle = { bold: false, italic: false, underline: false, font: 'sans', size: 10, color: '#000000' };
/** Every character as wide as half its font size, bold a little wider */
const measure = (text: string, style: FullStyle) => text.length * style.size * (style.bold ? 0.6 : 0.5);

describe('formats on ranges', () => {
	const text = richOf('Hello big world\nsecond');

	it('formats the characters of a range only, across paragraphs, and takes a format back', () => {
		const bold = styleRange(text, 6, 9, { bold: true });
		expect(bold[0].spans).toEqual([{ text: 'Hello ' }, { bold: true, text: 'big' }, { text: ' world' }]);
		expect(plainOf(bold)).toBe(plainOf(text));
		// Over the paragraph break (position 15): the end of the first and the start of the second
		const both = styleRange(bold, 10, 19, { italic: true });
		expect(both[0].spans.at(-1)).toEqual({ italic: true, text: 'world' });
		expect(both[1].spans).toEqual([{ italic: true, text: 'sec' }, { text: 'ond' }]);
		// Taken back: equal neighbours join again, nothing false is kept
		expect(styleRange(bold, 0, 15, { bold: false })).toEqual([text[0], text[1]]);
		expect(isPlain(styleRange(bold, 6, 9, { bold: undefined }))).toBe(true);
	});

	it('tells what a range has in common, and what typing at a place takes', () => {
		const bold = styleRange(text, 6, 9, { bold: true, size: 20 });
		expect(rangeStyle(bold, 6, 9, base)).toMatchObject({ bold: true, size: 20 });
		expect(rangeStyle(bold, 4, 9, base)).toMatchObject({ bold: null, size: null, italic: false });
		// A caret takes the style of the character before it; at a paragraph's start that of its first
		expect(rangeStyle(bold, 9, 9, base).bold).toBe(true);
		expect(rangeStyle(bold, 6, 6, base).bold).toBe(false);
		expect(rangeStyle(bold, 16, 16, base).bold).toBe(false);
		expect(plainOf(insertText(bold, 9, '!', { italic: true }))).toBe('Hello big! world\nsecond');
		expect(insertText(bold, 9, '!', { italic: true })[0].spans[2]).toEqual({ bold: true, size: 20, italic: true, text: '!' });
	});

	it('makes paragraphs list items and back, nested up to a limit', () => {
		const list = withList(text, 0, 1, 'number');
		expect(list.map((p) => p.list)).toEqual(['number', 'number']);
		expect(withList(list, 0, 1, 'number').some((p) => p.list)).toBe(false);
		expect(withList(list, 1, 1, 'bullet').map((p) => p.list)).toEqual(['number', 'bullet']);
		expect(withLevel(withLevel(list, 1, 1, 9), 1, 1, -1)[1].level).toBe(3);
		expect(tidy([{ spans: [{ text: '', bold: true }, { text: '' }] }])).toEqual([{ spans: [{ bold: true, text: '' }] }]);
	});
});

describe('lines of formatted text', () => {
	it('breaks unformatted text exactly where plain text breaks', () => {
		const plain = 'The quick brown fox  jumps over a verylongwordthatdoesnotfit dog\n\nlast line ';
		for (const width of [30, 55, 80, 400]) {
			const lines = layoutRich(richOf(plain), base, measure, { maxWidth: width });
			expect(lines.map((l) => ({ text: l.text, last: l.last }))).toEqual(wrapText(plain, (s) => measure(s, base), width));
		}
		expect(layoutRich(richOf(plain), base, measure).map((l) => l.text)).toEqual(wrapText(plain, (s) => measure(s, base)).map((l) => l.text));
	});

	it('breaks with the widths of each format, a line as high as its largest font', () => {
		// "aaaa bbbb" fits 45 plain (4.5 × 10), not with the second word bold and large
		const text: RichText = [{ spans: [{ text: 'aaaa ' }, { text: 'bbbb', bold: true, size: 20 }] }];
		expect(layoutRich(richOf('aaaa bbbb'), base, measure, { maxWidth: 45 })).toHaveLength(1);
		const lines = layoutRich(text, base, measure, { maxWidth: 60, lineHeight: 1.5 });
		expect(lines.map((l) => [l.text, l.height, l.y])).toEqual([['aaaa', 15, 0], ['bbbb', 30, 15]]);
		expect(lines[1].runs).toEqual([{ x: 0, width: 48, text: 'bbbb', style: { ...base, bold: true, size: 20 } }]);
	});

	it('aligns lines, indents list items behind their marks and counts numbered ones', () => {
		const text: RichText = [{ spans: [{ text: 'one' }], list: 'number' }, { spans: [{ text: 'two two' }], list: 'number' }, { spans: [{ text: 'in' }], list: 'bullet', level: 1 }, { spans: [{ text: 'x' }] }];
		const lines = layoutRich(text, base, measure, { maxWidth: 100, align: 'right' });
		expect(lines.map((l) => l.runs.filter((r) => r.marker).map((r) => r.text)[0])).toEqual(['1.', '2.', '•', undefined]);
		// Indented one step (15), right-aligned in what is left
		expect(lines[0].runs.find((r) => !r.marker)).toMatchObject({ text: 'one', x: 85 });
		expect(lines[2].runs.find((r) => !r.marker)).toMatchObject({ text: 'in', x: 90 });
		expect(lines[3].runs[0]).toMatchObject({ text: 'x', x: 95 });
		// Justified: the words of a line that isn't its paragraph's last reach both edges
		const justified = layoutRich(richOf('aa bb cc dd'), base, measure, { maxWidth: 45, align: 'justify' });
		expect(justified[0].runs.map((r) => [r.text, r.x])).toEqual([['aa ', 0], ['bb ', 17.5], ['cc', 35]]);
		expect(justified[1].runs.map((r) => r.x)).toEqual([0]);
	});

	it('shows a character its font lacks in the style the tool names', () => {
		const lines = layoutRich([{ spans: [{ text: 'aλb', font: 'serif', bold: true }] }], base, measure, { fallback: (char, style) => (char === 'λ' ? { ...style, font: 'sans', bold: false } : style) });
		expect(lines[0].runs.map((r) => [r.text, r.style.font, r.style.bold])).toEqual([['a', 'serif', true], ['λ', 'sans', false], ['b', 'serif', true]]);
	});
});
