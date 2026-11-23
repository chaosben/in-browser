// "My stamps": pictures kept as files in a hidden folder of the shared file system (`/.apps/pdf-editor/stamps/`), so
// they travel to the user's other devices with the sync. The stamp tool places them like the standard's words.

import { barcodeSvg, type BarcodeSpec } from '@in-browser/graphics/barcode.js';
import { deleteToTrash } from '@in-browser/files/trash-browser.js';
import { copy, list, mkdir, read, readText, write } from '@in-browser/files/fs.js';
import { FormatError } from '@in-browser/files/formats.js';
import { extname, join, stem, uniqueName } from '@in-browser/files/path.js';
import { formBitmap, isForm, pdfForm, type PdfForm, type PdfPicture } from '@in-browser/pdf/write/form.js';
import { encodeImage } from '@in-browser/pdf/write/image.js';
import { svgForm } from '@in-browser/pdf/write/svg.js';
import { loadPdf } from '@in-browser/pdf/load.js';
import type { IconData } from '@in-browser/graphics/icons/types.js';
import { iconSvg, registerStampImage, type StampIcon } from '#lib/render/stamp.js';
import { defaultWords, parseWords, serializeWords, type StampWord } from './stamp-words.js';
import { setStamp, stampChoice } from './tools.svelte.js';

export const STAMP_FOLDER = '/.apps/pdf-editor/stamps';
/** Picture files a stamp can be made of */
export const STAMP_TYPES = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg', '.pdf'];

export interface CustomStamp {
	/** Its file's name without the ending */
	name: string;
	path: string;
	/** When its file last changed: another picture under the same name is another stamp */
	modified: number;
}

/** The user's own stamps, by name (loaded by `loadStamps`) */
export const customStamps = $state<{ list: CustomStamp[] }>({ list: [] });

