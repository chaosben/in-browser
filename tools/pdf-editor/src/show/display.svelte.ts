// The display's side of a presentation: it holds where the presentation stands (`state.ts`) and is the only one that
// decides; controls send it where to go and hear its state after every change and on every “hello”. Keys and clicks
// on the display itself go the same way, so it keeps working when every control is gone. While a remote control –
// one on another device – is connected, it alone steers (decided by the user): the display's own keys and clicks for
// going on wait (`local`) until it leaves or falls silent.

import { atEnd, clamp, go, nextOf, previousOf, START, type ShowDeck, type ShowState } from './state.js';
import type { FromDisplay, PointerMode, ShowLink, ToDisplay } from './protocol.js';

export type DisplayLink = ShowLink<ToDisplay, FromDisplay>;

/** A remote control that said nothing for this long counts as gone (it asks every 2 s) */
export const REMOTE_SILENT_MS = 5000;

export class DisplayController {
	state = $state<ShowState>(START);
	pointer = $state<{ x: number; y: number; mode: PointerMode } | null>(null);
	fullscreen = $state(false);
	/** Tells this display from one started before it (a reload) */
	readonly run = crypto.randomUUID();
	/** A control ended the presentation */
	onend: (() => void) | null = null;
	/** The place changed (kept so a reload starts there) */
	onplace: ((state: ShowState) => void) | null = null;
	private readonly links = new Map<DisplayLink, () => void>();
	/** When a remote control was last heard (`now`'s clock), 0: none is there */
	private remoteHeard = 0;

	constructor(
		private readonly deck: () => ShowDeck,
		start?: { page: number; step: number },
		/** The version of the file shown (`PdfDocument.fingerprint`) */
		private readonly file: () => string = () => '',
		private readonly now: () => number = () => performance.now()
	) {
		if (start) this.state = go(deck(), START, start);
	}

	/** A remote control is connected: it steers, the display's own keys and clicks for going on wait */
	get controlled(): boolean {
		return this.remoteHeard > 0 && this.now() - this.remoteHeard < REMOTE_SILENT_MS;
	}

	/** Runs what a key or click on the display itself asks for – unless a remote control steers */
	local(action: () => void) {
		if (!this.controlled) action();
	}

	/** Hears a control on `link` and tells it the state right away. `remote`: a control on another device – while it
	 * is heard it steers alone, and it never ends the presentation (its “End” only leaves) */
	attach(link: DisplayLink, { remote = false } = {}): () => void {
		const off = link.onMessage((message) => {
			if (!remote) return this.hear(message);
			if (message.t === 'end') return;
			this.remoteHeard = message.t === 'bye' ? 0 : this.now();
			this.hear(message);
		});
		this.links.set(link, off);
		link.send(this.message());
		return () => {
			off();
			this.links.delete(link);
		};
	}

	private hear(message: ToDisplay) {
		switch (message.t) {
			case 'hello':
				return this.broadcast();
			case 'go':
				return this.goTo(message);
			case 'blank':
				return this.setBlank(message.on);
			case 'pointer':
				this.pointer = 'off' in message ? null : { x: message.x, y: message.y, mode: message.mode };
				return;
			case 'end':
				return this.onend?.();
			case 'bye':
				return;
		}
	}

	goTo(to: { page: number; step: number }) {
		this.set(go(this.deck(), this.state, to));
	}

	next() {
		this.goTo(nextOf(this.deck(), this.state));
	}

	previous() {
		this.goTo(previousOf(this.deck(), this.state));
	}

	first() {
		this.goTo({ page: 0, step: 0 });
	}

	last() {
		const deck = this.deck();
		this.goTo({ page: deck.pages - 1, step: 0 });
	}

	get atEnd(): boolean {
		return atEnd(this.deck(), this.state);
	}

	setBlank(on: boolean) {
		if (this.state.blank !== on) this.set({ ...this.state, blank: on });
		else this.broadcast();
	}

	/** The file was read anew (another version): the place stays where the new one has it, and every control hears */
	reloaded() {
		this.set({ ...this.state, ...clamp(this.deck(), this.state) });
	}

	setFullscreen(on: boolean) {
		if (this.fullscreen === on) return;
		this.fullscreen = on;
		this.broadcast();
	}

	/** Tells every control that the display is gone (closed, ended) */
	leave() {
		for (const [link, off] of this.links) {
			link.send({ t: 'gone' });
			off();
		}
		this.links.clear();
	}

	private set(next: ShowState) {
		const moved = next.page !== this.state.page || next.step !== this.state.step;
		this.state = next;
		// The pointer belongs to the slide it was shown on
		if (moved) this.pointer = null;
		this.onplace?.(next);
		this.broadcast();
	}

	private message(): FromDisplay {
		return { t: 'state', ...this.state, file: this.file(), fullscreen: this.fullscreen, run: this.run };
	}

	private broadcast() {
		const message = this.message();
		for (const link of this.links.keys()) link.send(message);
	}
}
