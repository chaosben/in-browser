import { extname } from './path.js';

// Kind of a file by its extension: picks its icon (`FileIcon.svelte`) and how Files previews it.

export type PreviewKind = 'image' | 'video' | 'audio' | 'text' | null;

const PREVIEW: Record<Exclude<PreviewKind, null>, string[]> = {
	// SVG only ever as <img>: scripts in it do not run there
	image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.ico', '.svg'],
	video: ['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.ogv'],
	audio: ['.mp3', '.wav', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.flac'],
	text: ['.txt', '.md', '.json', '.csv', '.tsv', '.log', '.xml', '.yml', '.yaml', '.ini', '.toml', '.html', '.css', '.js', '.ts', '.svelte', '.py', '.sh']
};

/** How a file can be previewed in Files; `null`: no preview */
export function previewKind(name: string): PreviewKind {
	const ext = extname(name);
	for (const [kind, exts] of Object.entries(PREVIEW)) if (exts.includes(ext)) return kind as PreviewKind;
	return null;
}
