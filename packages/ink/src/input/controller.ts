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
//   corner, a point of a shape) moves/scales/reshapes it; dragging an item not selected yet selects and moves it. Laser: a fading trail, not stored.
// - tools of the tool using this core (a text box, a note …) get the pointer as a `Gesture` from `InputHandlers.gesture`.

import { debug } from '@in-browser/brand/debug.js';
import { snapPoint, type SnapTargets } from '@in-browser/graphics/snap.js';
import { SNAP_PX } from '../align.js';
import type { InkTool } from '../items.js';
import { diameter } from '../outline.js';
import { hasRealPressure, penPressure, PressureSimulator } from '../pressure.js';
import { suggestShape } from '../recognize.js';
import type { SceneItem, SurfacePage } from '../render/kit.js';
import type { SelectionHandle, Stage } from '../render/stage.js';
import { fitFromDrag, shapePoints, type ShapeFit, type ShapeKind, type ShapeStyle } from '../shapes.js';

/** Zoom factor of one notch of the mouse wheel with Ctrl */
const WHEEL_STEP = 1.1;

/** The tools of the ink core */
export type Tool = InkTool | 'shape' | 'eraser' | 'lasso' | 'laser';
export type EraserMode = 'stroke' | 'pixel';

const CORE_TOOLS: ReadonlySet<string> = new Set<Tool>(['pen', 'highlighter', 'shape', 'eraser', 'lasso', 'laser']);

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
	lasso(points: number[], touch: boolean): void;
	/** Selects the item at a screen point, if any (it is then dragged right away) */
	grab(sx: number, sy: number, touch: boolean): boolean;
}

/** A pointer pressed with a tool of the tool using the core: where it goes (screen pixels) and how it ends */
export interface Gesture {
	move(sx: number, sy: number, e: PointerEvent): void;
	end(cancelled: boolean): void;
}

export interface InputHandlers<T extends string = never> {
	/** Current tool settings (read at the start of a stroke) */
	tool(): ToolState<T>;
	/** A finished stroke; its id */
	commit(stroke: { page: number; points: Float32Array; tool: InkTool; color: string; size: number }): string | null;
	/** A shape drawn with the shape tool */
	commitShape(page: number, fit: ShapeFit, color: string, size: number, style: ShapeStyle): void;
	/** A finished pen stroke resembles a shape (null: drop the suggestion shown, a new action starts) */
	suggest(suggestion: { page: number; id: string; fit: ShapeFit } | null): void;
	/** The eraser at a screen point with a radius in screen pixels (called repeatedly during one gesture) */
	erase(sx: number, sy: number, radius: number, mode: EraserMode): void;
	/** End of an erase gesture (one undo step) */
	eraseEnd(): void;
	selection: SelectionLike;
	/** A pen hovered for the first time this session */
	hover?(): void;
	/** A press with one of the tool's own tools (screen pixels); null: it pans instead */
	gesture?(tool: T, sx: number, sy: number, e: PointerEvent): Gesture | null;
	/** Events the page itself handles (e.g. selecting text of a PDF page): the controller leaves them alone */
	passthrough?(e: Event): boolean;
}

