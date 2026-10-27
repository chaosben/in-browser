// Last used settings per annotation type (color, font, width, duration, …), applied to the next new annotation
// of that type. Position, content and step number are not part of it. Stored in localStorage for all projects.

import type { Annotation, AnnotationKind } from './types.js';

const STORAGE_KEY = 'screen-capture:annotation-styles';

/** Fields that are not settings: identity, timing, track, geometry and content */
const NOT_STYLE: ReadonlySet<string> = new Set([
	'id',
	'type',
	'kind',
	'start',
	'end',
	'track',
	'group',
	'from',
	'to',
	'rect',
	'x',
	'y',
	'boxWidth',
	'tip',
	'text',
	'number',
	'imageId',
	'icon'
]);

/** Remembered settings of one type; `duration` in seconds */
export type Style = Record<string, unknown>;

type Styles = Partial<Record<AnnotationKind, Style>>;

/** Only the setting fields of a change */
export function styleFields(patch: object): Style {
	return Object.fromEntries(Object.entries(patch).filter(([key]) => !NOT_STYLE.has(key)));
}

/** Same kind of value, so a stale or broken entry cannot produce an invalid annotation */
function compatible(current: unknown, stored: unknown) {
	if (typeof current === typeof stored && current !== null && stored !== null) return true;
	// Optional colors (text background): string or none
	const color = (v: unknown) => v === null || typeof v === 'string';
	return (current === null || stored === null) && color(current) && color(stored);
}

/** New annotation with the remembered settings of its type */
export function applyStyle<T extends Annotation>(annotation: T, style: Style | undefined): T {
	if (!style) return annotation;
	const result: Record<string, unknown> = { ...annotation };
	for (const [key, value] of Object.entries(style)) {
		if (NOT_STYLE.has(key) || !(key in result) || !compatible(result[key], value)) continue;
		result[key] = value;
	}
	const duration = style.duration;
	if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) result.end = annotation.start + duration;
	return result as T;
}

function load(): Styles {
	try {
		const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		return raw && typeof raw === 'object' ? raw : {};
	} catch {
		// localStorage not available or invalid JSON
		return {};
	}
}

function store(kind: AnnotationKind, style: Style) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...load(), [kind]: { ...load()[kind], ...style } }));
	} catch {
		// ignore
	}
}

export function loadStyle(kind: AnnotationKind): Style | undefined {
	const style = load()[kind];
	return style && typeof style === 'object' ? style : undefined;
}

/** Remembers the setting fields of a change for the next annotation of this type */
export function rememberStyle(kind: AnnotationKind, patch: object) {
	const style = styleFields(patch);
	if (Object.keys(style).length) store(kind, style);
}

export function rememberDuration(kind: AnnotationKind, seconds: number) {
	if (Number.isFinite(seconds) && seconds > 0) store(kind, { duration: seconds });
}
