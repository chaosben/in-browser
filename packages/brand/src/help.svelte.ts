// Help window of a tool: open or closed, shown topic, position and size (topic, position and size persisted under
// `<tool>:help`). Each tool creates one in its layout and passes it to `BrandBar` and `HelpWindow`.

import { loadJson, storeJson } from './storage.js';
import { inTextField } from './ui/typing.js';

interface Stored {
	topic: string | null;
	/** Top-left corner in CSS pixels; `null`: default place */
	pos: { x: number; y: number } | null;
	size: { w: number; h: number };
}

const DEFAULTS: Stored = { topic: null, pos: null, size: { w: 760, h: 540 } };

export class HelpState {
	open = $state(false);
	/** Shown topic; `null`: the first one */
	topic = $state<string | null>(DEFAULTS.topic);
	pos = $state<Stored['pos']>(DEFAULTS.pos);
	size = $state(DEFAULTS.size);
	readonly #key: string;

	/** `tool`: prefix of the storage key, e.g. `screen-capture` */
	constructor(tool: string) {
		this.#key = `${tool}:help`;
		const value = loadJson<Partial<Stored> | null>(this.#key, null);
		if (value && typeof value === 'object') {
			const stored = { ...DEFAULTS, ...value } as Stored;
			this.topic = stored.topic;
			this.pos = stored.pos;
			this.size = stored.size;
		}
	}

	toggle() {
		this.open = !this.open;
	}

	/** Opens the help at a topic */
	show(topic?: string) {
		if (topic) this.topic = topic;
		this.open = true;
		this.save();
	}

	save() {
		storeJson(this.#key, { topic: this.topic, pos: this.pos, size: this.size });
	}
}

/**
 * F1 opens and closes the help everywhere (not the browser's own help), `?` only outside of text fields and
 * editors. Not while a modal dialog is open (the help would sit behind it). Call from an `$effect` and return the
 * result.
 */
export function installHelpKeys(help: HelpState): () => void {
	const onKey = (e: KeyboardEvent) => {
		if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.key !== 'F1' && e.key !== '?') return;
		if (document.querySelector('dialog[open]:modal')) return;
		if (e.key === '?' && inTextField(e.target)) return;
		e.preventDefault();
		help.toggle();
	};
	window.addEventListener('keydown', onKey);
	return () => window.removeEventListener('keydown', onKey);
}
