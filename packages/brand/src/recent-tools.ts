// Recently used tools, for the launcher on the overview. Every tool records itself when it loads (also when it
// starts as an installed app or from a bookmark). Suite-wide key (all tools share one origin), like `theme`.

export const RECENT_KEY = 'recent-tools';
export const RECENT_MAX = 5;

/** `url` in front, without duplicates, at most `RECENT_MAX` entries */
export function pushRecent(list: readonly string[], url: string): string[] {
	return [url, ...list.filter((entry) => entry !== url)].slice(0, RECENT_MAX);
}

/** Start pages of the recently used tools (e.g. `/notes`), most recent first; empty if storage is blocked */
export function recentTools(): string[] {
	try {
		const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
		return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
	} catch {
		return [];
	}
}

/** Records that the tool with this start page was opened (call once in the tool's layout) */
export function recordToolUse(url: string) {
	try {
		localStorage.setItem(RECENT_KEY, JSON.stringify(pushRecent(recentTools(), url)));
	} catch {
		// Storage blocked (private mode, site data disabled): the launcher just shows no recent tools
	}
}