export async function loadStamps() {
	const entries = await list(STAMP_FOLDER).catch(() => []);
	customStamps.list = entries
		.filter((e) => e.kind === 'file' && STAMP_TYPES.includes(extname(e.name).toLowerCase()))
		.map((e) => ({ name: stem(e.name), path: e.path, modified: e.modified ?? 0 }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** Copies a picture of the user's files into "My stamps" – of a PDF with several pages only the page `page`, as a
 * PDF of its own; the new stamp's path */
export async function addStamp(from: string, page = 0, pages = 1): Promise<string> {
	const file = from.slice(from.lastIndexOf('/') + 1);
	if (pages > 1) return saveStamp(await pdfForm(new Uint8Array(await (await read(from)).arrayBuffer()), page), `${stem(file)} ${page + 1}`);
	await mkdir(STAMP_FOLDER);
	const taken = (await list(STAMP_FOLDER)).map((e) => e.name);
	const path = join(STAMP_FOLDER, uniqueName(file, taken));
	await copy(from, path);
	await loadStamps();
	return path;
}

/** Keeps a vector picture (a piece of a page, comments) as a stamp of its own – a PDF named `name`; its path */
export async function saveStamp(form: PdfForm, name: string): Promise<string> {
	await mkdir(STAMP_FOLDER);
	const taken = (await list(STAMP_FOLDER)).map((e) => e.name);
	const path = join(STAMP_FOLDER, uniqueName(`${name}.pdf`, taken));
	await write(path, new Blob([(await form.pdf) as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
	await loadStamps();
	return path;
}

/** A stamp's picture for a thumbnail (a PDF or SVG drawn; null: show the file itself) */
export async function stampThumbnail(path: string): Promise<ImageBitmap | null> {
	if (extname(path).toLowerCase() !== '.pdf') return null;
	return formBitmap(await pdfForm(new Uint8Array(await (await read(path)).arrayBuffer())));
}

/** Takes a stamp out of "My stamps" (into the trash, with "Undo") */
export async function removeStamp(path: string) {
	if (!(await deleteToTrash([path], () => void loadStamps()))) return;
	// The stamp tool doesn't go on with a picture that is gone
	if (stampChoice.custom === path) {
		setStamp({ custom: null });
		stampTool.picture = null;
	}
	await loadStamps();
}

// --- The words ---

const WORDS_FILE = join(STAMP_FOLDER, 'words.json');

/** The words of the stamp tool (`stamp-words.ts`). `locked`: the file is of a newer version – shown, not changed */
export const stampWords = $state<{ list: StampWord[]; locked: boolean }>({ list: defaultWords(), locked: false });

export async function loadWords() {
	try {
		stampWords.list = parseWords(JSON.parse(await readText(WORDS_FILE)));
		stampWords.locked = false;
	} catch (e) {
		// No file yet: the standard's words. A file that can't be read stays as it is until the user changes the list
		stampWords.list = defaultWords();
		stampWords.locked = e instanceof FormatError && e.reason === 'newer';
	}
}

/** Keeps a changed list (the whole file is written) */
export async function saveWords(words: StampWord[]) {
	if (stampWords.locked) return;
	await mkdir(STAMP_FOLDER);
	await write(WORDS_FILE, serializeWords(words));
	stampWords.list = words;
}

/** The picture a click with the stamp tool places: its key in `stampImages` and its size – in pixels, or with
 * `vector` in points */
export interface StampPicture {
	key: string;
	width: number;
	height: number;
	vector: boolean;
	/** Where it comes from: a stamp of "My stamps", or a picture picked once (empty: an icon) */
	path: string;
	/** Which file under that path and which page of it: `pictureSource` */
	source: string;
}

/** What tells one stamp picture from another: the file, when it changed and the page taken */
export const pictureSource = (path: string, page: number): string => `${path}|${customStamps.list.find((s) => s.path === path)?.modified ?? 0}|${page}`;

/** The picture of the chosen stamp, once it is read (null: a word is chosen, or it is still being read) */
export const stampTool = $state<{ picture: StampPicture | null }>({ picture: null });

/** A picture file ready to be placed: a PDF's first page and an SVG as vectors (an SVG with something vectors
 * can't hold here – text, gradients – as pixels), everything else as pixels */
async function pictureOf(file: Blob, name: string, page: number): Promise<PdfPicture> {
	const type = extname(name).toLowerCase();
	if (type === '.pdf') return pdfForm(new Uint8Array(await file.arrayBuffer()), page);
	if (type === '.svg') return (await svgForm(await file.text())) ?? encodeImage(file);
	return encodeImage(file);
}

function registered(picture: PdfPicture, path: string, source: string): StampPicture {
	const key = crypto.randomUUID();
	registerStampImage(key, picture);
	return { key, width: picture.width, height: picture.height, vector: isForm(picture), path, source };
}

/** A barcode as a picture to place: vectors (its SVG is plain paths, the text below it too) */
export async function barcodePicture(spec: BarcodeSpec): Promise<StampPicture> {
	const drawn = await barcodeSvg(spec);
	if ('problem' in drawn) throw new Error(`No barcode: ${drawn.problem}`);
	const form = await svgForm(drawn.svg);
	return registered(form ?? (await encodeImage(new Blob([drawn.svg], { type: 'image/svg+xml' }))), '', '');
}

/** Reads a stamp's file (`page` of a PDF) and makes it ready to be placed */
export async function stampPicture(path: string, page = 0): Promise<StampPicture> {
	const source = pictureSource(path, page);
	return registered(await pictureOf(await read(path), path, page), path, source);
}

/** How many pages a picture file has to choose from (1 for everything but a PDF) */
export async function picturePages(path: string): Promise<number> {
	if (extname(path).toLowerCase() !== '.pdf') return 1;
	const loaded = await loadPdf(new Uint8Array(await (await read(path)).arrayBuffer()));
	return loaded.locked ? 1 : loaded.doc.getPageCount();
}

/** Longer side of an icon drawn as pixels (only when its drawing can't be kept as vectors) */
const ICON_PIXELS = 1024;

/** An icon in a color (`#rrggbb`, optionally with an opacity) as a picture to be placed – as vectors, and then with
 * its drawing (`icon`), so its stamp can get another color later; an icon vectors can't hold stays pixels in the
 * color it was placed in */
export async function iconPicture(icon: IconData, color: string): Promise<StampPicture & { icon?: StampIcon }> {
	const drawing: StampIcon = { body: icon.body, width: icon.width, height: icon.height };
	const form = await svgForm(iconSvg(drawing, color));
	if (form) return { ...registered(form, '', ''), icon: drawing };
	const k = ICON_PIXELS / Math.max(icon.width, icon.height);
	return registered(await encodeImage(new Blob([iconSvg(drawing, color, Math.round(icon.width * k), Math.round(icon.height * k))], { type: 'image/svg+xml' })), '', '');
}
