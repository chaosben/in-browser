import { Text, type EditorState, type StateEffect } from '@codemirror/state';
import type { Entry } from '@in-browser/files/fs.js';
import { basename } from '@in-browser/files/path.js';
import type { Decoded, Encoding, LineEnding } from '#lib/document.js';
import type { FileStamp } from '#lib/drafts.js';
import { createState } from '#lib/editor/setup.js';
import { m } from '#lib/i18n/index.js';

// One open file: its CodeMirror state and everything about saving it.

export const stampOf = (entry: Entry): FileStamp => ({ size: entry.size ?? 0, modified: entry.modified ?? 0 });
export const sameStamp = (a: FileStamp | null, b: FileStamp | null) => !!a && !!b && a.size === b.size && a.modified === b.modified;
const sameEncoding = (a: Encoding, b: Encoding) => a.charset === b.charset && a.bom === b.bom;

export class Tab {
	readonly id: string;
	path = $state<string | null>(null);
	/** Number of an untitled tab ("Untitled 2") */
	readonly untitled: number;
	/** Name of a file opened from the computer (not saved here yet) */
	fileName = $state<string | null>(null);
	get name() {
		return this.path ? basename(this.path) : (this.fileName ?? m.common.untitled(this.untitled));
	}
	/** CodeMirror state; kept current while the tab is shown */
	state: EditorState;
	/** Counts changes of the text (for the preview) */
	version = $state(0);
	/** Text as last loaded or saved */
	saved: Text;
	encoding = $state<Encoding>({ charset: 'utf-8', bom: false });
	eol = $state<LineEnding>('\n');
	savedEncoding: Encoding = { charset: 'utf-8', bom: false };
	savedEol: LineEnding = '\n';
	changedText = $state(false);
	dirty = $derived(this.changedText || !sameEncoding(this.encoding, this.savedEncoding) || this.eol !== this.savedEol);
	/** The file as last read or written (null: untitled or not there) */
	stamp: FileStamp | null = null;
	/** Changed or removed elsewhere while open */
	conflict = $state<'changed' | 'deleted' | null>(null);
	/** The last save failed (e.g. a connected folder without access): shown as the save state until a save works */
	saveError = $state<string | null>(null);
	/** Characters the encoding can't hold: automatic saving waits */
	problem = $state<{ unmappable: number } | null>(null);
	/** Automatic save is waiting for the pause after typing */
	pending = $state(false);
	saving = $state(false);
	history = $state({ undo: 0, redo: 0 });
	cursor = $state({ line: 1, column: 1, selected: 0 });
	/** Offset of the cursor in the text (the views mark what it is on) */
	head = $state(0);
	language = $state<string | null>(null);
	/** Scroll position while another tab is shown */
	scroll: StateEffect<unknown> | null = null;
	/** Saving or renaming: our own change notifications don't count as changes from elsewhere */
	busy = false;

	constructor(init: {
		id?: string;
		path: string | null;
		untitled: number;
		fileName?: string | null;
		text: string;
		saved: string;
		wrap: boolean;
	}) {
		this.id = init.id ?? crypto.randomUUID();
		this.path = init.path;
		this.untitled = init.untitled;
		this.fileName = init.fileName ?? null;
		this.state = createState(init.text, init.wrap);
		this.saved = init.text === init.saved ? this.state.doc : Text.of(init.saved.split(/\r\n|\r|\n/));
		this.changedText = !this.state.doc.eq(this.saved);
	}

	/** Takes over loaded or saved content as the new clean state */
	setSaved(decoded: Pick<Decoded, 'encoding' | 'eol'>, stamp: FileStamp | null) {
		this.saved = this.state.doc;
		this.changedText = false;
		this.encoding = this.savedEncoding = decoded.encoding;
		this.eol = this.savedEol = decoded.eol;
		this.stamp = stamp;
		this.conflict = null;
		this.problem = null;
	}

	/** Name suggested when saving or downloading */
	get suggestedName() {
		return this.path ? this.name : (this.fileName ?? `${this.name}.txt`);
	}
}
