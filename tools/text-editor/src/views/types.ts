import type { ChangeSpec } from '@codemirror/state';
import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
import type { Tab } from '#lib/tab.svelte.js';
import type { TableFormat } from './table/model.js';
import type { TreeFormat } from './tree/model.js';

// What a view gets from the page: the file whose text it shows, and the ways back into the text.

/** What one command of the view's ribbon tab does there (read when used, so it acts on the current state) */
export interface ViewAction {
	run?: () => void;
	enabled?: () => boolean;
	/** Switches: on now */
	active?: () => boolean;
	/** Choices (menu commands) */
	menu?: () => MenuEntry[];
}

export interface ViewUi {
	/** Which contextual ribbon tab belongs to the view */
	kind: 'table' | 'tree';
	/**
	 * The view's side of the commands in `commands.ts` (by id): they act on the picked rows or nodes, else on the
	 * current cell or node. Commands without an entry here are disabled.
	 */
	actions: Partial<Record<string, ViewAction>>;
	/** How many rows or nodes are picked (phones open the view's tab for a selection) */
	picked(): number;
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
	/** The view's commands and status while it is shown; returns the cleanup */
	register(ui: ViewUi): () => void;
	/** Shows the text (next to the view where there is room) with the cursor at `pos` */
	showText(pos: number): void;
	/** Puts the focus into the text (when it is visible) */
	focusText(): void;
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
