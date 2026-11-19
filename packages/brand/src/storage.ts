// localStorage access that never throws: in a private window, with blocked or full storage everything stored there
// is only a convenience, so reading falls back and writing is skipped quietly. Keys start with `<tool>:`.

/** Stored text of `key`, `null` if missing or unavailable */
export function readStored(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

/** Stores `value` under `key`; `null` removes it */
export function writeStored(key: string, value: string | null) {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		// Storage full or blocked: only a convenience
	}
}

/**
 * Parsed JSON of `key`, `fallback` if missing, unavailable or broken. Not validated: where an old or foreign value
 * could break things, ask for `unknown` and check the shape.
 */
export function loadJson<T = unknown>(key: string, fallback: T): T {
	const raw = readStored(key);
	if (raw === null) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

export function storeJson(key: string, value: unknown) {
	writeStored(key, JSON.stringify(value));
}
