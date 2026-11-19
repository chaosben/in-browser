import { readStored, writeStored } from '@in-browser/brand/storage.js';

const STORAGE_KEY = 'screen-capture:snapping';

/** Snapping in the preview and the timeline (persisted); Alt while dragging does the opposite */
class Snapping {
	#enabled = $state(readStored(STORAGE_KEY) !== 'off');

	get enabled() {
		return this.#enabled;
	}

	set enabled(on: boolean) {
		this.#enabled = on;
		writeStored(STORAGE_KEY, on ? 'on' : 'off');
	}

	/** Snap during this drag step? */
	active(e: { altKey: boolean }) {
		return this.#enabled !== e.altKey;
	}
}

export const snapping = new Snapping();
