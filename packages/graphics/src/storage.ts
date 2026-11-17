// localStorage helpers of the package (keys start with `graphics:`).

/** Stored value of `key`; falls back to `legacy` (the key before it became suite-wide), null if neither exists */
export function readStored(key: string, legacy?: string): string | null {
	return localStorage.getItem(key) ?? (legacy ? localStorage.getItem(legacy) : null);
}
