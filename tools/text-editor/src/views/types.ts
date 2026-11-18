import type { ChangeSpec } from '@codemirror/state';
import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
import type { Tab } from '#lib/workspace.svelte.js';
import type { TableFormat } from './table/model.js';
import type { TreeFormat } from './tree/model.js';

// What a view gets from the page: the tab whose text it shows, and the ways back into the text.

export interface ViewUi {
	/** Actions on the current file, shown in the menu at the file name (stable: their `run` reads the view's state) */
	actions?: MenuEntry[];
	/** Entries for the "View" menu */
	view?: MenuEntry[];
	/** Short status for the footer (rows, filter, path of the selected node) */
	status?: () => string | null;
}

export interface ViewHost {
	/** Changes the text (one undo step), from the view */
	edit(spec: ChangeSpec): void;
	/** Puts the cursor of the text on a place (and shows it, when the text is visible) */
	reveal(from: number, to?: number): void;
	undo(): void;
	redo(): void;
	/** The view's menus and status while it is shown; returns the cleanup */
	register(ui: ViewUi): () => void;
	/** Shows the text (next to the view where there is room) with the cursor at `pos` */
	showText(pos: number): void;
	/** The text is visible next to the view (clicks then also move its cursor) */
	readonly textVisible: boolean;
	/** CSV: the first row holds the column names (a setting of the whole editor) */
	tableHeader: boolean;
}

export interface ViewProps {
	tab: Tab;
	host: ViewHost;
	/** Table or tree format (previews have none) */
	format?: TableFormat | TreeFormat;
}
