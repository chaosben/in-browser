import { describe, expect, it } from 'vitest';
import { DisplayController, REMOTE_SILENT_MS, type DisplayLink } from './display.svelte.js';
import type { ToDisplay } from './protocol.js';

// Who steers the slides: while a remote control on another device is connected it alone does – a key pressed at the
// projector by mistake must not move them – and when it is gone the display's own keys work again. Its “End” never
// closes the slides.

/** A link whose control's messages the test sends */
function link() {
	let handler: (message: ToDisplay) => void = () => {};
	const end: DisplayLink = { send() {}, onMessage: (h) => ((handler = h), () => {}), close() {} };
	return { end, say: (message: ToDisplay) => handler(message) };
}

describe('a display with a remote control', () => {
	it('leaves the steering to the remote control while it is heard, and takes its keys back when it leaves or falls silent', () => {
		let now = 1000;
		const display = new DisplayController(() => ({ pages: 5, steps: () => 0 }), undefined, () => '', () => now);
		let ended = 0;
		display.onend = () => ended++;
		const remote = link();
		display.attach(remote.end, { remote: true });
		// Nobody there yet: the display's own key goes on
		display.local(() => display.next());
		expect(display.state.page).toBe(1);

		remote.say({ t: 'hello' });
		display.local(() => display.next());
		expect(display.state.page).toBe(1);
		remote.say({ t: 'go', page: 3, step: 0 });
		expect(display.state.page).toBe(3);
		// Its “End” closes nothing
		remote.say({ t: 'end' });
		expect(ended).toBe(0);

		// Silent for too long (the connection dropped): the keys at the projector work
		now += REMOTE_SILENT_MS + 1;
		display.local(() => display.next());
		expect(display.state.page).toBe(4);

		// Back, then leaving: at once
		remote.say({ t: 'hello' });
		display.local(() => display.previous());
		expect(display.state.page).toBe(4);
		remote.say({ t: 'bye' });
		display.local(() => display.previous());
		expect(display.state.page).toBe(3);

		// The presenter view of the same browser never takes the keys away, and its “End” ends
		const presenter = link();
		display.attach(presenter.end);
		presenter.say({ t: 'hello' });
		display.local(() => display.next());
		expect(display.state.page).toBe(4);
		presenter.say({ t: 'end' });
		expect(ended).toBe(1);
	});
});
