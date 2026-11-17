// Input pipeline of the drawing surface. Pointer Events only (no mouse/touch events for the logic):
// - the drawing pointer's points come from `pointerrawupdate` where the browser sends it (Chromium, Firefox; not
//   for every pointer type) and `pointermove`, deduplicated by time stamp; each event's coalesced events are used, or the event itself when that list is empty (Firefox
//   Android). Predicted events are only shown, never stored.
// - palm rejection: once a pen was used, touch only pans and zooms (also with the setting "only the pen draws").
//   A second finger shortly after the first turns a just-started finger stroke into a pinch.
// - a hovering pen (pen, no buttons) shows a preview of the brush; hover is never required for anything.
// - holding the pen still at the end of a stroke replaces it by the recognized shape (line, triangle, rectangle,
//   ellipse); a line then follows the pen until it is lifted.
// - lasso: a loop selects; dragging the selection (or a corner) moves/scales it. Laser: a fading trail, not stored.

import { debug } from '@in-browser/brand/debug.js';
import { hasRealPressure, penPressure, PressureSimulator } from '#lib/ink/pressure.js';
import { diameter } from '#lib/ink/outline.js';
import { recognize, shapePoints, type ShapeFit } from '#lib/ink/recognize.js';
import type { InkTool } from '#lib/model/types.js';
import type { Stage } from '#lib/render/stage.js';
import type { Selection } from './selection.svelte.js';

export type Tool = InkTool | 'eraser' | 'lasso' | 'laser';
export type EraserMode = 'stroke' | 'pixel';

export interface ToolState {
	tool: Tool;
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
}

export interface InputHandlers {
	/** Current tool settings (read at the start of a stroke) */
	tool(): ToolState;
	commit(stroke: { page: number; points: Float32Array; tool: InkTool; color: string; size: number }): void;
	/** The eraser at a screen point with a radius in screen pixels (called repeatedly during one gesture) */
	erase(sx: number, sy: number, radius: number, mode: EraserMode): void;
	/** End of an erase gesture (one undo step) */
	eraseEnd(): void;
	selection: Selection;
	/** A pen hovered for the first time this session */
	hover?(): void;
}

type Mode = 'draw' | 'erase' | 'nav' | 'lasso' | 'select' | 'laser';

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
/** Holding the pen this long (moving less than HOLD_SLOP px) straightens the stroke into a shape */
const HOLD_MS = 600;
const HOLD_SLOP = 4;

export class InputController {
	private readonly active = new Map<number, Active>();
	private readonly pressure = new PressureSimulator();
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
	/** Hold detection: where and when the pen last moved noticeably */
	private hold = { x: 0, y: 0, t: 0, timer: 0 as ReturnType<typeof setInterval> | 0 };
	/** Recognized shape of the current stroke */
	private shape: ShapeFit | null = null;
	private lassoPoints: number[] = [];

	constructor(
		private readonly root: HTMLElement,
		private readonly stage: Stage,
		private readonly h: InputHandlers
	) {}

