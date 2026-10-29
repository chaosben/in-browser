import { m } from '#lib/i18n/index.js';
import { oneLine } from '#lib/util/text.js';
import { FREEZE_ICON, OVERLAY_KINDS } from './defaults.js';
import type { Editor } from './editor.svelte.js';
import type { Annotation, Item } from './types.js';

/** Caption of an annotation: its text on one line, else what identifies it */
export function annotationLabel(a: Annotation, editor: Editor): string {
	if (a.kind === 'text' || a.kind === 'callout') return oneLine(a.text) || OVERLAY_KINDS[a.kind].label;
	if (a.kind === 'step') return m.kinds.stepN(a.number);
	if (a.kind === 'image') return editor.image(a.imageId)?.name ?? OVERLAY_KINDS.image.label;
	if (a.kind === 'icon') return a.icon.name;
	return OVERLAY_KINDS[a.kind].label;
}

/** Caption of any item (e.g. in lists of items) */
export function itemLabel(item: Item, editor: Editor): string {
	if (item.type === 'annotation') return annotationLabel(item, editor);
	if (item.type === 'freeze') return m.timeline.freeze;
	return editor.source(item.sourceId)?.name ?? m.timeline.missingSource;
}

/** Icon class of an item's type */
export function itemIcon(item: Item, editor: Editor): string {
	if (item.type === 'annotation') return OVERLAY_KINDS[item.kind].icon;
	if (item.type === 'freeze') return FREEZE_ICON;
	return editor.source(item.sourceId)?.hasVideo === false
		? 'icon-[material-symbols-light--music-note]'
		: 'icon-[material-symbols-light--movie-outline]';
}
