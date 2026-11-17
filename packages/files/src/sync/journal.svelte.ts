import { idbGet, idbSet } from './idb.js';
import { logText, SyncLog, type LogEntry } from './log.js';

// The opt-in sync log in the app. Each sync (folder, devices) runs in its leading tab – possibly different tabs – and
// writes its own trail to IndexedDB (`log:<source>`); whether logging is on is shared (`log-enabled`, changes go to
// every tab via BroadcastChannel `files:log`). The export merges all trails in time order.

export type LogSource = 'folder' | 'p2p';

const SOURCES: LogSource[] = ['folder', 'p2p'];
const ENABLED = 'log-enabled';
const key = (source: LogSource) => `log:${source}`;

type Message = { enabled: boolean } | { cleared: true };

let channel: BroadcastChannel | null = null;
const logs = new Map<LogSource, SyncLog>();

function connect() {
	if (channel || typeof BroadcastChannel === 'undefined') return;
	channel = new BroadcastChannel('files:log');
	channel.onmessage = (e: MessageEvent<Message>) => {
		for (const log of logs.values()) {
			if ('enabled' in e.data) log.enabled = e.data.enabled;
			else log.entries = [];
		}
	};
}

/** The log a sync writes to (call in its leading tab); entries are saved shortly after they come in */
export async function journal(source: LogSource): Promise<SyncLog> {
	connect();
	const existing = logs.get(source);
	if (existing) return existing;
	const log = new SyncLog();
	logs.set(source, log);
	log.enabled = (await idbGet<boolean>(ENABLED)) ?? false;
	log.entries = ((await idbGet<LogEntry[]>(key(source))) ?? []).concat(log.entries);
	const add = log.add;
	log.add = (event, data) => {
		if (!log.enabled) return;
		add(event, data);
		log.entries[log.entries.length - 1].source = source;
	};
	let timer: ReturnType<typeof setTimeout> | undefined;
	log.onChange(() => {
		clearTimeout(timer);
		timer = setTimeout(() => void idbSet(key(source), log.entries), 500);
	});
	return log;
}

// --- From the UI (any tab) ---

export interface LogInfo {
	enabled: boolean;
	count: number;
}

async function allEntries(): Promise<LogEntry[]> {
	const lists = await Promise.all(SOURCES.map(async (source) => (await idbGet<LogEntry[]>(key(source))) ?? []));
	return lists.flat().sort((a, b) => a.t - b.t);
}

export async function logInfo(): Promise<LogInfo> {
	return { enabled: (await idbGet<boolean>(ENABLED)) ?? false, count: (await allEntries()).length };
}

export async function setLogEnabled(on: boolean) {
	await idbSet(ENABLED, on);
	connect();
	channel?.postMessage({ enabled: on } satisfies Message);
	for (const log of logs.values()) log.enabled = on;
}

export async function clearLog() {
	for (const source of SOURCES) await idbSet(key(source), []);
	connect();
	channel?.postMessage({ cleared: true } satisfies Message);
	for (const log of logs.values()) log.entries = [];
}

/** All trails as one text file; `header`: what describes this device and its syncs */
export async function exportLog(header: Record<string, unknown>): Promise<string> {
	// Give the leading tabs a moment to save what just came in
	await new Promise((r) => setTimeout(r, 600));
	const entries = await allEntries();
	return logText(entries, { ...header, entries: entries.length });
}