	attach(): () => void {
		const root = this.root;
		const opts = { passive: false } as const;
		const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
			root.addEventListener(type, fn as EventListener, o);
			return () => root.removeEventListener(type, fn as EventListener, o);
		};
		const offs = [
			on('pointerdown', (e) => this.down(e)),
			on('pointermove', (e) => this.move(e, false)),
			on('pointerup', (e) => this.up(e, false)),
			on('pointercancel', (e) => this.up(e, true)),
			on('pointerleave', () => this.stage.hideCursor()),
			on('wheel', (e) => this.wheel(e), opts),
			on('contextmenu', (e) => e.preventDefault()),
			// iOS Safari ignores `user-scalable=no`; these keep it from scrolling, zooming and selecting
			on('touchstart', (e) => e.preventDefault(), opts),
			on('touchmove', (e) => e.preventDefault(), opts),
			on('gesturestart' as keyof HTMLElementEventMap, (e) => e.preventDefault(), opts)
		];
		if (this.raw) offs.push(on('pointerrawupdate' as 'pointermove', (e) => this.move(e, true)));
		return () => {
			offs.forEach((off) => off());
			this.stopFling();
			this.stopHold();
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

	private startTool(e: PointerEvent, x: number, y: number, s: ToolState): Mode | null {
		const selection = this.h.selection;
		if (s.tool !== 'lasso' && selection.active) selection.clear();
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
		this.realPressure = hasRealPressure(e.pointerType, e.pressure);
		this.pressure.reset();
		const p = this.realPressure ? penPressure(e.pressure) : this.pressure.next(x, y, e.timeStamp, 1);
		if (!this.stage.begin(x, y, p, s.tool, s.color, s.size, s.smoothing)) return null;
		this.lastPoint = e.timeStamp;
		this.drawId = e.pointerId;
		this.shape = null;
		this.startHold(x, y, e.timeStamp);
		return 'draw';
	}

	// --- Hold to straighten ---

	private startHold(x: number, y: number, t: number) {
		this.stopHold();
		this.hold = { x, y, t, timer: setInterval(() => this.checkHold(), 100) };
	}

	private stopHold() {
		if (this.hold.timer) clearInterval(this.hold.timer);
		this.hold.timer = 0;
	}

	/** Called per point: a noticeable move restarts the hold time */
	private moved(x: number, y: number, t: number) {
		if (Math.hypot(x - this.hold.x, y - this.hold.y) > HOLD_SLOP) {
			this.hold.x = x;
			this.hold.y = y;
			this.hold.t = t;
		}
	}

	private checkHold() {
		if (this.shape || !this.stage.drawing || performance.now() - this.hold.t < HOLD_MS) return;
		const points = this.stage.livePoints();
		const fit = points && recognize(points);
		this.stopHold();
		if (!fit) return;
		this.shape = fit;
		this.stage.replaceLive(shapePoints(fit));
		if (import.meta.hot) debug(`[notes] shape ${fit.kind}`);
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
		if (a.mode === 'lasso') {
			for (const ev of coalesced(e)) this.lassoPoints.push(...this.stage.local(ev.clientX, ev.clientY));
			this.stage.setLasso(this.lassoPoints);
			return;
		}
		if (a.mode === 'select') {
			this.h.selection.move(x, y);
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

	private drawPoints(e: PointerEvent) {
		const list = coalesced(e);
		if (this.shape) {
			// A recognized line follows the pen with its end; other shapes stay as they are
			if (this.shape.kind === 'line') {
				const [x, y] = this.stage.local(e.clientX, e.clientY);
				const page = this.stage.pageAt(x, y);
				if (page) {
					this.shape = { ...this.shape, x1: page.x, y1: page.y };
					this.stage.replaceLive(shapePoints(this.shape));
				}
			}
			return;
		}
		for (let i = 0; i < list.length; i++) {
			const ev = list[i];
			if (ev.timeStamp <= this.lastPoint) continue;
			this.lastPoint = ev.timeStamp;
			const [x, y] = this.stage.local(ev.clientX, ev.clientY);
			this.moved(x, y, ev.timeStamp);
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
			this.stopHold();
			if (cancelled) this.stage.cancel();
			else {
				const stroke = this.stage.end();
				if (stroke) this.h.commit(stroke);
				if (import.meta.hot) {
					const s = this.h.tool();
					debug(`[notes] stroke ${a.type}${this.realPressure ? ' with pressure' : ', pressure simulated'}, smoothing ${s.smoothing}: ${this.stage.strokeReport()}`);
				}
			}
		} else if (a.mode === 'lasso' && this.drawId === e.pointerId) {
			this.drawId = null;
			this.stage.setLasso(null);
			if (!cancelled) this.h.selection.lasso(this.lassoPoints);
		} else if (a.mode === 'select' && this.drawId === e.pointerId) {
			this.drawId = null;
			this.h.selection.end();
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
			// Ctrl + wheel, and the touchpad pinch (sent as Ctrl + wheel)
			this.stage.zoomAt(Math.exp(-e.deltaY * unit * 0.01), x, y);
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
		if (!this.stage.view.pageAt(this.stage.rects, x, y) || s.tool === 'lasso' || s.tool === 'laser') return this.stage.hideCursor();
		if (s.tool === 'eraser') this.stage.showCursor(x, y, s.eraser * 2, null);
		else this.stage.showCursor(x, y, diameter(s.tool, s.size, 0.5) * this.stage.view.zoom, s.color);
	}
}

/** The event's coalesced events, or the event itself when there are none (Firefox Android: always empty) */
function coalesced(e: PointerEvent): PointerEvent[] {
	const list = e.getCoalescedEvents?.();
	return list && list.length ? list : [e];
}
