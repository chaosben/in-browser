// The commands every drawing tool offers for a selection of ink items and pictures (Notes, the PDF Editor): duplicate,
// delete, thickness, and arranging – draw order, align (2+), distribute (3+). Each acts on the selection, one undo step;
// without one the thickness sets the chosen tool's (remembered). The tools place them in their ribbon (format and
// "Arrange" tabs, `arrangeGroups`); the color and style popovers are `InkColorButton`/`InkStyleButton`.
// Speed: `enabled`/`active` read only the selection's and the tools' state, never anything of the drawing path.

import type { Command } from '@in-browser/brand/commands.js';
import type { RibbonGroup } from '@in-browser/brand/ribbon.js';
import type { AlignEdge, Order } from '../edit/items.js';
import { inkMessages } from '../i18n/index.svelte.js';
import type { Selection } from '../input/selection.svelte.js';
import type { SceneItem, SurfacePage } from '../render/kit.js';
import { HIGHLIGHTER_SIZES, PEN_SIZES } from '../sizes.js';

/** What the commands need of the tool settings (`InkTools`) */
export interface InkToolSettings {
	readonly tool: string;
	readonly ink: { size: number };
	store(): void;
}

export interface InkCommandOptions<P extends SurfacePage, I extends SceneItem> {
	/** The tool's selection (null before the surface is there) */
	selection: () => Selection<P, I> | null | undefined;
	tools: InkToolSettings;
	/** The chosen tool draws strokes or shapes (then the thickness sets its own without a selection) */
	drawsInk: () => boolean;
}

export type InkSelectionCommands<P extends SurfacePage, I extends SceneItem> = ReturnType<typeof inkSelectionCommands<P, I>>;

export function inkSelectionCommands<P extends SurfacePage, I extends SceneItem>({ selection, tools, drawsInk }: InkCommandOptions<P, I>) {
	/** The selection, when there is one */
	const sel = () => {
		const s = selection();
		return s?.count ? s : null;
	};
	const count = () => sel()?.count ?? 0;
	/** Selected items that may move (fixed ones – marked text – make the whole selection stay) */
	const movable = () => (sel()?.fixed ? 0 : count());
	const sm = inkMessages().selection;
	const tm = inkMessages().tools;
	const am = inkMessages().arrange;

	const order = (to: Order, label: string, icon: string): Command => ({
		id: `order:${to}`,
		label,
		icon,
		enabled: () => count() > 0,
		run: () => sel()?.reorder(to)
	});
	const align = (edge: AlignEdge, label: string, icon: string): Command => ({
		id: `align:${edge}`,
		label,
		tip: am.alignTip,
		icon,
		enabled: () => movable() > 1,
		run: () => sel()?.align(edge)
	});
	const distribute = (axis: 'x' | 'y', label: string, icon: string): Command => ({
		id: `distribute:${axis}`,
		label,
		tip: am.distributeTip,
		icon,
		enabled: () => movable() > 2,
		run: () => sel()?.distribute(axis)
	});

	return {
		sel,
		duplicate: {
			id: 'duplicate',
			label: sm.duplicate,
			icon: 'icon-[material-symbols-light--content-copy-outline]',
			enabled: () => movable() > 0,
			run: () => sel()?.duplicate()
		} satisfies Command,
		delete: {
			id: 'deleteSelection',
			label: sm.delete,
			icon: 'icon-[material-symbols-light--delete-outline]',
			shortcut: { key: 'Delete' },
			enabled: () => !!selection()?.active,
			run: () => selection()?.delete()
		} satisfies Command,
		/** Thickness of the selected strokes and shapes, else of the chosen tool (the highlighter has its own sizes) */
		thickness: {
			id: 'thickness',
			label: tm.size,
			icon: 'icon-[material-symbols-light--line-weight]',
			enabled: () => {
				const s = sel();
				return s ? !!s.size : drawsInk();
			},
			menu: () => {
				const s = sel();
				const current = s ? s.size : tools.ink.size;
				const sizes = !s && tools.tool === 'highlighter' ? HIGHLIGHTER_SIZES : PEN_SIZES;
				return sizes.map((size) => ({
					label: tm.sizeValue(size),
					checked: size === current,
					run: () => {
						if (s) return s.resize(size);
						tools.ink.size = size;
						tools.store();
					}
				}));
			}
		} satisfies Command,
		front: order('front', am.front, 'icon-[material-symbols-light--flip-to-front]'),
		forward: order('forward', am.forward, 'icon-[material-symbols-light--arrow-upward]'),
		backward: order('backward', am.backward, 'icon-[material-symbols-light--arrow-downward]'),
		back: order('back', am.back, 'icon-[material-symbols-light--flip-to-back]'),
		left: align('left', am.left, 'icon-[material-symbols-light--align-horizontal-left]'),
		center: align('center', am.center, 'icon-[material-symbols-light--align-horizontal-center]'),
		right: align('right', am.right, 'icon-[material-symbols-light--align-horizontal-right]'),
		top: align('top', am.top, 'icon-[material-symbols-light--align-vertical-top]'),
		middle: align('middle', am.middle, 'icon-[material-symbols-light--align-vertical-center]'),
		bottom: align('bottom', am.bottom, 'icon-[material-symbols-light--align-vertical-bottom]'),
		horizontal: distribute('x', am.horizontal, 'icon-[material-symbols-light--horizontal-distribute]'),
		vertical: distribute('y', am.vertical, 'icon-[material-symbols-light--vertical-distribute]')
	};
}

/** The groups of the tab "Arrange": order, align, distribute */
export function arrangeGroups<P extends SurfacePage, I extends SceneItem>(sc: InkSelectionCommands<P, I>): RibbonGroup[] {
	const g = inkMessages().arrange.groups;
	return [
		{ id: 'order', label: g.order, items: [sc.front, sc.forward, sc.backward, sc.back] },
		{ id: 'align', label: g.align, items: [sc.left, sc.center, sc.right, sc.top, sc.middle, sc.bottom] },
		{ id: 'distribute', label: g.distribute, items: [sc.horizontal, sc.vertical] }
	];
}
