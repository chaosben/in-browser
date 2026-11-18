// Tool settings: chosen tool, color and size per ink tool (shapes use the pen's), eraser size, smoothing, chosen
// shape, "only the pen draws". Remembered in localStorage (`notes:tools`) for the next notebook.

import type { EraserMode, Tool, ToolState } from '#lib/input/controller.js';
import { SHAPE_KINDS, type ShapeKind } from '#lib/ink/shapes.js';
import { SMOOTHING_LEVELS } from '#lib/ink/smooth.js';

const KEY = 'notes:tools';

/** Size choices in points */
export const PEN_SIZES = [0.8, 1.5, 2.5, 4, 7] as const;
export const HIGHLIGHTER_SIZES = [8, 14, 22] as const;
/** Eraser radius in screen pixels */
export const ERASER_SIZES = [8, 16, 32] as const;

interface Saved {
	tool: Tool;
	pen: { color: string; size: number };
	highlighter: { color: string; size: number };
	eraser: number;
	eraserMode: EraserMode;
	penOnly: boolean;
	smoothing: number;
	shape: ShapeKind;
}

const TOOLS: readonly Tool[] = ['pen', 'highlighter', 'shape', 'eraser', 'lasso', 'laser'];

const DEFAULTS: Saved = {
	tool: 'pen',
	pen: { color: '#1e293b', size: 1.5 },
	highlighter: { color: '#facc15', size: 14 },
	eraser: 16,
	eraserMode: 'stroke',
	penOnly: false,
	smoothing: 0.3,
	shape: 'arrow'
};

const HEX = /^#[0-9a-f]{6}$/;

function load(): Saved {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null;
		if (!raw || typeof raw !== 'object') return structuredClone(DEFAULTS);
		const ink = (v: unknown, d: { color: string; size: number }) => {
			const o = v as { color?: unknown; size?: unknown } | undefined;
			return {
				color: typeof o?.color === 'string' && HEX.test(o.color) ? o.color : d.color,
				size: typeof o?.size === 'number' && o.size > 0 && o.size < 100 ? o.size : d.size
			};
		};
		return {
			tool: TOOLS.includes(raw.tool as Tool) ? raw.tool! : DEFAULTS.tool,
			pen: ink(raw.pen, DEFAULTS.pen),
			highlighter: ink(raw.highlighter, DEFAULTS.highlighter),
			eraser: typeof raw.eraser === 'number' && raw.eraser > 0 ? raw.eraser : DEFAULTS.eraser,
			eraserMode: raw.eraserMode === 'pixel' ? 'pixel' : 'stroke',
			penOnly: raw.penOnly === true,
			smoothing: SMOOTHING_LEVELS.includes(raw.smoothing as (typeof SMOOTHING_LEVELS)[number]) ? raw.smoothing! : DEFAULTS.smoothing,
			shape: SHAPE_KINDS.includes(raw.shape as ShapeKind) ? raw.shape! : DEFAULTS.shape
		};
	} catch {
		return structuredClone(DEFAULTS);
	}
}

class Tools {
	tool = $state<Tool>('pen');
	pen = $state({ ...DEFAULTS.pen });
	highlighter = $state({ ...DEFAULTS.highlighter });
	eraser = $state(DEFAULTS.eraser);
	eraserMode = $state<EraserMode>(DEFAULTS.eraserMode);
	penOnly = $state(false);
	smoothing = $state(DEFAULTS.smoothing);
	shape = $state<ShapeKind>(DEFAULTS.shape);
	/** A pen hovered this session (enables hover previews and the palm rejection hint) */
	penHover = $state(false);

	constructor() {
		const saved = typeof localStorage === 'undefined' ? DEFAULTS : load();
		this.tool = saved.tool;
		this.pen = saved.pen;
		this.highlighter = saved.highlighter;
		this.eraser = saved.eraser;
		this.eraserMode = saved.eraserMode;
		this.penOnly = saved.penOnly;
		this.smoothing = saved.smoothing;
		this.shape = saved.shape;
	}

	/** Ink settings of the chosen tool (eraser: those of the pen, for the preview) */
	get ink() {
		return this.tool === 'highlighter' ? this.highlighter : this.pen;
	}

	/** Snapshot for the input pipeline (plain values, read once per stroke) */
	state(): ToolState {
		const ink = this.tool === 'highlighter' ? this.highlighter : this.pen;
		return {
			tool: this.tool,
			color: ink.color,
			size: ink.size,
			eraser: this.eraser,
			eraserMode: this.eraserMode,
			penOnly: this.penOnly,
			smoothing: this.smoothing,
			shape: this.shape
		};
	}

	store() {
		try {
			const saved: Saved = {
				tool: this.tool,
				pen: { ...this.pen },
				highlighter: { ...this.highlighter },
				eraser: this.eraser,
				eraserMode: this.eraserMode,
				penOnly: this.penOnly,
				smoothing: this.smoothing,
				shape: this.shape
			};
			localStorage.setItem(KEY, JSON.stringify(saved));
		} catch {
			// Storage blocked: the settings just don't survive a reload
		}
	}
}

export const tools = new Tools();
