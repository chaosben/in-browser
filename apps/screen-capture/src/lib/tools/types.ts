import type { Component } from 'svelte';
import type { Player } from '#lib/preview/player.svelte.js';
import type { Editor } from '#lib/project/editor.svelte.js';
import type { AnnotationKind } from '#lib/project/types.js';

/** Actions the editor provides to the tools */
export interface ToolActions {
	addAnnotation(kind: AnnotationKind): void;
	addZoom(): void;
	record(): void;
	importVideo(): void;
}

export interface ToolProps {
	editor: Editor;
	player: Player;
	actions: ToolActions;
}

/** Tile: inserts something at the playhead on click */
export interface ToolItem {
	id: string;
	icon: string;
	label: string;
	run(actions: ToolActions): void;
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
