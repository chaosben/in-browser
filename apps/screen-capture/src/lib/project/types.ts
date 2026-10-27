import { m } from '#lib/i18n/index.js';
/** A media file in the project (recording or import), stored in the OPFS under `projects/<id>/media/<file>`. */
export interface Source {
	id: string;
	file: string;
	name: string;
	kind: 'recording' | 'import';
	duration: number;
	/** `false` for audio-only sources (audio file, microphone); `width`/`height` are 0 then. */
	hasVideo: boolean;
	width: number;
	height: number;
	hasAudio: boolean;
}

/** Common fields of all items on a track. Items on the same track never overlap in time. */
interface ItemBase {
	id: string;
	/** Timeline seconds */
	start: number;
	/** Track (0 = back). Higher tracks are drawn later, so they are in front. */
	track: number;
	/** Link: items of the same group (e.g. screen, webcam, microphone of a recording) are selected together. */
	group?: string;
}

/** Crop of a clip in the frame */
export type ClipShape = 'rect' | 'rounded' | 'circle';

/**
 * A segment of a source on the timeline (including audio-only sources). `in`/`out` are seconds within
 * the source.
 */
export interface VideoClip extends ItemBase {
	type: 'video';
	sourceId: string;
	in: number;
	out: number;
	/** Position on the canvas (content coordinates), default: source fitted */
	rect: Rect;
	shape?: ClipShape;
	/** Volume 0…1 (default 1) */
	volume?: number;
}

/** Holds frame `at` of the source for `duration` seconds (without audio). */
export interface FreezeClip extends ItemBase {
	type: 'freeze';
	sourceId: string;
	at: number;
	duration: number;
	rect: Rect;
	shape?: ClipShape;
}

export type Clip = VideoClip | FreezeClip;

export interface Point {
	x: number;
	y: number;
}

/** Normalized to 0…1 relative to the project canvas (content coordinates). */
export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

// Sizes (width, size) are fractions of the canvas height so they look the same at any resolution.
interface AnnotationBase extends ItemBase {
	type: 'annotation';
	/** Timeline seconds */
	end: number;
	/** Fade in and out smoothly */
	fade: boolean;
}

/** Bundled fonts for text annotations (see `render/fonts.svelte.ts`) */
export type FontId = 'system' | 'inter' | 'caveat' | 'jetbrains-mono' | 'montserrat';

interface Shadowed {
	/** Soft drop shadow */
	shadow: boolean;
}

export interface ArrowAnnotation extends AnnotationBase, Shadowed {
	kind: 'arrow';
	from: Point;
	to: Point;
	color: string;
	width: number;
}

export interface LineAnnotation extends AnnotationBase, Shadowed {
	kind: 'line';
	from: Point;
	to: Point;
	color: string;
	width: number;
	dashed: boolean;
}

export interface RectAnnotation extends AnnotationBase, Shadowed {
	kind: 'rect';
	rect: Rect;
	color: string;
	width: number;
	radius: number;
}

export interface EllipseAnnotation extends AnnotationBase, Shadowed {
	kind: 'ellipse';
	rect: Rect;
	color: string;
	width: number;
}

/** Numbered circle for step-by-step instructions */
export interface StepAnnotation extends AnnotationBase, Shadowed {
	kind: 'step';
	/** Center */
	x: number;
	y: number;
	/** Diameter */
	size: number;
	number: number;
	/** Fill; the number is drawn in black or white, whichever reads better */
	color: string;
}

export interface HighlightAnnotation extends AnnotationBase {
	kind: 'highlight';
	rect: Rect;
	/** Color including opacity (`#rrggbbaa`) */
	color: string;
}

export interface SpotlightAnnotation extends AnnotationBase {
	kind: 'spotlight';
	rect: Rect;
	/** Veil outside the area, color including opacity (`#rrggbbaa`) */
	color: string;
}

export interface BlurAnnotation extends AnnotationBase {
	kind: 'blur';
	rect: Rect;
	/** Blur radius as a fraction of the canvas height */
	strength: number;
	/** Blur the area itself or everything outside it (focus effect) */
	area: 'inside' | 'outside';
}

