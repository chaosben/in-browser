<script lang="ts">
	// One section of the selection's properties (or the project's canvas) in a ribbon popover or a dialog: the fields
	// of `Inspector.svelte`, without the inspector's frame (no title, search or folding – `InspectorState` plain).
	import { InspectorState, setInspector } from '@in-browser/brand/inspector.svelte.js';
	import type { Editor } from '#lib/project/editor.svelte.js';
	import type { EditorCommands } from '#lib/ui/commands.js';
	import Inspector, { type PropertySection } from './Inspector.svelte';

	interface Props {
		editor: Editor;
		commands: EditorCommands;
		only: PropertySection;
	}

	let { editor, commands, only }: Props = $props();

	setInspector(new InspectorState('screen-capture', { plain: true }));
</script>

<Inspector {editor} {commands} {only} />
