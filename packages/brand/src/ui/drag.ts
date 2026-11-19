// Pointer drags (mouse, pen, finger): the element that got the `pointerdown` captures the pointer, so the drag goes
// on outside it, and ends on release or when the browser cancels it (e.g. a touch turns into scrolling).

/** Follows the drag started by `e`: `move` on every move, `end` once at the end */
export function pointerDrag(e: PointerEvent, move: (ev: PointerEvent) => void, end?: (ev: PointerEvent) => void) {
	const el = e.currentTarget as Element;
	el.setPointerCapture(e.pointerId);
	const up = (ev: PointerEvent) => {
		el.removeEventListener('pointermove', move as EventListener);
		el.removeEventListener('pointerup', up as EventListener);
		el.removeEventListener('pointercancel', up as EventListener);
		end?.(ev);
	};
	el.addEventListener('pointermove', move as EventListener);
	el.addEventListener('pointerup', up as EventListener);
	el.addEventListener('pointercancel', up as EventListener);
}
