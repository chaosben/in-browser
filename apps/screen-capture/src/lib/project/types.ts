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
	/**
	 * Recordings of a resized window: top-left corner (pixels) of the used `width` × `height` area in the
	 * file; missing = (0, 0). The window was drawn 1:1 and centered into a larger fixed frame.
	 */
	crop?: { x: number; y: number };
	/** Recordings of a resized window: window size over time; outside of it the clip stays empty. */
	sizes?: SourceSize[];
}

/** Size of the recorded window from source time `t` (seconds) on */
export interface SourceSize {
	t: number;
	width: number;
	height: number;
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

/** Where a recorded window sits in its clip while it is smaller than its largest size (default: center) */
export type Anchor = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';

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
	anchor?: Anchor;
	/** Volume 0…1 (default 1) */
	volume?: number;
	/** Fade in/out of picture and sound in seconds (missing or 0: none) */
	fadeIn?: number;
	fadeOut?: number;
}

/** Holds frame `at` of the source for `duration` seconds (without audio). */
export interface FreezeClip extends ItemBase {
	type: 'freeze';
	sourceId: string;
	at: number;
	duration: number;
	rect: Rect;
	shape?: ClipShape;
	anchor?: Anchor;
	/** Fade in/out of the picture in seconds (missing or 0: none) */
	fadeIn?: number;
	fadeOut?: number;
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
	/** Smooth fade in and out in seconds (0: none) */
	fadeIn: number;
	fadeOut: number;
}

/** Bundled fonts for text annotations (see `render/fonts.svelte.ts`) */
export type TextAlign = 'left' | 'center' | 'right' | 'justify';

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
	align: TextAlign;
	/** Fixed box width (fraction of the canvas width), the text wraps inside; without it the box fits the longest line */
	boxWidth?: number;
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

/** Own image from the media bin (`Project.images`), kept at its aspect ratio */
export interface ImageAnnotation extends AnnotationBase, Shadowed {
	kind: 'image';
	rect: Rect;
	imageId: string;
	/** Corner radius as a fraction of the canvas height */
	radius: number;
}

/** Material icon; its SVG is stored here, so it never depends on an icon collection being available */
export interface IconAnnotation extends AnnotationBase, Shadowed {
	kind: 'icon';
	rect: Rect;
	icon: IconData;
	color: string;
}

export interface IconData {
	/** Iconify name, e.g. `arrow-forward` */
	name: string;
	/** SVG content (paths with `fill="currentColor"`) */
	body: string;
	width: number;
	height: number;
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
	| CalloutAnnotation
	| ImageAnnotation
	| IconAnnotation;

export type AnnotationKind = Annotation['kind'];

/** Annotations created from a tool tile (images and icons need their content) */
export type ToolKind = Exclude<AnnotationKind, 'image' | 'icon'>;

export type ShadowedAnnotation = Extract<Annotation, Shadowed>;

const SHADOWED: ReadonlySet<AnnotationKind> = new Set(['arrow', 'line', 'rect', 'ellipse', 'step', 'text', 'callout', 'image', 'icon']);

/** Annotations with a switchable drop shadow (not highlight, spotlight and blur) */
export function hasShadow(a: Annotation): a is ShadowedAnnotation {
	return SHADOWED.has(a.kind);
}

/** Everything that can be placed on a track */
export type Item = Clip | Annotation;

/** Zooms to `rect` during [start, end), with `easeIn`/`easeOut` seconds of transition at the start/end. */
export interface ZoomSegment {
	id: string;
	start: number;
	end: number;
	rect: Rect;
	easeIn: number;
	easeOut: number;
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
	/** Own images (media bin); placed as `image` annotations */
	images: ImageAsset[];
	timeline: Timeline;
}

/** Image file in the project's media folder */
export interface ImageAsset {
	id: string;
	file: string;
	name: string;
	width: number;
	height: number;
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
		images: Array.isArray(p.images) ? p.images : [],
		timeline: {
			items: p.timeline.items.map(fillItem),
			tracks: p.timeline.tracks ?? [],
			zoom: (p.timeline.zoom ?? []).map(fillZoom)
		}
	};
}

/** Fields added to annotations later; defaults keep older projects looking the same */
function fillItem(item: Item): Item {
	if (item.type !== 'annotation') return item;
	const raw = item as unknown as Record<string, unknown>;
	const patch: Record<string, unknown> = {};
	if ((item.kind === 'text' || item.kind === 'callout') && !raw.font) patch.font = 'system';
	if ((item.kind === 'text' || item.kind === 'callout') && !raw.align) patch.align = 'left';
	// Text used to get a shadow only without a background
	if (hasShadow(item) && typeof raw.shadow !== 'boolean') patch.shadow = item.kind === 'text' ? !item.background : true;
	// Formerly one switch for both ends with a fixed 0.2 s
	if (typeof raw.fadeIn !== 'number') patch.fadeIn = raw.fade === false ? 0 : 0.2;
	if (typeof raw.fadeOut !== 'number') patch.fadeOut = raw.fade === false ? 0 : 0.2;
	if (!Object.keys(patch).length && !('fade' in raw)) return item;
	const { fade: _, ...rest } = { ...raw, ...patch };
	return rest as unknown as Annotation;
}

/** Formerly one transition for both ends of a zoom segment */
function fillZoom(zoom: ZoomSegment): ZoomSegment {
	const raw = zoom as ZoomSegment & { ease?: number };
	if (typeof raw.easeIn === 'number' && typeof raw.easeOut === 'number' && !('ease' in raw)) return zoom;
	const { ease = 0.6, ...rest } = raw;
	return { ...rest, easeIn: raw.easeIn ?? ease, easeOut: raw.easeOut ?? ease };
}
