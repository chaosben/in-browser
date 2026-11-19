import { describe, expect, it } from 'vitest';
import { matches, normalize, sections } from './launcher';
import { CATEGORIES, TOOLS } from './tools';

const ids = (query: string) => sections(TOOLS, query).flatMap((section) => section.tools.map((tool) => tool.id));

describe('launcher', () => {
	it('normalizes case and diacritics', () => {
		expect(normalize('Notizbücher')).toBe('notizbucher');
	});

	it('shows every tool once, by main category', () => {
		expect(ids('')).toEqual(['screenCapture', 'textEditor', 'notes', 'files']);
		expect(sections(TOOLS, '').map((section) => section.category)).toEqual(['media', 'writing', 'organize']);
	});

	it('finds tools by name, keywords and categories in both languages', () => {
		expect(ids('record')).toEqual(['screenCapture']);
		expect(ids('screen recorder')).toEqual(['screenCapture']);
		expect(ids('Bildschirm aufnehmen')).toEqual(['screenCapture']);
		expect(ids('notizbucher')).toEqual(['notes']);
		// A further category only helps the search
		expect(ids('drawing')).toEqual(['notes']);
		expect(ids('zeichnen')).toEqual(['notes']);
		expect(ids('dateien')).toContain('files');
		expect(ids('xyz')).toEqual([]);
	});

	it('needs every word of the query', () => {
		const notes = TOOLS.find((tool) => tool.id === 'notes')!;
		expect(matches(notes, 'stylus pdf')).toBe(true);
		expect(matches(notes, 'stylus markdown')).toBe(false);
	});

	it('knows the category of every tool', () => {
		for (const tool of TOOLS) {
			for (const category of [tool.category, ...(tool.also ?? [])]) expect(CATEGORIES).toContain(category);
		}
	});
});
