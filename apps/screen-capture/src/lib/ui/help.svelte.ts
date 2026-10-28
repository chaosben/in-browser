// Help window: open or closed, shown topic, position and size (topic, position and size persisted)

const STORAGE_KEY = 'screen-capture:help';

interface Stored {
	topic: string;
	/** Top-left corner in CSS pixels; `null`: default place (bottom right of the preview) */
	pos: { x: number; y: number } | null;
	size: { w: number; h: number };
}

const DEFAULTS: Stored = { topic: 'start', pos: null, size: { w: 760, h: 540 } };

function load(): Stored {
	try {
		const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
		if (value && typeof value === 'object') return { ...DEFAULTS, ...value };
	} catch {
		// localStorage not available or broken entry
	}
	return DEFAULTS;
}

class HelpState {
	open = $state(false);
	topic = $state(DEFAULTS.topic);
	pos = $state<Stored['pos']>(null);
	size = $state(DEFAULTS.size);

	constructor() {
		const stored = load();
		this.topic = stored.topic;
		this.pos = stored.pos;
		this.size = stored.size;
	}

	toggle() {
		this.open = !this.open;
	}

	save() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ topic: this.topic, pos: this.pos, size: this.size }));
		} catch {
			// ignore
		}
	}
}

export const helpState = new HelpState();
