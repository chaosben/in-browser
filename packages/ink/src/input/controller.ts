// Input pipeline of the drawing surface. Pointer Events only (no mouse/touch events for the logic):
// - the drawing pointer's points come from `pointerrawupdate` where the browser sends it (Chromium, Firefox; not
//   for every pointer type) and `pointermove`, deduplicated by time stamp; each event's coalesced events are used, or the event itself when that list is empty (Firefox
//   Android). Predicted events are only shown, never stored.
// - palm rejection: once a pen was used, touch only pans and zooms (also with the setting "only the pen draws").
//   A second finger shortly after the first turns a just-started finger stroke into a pinch.
// - a hovering pen (pen, no buttons) shows a preview of the brush; hover is never required for anything.
// - a large pen stroke that resembles a shape (line, arrow, triangle, rectangle, ellipse) gets a suggestion to turn
//   it into that shape (`recognize.ts`, shown by `ShapeSuggestion`), checked once when the pen is lifted.
// - shape tool: dragging draws the chosen shape from the start point to the pointer (a shape item, see `shapes.ts`).
// - select ("lasso"): a tap selects the item there, a loop selects what it encloses; dragging the selection (a
//   corner, a point of a shape) moves/scales/reshapes it; dragging an item not selected yet selects and moves it;
//   with Shift or Ctrl/⌘ a tap adds the item or takes it out, a loop adds what it encloses.
// - tools of the tool using this core (a text box, a note …) get the pointer as a `Gesture` from `InputHandlers.gesture`.

import { debug } from '@in-browser/brand/debug.js';
import { snapPoint, type SnapTargets } from '@in-browser/graphics/snap.js';
import { SNAP_PX } from '../align.js';
import type { InkTool } from '../items.js';
import { diameter } from '../outline.js';
import { hasRealPressure, penPressure, PressureFilter, PressureSimulator } from '../pressure.js';
import { suggestShape } from '../recognize.js';
import type { SceneItem, SurfacePage } from '../render/kit.js';
import type { SelectionHandle, Stage } from '../render/stage.js';
import { fitFromDrag, isPathKind, shapePoints, type ShapeFit, type ShapeKind, type ShapeStyle } from '../shapes.js';

/** Zoom factor of one notch of the mouse wheel with Ctrl */
const WHEEL_STEP = 1.1;

/** The tools of the ink core */
export type Tool = InkTool | 'shape' | 'eraser' | 'lasso';
export type EraserMode = 'stroke' | 'pixel';

const CORE_TOOLS: ReadonlySet<string> = new Set<Tool>(['pen', 'highlighter', 'shape', 'eraser', 'lasso']);

/** Settings of the tools; `T`: tools of the tool using the core (handled by `InputHandlers.gesture`) */
export interface ToolState<T extends string = never> {
	tool: Tool | T;
	color: string;
	/** Diameter in points (pen, highlighter) */
	size: number;
	/** Eraser radius in screen pixels */
	eraser: number;
	/** Whole strokes or only what is under the eraser */
	eraserMode: EraserMode;
	/** Fingers never draw */
	penOnly: boolean;
	/** Smoothing level 0…1 */
	smoothing: number;
	/** The pen's pressure (or, without a sensor, its speed) changes the width; false: always the chosen size */
	pressure: boolean;
	/** What the shape tool draws, and how */
	shape: ShapeKind;
	shapeStyle: ShapeStyle;
	/** Shapes and selections snap (Alt while dragging: the opposite) */
	snap: boolean;
}

/** What the controller needs of the selection (`Selection`) */
export interface SelectionLike {
	readonly active: boolean;
	clear(): void;
	handleAt(sx: number, sy: number, touch: boolean): SelectionHandle | null;
	start(handle: SelectionHandle, sx: number, sy: number): void;
	move(sx: number, sy: number, snap: boolean, keys?: { keepAspect?: boolean; scaleText?: boolean; axis?: boolean }): void;
	end(): void;
	lasso(points: number[], touch: boolean, add: boolean): void;
	toggleAt(sx: number, sy: number, touch: boolean): boolean;
	/** Selects the item at a screen point, if any (it is then dragged right away) */
	grab(sx: number, sy: number, touch: boolean): boolean;
}

/** A pointer pressed with a tool of the tool using the core: where it goes (screen pixels) and how it ends */
export interface Gesture {
	move(sx: number, sy: number, e: PointerEvent): void;
	end(cancelled: boolean): void;
	/** Asked when the pointer went up where it went down: true keeps the gesture for a second click – `move` then
	 * follows the hovering pointer, the next press and release end it (Esc or another tool: cancelled). For what two
	 * points define (a box, a line), so the view can be scrolled between them. */
	hold?(): boolean;
}

