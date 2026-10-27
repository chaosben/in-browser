import MediaPanel from '#lib/components/MediaPanel.svelte';
import { OVERLAY_KINDS, ZOOM_ICON } from '#lib/project/defaults.js';
import type { AnnotationKind } from '#lib/project/types.js';
import { m } from '#lib/i18n/index.js';
import type { ToolGroup, ToolItem } from './types.js';

function annotation(kind: AnnotationKind): ToolItem {
	const info = OVERLAY_KINDS[kind];
	return { id: kind, icon: info.icon, label: info.label, run: (a) => a.addAnnotation(kind) };
}

/** Left tool rail: only things you add to the project. Editing tools sit above the timeline. */
export const TOOL_GROUPS: ToolGroup[] = [
	{
		id: 'media',
		icon: 'icon-[material-symbols-light--video-library-outline]',
		label: m.tools.groups.media,
		tabs: [{ id: 'media', label: m.tools.groups.media, component: MediaPanel }]
	},
	{
		id: 'annotations',
		icon: 'icon-[material-symbols-light--draw-outline]',
		label: m.tools.groups.annotations,
		tabs: [
			{
				id: 'annotations',
				label: m.tools.groups.annotations,
				items: (['arrow', 'line', 'rect', 'ellipse', 'highlight', 'spotlight', 'blur', 'step'] as const).map(annotation)
			}
		]
	},
	{
		id: 'text',
		icon: 'icon-[material-symbols-light--title]',
		label: m.tools.groups.text,
		tabs: [{ id: 'text', label: m.tools.groups.text, items: (['text', 'callout'] as const).map(annotation) }]
	},
	{
		id: 'zoom',
		icon: 'icon-[material-symbols-light--zoom-in]',
		label: m.tools.groups.zoom,
		tabs: [
			{
				id: 'zoom',
				label: m.tools.groups.zoom,
				items: [{ id: 'zoom', icon: ZOOM_ICON, label: m.editor.zoomSegment, run: (a) => a.addZoom() }]
			}
		]
	}
];