interface TextBase extends AnnotationBase, Shadowed {
	/** Top-left corner */
	x: number;
	y: number;
	text: string;
	size: number;
	color: string;
	font: FontId;
}

export interface TextAnnotation extends TextBase {
	kind: 'text';
	background: string | null;
}

/** Text box with a pointer to `tip` */
export interface CalloutAnnotation extends TextBase {
	kind: 'callout';
	background: string;
	tip: Point;
}

export type Annotation =
	| ArrowAnnotation
	| LineAnnotation
	| RectAnnotation
	| EllipseAnnotation
	| StepAnnotation
	| HighlightAnnotation
	| SpotlightAnnotation
	| BlurAnnotation
	| TextAnnotation
	| CalloutAnnotation;

export type AnnotationKind = Annotation['kind'];

export type ShadowedAnnotation = Extract<Annotation, Shadowed>;

const SHADOWED: ReadonlySet<AnnotationKind> = new Set(['arrow', 'line', 'rect', 'ellipse', 'step', 'text', 'callout']);

/** Annotations with a switchable drop shadow (not highlight, spotlight and blur) */
export function hasShadow(a: Annotation): a is ShadowedAnnotation {
	return SHADOWED.has(a.kind);
}

/** Everything that can be placed on a track */
export type Item = Clip | Annotation;

/** Zooms to `rect` during [start, end), with `ease` seconds of transition at both ends. */
export interface ZoomSegment {
	id: string;
	start: number;
	end: number;
	rect: Rect;
	ease: number;
}

/** State of a track (index = track number) */
export interface TrackState {
	/** Neither picture nor sound */
	hidden?: boolean;
	/** No sound */
	muted?: boolean;
	/** Not editable in the UI (ripple still applies so everything stays in sync) */
	locked?: boolean;
}

export interface Timeline {
	items: Item[];
	tracks: TrackState[];
	/** Dedicated camera track, affects the whole frame */
	zoom: ZoomSegment[];
}

export interface Project {
	version: 1;
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	/** Working resolution (canvas), default: resolution of the first source. */
	width: number;
	height: number;
	/** Background color (`#rrggbb`, opaque), visible wherever there is no clip */
	background: string;
	sources: Source[];
	timeline: Timeline;
}

/** Selection; `primary` is the clicked item (the panel shows its properties). */
export type Selection = { kind: 'items'; ids: string[]; primary?: string } | { kind: 'zoom'; id: string } | null;

export function newId(): string {
	return crypto.randomUUID().slice(0, 8);
}

/** Validates a saved project. Other format versions are not accepted (yet). */
export function parseProject(raw: unknown): Project {
	const p = raw as Project & { version: number };
	if (!p || typeof p !== 'object' || !Array.isArray(p.sources) || !p.timeline || !Array.isArray(p.timeline.items)) {
		throw new Error(m.errors.unknownFormat);
	}
	if (p.version > 1) throw new Error(m.errors.newerVersion);
	if (p.version !== 1) throw new Error(m.errors.unknownFormat);
	// Fill in fields added later (idempotent)
	return {
		...p,
		sources: p.sources.map((s) => (typeof s.hasVideo === 'boolean' ? s : { ...s, hasVideo: true })),
		timeline: { items: p.timeline.items.map(fillItem), tracks: p.timeline.tracks ?? [], zoom: p.timeline.zoom ?? [] }
	};
}

/** Fields added to annotations later; defaults keep older projects looking the same */
function fillItem(item: Item): Item {
	if (item.type !== 'annotation') return item;
	const raw = item as unknown as Record<string, unknown>;
	const patch: Record<string, unknown> = {};
	if ((item.kind === 'text' || item.kind === 'callout') && !raw.font) patch.font = 'system';
	// Text used to get a shadow only without a background
	if (hasShadow(item) && typeof raw.shadow !== 'boolean') patch.shadow = item.kind === 'text' ? !item.background : true;
	return Object.keys(patch).length ? ({ ...item, ...patch } as Annotation) : item;
}
