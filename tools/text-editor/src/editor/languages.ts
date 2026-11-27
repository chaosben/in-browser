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
const ENV = legacy('.env', async () => (await import('@codemirror/legacy-modes/mode/properties')).properties);
/** Named only (no highlighting) */
const plain = (name: string): Language => ({ name, load: async () => [] });
const clike = (name: string, pick: (m: typeof import('@codemirror/legacy-modes/mode/clike')) => StreamParser<unknown>) =>
	legacy(name, async () => pick(await import('@codemirror/legacy-modes/mode/clike')));
const C = clike('C', (m) => m.c);
const CPP = clike('C++', (m) => m.cpp);
const SCSS = legacy('SCSS', async () => (await import('@codemirror/legacy-modes/mode/css')).sCSS);
const DIFF = legacy('Diff', async () => (await import('@codemirror/legacy-modes/mode/diff')).diff);
const DOCKERFILE = legacy('Dockerfile', async () => (await import('@codemirror/legacy-modes/mode/dockerfile')).dockerFile);
const JSON_LINES: Language = { name: 'JSON Lines', load: JSON_DATA.load };
const SVG: Language = { name: 'SVG', load: XML.load };

const BY_EXTENSION: Record<string, Language> = {
	'.md': MARKDOWN,
	'.markdown': MARKDOWN,
	'.json': JSON_DATA,
	'.jsonl': JSON_LINES,
	'.ndjson': JSON_LINES,
	'.csv': plain('CSV'),
	'.tsv': plain('TSV'),
	'.yml': YAML,
	'.yaml': YAML,
	'.html': HTML,
	'.htm': HTML,
	'.svelte': HTML,
	'.css': CSS,
	'.xml': XML,
	'.svg': SVG,
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
	'.properties': INI,
	'.scss': SCSS,
	'.less': legacy('Less', async () => (await import('@codemirror/legacy-modes/mode/css')).less),
	'.vue': HTML,
	'.c': C,
	'.h': C,
	'.cpp': CPP,
	'.hpp': CPP,
	'.cc': CPP,
	'.cs': clike('C#', (m) => m.csharp),
	'.java': clike('Java', (m) => m.java),
	'.kt': clike('Kotlin', (m) => m.kotlin),
	'.go': legacy('Go', async () => (await import('@codemirror/legacy-modes/mode/go')).go),
	'.rs': legacy('Rust', async () => (await import('@codemirror/legacy-modes/mode/rust')).rust),
	'.rb': legacy('Ruby', async () => (await import('@codemirror/legacy-modes/mode/ruby')).ruby),
	'.pl': legacy('Perl', async () => (await import('@codemirror/legacy-modes/mode/perl')).perl),
	'.lua': legacy('Lua', async () => (await import('@codemirror/legacy-modes/mode/lua')).lua),
	'.sql': legacy('SQL', async () => (await import('@codemirror/legacy-modes/mode/sql')).standardSQL),
	'.r': legacy('R', async () => (await import('@codemirror/legacy-modes/mode/r')).r),
	'.swift': legacy('Swift', async () => (await import('@codemirror/legacy-modes/mode/swift')).swift),
	'.ps1': legacy('PowerShell', async () => (await import('@codemirror/legacy-modes/mode/powershell')).powerShell),
	'.diff': DIFF,
	'.patch': DIFF,
	'.tex': legacy('LaTeX', async () => (await import('@codemirror/legacy-modes/mode/stex')).stex),
	'.php': plain('PHP'),
	'.bat': plain('Batch'),
	'.cmd': plain('Batch'),
	'.srt': plain('SubRip'),
	'.vtt': plain('WebVTT')
};

/** Languages of files known by their whole name */
const BY_NAME: Record<string, Language> = { dockerfile: DOCKERFILE, makefile: plain('Makefile') };

/** Language of a file; `null` for plain text */
export function languageOf(name: string): Language | null {
	if (/^\.env(\..+)?$/i.test(name)) return ENV;
	return BY_EXTENSION[extname(name)] ?? BY_NAME[name.toLowerCase()] ?? null;
}

/** Markdown files get a preview */
export function isMarkdown(name: string) {
	return languageOf(name) === MARKDOWN;
}
