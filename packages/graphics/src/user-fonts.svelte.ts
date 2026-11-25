// The user's own fonts, for every tool with formatted text: font files (TrueType, OpenType) in the hidden, synced
// folder `/.apps/fonts/`, so they reach the user's other devices like their files. Files of one family (by the name
// the file gives) are its faces – regular, bold, italic, bold italic (by its weight and slant; of several weights the
// one nearest to 400 and 700). Each family is registered with `fonts.ts` as `user:<family>`; tools offer them under
// “My fonts”. The tool “Fonts” adds and deletes them. A font's own license flags are shown, never enforced (decided by
// the user: using a font is the user's decision).

import { copy, list, mkdir, read, watch, write } from '@in-browser/files/fs.js';
import { extname, join, uniqueName } from '@in-browser/files/path.js';
import { deleteToTrash } from '@in-browser/files/trash-browser.js';
import { registerFamily, registeredFamilies, unregisterFamily, type FontFace4 } from './fonts.js';
import type { CustomFont } from './rich-text.js';

export const FONT_FOLDER = '/.apps/fonts';
export const FONT_TYPES = ['.ttf', '.otf'];

/** What a font file says it allows (OS/2 `fsType`) – shown, never enforced */
export type Embedding = 'installable' | 'editable' | 'preview' | 'restricted';

export interface FontFileInfo {
	path: string;
	/** The file's name */
	name: string;
	family: string;
	/** Its style as the file names it (“Bold Italic”, “Light”) */
	style: string;
	weight: number;
	italic: boolean;
	embedding: Embedding;
	glyphs: number;
	version?: string;
	designer?: string;
	copyright?: string;
	license?: string;
	modified: number;
}

export interface UserFamily {
	id: CustomFont;
	family: string;
	/** All its files, and the one standing for each face */
	files: FontFileInfo[];
	faces: Partial<Record<FontFace4, FontFileInfo>>;
}

/** The user's fonts (`loadUserFonts`); `loaded` once read the first time */
export const userFonts = $state<{ families: UserFamily[]; loaded: boolean }>({ families: [], loaded: false });

type Font = import('@pdf-lib/fontkit').Font;
const load = () => import('@pdf-lib/fontkit').then((m) => (m as unknown as { default: { create(bytes: Uint8Array): Font } }).default);
let fontkit: ReturnType<typeof load> | null = null;
const kit = () => (fontkit ??= load());

/** Parsed files by path and date (read once) */
const parsed = new Map<string, { modified: number; info: FontFileInfo; font: Font }>();

/** A name of the font's `name` table – none when it has no such table (subsets embedded in PDFs often haven't, and
 * fontkit throws on reading it then) */
const nameOf = (font: Font, key: string): string | undefined => {
	const record = tryRead(() => (font as unknown as { name?: { records?: Record<string, Record<string, string>> } }).name?.records?.[key]);
	return record ? (record.en ?? Object.values(record)[0]) : undefined;
};
function tryRead<T>(read: () => T): T | undefined {
	try {
		return read();
	} catch {
		return undefined;
	}
}

function embeddingOf(fsType: Record<string, boolean> | undefined): Embedding {
	if (!fsType) return 'installable';
	if (fsType.noEmbedding) return 'restricted';
	if (fsType.viewOnly) return 'preview';
	if (fsType.editable) return 'editable';
	return 'installable';
}

/** What a font file is (null: not a font fontkit can read) */
export async function describeFont(bytes: Uint8Array, path: string, modified: number): Promise<{ info: FontFileInfo; font: Font } | null> {
	try {
		const font = (await kit()).create(bytes);
		if (!font || !('numGlyphs' in font)) return null;
		const os2 = tryRead(() => (font as unknown as { 'OS/2'?: { usWeightClass?: number; fsType?: Record<string, boolean>; fsSelection?: Record<string, boolean> } })['OS/2']);
		const style = nameOf(font, 'preferredSubfamily') ?? tryRead(() => font.subfamilyName) ?? 'Regular';
		const weight = os2?.usWeightClass ?? (/bold/i.test(style) ? 700 : 400);
		const italic = !!os2?.fsSelection?.italic || /italic|oblique/i.test(style);
		const info: FontFileInfo = {
			path,
			name: path.slice(path.lastIndexOf('/') + 1),
			family: nameOf(font, 'preferredFamily') ?? tryRead(() => font.familyName) ?? path,
			style,
			weight,
			italic,
			embedding: embeddingOf(os2?.fsType),
			glyphs: font.numGlyphs,
			version: nameOf(font, 'version'),
			designer: nameOf(font, 'designer') ?? nameOf(font, 'manufacturer'),
			copyright: nameOf(font, 'copyright'),
			license: nameOf(font, 'licenseURL') ?? nameOf(font, 'licenseDescription'),
			modified
		};
		return { info, font };
	} catch (e) {
		console.warn('[graphics] not a font', path, e);
		return null;
	}
}

