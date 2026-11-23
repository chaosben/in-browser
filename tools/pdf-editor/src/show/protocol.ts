// What the display and its controls (the presenter view, a phone) say to each other. The display is the only one
// that decides where the presentation stands; it answers every message with its state, so a control that missed
// something (reloaded, reconnected) is right again with the next answer. The same messages go between two windows
// of one browser (`local.ts`) and between devices.

/** How the pointer shows on the display */
export type PointerMode = 'dot' | 'spotlight';

/** A control to the display */
export type ToDisplay =
	/** Asks for the state (a control that just came or came back) */
	| { t: 'hello' }
	/** Go to a place – absolute, so sending it twice never skips anything */
	| { t: 'go'; page: number; step: number }
	| { t: 'blank'; on: boolean }
	/** The pointer at a point of the slide (0…1 across and down), or gone */
	| { t: 'pointer'; x: number; y: number; mode: PointerMode }
	| { t: 'pointer'; off: true }
	/** The presentation ends: the display closes (only heard from the presenter view of the same browser) */
	| { t: 'end' }
	/** A remote control leaves: the display goes on, and takes its own keys again at once */
	| { t: 'bye' };

/** The display to its controls */
export type FromDisplay =
	| {
			t: 'state';
			page: number;
			step: number;
			blank: boolean;
			/** The version of the PDF it shows (`PdfDocument.fingerprint`): a control with another one sees it differs */
			file: string;
			/** Whether it fills its screen */
			fullscreen: boolean;
			/** Tells a display started anew (reloaded) from the one before */
			run: string;
	  }
	/** The display was closed or ended */
	| { t: 'gone' };

/** One end of a connection between the display and a control */
export interface ShowLink<In, Out> {
	send(message: Out): void;
	onMessage(handler: (message: In) => void): () => void;
	close(): void;
}

const POINTER_MODES: readonly PointerMode[] = ['dot', 'spotlight'];
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A message to the display, checked (another device may send anything): null when it isn't one */
export function toDisplay(raw: unknown): ToDisplay | null {
	if (!raw || typeof raw !== 'object') return null;
	const m = raw as Record<string, unknown>;
	switch (m.t) {
		case 'hello':
		case 'end':
		case 'bye':
			return { t: m.t };
		case 'go':
			return finite(m.page) && finite(m.step) ? { t: 'go', page: m.page, step: m.step } : null;
		case 'blank':
			return typeof m.on === 'boolean' ? { t: 'blank', on: m.on } : null;
		case 'pointer':
			if (m.off === true) return { t: 'pointer', off: true };
			return finite(m.x) && finite(m.y) && POINTER_MODES.includes(m.mode as PointerMode)
				? { t: 'pointer', x: Math.min(1, Math.max(0, m.x)), y: Math.min(1, Math.max(0, m.y)), mode: m.mode as PointerMode }
				: null;
	}
	return null;
}

/** A message from the display, checked: null when it isn't one */
export function fromDisplay(raw: unknown): FromDisplay | null {
	if (!raw || typeof raw !== 'object') return null;
	const m = raw as Record<string, unknown>;
	if (m.t === 'gone') return { t: 'gone' };
	if (m.t === 'state' && finite(m.page) && finite(m.step) && typeof m.file === 'string' && typeof m.blank === 'boolean' && typeof m.fullscreen === 'boolean' && typeof m.run === 'string')
		return { t: 'state', page: m.page, step: m.step, blank: m.blank, file: m.file, fullscreen: m.fullscreen, run: m.run };
	return null;
}