type Mode = 'draw' | 'shape' | 'erase' | 'nav' | 'lasso' | 'select' | 'laser' | 'gesture';

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
	/** K held (scale a text box's font along) */
	private scaleKey = false;
	private realPressure = false;
	private drawId: number | null = null;
	/** Time stamp of the last point taken (raw and normal move events overlap) */
	private lastPoint = 0;
	private penSeen = false;
	private hoverSeen = false;
	private readonly raw = 'onpointerrawupdate' in window;
	private pinch: { dist: number; cx: number; cy: number } | null = null;
	private fling: { vx: number; vy: number; t: number; raf: number } | null = null;
	private track: { x: number; y: number; t: number }[] = [];
	private lassoPoints: number[] = [];
	/** The running gesture of one of the tool's own tools */
	private gesture: Gesture | null = null;
	/** Shape tool: what is dragged, from where (page points of the live stroke's page) and with which pen size */
	private drag = {
		kind: 'line' as ShapeKind,
		style: null as ShapeStyle | null,
		page: 0,
		x: 0,
		y: 0,
		size: 1,
		moved: false,
		fit: null as ShapeFit | null,
		snap: true,
		targets: null as SnapTargets | null
	};

	constructor(
		private readonly root: HTMLElement,
		private readonly stage: Stage<P, I>,
		private readonly h: InputHandlers<T>,
		/** Prefix of log lines, e.g. `[notes]` */
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
			on('pointerleave', () => this.stage.hideCursor()),
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
		// K held while dragging a handle scales what sizes itself too (a text box's font), as Figma's scale tool
		const key = (down: boolean) => (e: KeyboardEvent) => {
			if (e.key.toLowerCase() !== 'k' || e.ctrlKey || e.metaKey || e.altKey) return;
			const t = e.target as HTMLElement | null;
			if (t?.closest?.('input, textarea, select, [contenteditable]')) return;
			this.scaleKey = down;
		};
		const keyDown = key(true);
		const keyUp = key(false);
		const blur = () => (this.scaleKey = false);
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
			// Pen eraser end (button 5 / buttons 32) or barrel button (2): erase while held – optional, if the device reports it
			const eraserEnd = e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32) !== 0 || (e.buttons & 2) !== 0);
			if (this.drawId !== null) a.mode = 'nav';
			else a.mode = this.startTool(e, x, y, eraserEnd ? { ...settings, tool: 'eraser' } : settings) ?? 'nav';
		}
		if (a.mode === 'nav') this.startNav();
	}

	private startTool(e: PointerEvent, x: number, y: number, s: ToolState<T>): Mode | null {
		const selection = this.h.selection;
		this.h.suggest(null);
		if (s.tool !== 'lasso' && selection.active) selection.clear();
		if (!isCore(s.tool)) {
			this.gesture = this.h.gesture?.(s.tool, x, y, e) ?? null;
			if (!this.gesture) return null;
			this.drawId = e.pointerId;
			return 'gesture';
		}
		if (s.tool === 'eraser') {
			this.drawId = e.pointerId;
			this.h.erase(x, y, s.eraser, s.eraserMode);
			return 'erase';
		}
		if (s.tool === 'lasso') {
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
			selection.clear();
			this.lassoPoints = [x, y];
			this.stage.setLasso(this.lassoPoints);
			return 'lasso';
		}
		if (s.tool === 'laser') {
			this.drawId = e.pointerId;
			this.stage.laserPoint(x, y);
			return 'laser';
		}
		if (s.tool === 'shape') {
			const hit = this.stage.pageAt(x, y);
			if (!hit || !this.stage.begin(x, y, 0.5, 'pen', s.color, s.size, 0)) return null;
			this.drawId = e.pointerId;
			const targets = this.stage.snapTargets(hit.index, new Set());
			this.drag = { kind: s.shape, style: s.shapeStyle, page: hit.index, x: hit.x, y: hit.y, size: s.size, moved: false, fit: null, snap: s.snap, targets };
			// The start point snaps too (shown once the drag moves)
			if (targets && s.snap !== e.altKey) {
				const p = this.snapped(hit.x, hit.y).point;
				this.drag.x = p.x;
				this.drag.y = p.y;
			}
			return 'shape';
		}
		this.realPressure = hasRealPressure(e.pointerType, e.pressure);
		this.pressure.reset();
		const p = this.realPressure ? penPressure(e.pressure) : this.pressure.next(x, y, e.timeStamp, 1);
		if (!this.stage.begin(x, y, p, s.tool, s.color, s.size, s.smoothing)) return null;
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
			// Raw updates come first where the browser sends them (not for every pointer type); `pointermove` then
			// repeats the same points, which the time stamp filters out
			this.drawPoints(e);
			return;
		}
		if (raw) return;
		const [x, y] = this.stage.local(e.clientX, e.clientY);
		if (a.mode === 'gesture') {
			this.gesture?.move(x, y, e);
			return;
		}
		if (a.mode === 'shape') {
			const d = this.drag;
			const [px, py] = this.stage.toPage(d.page, x, y);
			// A tap or a tiny wiggle draws nothing
			if (!d.moved && Math.hypot(px - d.x, py - d.y) * this.stage.view.zoom < 6) return;
			d.moved = true;
			const snap = d.snap !== e.altKey;
			const end = snap && d.targets ? this.snapped(px, py) : null;
			const onGuide = !!(end?.guides.x || end?.guides.y);
			// An end on a guide stays there; otherwise lines snap to 15° steps
			d.fit = fitFromDrag(d.kind, d.x, d.y, end?.point.x ?? px, end?.point.y ?? py, snap && !onGuide);
			this.stage.setGuides(end ? { page: d.page, guides: end.guides, targets: d.targets! } : null);
			this.stage.replaceLive(shapePoints(d.fit, d.size));
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
		if (a.mode === 'laser') {
			for (const ev of coalesced(e)) this.stage.laserPoint(...this.stage.local(ev.clientX, ev.clientY));
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

	/** A point of the shape being dragged (page points), snapped to the page and the shapes and pictures on it */
	private snapped(x: number, y: number) {
		const tol = SNAP_PX / this.stage.view.zoom;
		return snapPoint({ x, y }, this.drag.targets!, { x: tol, y: tol });
	}

	private drawPoints(e: PointerEvent) {
		const list = coalesced(e);
		for (let i = 0; i < list.length; i++) {
			const ev = list[i];
			if (ev.timeStamp <= this.lastPoint) continue;
			this.lastPoint = ev.timeStamp;
			const [x, y] = this.stage.local(ev.clientX, ev.clientY);
			const p = this.realPressure ? penPressure(ev.pressure) : this.pressure.next(x, y, ev.timeStamp, 1);
			// The trusted parent event feeds the OS ink trail
			this.stage.add(x, y, p, i === list.length - 1 ? e : null, ev.timeStamp);
		}
		const predicted = e.getPredictedEvents?.() ?? [];
		this.stage.predict(predicted.map((ev) => {
			const [sx, sy] = this.stage.local(ev.clientX, ev.clientY);
			return { sx, sy };
		}));
	}


	private up(e: PointerEvent, cancelled: boolean) {
		const a = this.active.get(e.pointerId);
		this.active.delete(e.pointerId);
		if (!a) return;
		if (a.mode === 'draw' && this.drawId === e.pointerId) {
			this.drawId = null;
			if (cancelled) this.stage.cancel();
			else {
				const stroke = this.stage.end();
				const id = stroke && this.h.commit(stroke);
				// Checked once, after the stroke is on the page (not while drawing)
				const fit = id && stroke.tool === 'pen' ? suggestShape(stroke.points, this.stage.view.zoom) : null;
				if (fit) this.h.suggest({ page: stroke!.page, id: id!, fit });
				if (import.meta.hot) {
					const s = this.h.tool();
					debug(`${this.label} stroke ${a.type}${this.realPressure ? ' with pressure' : ', pressure simulated'}, smoothing ${s.smoothing}: ${this.stage.strokeReport()}`);
				}
			}
		} else if (a.mode === 'shape' && this.drawId === e.pointerId) {
			this.drawId = null;
			const d = this.drag;
			this.stage.setGuides(null);
			if (cancelled || !d.moved || !d.fit) this.stage.cancel();
			else {
				const stroke = this.stage.end();
				if (stroke && d.style) this.h.commitShape(d.page, d.fit, stroke.color, d.size, d.style);
			}
		} else if (a.mode === 'lasso' && this.drawId === e.pointerId) {
			this.drawId = null;
			this.stage.setLasso(null);
			if (!cancelled) this.h.selection.lasso(this.lassoPoints, a.type !== 'mouse');
		} else if (a.mode === 'select' && this.drawId === e.pointerId) {
			this.drawId = null;
			this.h.selection.end();
		} else if (a.mode === 'gesture' && this.drawId === e.pointerId) {
			this.drawId = null;
			const gesture = this.gesture;
			this.gesture = null;
			gesture?.end(cancelled);
		} else if (a.mode === 'laser' && this.drawId === e.pointerId) {
			this.drawId = null;
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
	}

	// --- Hover ---

	private hover(e: PointerEvent) {
		if (e.pointerType === 'touch' || e.buttons !== 0) return this.stage.hideCursor();
		if (e.pointerType === 'pen' && !this.hoverSeen) {
			this.hoverSeen = true;
			this.h.hover?.();
		}
		const [x, y] = this.stage.local(e.clientX, e.clientY);
		const s = this.h.tool();
		if (!this.stage.view.pageAt(this.stage.rects, x, y) || !isCore(s.tool) || s.tool === 'lasso' || s.tool === 'laser') return this.stage.hideCursor();
		if (s.tool === 'eraser') this.stage.showCursor(x, y, s.eraser * 2, null);
		else this.stage.showCursor(x, y, diameter(s.tool === 'highlighter' ? 'highlighter' : 'pen', s.size, 0.5) * this.stage.view.zoom, s.color);
	}
}

const isCore = (tool: string): tool is Tool => CORE_TOOLS.has(tool);

/** The event's coalesced events, or the event itself when there are none (Firefox Android: always empty) */
function coalesced(e: PointerEvent): PointerEvent[] {
	const list = e.getCoalescedEvents?.();
	return list && list.length ? list : [e];
}
