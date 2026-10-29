import type { Component } from 'svelte';
import type { Player } from '#lib/preview/player.svelte.js';
import type { Editor } from '#lib/project/editor.svelte.js';
import type { IconData, Point, ToolKind } from '#lib/project/types.js';
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
	insertLibrary(scope: LibraryScope, id: string, at?: DropPlace): void;
	/** Copies or moves a library entry into the other library */
	transferLibrary(scope: LibraryScope, id: string, move: boolean): void;
	record(): void;
	importMedia(): void;
	importFromFiles(): void;
}

export interface ToolProps {
	editor: Editor;
	player: Player;
	actions: ToolActions;
}

/** Tile: inserts something at the playhead on click, or where it is dropped when dragged */
export interface ToolItem {
	id: string;
	icon: string;
	label: string;
	run(actions: ToolActions): void;
	drag?: DragPayload;
}

/** Tab within a group: its own content (`component`) and/or tiles below */
export interface ToolTab {
	id: string;
	label: string;
	items?: ToolItem[];
	component?: Component<ToolProps>;
}

/** Group in the left tool rail; multiple tabs only when the content becomes varied */
export interface ToolGroup {
	id: string;
	icon: string;
	label: string;
	tabs: ToolTab[];
}
