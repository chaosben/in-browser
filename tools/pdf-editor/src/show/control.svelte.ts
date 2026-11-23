// A control's side of a presentation (the presenter view, a phone): it sends the display where to go – always as a
// place – and shows the display's state when it answers. A change shows at once (`pending`) and is confirmed by the
// next state; a display that stops answering shows as gone, and every place sent again after it is back is a place,
// never “one further”, so nothing is skipped.

import { nextOf, previousOf, type ShowDeck } from './state.js';
import type { FromDisplay, PointerMode, ShowLink, ToDisplay } from './protocol.js';

export type ControlLink = ShowLink<FromDisplay, ToDisplay>;
type DisplayState = Extract<FromDisplay, { t: 'state' }>;

/** Asking the display this often how it stands */
const HEARTBEAT_MS = 2000;
/** Without an answer for this long the display counts as gone */
const SILENT_MS = 5000;

export class ShowControl {
	/** The display's state as it last said it */
	display = $state<DisplayState | null>(null);
	/** A place sent and not confirmed yet */
	pending = $state<{ page: number; step: number } | null>(null);
	/** The display answered lately */
	connected = $state(false);
	/** The display said it is gone (closed, ended) */
	gone = $state(false);
	private lastHeard = 0;
	private readonly timer: ReturnType<typeof setInterval>;
	private readonly off: () => void;
	/** The newest pointer position waiting to be sent (one per frame) */
	private pointerNext: ToDisplay | null = null;
	private pointerFrame = 0;

	constructor(
		private readonly link: ControlLink,
		private readonly deck: () => ShowDeck
	) {
		this.off = link.onMessage((message) => this.hear(message));
		link.send({ t: 'hello' });
		this.timer = setInterval(() => {
			link.send({ t: 'hello' });
			if (this.connected && performance.now() - this.lastHeard > SILENT_MS) this.connected = false;
		}, HEARTBEAT_MS);
	}

	/** Where the presentation stands as this control shows it: the place sent, else the display's */
	get place(): { page: number; step: number } {
		return this.pending ?? (this.display ? { page: this.display.page, step: this.display.step } : { page: 0, step: 0 });
	}

	private hear(message: FromDisplay) {
		if (message.t === 'gone') {
			this.gone = true;
			this.connected = false;
			return;
		}
		this.lastHeard = performance.now();
		this.connected = true;
		this.gone = false;
		this.display = message;
		// The display went where it was sent (or decided otherwise: its word counts)
		this.pending = null;
	}

	goTo(to: { page: number; step: number }) {
		this.pending = to;
		this.link.send({ t: 'go', page: to.page, step: to.step });
	}

	next() {
		this.goTo(nextOf(this.deck(), this.place));
	}

	previous() {
		this.goTo(previousOf(this.deck(), this.place));
	}

	blank(on: boolean) {
		this.link.send({ t: 'blank', on });
	}

	/** The pointer at a point of the current slide (0…1), or gone; at most one position per frame goes out */
	point(at: { x: number; y: number } | null, mode: PointerMode) {
		this.pointerNext = at ? { t: 'pointer', x: at.x, y: at.y, mode } : { t: 'pointer', off: true };
		if (this.pointerFrame) return;
		this.pointerFrame = requestAnimationFrame(() => {
			this.pointerFrame = 0;
			const message = this.pointerNext;
			this.pointerNext = null;
			if (message) this.link.send(message);
		});
	}

	/** Ends the presentation: the display closes */
	end() {
		this.link.send({ t: 'end' });
	}

	/** A remote control leaves: the slides stay and go on with their own keys */
	leave() {
		this.link.send({ t: 'bye' });
	}

	destroy() {
		clearInterval(this.timer);
		cancelAnimationFrame(this.pointerFrame);
		this.off();
	}
}