export interface InputHandlers<T extends string = never> {
	/** Current tool settings (read at the start of a stroke) */
	tool(): ToolState<T>;
	/** A finished stroke; its id */
	commit(stroke: { page: number; points: Float32Array; tool: InkTool; color: string; size: number }): string | null;
	/** A shape drawn with the shape tool; its id */
	commitShape(page: number, fit: ShapeFit, color: string, size: number, style: ShapeStyle): string | null | void;
	/** Shapes drawn point by point ("Polyline", "Polygon") grow with every point: the shape's geometry now (null: it
	 * is gone, e.g. undone) and a new one for it – with a style once it is finished (`ItemEditor.shapeFit`/`setFit`) */
	path?: { fit(page: number, id: string): ShapeFit | null; set(page: number, id: string, fit: ShapeFit, style?: ShapeStyle): void };
	/** A finished pen stroke resembles a shape (null: drop the suggestion shown, a new action starts) */
	suggest(suggestion: { page: number; id: string; fit: ShapeFit } | null): void;
	/** The eraser at a screen point with a radius in screen pixels (called repeatedly during one gesture) */
	erase(sx: number, sy: number, radius: number, mode: EraserMode): void;
	/** End of an erase gesture (one undo step) */
	eraseEnd(): void;
	selection: SelectionLike;
	/** A pen hovered for the first time this session */
	hover?(): void;
	/** A pen's button was pressed in the air: the eraser on or off (`InkTools.toggleEraser`) */
	penButton?(): void;
	/** A press with one of the tool's own tools (screen pixels); null: it pans instead */
	gesture?(tool: T, sx: number, sy: number, e: PointerEvent): Gesture | null;
	/** Events the page itself handles (e.g. selecting text of a PDF page): the controller leaves them alone */
	passthrough?(e: Event): boolean;
}

type Mode = 'draw' | 'shape' | 'erase' | 'nav' | 'lasso' | 'select' | 'gesture';

interface Active {
	id: number;
	type: string;
	mode: Mode;
	x: number;
	y: number;
	start: number;
}

/** A finger stroke younger than this becomes a pinch when a second finger comes */
const PINCH_GRACE_MS = 250;

export class InputController<P extends SurfacePage, I extends SceneItem, T extends string = never> {
	private readonly active = new Map<number, Active>();
	private readonly pressure = new PressureSimulator();
	private readonly pressureFilter = new PressureFilter();
	/** K held (scale a text box's font along) */
	private scaleKey = false;
	/** Where the stroke's pressure comes from: the pen, its speed, or none (constant width) */
	private pressureFrom: 'pen' | 'speed' | 'off' = 'speed';
	private drawId: number | null = null;
	/** Time stamp of the last point taken (raw and normal move events overlap) */
	private lastPoint = 0;
	private penSeen = false;
	/** The buttons of the hovering pen at its last event: a press shows as a change from none. Some pens report the
	 * button only in the air (S Pen in Chrome: `buttons` 1 without contact; a button held while touching reaches
	 * no page at all – Android takes it), so it switches the eraser on and off instead of erasing while held. */
	private penButtons = 0;
	private hoverSeen = false;
	private readonly raw = 'onpointerrawupdate' in window;
	private pinch: { dist: number; cx: number; cy: number } | null = null;
	private fling: { vx: number; vy: number; t: number; raf: number } | null = null;
	private track: { x: number; y: number; t: number }[] = [];
	private lassoPoints: number[] = [];
	/** The loop adds to the selection (Shift, Ctrl/⌘ when it started) */
	private lassoAdd = false;
	/** The running gesture of one of the tool's own tools */
	private gesture: Gesture | null = null;
	/** Where the gesture's pointer went down (screen pixels), whether it moved from there, and whether the gesture
	 * was held before (its second click) */
	private gestureAt = { x: 0, y: 0, moved: false, resumed: false, tool: '' };
	/** A gesture kept after a click, waiting for its second one (`Gesture.hold`), and its tool */
	private held: { gesture: Gesture; tool: string } | null = null;
	/** A shape of two points whose first one was clicked: the next press sets the second, the pointer shows it */
	private pending: { kind: ShapeKind; style: ShapeStyle | null; page: number; x: number; y: number; size: number; color: string; snap: boolean; targets: SnapTargets | null } | null = null;
	/** The last event of a hovering pointer: what the previews go by after the view moved */
	private hovered: PointerEvent | null = null;
	/** A shape drawn point by point: its page, its item once it has two points (before: where it starts), whether it
	 * is closed in the end, the style it gets then */
	private path: { page: number; id: string | null; x: number; y: number; polygon: boolean; style: ShapeStyle | null } | null = null;
	/** Shape tool: what is dragged, from where (page points of the live stroke's page) and with which pen size */
	private drag = {
		kind: 'line' as ShapeKind,
		style: null as ShapeStyle | null,
		color: '',
		/** The start was clicked before (`pending`): this press sets the second point */
		resumed: false,
		page: 0,
		x: 0,
		y: 0,
		size: 1,
		moved: false,
		fit: null as ShapeFit | null,
		snap: true,
		targets: null as SnapTargets | null,
		/** The drag is a segment of a shape drawn point by point; `first`: it starts that shape */
		path: false,
		first: false
	};

