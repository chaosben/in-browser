// The suite settings in the browser (`settings.ts`: file, schema): values as state, read once and again whenever the
// file changes (another tab, a device, the folder on disk), and the settings dialog's state – any tool opens it,
// also at one category (`openSettings('profile')`).

import { readText, watch, write } from './fs.js';
import { FilesError } from './entry.js';
import { parseSettings, SUITE_SETTINGS, withValue, type CategoryId, type SettingKey, type SuiteSettings } from './settings.js';
import { trashRetention } from './trash-browser.js';

async function readSettings(): Promise<string | null> {
	try {
		return await readText(SUITE_SETTINGS);
	} catch (e) {
		if (e instanceof FilesError && e.code === 'notFound') return null;
		throw e;
	}
}

class SuiteSettingsStore {
	/** Every setting (defaults until loaded) */
	values = $state<SuiteSettings>(parseSettings(null));
	#loading: Promise<void> | null = null;
	#watching = false;
	#writing: Promise<void> = Promise.resolve();

	/** Loads once (and again when the file changes); safe to call often */
	load(): Promise<void> {
		if (!this.#watching) {
			this.#watching = true;
			watch((paths) => {
				if (!paths.includes(SUITE_SETTINGS)) return;
				this.#loading = null;
				void this.load();
			});
		}
		this.#loading ??= (async () => {
			try {
				const values = parseSettings(await readSettings());
				// The retention may still be where earlier versions kept it
				values.trash.days = (await trashRetention()) as SuiteSettings['trash']['days'];
				this.values = values;
			} catch (e) {
				console.warn('[settings]', e);
			}
		})();
		return this.#loading;
	}

	/** Changes one setting for every device (the file is read again first: what else is in it stays) */
	set<C extends CategoryId, K extends SettingKey<C>>(category: C, key: K, value: SuiteSettings[C][K]): Promise<void> {
		this.values[category][key] = value;
		this.#writing = this.#writing.catch(() => undefined).then(async () => {
			await write(SUITE_SETTINGS, withValue(await readSettings(), category, key, value));
		});
		return this.#writing;
	}
}

export const suiteSettings = new SuiteSettingsStore();

/** The settings dialog: open or not, and the category shown */
export const settingsDialog = $state<{ open: boolean; category: CategoryId | null }>({ open: false, category: null });

/** Opens the settings (at a category; without one, at the first – phones: the list) */
export function openSettings(category?: CategoryId) {
	settingsDialog.category = category ?? null;
	settingsDialog.open = true;
	void suiteSettings.load();
}

export function closeSettings() {
	settingsDialog.open = false;
}