/** The files of a family as its four faces: of each slant the weight nearest to 400 (regular) and to 700 (bold) */
function facesOf(files: readonly FontFileInfo[]): Partial<Record<FontFace4, FontFileInfo>> {
	const near = (list: readonly FontFileInfo[], target: number) => [...list].sort((a, b) => Math.abs(a.weight - target) - Math.abs(b.weight - target))[0];
	const faces: Partial<Record<FontFace4, FontFileInfo>> = {};
	for (const italic of [false, true]) {
		const slant = files.filter((f) => f.italic === italic);
		const regular = near(slant.filter((f) => f.weight < 600), 400);
		const bold = near(slant.filter((f) => f.weight >= 600), 700);
		if (regular) faces[italic ? 'italic' : 'regular'] = regular;
		if (bold) faces[italic ? 'boldItalic' : 'bold'] = bold;
	}
	// A family of only bold or only italic files: one of them stands for regular
	faces.regular ??= faces.bold ?? faces.italic ?? faces.boldItalic ?? files[0];
	return faces;
}

let reading: Promise<void> | null = null;

/** Reads the font folder: every family registered, those gone taken away */
export function loadUserFonts(): Promise<void> {
	reading ??= (async () => {
		try {
			const entries = await list(FONT_FOLDER).catch(() => []);
			const files: { info: FontFileInfo; font: Font }[] = [];
			for (const entry of entries) {
				if (entry.kind !== 'file' || !FONT_TYPES.includes(extname(entry.name).toLowerCase())) continue;
				const path = join(FONT_FOLDER, entry.name);
				const modified = entry.modified ?? 0;
				const known = parsed.get(path);
				if (known && known.modified === modified) {
					files.push(known);
					continue;
				}
				const found = await describeFont(new Uint8Array(await (await read(path)).arrayBuffer()), path, modified);
				if (!found) continue;
				parsed.set(path, { modified, ...found });
				files.push(found);
			}
			const byFamily = new Map<string, { info: FontFileInfo; font: Font }[]>();
			for (const f of files) byFamily.set(f.info.family, [...(byFamily.get(f.info.family) ?? []), f]);
			const families: UserFamily[] = [...byFamily].map(([family, list]) => ({ id: `user:${family}` as CustomFont, family, files: list.map((f) => f.info), faces: facesOf(list.map((f) => f.info)) }));
			for (const fam of families) {
				const fonts = new Map(fam.files.map((info) => [info.path, files.find((f) => f.info.path === info.path)!.font]));
				registerFamily(fam.id, {
					label: fam.family,
					faces: Object.fromEntries(Object.entries(fam.faces).map(([face, info]) => [face, async () => (await read(info.path)).arrayBuffer()])),
					has: (face, codePoint) => {
						const info = fam.faces[face] ?? fam.faces.regular;
						return !!info && !!fonts.get(info.path)?.hasGlyphForCodePoint(codePoint);
					}
				});
			}
			const ids = new Set(families.map((f) => f.id));
			for (const id of registeredFamilies('user:')) if (!ids.has(id)) unregisterFamily(id);
			userFonts.families = families.sort((a, b) => a.family.localeCompare(b.family));
		} finally {
			userFonts.loaded = true;
			reading = null;
		}
	})();
	return reading;
}

/** Reads the fonts again when the folder changes (another tab, the sync); returns the end of that */
export function watchUserFonts(): () => void {
	return watch((paths) => {
		if (paths.some((p) => p === FONT_FOLDER || p.startsWith(`${FONT_FOLDER}/`))) void loadUserFonts();
	});
}

/** Puts font files into the font folder (under a free name): files of the user's files (`paths`) or from the computer.
 * Files that are no fonts are left out; the paths of those added */
export async function addFonts(from: { paths?: readonly string[]; files?: readonly File[] }): Promise<string[]> {
	await mkdir(FONT_FOLDER);
	const taken = (await list(FONT_FOLDER)).map((e) => e.name);
	const added: string[] = [];
	const target = (name: string) => {
		const path = join(FONT_FOLDER, uniqueName(name, taken));
		taken.push(path.slice(path.lastIndexOf('/') + 1));
		added.push(path);
		return path;
	};
	const isFont = async (blob: Blob, name: string) => !!(await describeFont(new Uint8Array(await blob.arrayBuffer()), name, 0));
	for (const path of from.paths ?? []) {
		const name = path.slice(path.lastIndexOf('/') + 1);
		if (await isFont(await read(path), name)) await copy(path, target(name));
	}
	for (const file of from.files ?? []) if (await isFont(file, file.name)) await write(target(file.name), file);
	await loadUserFonts();
	return added;
}

/** Puts a font's bytes into the font folder (a font installed from the catalog) */
export async function addFontBytes(name: string, bytes: Uint8Array): Promise<string> {
	const [path] = await addFonts({ files: [new File([bytes as Uint8Array<ArrayBuffer>], name)] });
	return path;
}

/** Moves the files of families into the trash (with “Undo”) */
export async function removeFamilies(ids: readonly CustomFont[]): Promise<boolean> {
	const paths = userFonts.families.filter((f) => ids.includes(f.id)).flatMap((f) => f.files.map((file) => file.path));
	if (!paths.length) return false;
	const done = await deleteToTrash(paths, () => void loadUserFonts());
	await loadUserFonts();
	return done;
}
