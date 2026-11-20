import type { Player } from '#lib/preview/player.svelte.js';
import type { Editor } from '#lib/project/editor.svelte.js';
import type { IconData, ImageAsset, Point, Source, ToolKind } from '#lib/project/types.js';
import type { DragPayload } from './drag.js';
import type { LibraryScope } from '#lib/ui/library.svelte.js';

/** Where a dragged tile was dropped: `start` on the timeline, `point` (content coordinates) in the preview */
export interface DropPlace {
	start?: number;
	point?: Point;
}

/** Actions the editor provides to the tools */
export interface ToolActions {
	/** Without `at`: at the playhead in the default position */
	addAnnotation(kind: ToolKind, at?: DropPlace): void;
	/** Own image from the media bin */
	addImage(imageId: string, at?: DropPlace): void;
	addIcon(icon: IconData, at?: DropPlace): void;
	addZoom(at?: DropPlace): void;
	/** Library entry: at the playhead or the dropped time, keeping its place in the picture */
	insertLibrary(scope: LibraryScope, id: string, at?: DropPlace): Promise<void>;
	/** Copies or moves a library entry into the other library */
	transferLibrary(scope: LibraryScope, id: string, move: boolean): Promise<void>;
	record(): void;
	importMedia(): void;
	importFromFiles(): void;
}

/** What every side panel gets as its `context` (the open project; getters, so a reload shows the new one) */
export interface PanelContext {
	readonly editor: Editor;
	readonly player: Player;
	readonly actions: ToolActions;
}

/** Tile: inserts something at the playhead on click, or where it is dropped when dragged */
export interface ToolItem {
	id: string;
	icon: string;
	label: string;
	run(actions: ToolActions): void;
	drag?: DragPayload;
}

/** One entry of the media bin */
export type BinEntry = { kind: 'source'; id: string; source: Source } | { kind: 'image'; id: string; image: ImageAsset };
