import { readStored, writeStored } from '@in-browser/brand/storage.js';

const STORAGE_KEY = 'screen-capture:tool-panel';

/** Open group; `''` stored means collapsed */
function loadGroup(): string | null {
	const raw = readStored(STORAGE_KEY);
	return raw === null ? 'media' : raw || null;
}

/** State of the left tool rail: open group (persisted) and active tab per group */
class ToolState {
	#group = $state(loadGroup());
	tabs = $state<Record<string, string>>({});

	get group() {
		return this.#group;
	}

	set group(id: string | null) {
		this.#group = id;
		writeStored(STORAGE_KEY, id ?? '');
	}

	/** Click on the group icon: open it, or collapse it if already active */
	toggle(id: string) {
		this.group = this.#group === id ? null : id;
	}
}

export const toolState = new ToolState();
