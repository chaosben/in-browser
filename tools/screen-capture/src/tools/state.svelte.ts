const STORAGE_KEY = 'screen-capture:tool-panel';

function loadGroup(): string | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw !== null) return raw || null;
	} catch {
		// localStorage not available
	}
	return 'media';
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
		try {
			localStorage.setItem(STORAGE_KEY, id ?? '');
		} catch {
			// ignore
		}
	}

	/** Click on the group icon: open it, or collapse it if already active */
	toggle(id: string) {
		this.group = this.#group === id ? null : id;
	}
}

export const toolState = new ToolState();