	constructor(
		private readonly root: HTMLElement,
		private readonly stage: Stage<P, I>,
		private readonly h: InputHandlers<T>,
		/** Prefix of log lines, e.g. `[pdf-editor]` */
		private readonly label = '[ink]'
	) {}

	attach(): () => void {
		const root = this.root;
		const opts = { passive: false } as const;
		const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
			root.addEventListener(type, fn as EventListener, o);
			return () => root.removeEventListener(type, fn as EventListener, o);
		};
		const offs = [
			on('pointerdown', (e) => {
				if (!this.h.passthrough?.(e)) this.down(e);
			}),
			on('pointermove', (e) => this.move(e, false)),
			on('pointerup', (e) => this.up(e, false)),
			on('pointercancel', (e) => this.up(e, true)),
			on('pointerleave', () => {
				this.stage.hideCursor();
				this.penButtons = 0;
			}),
			on('wheel', (e) => this.wheel(e), opts),
			// The browser's own menu never shows on the surface; a long press of `installLongPress` (synthetic) stays
			// unhandled, so it doesn't swallow the next tap
			on('contextmenu', (e) => {
				if (e.isTrusted && !this.h.passthrough?.(e)) e.preventDefault();
			}),
			// iOS Safari ignores `user-scalable=no`; these keep it from scrolling, zooming and selecting
			on('touchstart', (e) => {
				if (!this.h.passthrough?.(e)) e.preventDefault();
			}, opts),
			on('touchmove', (e) => {
				if (!this.h.passthrough?.(e)) e.preventDefault();
			}, opts),
			on('gesturestart' as keyof HTMLElementEventMap, (e) => e.preventDefault(), opts)
		];
		if (this.raw) offs.push(on('pointerrawupdate' as 'pointermove', (e) => this.move(e, true)));
		// K held while dragging a handle scales what sizes itself too (a text box's font)
		const key = (down: boolean) => (e: KeyboardEvent) => {
			if (e.key.toLowerCase() !== 'k' || e.ctrlKey || e.metaKey || e.altKey) return;
			const t = e.target as HTMLElement | null;
			if (t?.closest?.('input, textarea, select, [contenteditable]')) return;
			this.scaleKey = down;
		};
		const keyDown = key(true);
		const keyUp = key(false);
		const blur = () => (this.scaleKey = false);
		// Enter or Esc end a shape drawn point by point (before anything else takes the key)
		const pathKey = (e: KeyboardEvent) => {
			const waiting = this.pending || this.held;
			if (!(e.key === 'Escape' && waiting) && !(this.path && (e.key === 'Enter' || e.key === 'Escape'))) return;
			const t = e.target as HTMLElement | null;
			if (t?.closest?.('input, textarea, select, [contenteditable], dialog')) return;
			e.preventDefault();
			e.stopImmediatePropagation();
			// Esc takes back a clicked first point; otherwise the keys end a shape drawn point by point
			if (e.key === 'Escape' && waiting) this.dropWaiting();
			else this.finishPath();
		};
		window.addEventListener('keydown', pathKey, true);
		offs.push(() => window.removeEventListener('keydown', pathKey, true));
		window.addEventListener('keydown', keyDown);
		window.addEventListener('keyup', keyUp);
		window.addEventListener('blur', blur);
		offs.push(() => {
			window.removeEventListener('keydown', keyDown);
			window.removeEventListener('keyup', keyUp);
			window.removeEventListener('blur', blur);
		});
		return () => {
			offs.forEach((off) => off());
			this.stopFling();
		};
	}

	private down(e: PointerEvent) {
		this.stopFling();
		const [x, y] = this.stage.local(e.clientX, e.clientY);
		if (e.pointerType === 'pen') this.penSeen = true;
		try {
			this.root.setPointerCapture(e.pointerId);
		} catch {
			// The pointer may already be gone
		}
		// Counted before this pointer joins
		const navigating = this.navCount() > 0;
		const a: Active = { id: e.pointerId, type: e.pointerType, mode: 'nav', x, y, start: e.timeStamp };
		this.active.set(e.pointerId, a);
		this.stage.hideCursor();

		if (e.pointerType === 'mouse' && e.button !== 0) {
			// Middle (or right) button pans
			a.mode = 'nav';
		} else if (e.pointerType === 'touch') {
			const settings = this.h.tool();
			const drawing = this.drawId !== null ? this.active.get(this.drawId) : undefined;
			if (drawing && drawing.type === 'touch' && e.timeStamp - drawing.start < PINCH_GRACE_MS) {
				// Second finger right after the first: it was a pinch, not a stroke
				this.stage.cancel();
				this.drawId = null;
				drawing.mode = 'nav';
				a.mode = 'nav';
			} else if (drawing || this.penSeen || settings.penOnly || navigating) {
				a.mode = 'nav';
			} else {
				a.mode = this.startTool(e, x, y, settings) ?? 'nav';
			}
		} else {
			const settings = this.h.tool();
			// Pen eraser end (button 5 / buttons 32) or barrel button (2): erase while held – optional, if the device
			// reports it
			const eraserEnd = e.pointerType === 'pen' && (e.button === 5 || penErases(e));
			if (this.drawId !== null) a.mode = 'nav';
			else a.mode = this.startTool(e, x, y, eraserEnd ? { ...settings, tool: 'eraser' } : settings) ?? 'nav';
		}
		if (a.mode === 'nav') this.startNav();
	}

	/** The points of the shape being drawn point by point (x, y pairs): its item's, or only its start */
	private pathPoints(): number[] | null {
		const p = this.path;
		if (!p) return null;
		if (!p.id) return [p.x, p.y];
		const fit = this.h.path?.fit(p.page, p.id);
		return fit?.kind === 'polyline' ? fit.points : null;
	}

	/** Ends the shape drawn point by point: a polygon is closed (three points or more) and takes its fill */
	finishPath() {
		const p = this.path;
		this.path = null;
		this.stage.setRubber(null);
		if (!p?.id || !p.polygon) return;
		const fit = this.h.path?.fit(p.page, p.id);
		if (fit?.kind === 'polyline' && fit.points.length >= 6) this.h.path!.set(p.page, p.id, { kind: 'polygon', points: fit.points }, p.style ?? undefined);
	}

	/** Forgets a clicked first point (a shape's, a held gesture's) and its preview */
	private dropWaiting() {
		if (this.pending) {
			this.pending = null;
			this.stage.setRubber(null);
			this.stage.setGuides(null);
		}
		const held = this.held;
		this.held = null;
		held?.gesture.end(true);
	}

	/** The shape dragged (or clicked) from the start point to a page point: fitted, snapped, shown */
	private shapeTo(px: number, py: number, alt: boolean) {
		const d = this.drag;
		const snap = d.snap !== alt;
		const end = snap && d.targets ? this.snapped(px, py) : null;
		const onGuide = !!(end?.guides.x || end?.guides.y);
		// An end on a guide stays there; otherwise lines snap to 15° steps
		d.fit = fitFromDrag(d.kind, d.x, d.y, end?.point.x ?? px, end?.point.y ?? py, snap && !onGuide);
		this.stage.setGuides(end ? { page: d.page, guides: end.guides, targets: d.targets! } : null);
		this.stage.replaceLive(shapePoints(d.fit, d.size));
	}

	/** What a hovering pointer shows of something begun with a click: the shape to its second point, the next
	 * segment of a shape drawn point by point, a held gesture. Also called after the view moved. */
	private preview() {
		const e = this.hovered;
		if (!e || this.active.size) return;
		if (!this.pending && !this.held && !this.path) return;
		const s = this.h.tool();
		const [x, y] = this.stage.local(e.clientX, e.clientY);
		const held = this.held;
		if (held) {
			if (s.tool !== held.tool) this.dropWaiting();
			else held.gesture.move(x, y, e);
		}
		const p = this.pending;
		if (p) {
			if (s.tool !== 'shape' || s.shape !== p.kind) return this.dropWaiting();
			this.rubberTo(p, p.kind, p.x, p.y, x, y, e.altKey);
			return;
		}
		const path = this.path;
		if (!path) return;
		const points = s.tool === 'shape' && isPathKind(s.shape) ? this.pathPoints() : null;
		if (!points) return this.stage.setRubber(null);
		const d = this.drag;
		this.rubberTo({ page: path.page, size: d.size, color: d.color, snap: d.snap, targets: d.targets }, 'line', points[points.length - 2], points[points.length - 1], x, y, e.altKey);
	}

	/** Shows a shape from a page point to the pointer (screen pixels) on the overlay, snapped like a dragged one */
	private rubberTo(of: { page: number; size: number; color: string; snap: boolean; targets: SnapTargets | null }, kind: ShapeKind, x0: number, y0: number, sx: number, sy: number, alt: boolean) {
		const [px, py] = this.stage.toPage(of.page, sx, sy);
		const snap = of.snap !== alt;
		const tol = SNAP_PX / this.stage.view.zoom;
		const end = snap && of.targets ? snapPoint({ x: px, y: py }, of.targets, { x: tol, y: tol }) : null;
		const onGuide = !!(end?.guides.x || end?.guides.y);
		const fit = fitFromDrag(kind, x0, y0, end?.point.x ?? px, end?.point.y ?? py, snap && !onGuide);
		this.stage.setGuides(end ? { page: of.page, guides: end.guides, targets: of.targets! } : null);
		this.stage.setRubber({ page: of.page, points: shapePoints(fit, of.size), color: of.color, size: of.size });
	}

	private startTool(e: PointerEvent, x: number, y: number, s: ToolState<T>): Mode | null {
		const selection = this.h.selection;
		this.h.suggest(null);
		// Another tool or shape: a clicked first point is forgotten
		if ((this.pending && (s.tool !== 'shape' || s.shape !== this.pending.kind)) || (this.held && s.tool !== this.held.tool)) this.dropWaiting();
		// Another tool or shape: what was drawn point by point is done
		if (this.path && (s.tool !== 'shape' || !isPathKind(s.shape))) this.finishPath();
		if (s.tool !== 'lasso' && selection.active) selection.clear();
		if (!isCore(s.tool)) {
			// The second click of a held gesture: it goes on to here and ends when the pointer goes up
			const held = this.held;
			this.held = null;
			this.gesture = held?.gesture ?? this.h.gesture?.(s.tool, x, y, e) ?? null;
			if (!this.gesture) return null;
			this.gestureAt = { x, y, moved: false, resumed: !!held, tool: s.tool };
			if (held) this.gesture.move(x, y, e);
			this.drawId = e.pointerId;
			return 'gesture';
		}
		if (s.tool === 'eraser') {
			this.drawId = e.pointerId;
			this.h.erase(x, y, s.eraser, s.eraserMode);
			return 'erase';
		}
		if (s.tool === 'lasso') {
			const add = e.shiftKey || e.ctrlKey || e.metaKey;
			// Shift or Ctrl/⌘ on an item: adds it to the selection or takes it out (no dragging)
			if (add && selection.toggleAt(x, y, e.pointerType !== 'mouse')) return null;
			this.drawId = e.pointerId;
			const handle = selection.handleAt(x, y, e.pointerType !== 'mouse');
			if (handle) {
				selection.start(handle, x, y);
				return 'select';
			}
			// An item not selected yet: taken and moved at once (a loop starts only beside items)
			if (selection.grab(x, y, e.pointerType !== 'mouse')) {
				selection.start('move', x, y);
				return 'select';
			}
			if (!add) selection.clear();
			this.lassoAdd = add;
			this.lassoPoints = [x, y];
			this.stage.setLasso(this.lassoPoints);
			return 'lasso';
		}
		if (s.tool === 'shape') {
			const hit = this.stage.pageAt(x, y);
			if (!hit || !this.stage.begin(x, y, 0.5, 'pen', s.color, s.size, 0)) return null;
			this.drawId = e.pointerId;
			const targets = this.stage.snapTargets(hit.index, new Set());
			this.drag = { kind: s.shape, style: s.shapeStyle, color: s.color, resumed: false, page: hit.index, x: hit.x, y: hit.y, size: s.size, moved: false, fit: null, snap: s.snap, targets, path: false, first: false };
			this.stage.setRubber(null);
			const pending = this.pending;
			this.pending = null;
			if (pending && pending.page === hit.index) {
				// The second click of a shape: from the point clicked first to here (dragging still adjusts it)
				this.drag = { ...this.drag, x: pending.x, y: pending.y, moved: true, resumed: true };
				this.shapeTo(hit.x, hit.y, e.altKey);
				return 'shape';
			}
			// The start point snaps too (shown once the drag moves)
			if (targets && s.snap !== e.altKey) {
				const p = this.snapped(hit.x, hit.y).point;
				this.drag.x = p.x;
				this.drag.y = p.y;
			}
			if (isPathKind(s.shape) && this.h.path) {
				// Point by point: this press draws the segment from the last point (the first press starts the shape)
				const points = this.path?.page === hit.index ? this.pathPoints() : null;
				if (!points) {
					this.finishPath();
					this.path = { page: hit.index, id: null, x: this.drag.x, y: this.drag.y, polygon: s.shape === 'freePolygon', style: s.shapeStyle };
				}
				const from = points ?? [this.drag.x, this.drag.y];
				this.drag = { ...this.drag, kind: 'line', path: true, first: !points, x: from[from.length - 2], y: from[from.length - 1] };
				if (points) this.pathSegment(hit.x, hit.y, s.snap !== e.altKey);
			}
			return 'shape';
		}
		this.pressureFrom = !s.pressure ? 'off' : hasRealPressure(e.pointerType, e.pressure) ? 'pen' : 'speed';
		this.pressure.reset();
		this.pressureFilter.reset();
		const p = this.pressureAt(e, x, y);
		if (!this.stage.begin(x, y, p, s.tool, s.color, s.size, s.smoothing, e.timeStamp)) return null;
		this.lastPoint = e.timeStamp;
		this.drawId = e.pointerId;
		return 'draw';
	}

	private move(e: PointerEvent, raw: boolean) {
		const a = this.active.get(e.pointerId);
		if (!a) {
			if (!raw) this.hover(e);
			return;
		}
		if (a.mode === 'draw') {
			// A pen whose eraser end or button shows while it draws (where the device reports that): the stroke ends
			// here, the rest of the gesture erases
			if (e.pointerType === 'pen' && penErases(e) && this.drawId === e.pointerId) {
				this.endStroke(a);
				const [x, y] = this.stage.local(e.clientX, e.clientY);
				const s = this.h.tool();
				a.mode = this.startTool(e, x, y, { ...s, tool: 'eraser' }) ?? 'nav';
				return;
			}
			// Raw updates come first where the browser sends them (not for every pointer type); `pointermove` then
			// repeats the same points, which the time stamp filters out
			this.drawPoints(e);
			return;
		}
		if (raw) return;
		const [x, y] = this.stage.local(e.clientX, e.clientY);
		if (a.mode === 'gesture') {
			const g = this.gestureAt;
			if (!g.moved && Math.hypot(x - g.x, y - g.y) >= 6) g.moved = true;
			this.gesture?.move(x, y, e);
			return;
		}
		if (a.mode === 'shape') {
			const d = this.drag;
			const [px, py] = this.stage.toPage(d.page, x, y);
			if (d.path && !d.first) return this.pathSegment(px, py, d.snap !== e.altKey);
			// A tap or a tiny wiggle draws nothing
			if (!d.moved && Math.hypot(px - d.x, py - d.y) * this.stage.view.zoom < 6) return;
			d.moved = true;
			this.shapeTo(px, py, e.altKey);
			return;
		}
		if (a.mode === 'lasso') {
			for (const ev of coalesced(e)) this.lassoPoints.push(...this.stage.local(ev.clientX, ev.clientY));
			this.stage.setLasso(this.lassoPoints);
			return;
		}
		if (a.mode === 'select') {
			this.h.selection.move(x, y, this.h.tool().snap !== e.altKey, { keepAspect: e.shiftKey, axis: e.shiftKey, scaleText: this.scaleKey });
			return;
		}
		if (a.mode === 'erase') {
			const s = this.h.tool();
			for (const ev of coalesced(e)) {
				const [ex, ey] = this.stage.local(ev.clientX, ev.clientY);
				this.h.erase(ex, ey, s.eraser, s.eraserMode);
			}
			a.x = x;
			a.y = y;
			this.stage.showCursor(x, y, s.eraser * 2, null);
			return;
		}
		this.navMove(a, x, y, e.timeStamp);
	}

	/** The segment from the last point of a shape drawn point by point to (px, py), shown while the pointer is down */
	private pathSegment(px: number, py: number, snap: boolean) {
		const d = this.drag;
		const end = snap && d.targets ? this.snapped(px, py) : null;
		const onGuide = !!(end?.guides.x || end?.guides.y);
		d.fit = fitFromDrag('line', d.x, d.y, end?.point.x ?? px, end?.point.y ?? py, snap && !onGuide);
		this.stage.setGuides(end ? { page: d.page, guides: end.guides, targets: d.targets! } : null);
		this.stage.replaceLive(shapePoints(d.fit, d.size));
	}

	/** The pointer of a shape drawn point by point went up: its first segment, one more point, or its end */
	private pathUp(cancelled: boolean) {
		const d = this.drag;
		const p = this.path;
		const fit = d.fit?.kind === 'line' ? d.fit : null;
		if (cancelled || !p || !fit) {
			// A click that starts the shape: its first point is remembered
			this.stage.cancel();
			return;
		}
		const near = (x: number, y: number) => Math.hypot(fit.x1 - x, fit.y1 - y) * this.stage.view.zoom < 8;
		const points = this.pathPoints();
		if (!p.id || !points) {
			const stroke = this.stage.end();
			// A plain line style while it grows: a fill comes when it is closed
			const id = stroke && d.style && !near(fit.x0, fit.y0) ? this.h.commitShape(d.page, { kind: 'polyline', points: [fit.x0, fit.y0, fit.x1, fit.y1] }, stroke.color, d.size, { ...d.style, fill: null, cloud: false }) : null;
			if (id) p.id = id;
			// Nothing was added: nothing will replace the live layer
			else this.stage.cancel();
			return;
		}
		this.stage.cancel();
		// On the last point again (a double click or tap) or – a polygon – on the first: done
		if (near(points[points.length - 2], points[points.length - 1]) || (p.polygon && points.length >= 6 && near(points[0], points[1]))) return this.finishPath();
		this.h.path!.set(p.page, p.id, { kind: 'polyline', points: [...points, fit.x1, fit.y1] });
	}

	/** A shape whose two points are (nearly) the same on screen: the second click on the first point */
	private tiny(fit: ShapeFit): boolean {
		const pts = shapePoints(fit, 1);
		let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
		for (let i = 0; i < pts.length; i += 3) {
			x0 = Math.min(x0, pts[i]);
			x1 = Math.max(x1, pts[i]);
			y0 = Math.min(y0, pts[i + 1]);
			y1 = Math.max(y1, pts[i + 1]);
		}
		return Math.hypot(x1 - x0, y1 - y0) * this.stage.view.zoom < 6;
	}

	/** A point of the shape being dragged (page points), snapped to the page and the shapes on it */
	private snapped(x: number, y: number) {
		const tol = SNAP_PX / this.stage.view.zoom;
		return snapPoint({ x, y }, this.drag.targets!, { x: tol, y: tol });
	}

	/** The pressure of a point of the stroke being drawn */
	private pressureAt(ev: PointerEvent, x: number, y: number): number {
		if (this.pressureFrom === 'off') return 0.5;
		if (this.pressureFrom === 'pen') return this.pressureFilter.next(penPressure(ev.pressure), ev.timeStamp);
		return this.pressure.next(x, y, ev.timeStamp, 1);
	}

	private drawPoints(e: PointerEvent) {
		const list = coalesced(e);
		for (let i = 0; i < list.length; i++) {
			const ev = list[i];
			if (ev.timeStamp <= this.lastPoint) continue;
			this.lastPoint = ev.timeStamp;
			const [x, y] = this.stage.local(ev.clientX, ev.clientY);
			const p = this.pressureAt(ev, x, y);
			// The trusted parent event feeds the OS ink trail
			this.stage.add(x, y, p, i === list.length - 1 ? e : null, ev.timeStamp);
		}
		const predicted = e.getPredictedEvents?.() ?? [];
		this.stage.predict(predicted.map((ev) => {
			const [sx, sy] = this.stage.local(ev.clientX, ev.clientY);
			return { sx, sy };
		}));
	}


	/** The pen stroke being drawn is done: on the page, checked for a shape */
	private endStroke(a: Active) {
		this.drawId = null;
		const stroke = this.stage.end();
		const id = stroke && this.h.commit(stroke);
		if (!id) this.stage.cancel();
		// Checked once, after the stroke is on the page (not while drawing)
		const fit = id && stroke.tool === 'pen' ? suggestShape(stroke.points, this.stage.view.zoom) : null;
		if (fit) this.h.suggest({ page: stroke!.page, id: id!, fit });
		if (import.meta.hot) {
			const s = this.h.tool();
			debug(`${this.label} stroke ${a.type}, pressure ${this.pressureFrom}, smoothing ${s.smoothing}: ${this.stage.strokeReport()}`);
		}
	}

	private up(e: PointerEvent, cancelled: boolean) {
		const a = this.active.get(e.pointerId);
		this.active.delete(e.pointerId);
		if (!a) return;
		if (a.mode === 'draw' && this.drawId === e.pointerId) {
			if (cancelled) {
				this.drawId = null;
				this.stage.cancel();
			} else this.endStroke(a);
		} else if (a.mode === 'shape' && this.drawId === e.pointerId) {
			this.drawId = null;
			const d = this.drag;
			this.stage.setGuides(null);
			if (d.path) this.pathUp(cancelled || (d.first && !d.moved));
			else if (cancelled || !d.moved || !d.fit || (d.resumed && this.tiny(d.fit))) {
				this.stage.cancel();
				// A click without dragging: the shape's first point – the next click sets its second
				if (!cancelled && !d.moved) this.pending = { kind: d.kind, style: d.style, page: d.page, x: d.x, y: d.y, size: d.size, color: d.color, snap: d.snap, targets: d.targets };
			} else {
				const stroke = this.stage.end();
				const id = stroke && d.style ? this.h.commitShape(d.page, d.fit, stroke.color, d.size, d.style) : null;
				// Nothing was added (the tool only asked for the shape, or the page can't be changed): nothing will
				// replace the live layer, so it goes now
				if (!id) this.stage.cancel();
			}
		} else if (a.mode === 'lasso' && this.drawId === e.pointerId) {
			this.drawId = null;
			this.stage.setLasso(null);
			if (!cancelled) this.h.selection.lasso(this.lassoPoints, a.type !== 'mouse', this.lassoAdd);
		} else if (a.mode === 'select' && this.drawId === e.pointerId) {
			this.drawId = null;
			this.h.selection.end();
		} else if (a.mode === 'gesture' && this.drawId === e.pointerId) {
			this.drawId = null;
			const gesture = this.gesture;
			this.gesture = null;
			const g = this.gestureAt;
			// A click: kept for its second one where the gesture wants that
			if (gesture && !cancelled && !g.moved && !g.resumed && gesture.hold?.()) this.held = { gesture, tool: g.tool };
			else gesture?.end(cancelled);
		} else if (a.mode === 'erase' && this.drawId === e.pointerId) {
			this.drawId = null;
			this.stage.hideCursor();
			this.h.eraseEnd();
		} else if (a.mode === 'nav') {
			this.pinch = null;
			if (this.navCount() === 0 && a.type === 'touch' && !cancelled) this.startFling(e.timeStamp);
			else this.startNav();
		}
		if (e.pointerType === 'pen' && !cancelled) this.hover(e);
	}

	// --- Pan and pinch ---

	private navPointers(): Active[] {
		return [...this.active.values()].filter((a) => a.mode === 'nav');
	}

	private navCount() {
		return this.navPointers().length;
	}

	/** (Re)starts pan/pinch from the current pointers */
	private startNav() {
		const nav = this.navPointers();
		this.track = [];
		if (nav.length >= 2) {
			const [a, b] = nav;
			this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
		} else this.pinch = null;
	}

	private navMove(a: Active, x: number, y: number, t: number) {
		const nav = this.navPointers();
		if (nav.length >= 2 && this.pinch) {
			a.x = x;
			a.y = y;
			const [p, q] = nav;
			const dist = Math.hypot(p.x - q.x, p.y - q.y);
			const cx = (p.x + q.x) / 2;
			const cy = (p.y + q.y) / 2;
			this.stage.panBy(cx - this.pinch.cx, cy - this.pinch.cy);
			if (this.pinch.dist > 0 && dist > 0) this.stage.zoomAt(dist / this.pinch.dist, cx, cy);
			this.pinch = { dist, cx, cy };
			return;
		}
		this.stage.panBy(x - a.x, y - a.y);
		a.x = x;
		a.y = y;
		this.track.push({ x, y, t });
		if (this.track.length > 6) this.track.shift();
	}

	/** Keeps a flicked page moving and slows it down */
	private startFling(t: number) {
		const track = this.track.filter((p) => t - p.t < 100);
		this.track = [];
		if (track.length < 2) return;
		const first = track[0];
		const last = track[track.length - 1];
		const dt = Math.max(1, last.t - first.t);
		const vx = (last.x - first.x) / dt;
		const vy = (last.y - first.y) / dt;
		if (Math.hypot(vx, vy) < 0.3) return;
		const step = (now: number) => {
			const f = this.fling;
			if (!f) return;
			const elapsed = Math.min(50, now - f.t);
			f.t = now;
			this.stage.panBy(f.vx * elapsed, f.vy * elapsed);
			const decay = Math.pow(0.995, elapsed);
			f.vx *= decay;
			f.vy *= decay;
			if (Math.hypot(f.vx, f.vy) < 0.02) this.fling = null;
			else f.raf = requestAnimationFrame(step);
		};
		this.fling = { vx, vy, t: performance.now(), raf: requestAnimationFrame(step) };
	}

	private stopFling() {
		if (this.fling) cancelAnimationFrame(this.fling.raf);
		this.fling = null;
	}

	private wheel(e: WheelEvent) {
		e.preventDefault();
		this.stopFling();
		const [x, y] = this.stage.local(e.clientX, e.clientY);
		const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.stage.view.height : 1;
		if (e.ctrlKey || e.metaKey) {
			// Ctrl + wheel, and the touchpad pinch (sent as Ctrl + wheel). A mouse wheel moves in notches (100 or 120
			// pixels, or 3 lines): 10 % per notch. The pinch comes in small steps and follows the fingers.
			const notched = e.deltaMode !== 0 || Math.abs(e.deltaY) >= 40;
			const notches = Math.max(1, Math.round(Math.abs(e.deltaY) / (e.deltaMode === 1 ? 3 : e.deltaMode === 2 ? 1 : 100)));
			this.stage.zoomAt(notched ? WHEEL_STEP ** (-Math.sign(e.deltaY) * notches) : Math.exp(-e.deltaY * 0.01), x, y);
		} else if (e.shiftKey && !e.deltaX) {
			this.stage.panBy(-e.deltaY * unit, 0);
		} else {
			this.stage.panBy(-e.deltaX * unit, -e.deltaY * unit);
		}
		// What follows the pointer is now somewhere else on the page
		this.preview();
	}

	// --- Hover ---

	private hover(e: PointerEvent) {
		// A pen's button pressed in the air (no contact): the eraser on or off
		const button = e.pointerType === 'pen' && e.buttons !== 0 && e.pressure === 0;
		if (e.pointerType === 'pen') {
			if (button && this.penButtons === 0) this.h.penButton?.();
			this.penButtons = e.buttons;
		}
		if (e.pointerType === 'touch' || (e.buttons !== 0 && !button)) return this.stage.hideCursor();
		this.hovered = e;
		this.preview();
		if (e.pointerType === 'pen' && !this.hoverSeen) {
			this.hoverSeen = true;
			this.h.hover?.();
		}
		const [x, y] = this.stage.local(e.clientX, e.clientY);
		const s = this.h.tool();
		if (!this.stage.view.pageAt(this.stage.rects, x, y)) return this.stage.hideCursor();
		if (!isCore(s.tool) || s.tool === 'lasso') return this.stage.hideCursor();
		if (s.tool === 'eraser') return this.stage.showCursor(x, y, s.eraser * 2, null);
		else this.stage.showCursor(x, y, diameter(s.tool === 'highlighter' ? 'highlighter' : 'pen', s.size, 0.5) * this.stage.view.zoom, s.color);
	}
}

const isCore = (tool: string): tool is Tool => CORE_TOOLS.has(tool);

/** A pen's eraser end (`buttons` 32) or barrel button (2) while it touches */
const penErases = (e: PointerEvent) => (e.buttons & 34) !== 0;

/** The event's coalesced events, or the event itself when there are none (Firefox Android: always empty) */
function coalesced(e: PointerEvent): PointerEvent[] {
	const list = e.getCoalescedEvents?.();
	return list && list.length ? list : [e];
}
