// Recently used tools, for the launcher on the overview. Every tool records itself when it loads (also when it
// starts as an installed app or from a bookmark). Suite-wide key (all tools share one origin), like `theme`.

import { loadJson, storeJson } from './storage.js';

export const RECENT_KEY = 'recent-tools';
export const RECENT_MAX = 5;

/** `item` in front, without duplicates, at most `max` entries (also for other recently-used lists) */
export function pushRecent(list: readonly string[], item: string, max = RECENT_MAX): string[] {
	return [item, ...list.filter((entry) => entry !== item)].slice(0, max);
}

/** Start pages of the recently used tools (e.g. `/pdf-editor`), most recent first; empty if storage is blocked */
export function recentTools(): string[] {
	const value = loadJson<unknown>(RECENT_KEY, []);
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/** Records that the tool with this start page was opened (call once in the tool's layout) */
export function recordToolUse(url: string) {
	storeJson(RECENT_KEY, pushRecent(recentTools(), url));
}
