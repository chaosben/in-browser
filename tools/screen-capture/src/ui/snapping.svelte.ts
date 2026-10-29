const STORAGE_KEY = 'screen-capture:snapping';

function load(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) !== 'off';
	} catch {
		// localStorage not available
		return true;
	}
}

/** Snapping in the preview and the timeline (persisted); Alt while dragging does the opposite */
class Snapping {
	#enabled = $state(load());

	get enabled() {
		return this.#enabled;
	}

	set enabled(on: boolean) {
		this.#enabled = on;
		try {
			localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
		} catch {
			// ignore
		}
	}

	/** Snap during this drag step? */
	active(e: { altKey: boolean }) {
		return this.#enabled !== e.altKey;
	}
}

export const snapping = new Snapping();
