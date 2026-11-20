// The side panels on the left (`PanelRail`): only what you add to the project – media, library entries, icons,
// annotations, text and zoom. What cuts or changes the timeline is in the ribbon. Add panels and tiles only here.

import type { PanelSpec } from '@in-browser/brand/panels.js';
import { OVERLAY_KINDS, ZOOM_ICON } from '#lib/project/defaults.js';
import type { ToolKind } from '#lib/project/types.js';
import { m } from '#lib/i18n/index.js';
import type { PanelContext, ToolItem } from './types.js';

function annotation(kind: ToolKind): ToolItem {
	const info = OVERLAY_KINDS[kind];
	return { id: kind, icon: info.icon, label: info.label, run: (a) => a.addAnnotation(kind), drag: { type: 'annotation', kind } };
}

export const ANNOTATION_TILES = (['arrow', 'line', 'rect', 'ellipse', 'highlight', 'spotlight', 'blur', 'step', 'click'] as const).map(annotation);
export const TEXT_TILES = (['text', 'callout'] as const).map(annotation);
export const ZOOM_TILES: ToolItem[] = [{ id: 'zoom', icon: ZOOM_ICON, label: m.editor.zoomSegment, run: (a) => a.addZoom(), drag: { type: 'zoom' } }];

/** The panels in the order of the rail; open panel and width are kept as `screen-capture:panel` */
export const PANELS: PanelSpec<PanelContext>[] = [
	{
		id: 'media',
		icon: 'icon-[material-symbols-light--video-library-outline]',
		label: m.tools.groups.media,
		load: async () => (await import('#lib/components/MediaPanel.svelte')).default
	},
	{
		id: 'library',
		icon: 'icon-[material-symbols-light--bookmarks-outline]',
		label: m.tools.groups.library,
		load: async () => (await import('#lib/components/LibraryPanel.svelte')).default
	},
	{
		id: 'icons',
		icon: 'icon-[material-symbols-light--interests-outline]',
		label: m.tools.groups.icons,
		load: async () => (await import('#lib/components/IconPanel.svelte')).default
	},
	{
		id: 'annotations',
		icon: 'icon-[material-symbols-light--draw-outline]',
		label: m.tools.groups.annotations,
		load: async () => (await import('#lib/components/AnnotationsPanel.svelte')).default
	},
	{
		id: 'text',
		icon: 'icon-[material-symbols-light--title]',
		label: m.tools.groups.text,
		load: async () => (await import('#lib/components/TextPanel.svelte')).default
	},
	{
		id: 'zoom',
		icon: 'icon-[material-symbols-light--zoom-in]',
		label: m.tools.groups.zoom,
		load: async () => (await import('#lib/components/ZoomPanel.svelte')).default
	}
];
