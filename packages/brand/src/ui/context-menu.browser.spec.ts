import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installLongPress, LONG_PRESS_MS } from './context-menu.svelte.js';

function pointer(el: Element, type: string, x = 10, y = 10, pointerType = 'touch') {
	el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType, clientX: x, clientY: y }));
}

/** A click as the browser fires it after releasing; `true` if it reached the element */
function click(el: Element) {
	return el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('long press opens the context menu', () => {
	let el: HTMLElement;
	let uninstall: () => void;
	let menus: MouseEvent[];
	let clicks: number;

	beforeEach(() => {
		vi.useFakeTimers();
		el = document.createElement('div');
		document.body.append(el);
		menus = [];
		clicks = 0;
		el.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			menus.push(e);
		});
		el.addEventListener('click', () => clicks++);
		uninstall = installLongPress();
	});

	afterEach(() => {
		uninstall();
		el.remove();
		vi.useRealTimers();
	});

	it('fires contextmenu at the pressed point after holding, and swallows the click on release', () => {
		pointer(el, 'pointerdown', 30, 40);
		vi.advanceTimersByTime(LONG_PRESS_MS - 1);
		expect(menus).toHaveLength(0);
		vi.advanceTimersByTime(1);
		expect(menus).toHaveLength(1);
		expect([menus[0].clientX, menus[0].clientY]).toEqual([30, 40]);
		pointer(el, 'pointerup', 30, 40);
		click(el);
		expect(clicks).toBe(0);
		// The next tap is a normal click again
		pointer(el, 'pointerdown');
		pointer(el, 'pointerup');
		click(el);
		expect(clicks).toBe(1);
	});

	it('does nothing for a short tap, a mouse or a finger that moves (scrolling)', () => {
		pointer(el, 'pointerdown');
		pointer(el, 'pointerup');
		vi.advanceTimersByTime(LONG_PRESS_MS * 2);
		pointer(el, 'pointerdown', 10, 10, 'mouse');
		vi.advanceTimersByTime(LONG_PRESS_MS * 2);
		pointer(el, 'pointerdown');
		pointer(el, 'pointermove', 10, 30);
		vi.advanceTimersByTime(LONG_PRESS_MS * 2);
		pointer(el, 'pointerdown');
		pointer(el, 'pointercancel');
		vi.advanceTimersByTime(LONG_PRESS_MS * 2);
		expect(menus).toHaveLength(0);
	});

	it('opens only once when the browser fires its own contextmenu (Android)', () => {
		// Browser first: ours is cancelled
		pointer(el, 'pointerdown');
		el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		vi.advanceTimersByTime(LONG_PRESS_MS * 2);
		expect(menus).toHaveLength(1);
		pointer(el, 'pointerup');
		// Ours first: the browser's one is swallowed
		pointer(el, 'pointerdown');
		vi.advanceTimersByTime(LONG_PRESS_MS);
		el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		expect(menus).toHaveLength(2);
	});

	it('leaves the click alone when nobody handles the long press', () => {
		const other = document.createElement('span');
		document.body.append(other);
		let otherClicks = 0;
		other.addEventListener('click', () => otherClicks++);
		pointer(other, 'pointerdown');
		vi.advanceTimersByTime(LONG_PRESS_MS);
		pointer(other, 'pointerup');
		click(other);
		expect(otherClicks).toBe(1);
		other.remove();
	});
});
