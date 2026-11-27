import { extname } from './path.js';

// Kind of a file by its extension: picks its icon (`FileIcon.svelte`) and how Files previews it.

export type PreviewKind = 'image' | 'video' | 'audio' | 'text' | null;

/**
 * Plain text files: previewed as text in Files, opened by the Text Editor on a double-click. (The Text Editor opens
 * any other file too – under "Open with" – as long as its content is text.)
 */
export const TEXT_EXTENSIONS: readonly string[] = [
	'.txt', '.md', '.markdown', '.json', '.jsonl', '.ndjson', '.csv', '.tsv', '.log', '.xml', '.yml', '.yaml', '.ini', '.cfg', '.conf',
	'.properties', '.toml', '.html', '.htm', '.css', '.scss', '.less', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx',
	'.svelte', '.vue', '.py', '.sh', '.bash', '.zsh', '.c', '.h', '.cpp', '.hpp', '.cc', '.cs', '.java', '.kt', '.go', '.rs',
	'.rb', '.php', '.pl', '.lua', '.sql', '.r', '.swift', '.bat', '.cmd', '.ps1', '.diff', '.patch', '.tex', '.srt', '.vtt'
];

/** Text files known by their whole name (no extension) */
const TEXT_NAMES: readonly string[] = ['makefile', 'dockerfile', 'license', 'readme', 'changelog', '.gitignore', '.gitattributes', '.editorconfig'];

/** A text file by its name: a text extension or a known name */
export function isTextName(name: string): boolean {
	return TEXT_EXTENSIONS.includes(extname(name)) || TEXT_NAMES.includes(name.toLowerCase());
}

const PREVIEW: Record<Exclude<PreviewKind, null>, readonly string[]> = {
	// SVG only ever as <img>: scripts in it do not run there
	image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.ico', '.svg'],
	video: ['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.ogv'],
	audio: ['.mp3', '.wav', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.flac'],
	text: TEXT_EXTENSIONS
};

/** How a file can be previewed in Files; `null`: no preview */
export function previewKind(name: string): PreviewKind {
	const ext = extname(name);
	for (const [kind, exts] of Object.entries(PREVIEW)) if (exts.includes(ext)) return kind as PreviewKind;
	return isTextName(name) ? 'text' : null;
}
