import type { Component } from 'svelte';
import type { Player } from '#lib/preview/player.svelte.js';
import type { Editor } from '#lib/project/editor.svelte.js';
import type { AnnotationKind, Point } from '#lib/project/types.js';
import type { DragPayload } from './drag.js';

/** Where a dragged tile was dropped: `start` on the timeline, `point` (content coordinates) in the preview */
export interface DropPlace {
	start?: number;
	point?: Point;
}

/** Actions the editor provides to the tools */
export interface ToolActions {
	/** Without `at`: at the playhead in the default position */
	addAnnotation(kind: AnnotationKind, at?: DropPlace): void;
	addZoom(at?: DropPlace): void;
	record(): void;
	importVideo(): void;
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
