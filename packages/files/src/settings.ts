// Settings of the whole suite that travel with the files: one JSON file in the shared file system
// (`/.apps/suite/settings.json`), synced to every device, the folder on disk and the p2p-node like everything else.
// The schema below is the only definition: categories (left in the settings dialog) with their settings (right).
// A new setting is one entry here plus its label and help text in `filesMessages().settings` – the dialog, the
// store's types and the parsing follow. Pure (no browser APIs): the p2p-node reads it too.

export const SUITE_SETTINGS = '/.apps/suite/settings.json';

/** Sizes as shown (`formatSize` counts in steps of 1000) */
const MB = 1000 * 1000;
const GB = 1000 * MB;

interface TextSetting {
	kind: 'text';
	default: string;
	/** Longest value kept */
	max: number;
	autocomplete?: AutoFill;
}
interface ChoiceSetting<V = unknown> {
	kind: 'choice';
	default: V;
	options: readonly V[];
}
interface ToggleSetting {
	kind: 'toggle';
	default: boolean;
}
export type Setting = TextSetting | ChoiceSetting | ToggleSetting;

interface CategorySpec {
	/** Icon in the list (full class name) */
	icon: string;
	settings: Record<string, Setting>;
}

export const SCHEMA = {
	profile: {
		icon: 'icon-[material-symbols-light--person-outline]',
		settings: {
			/** The user's name (e.g. written where a document names its author) */
			name: { kind: 'text', default: '', max: 100, autocomplete: 'name' }
		}
	},
	trash: {
		icon: 'icon-[material-symbols-light--delete-outline]',
		settings: {
			/** Days entries stay in the trash; `null`: until it is emptied */
			days: { kind: 'choice', default: 30, options: [7, 30, 90, null] }
		}
	},
	sync: {
		icon: 'icon-[material-symbols-light--sync]',
		settings: {
			/** Bytes from which a new folder arriving on a device waits for confirmation; `null`: never because of its size */
			askAbove: { kind: 'choice', default: GB, options: [100 * MB, GB, 10 * GB, null] }
		}
	}
} as const satisfies Record<string, CategorySpec>;

type Schema = typeof SCHEMA;
export type CategoryId = keyof Schema;
export const CATEGORY_IDS = Object.keys(SCHEMA) as CategoryId[];

type ValueOf<S> = S extends { kind: 'text' }
	? string
	: S extends { kind: 'toggle' }
		? boolean
		: S extends { options: readonly (infer V)[] }
			? V
			: never;

export type SuiteSettings = { -readonly [C in CategoryId]: { -readonly [K in keyof Schema[C]['settings']]: ValueOf<Schema[C]['settings'][K]> } };
export type SettingKey<C extends CategoryId> = keyof SuiteSettings[C] & string;

/** A setting's definition */
export const settingOf = (category: CategoryId, key: string): Setting => (SCHEMA[category].settings as Record<string, Setting>)[key];

/** A setting's value as stored, `undefined` when it is missing or not valid */
export function valid(setting: Setting, value: unknown): unknown {
	switch (setting.kind) {
		case 'text':
			return typeof value === 'string' ? value.trim().slice(0, setting.max) : undefined;
		case 'toggle':
			return typeof value === 'boolean' ? value : undefined;
		case 'choice':
			return setting.options.includes(value) ? value : undefined;
	}
}

/** The file's content as an object (`null` when missing or broken) */
export function parseRaw(text: string | null): Record<string, Record<string, unknown>> | null {
	if (text === null) return null;
	try {
		const raw: unknown = JSON.parse(text);
		return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, Record<string, unknown>>) : null;
	} catch {
		return null;
	}
}

/** A stored value (`undefined` when the file doesn't hold a valid one) */
export function storedValue(raw: Record<string, Record<string, unknown>> | null, category: CategoryId, key: string): unknown {
	const section = raw?.[category];
	if (!section || typeof section !== 'object') return undefined;
	return valid(settingOf(category, key), section[key]);
}

/** Every setting from the file's text: valid values as stored, the rest at their default */
export function parseSettings(text: string | null): SuiteSettings {
	const raw = parseRaw(text);
	const values: Record<string, Record<string, unknown>> = {};
	for (const category of CATEGORY_IDS) {
		values[category] = {};
		for (const [key, setting] of Object.entries(SCHEMA[category].settings as Record<string, Setting>)) {
			const value = storedValue(raw, category, key);
			values[category][key] = value === undefined ? setting.default : value;
		}
	}
	return values as SuiteSettings;
}

/** The file's new text with one value changed (everything else in it stays, also what this version doesn't know) */
export function withValue(text: string | null, category: CategoryId, key: string, value: unknown): string {
	const raw = parseRaw(text) ?? {};
	const section = raw[category] && typeof raw[category] === 'object' ? raw[category] : {};
	return JSON.stringify({ ...raw, [category]: { ...section, [key]: value } }, null, '\t');
}

/** The size from which a new folder waits for confirmation (`sync.askAbove`), read from a tree (browser or p2p-node) */
export async function askAboveOf(tree: { stat(path: string): Promise<unknown>; read(path: string): Promise<Blob> }): Promise<number | null> {
	try {
		const text = (await tree.stat(SUITE_SETTINGS)) ? await (await tree.read(SUITE_SETTINGS)).text() : null;
		return parseSettings(text).sync.askAbove;
	} catch {
		return SCHEMA.sync.settings.askAbove.default;
	}
}
