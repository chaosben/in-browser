// Tool settings of a tool using the ink core: chosen tool, color and size per ink tool (shapes use the pen's unless
// the tool asks for their own – `ownShapeInk`), eraser
// size, smoothing, chosen shape and its style (fill, dashes, hand-drawn), snapping, "only the pen draws". Remembered in
// localStorage under the tool's key (e.g. `notes:tools`) for the next document, so pen settings feel the same in
// every tool. `T`: tools of its own the tool adds (e.g. the PDF Editor's "Hand"), handled through `InputHandlers.gesture`.

import { loadJson, storeJson } from '@in-browser/brand/storage.js';
import type { EraserMode, Tool, ToolState } from './input/controller.js';
import { DASHES, PLAIN, SHAPE_KINDS, type Dash, type ShapeKind, type ShapeStyle } from './shapes.js';
import { SMOOTHING_LEVELS } from './smooth.js';

interface Saved<T extends string> {
	tool: Tool | T;
	pen: { color: string; size: number };
	highlighter: { color: string; size: number };
	/** Color and size of shapes when they have their own (else the pen's) */
	shapes?: { color: string; size: number };
	eraser: number;
	eraserMode: EraserMode;
	penOnly: boolean;
	smoothing: number;
	shape: ShapeKind;
	shapeStyle: ShapeStyle;
	/** Shapes and selections snap (15° steps, edges and centers, equal spacing) */
	snap: boolean;
}

const TOOLS: readonly Tool[] = ['pen', 'highlighter', 'shape', 'eraser', 'lasso', 'laser'];

const DEFAULTS: Saved<never> = {
	tool: 'pen',
	pen: { color: '#1e293b', size: 1.5 },
	highlighter: { color: '#facc15', size: 14 },
	eraser: 16,
	eraserMode: 'stroke',
	penOnly: false,
	smoothing: 0.3,
	shape: 'arrow',
	shapeStyle: PLAIN,
	snap: true
};

/** A color, optionally with an opacity (see-through ink) */
const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;
const FILL = /^#[0-9a-f]{8}$/;

function load<T extends string>(key: string, own: readonly T[], first: Tool | T): Saved<T> {
	const raw = loadJson<Partial<Saved<T>> | null>(key, null);
	if (!raw || typeof raw !== 'object') return { ...structuredClone(DEFAULTS), tool: first };
	const ink = (v: unknown, d: { color: string; size: number }) => {
		const o = v as { color?: unknown; size?: unknown } | undefined;
		return {
			color: typeof o?.color === 'string' && HEX.test(o.color) ? o.color : d.color,
			size: typeof o?.size === 'number' && o.size > 0 && o.size < 100 ? o.size : d.size
		};
	};
	return {
		tool: TOOLS.includes(raw.tool as Tool) || own.includes(raw.tool as T) ? raw.tool! : first,
		pen: ink(raw.pen, DEFAULTS.pen),
		highlighter: ink(raw.highlighter, DEFAULTS.highlighter),
		shapes: ink(raw.shapes ?? raw.pen, DEFAULTS.pen),
		eraser: typeof raw.eraser === 'number' && raw.eraser > 0 ? raw.eraser : DEFAULTS.eraser,
		eraserMode: raw.eraserMode === 'pixel' ? 'pixel' : 'stroke',
		penOnly: raw.penOnly === true,
		smoothing: SMOOTHING_LEVELS.includes(raw.smoothing as (typeof SMOOTHING_LEVELS)[number]) ? raw.smoothing! : DEFAULTS.smoothing,
		shape: SHAPE_KINDS.includes(raw.shape as ShapeKind) ? raw.shape! : DEFAULTS.shape,
		shapeStyle: {
			fill: typeof raw.shapeStyle?.fill === 'string' && FILL.test(raw.shapeStyle.fill) ? raw.shapeStyle.fill : null,
			dash: DASHES.includes(raw.shapeStyle?.dash as Dash) ? raw.shapeStyle!.dash : 'solid',
			sketch: raw.shapeStyle?.sketch === true
		},
		snap: raw.snap !== false
	};
}

export class InkTools<T extends string = never> {
	tool = $state<Tool | T>('pen');
	pen = $state({ ...DEFAULTS.pen });
	highlighter = $state({ ...DEFAULTS.highlighter });
	/** Color and size of shapes (used only with `ownShapeInk`) */
	shapes = $state({ ...DEFAULTS.pen });
	eraser = $state(DEFAULTS.eraser);
	eraserMode = $state<EraserMode>(DEFAULTS.eraserMode);
	penOnly = $state(false);
	smoothing = $state(DEFAULTS.smoothing);
	shape = $state<ShapeKind>(DEFAULTS.shape);
	shapeStyle = $state<ShapeStyle>({ ...DEFAULTS.shapeStyle });
	snap = $state(true);
	/** A pen hovered this session (enables hover previews and the palm rejection hint) */
	penHover = $state(false);

	constructor(
		/** localStorage key, `<tool>:tools` */
		private readonly key: string,
		/** The tool's own tools */
		own: readonly T[] = [],
		/** Chosen before anything was remembered */
		first: Tool | T = 'pen',
		/** Shapes keep a color and size of their own (the PDF Editor: every tool remembers its format) */
		private readonly ownShapeInk = false
	) {
		const saved: Saved<T> = typeof localStorage === 'undefined' ? { ...DEFAULTS, tool: first } : load(key, own, first);
		this.tool = saved.tool;
		this.pen = saved.pen;
		this.highlighter = saved.highlighter;
		this.shapes = saved.shapes ?? { ...saved.pen };
		this.eraser = saved.eraser;
		this.eraserMode = saved.eraserMode;
		this.penOnly = saved.penOnly;
		this.smoothing = saved.smoothing;
		this.shape = saved.shape;
		this.shapeStyle = { ...saved.shapeStyle };
		this.snap = saved.snap;
	}

	/** Ink settings of the chosen tool (eraser: those of the pen, for the preview) */
	get ink() {
		return this.tool === 'highlighter' ? this.highlighter : this.tool === 'shape' && this.ownShapeInk ? this.shapes : this.pen;
	}

	/** Snapshot for the input pipeline (plain values, read once per stroke) */
	state(): ToolState<T> {
		const ink = this.ink;
		return {
			tool: this.tool,
			color: ink.color,
			size: ink.size,
			eraser: this.eraser,
			eraserMode: this.eraserMode,
			penOnly: this.penOnly,
			smoothing: this.smoothing,
			shape: this.shape,
			shapeStyle: { ...this.shapeStyle },
			snap: this.snap
		};
	}

	store() {
		const saved: Saved<T> = {
			tool: this.tool,
			pen: { ...this.pen },
			highlighter: { ...this.highlighter },
			...(this.ownShapeInk ? { shapes: { ...this.shapes } } : {}),
			eraser: this.eraser,
			eraserMode: this.eraserMode,
			penOnly: this.penOnly,
			smoothing: this.smoothing,
			shape: this.shape,
			shapeStyle: { ...this.shapeStyle },
			snap: this.snap
		};
		storeJson(this.key, saved);
	}
}
