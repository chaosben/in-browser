import { m } from '#lib/i18n/index.js';

/** 83.456 → "1:23.4" */
export function formatTime(seconds: number, decimals = 1): string {
	const s = Math.max(0, seconds);
	const min = Math.floor(s / 60);
	const rest = (s - min * 60).toFixed(decimals).padStart(decimals ? 3 + decimals : 2, '0');
	return `${min}:${rest}`;
}

export function errorMessage(e: unknown): string {
	if (e instanceof DOMException && e.name === 'NotAllowedError') return m.common.denied;
	if (e instanceof DOMException && e.name === 'AbortError') return m.common.aborted;
	return e instanceof Error ? e.message : String(e);
}

export function isAbort(e: unknown): boolean {
	return e instanceof DOMException && (e.name === 'AbortError' || e.name === 'NotAllowedError');
}
