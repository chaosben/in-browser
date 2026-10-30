import { StreamLanguage, type StreamParser } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { extname } from '@in-browser/files/path.js';

// Syntax highlighting by file extension; each language is only loaded when a file needs it.

export interface Language {
	/** Shown in the status bar (a proper name, not translated) */
	name: string;
	load: () => Promise<Extension>;
}

const legacy = (name: string, parser: () => Promise<StreamParser<unknown>>): Language => ({
	name,
	load: async () => StreamLanguage.define(await parser())
});

const MARKDOWN: Language = { name: 'Markdown', load: async () => (await import('@codemirror/lang-markdown')).markdown() };
const JSON_DATA: Language = { name: 'JSON', load: async () => (await import('@codemirror/lang-json')).json() };
const YAML: Language = { name: 'YAML', load: async () => (await import('@codemirror/lang-yaml')).yaml() };
const HTML: Language = { name: 'HTML', load: async () => (await import('@codemirror/lang-html')).html() };
const CSS: Language = { name: 'CSS', load: async () => (await import('@codemirror/lang-css')).css() };
const XML: Language = { name: 'XML', load: async () => (await import('@codemirror/lang-xml')).xml() };
const PYTHON: Language = { name: 'Python', load: async () => (await import('@codemirror/lang-python')).python() };
const script = (name: string, options: { typescript?: boolean; jsx?: boolean }): Language => ({
	name,
	load: async () => (await import('@codemirror/lang-javascript')).javascript(options)
});
const SHELL = legacy('Shell', async () => (await import('@codemirror/legacy-modes/mode/shell')).shell);
const TOML = legacy('TOML', async () => (await import('@codemirror/legacy-modes/mode/toml')).toml);
const INI = legacy('INI', async () => (await import('@codemirror/legacy-modes/mode/properties')).properties);

const BY_EXTENSION: Record<string, Language> = {
	'.md': MARKDOWN,
	'.markdown': MARKDOWN,
	'.json': JSON_DATA,
	'.yml': YAML,
	'.yaml': YAML,
	'.html': HTML,
	'.htm': HTML,
	'.svelte': HTML,
	'.css': CSS,
	'.xml': XML,
	'.py': PYTHON,
	'.js': script('JavaScript', {}),
	'.mjs': script('JavaScript', {}),
	'.cjs': script('JavaScript', {}),
	'.jsx': script('JavaScript (JSX)', { jsx: true }),
	'.ts': script('TypeScript', { typescript: true }),
	'.mts': script('TypeScript', { typescript: true }),
	'.cts': script('TypeScript', { typescript: true }),
	'.tsx': script('TypeScript (TSX)', { typescript: true, jsx: true }),
	'.sh': SHELL,
	'.bash': SHELL,
	'.zsh': SHELL,
	'.toml': TOML,
	'.ini': INI,
	'.cfg': INI,
	'.conf': INI,
	'.properties': INI
};

/** Language of a file; `null` for plain text */
export function languageOf(name: string): Language | null {
	return BY_EXTENSION[extname(name)] ?? null;
}

/** Markdown files get a preview */
export function isMarkdown(name: string) {
	return languageOf(name) === MARKDOWN;
}
