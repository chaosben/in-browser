// Opt-in log of the syncs (folder on disk and other devices) for finding errors: what each sync saw and decided
// (states of both sides and of the last sync per path, content comparisons, conflict copies, sign-ins, member
// changes). Kept on this device only; exported as a text file on request. Contains file and device names.

export type LogFn = (event: string, data?: Record<string, unknown>) => void;

export interface LogEntry {
	/** Time in ms */
	t: number;
	/** Which sync wrote it */
	source?: string;
	event: string;
	data?: Record<string, unknown>;
}

export const LOG_LIMIT = 20_000;

export class SyncLog {
	enabled = false;
	entries: LogEntry[] = [];
	private listeners = new Set<() => void>();

	/** Records an entry while enabled (keeps the newest `LOG_LIMIT`) */
	add: LogFn = (event, data) => {
		if (!this.enabled) return;
		this.entries.push({ t: Date.now(), event, data });
		if (this.entries.length > LOG_LIMIT) this.entries.splice(0, this.entries.length - LOG_LIMIT);
		this.listeners.forEach((listener) => listener());
	};

	clear() {
		this.entries = [];
		this.listeners.forEach((listener) => listener());
	}

	onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

/** Text file: a header (device, version, browser, group) and one JSON line per entry */
export function logText(entries: LogEntry[], header: Record<string, unknown>): string {
	const lines = [`# in-browser sync log`, ...Object.entries(header).map(([key, value]) => `# ${key}: ${JSON.stringify(value)}`), ''];
	for (const entry of entries) {
		const source = entry.source ? `[${entry.source}] ` : '';
		lines.push(`${new Date(entry.t).toISOString()} ${source}${entry.event}${entry.data ? ' ' + JSON.stringify(entry.data) : ''}`);
	}
	return lines.join('\n') + '\n';
}
