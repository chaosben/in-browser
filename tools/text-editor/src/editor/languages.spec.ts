import { describe, expect, it } from 'vitest';
import { TEXT_EXTENSIONS } from '@in-browser/files/kinds.js';
import { isMarkdown, languageOf } from './languages';

describe('languageOf', () => {
	it('by extension, case-insensitive', () => {
		expect(languageOf('README.md')?.name).toBe('Markdown');
		expect(languageOf('config.YAML')?.name).toBe('YAML');
		expect(languageOf('app.tsx')?.name).toBe('TypeScript (TSX)');
		expect(languageOf('deploy.sh')?.name).toBe('Shell');
		expect(languageOf('notes.txt')).toBeNull();
		expect(languageOf('Makefile')).toBeNull();
		expect(languageOf('data.csv')?.name).toBe('CSV');
		expect(languageOf('log.ndjson')?.name).toBe('JSON Lines');
		expect(languageOf('icon.svg')?.name).toBe('SVG');
		expect(languageOf('.env')?.name).toBe('.env');
		expect(languageOf('.env.local')?.name).toBe('.env');
	});
	it('only for files the editor opens', () => {
		for (const ext of TEXT_EXTENSIONS) expect(() => languageOf(`a${ext}`)).not.toThrow();
		expect(languageOf('a.png')).toBeNull();
	});
	it('loads the language', async () => {
		expect(await languageOf('a.json')!.load()).toBeTruthy();
		expect(await languageOf('a.toml')!.load()).toBeTruthy();
	});
	it('knows Markdown', () => {
		expect(isMarkdown('a.markdown')).toBe(true);
		expect(isMarkdown('a.txt')).toBe(false);
	});
});
