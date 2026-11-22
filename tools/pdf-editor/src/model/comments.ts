// What a comment is, in words and as an icon: its kind's name – shown when it has no subject of its own, and written
// as the subject of new ones (other PDF programs list comments by it).

import { m } from '#lib/i18n/index.js';
import { isAnnotatable, isMarkup, type Annotatable, type PdfItem } from '#lib/render/markup.js';
import { isLink } from '#lib/render/link.js';
import { isMeasured, measureText } from '#lib/render/measure.js';
import { REVIEW_STATES, type ReviewState } from '@in-browser/pdf/write/annotations.js';
import type { CommentInfo, PdfDocument, Reply, StateEntry } from './document.svelte.js';
import { isNote } from '#lib/render/note.js';
import { isStamp } from '#lib/render/stamp.js';
import { isCaret } from '#lib/render/caret.js';
import { isText } from '#lib/render/textbox.js';

export function kindOf(item: PdfItem): { label: string; icon: string } {
	if (isNote(item) && item.file) return { label: m.attach.kind, icon: 'icon-[material-symbols-light--attach-file]' };
	if (isNote(item)) return { label: m.commands.note, icon: 'icon-[material-symbols-light--sticky-note-2-outline]' };
	if (isText(item)) return { label: m.commands.textbox, icon: 'icon-[material-symbols-light--text-fields]' };
	if (isMarkup(item)) {
		if (item.kind === 'highlight') return { label: m.commands.highlight, icon: 'icon-[material-symbols-light--ink-highlighter]' };
		if (item.area) return { label: m.commands.area, icon: 'icon-[material-symbols-light--highlight-outline]' };
		if (item.kind === 'underline') return { label: m.commands.underline, icon: 'icon-[material-symbols-light--format-underlined]' };
		if (item.kind === 'squiggly') return { label: m.commands.squiggly, icon: 'icon-[material-symbols-light--format-underlined-squiggle]' };
		return { label: m.commands.strikeout, icon: 'icon-[material-symbols-light--strikethrough-s]' };
	}
	if (isCaret(item) && item.replaces) return { label: m.commands.replace, icon: 'icon-[material-symbols-light--find-replace]' };
	if (isCaret(item)) return { label: m.commands.insert, icon: 'icon-[material-symbols-light--insert-text-outline]' };
	if (isMeasured(item)) return { label: m.measure.kinds[item.measure.kind], icon: 'icon-[material-symbols-light--straighten-outline]' };
	if (isLink(item)) return { label: m.commands.link, icon: 'icon-[material-symbols-light--link]' };
	if (isStamp(item)) return { label: m.commands.stamp, icon: 'icon-[material-symbols-light--approval-outline]' };
	return { label: m.ribbon.tabs.drawing, icon: 'icon-[material-symbols-light--ink-pen-outline]' };
}

/** The kinds the comments panel filters by */
export type CommentKind = 'notes' | 'texts' | 'marks' | 'drawings';

export const commentKind = (item: PdfItem): CommentKind => (isNote(item) ? 'notes' : isText(item) ? 'texts' : isMarkup(item) || isCaret(item) ? 'marks' : 'drawings');

/** A comment as lists show it (the comments panel, the printed list) */
export interface CommentEntry {
	item: PdfItem;
	kind: CommentKind;
	info: CommentInfo;
	icon: string;
	kindLabel: string;
	/** Its subject, else its kind */
	title: string;
	text: string;
	state: StateEntry | null;
	replies: (Reply & { subject: string; state: StateEntry | null })[];
}

/** Every comment of the PDF by page (`index`: the page's place; pages without comments left out) */
export function commentList(doc: PdfDocument): { index: number; number: number; entries: CommentEntry[] }[] {
	const { replies, subjects, states } = doc;
	return doc.pages
		.map((page, index) => ({
			index,
			number: page.number,
			entries: (doc.scene(page.id)?.items ?? []).filter((item): item is Annotatable => isAnnotatable(item) && !isLink(item)).map((item): CommentEntry => {
				const said = kindOf(item);
				return {
					item,
					kind: commentKind(item),
					info: doc.infoOf(item.id),
					icon: said.icon,
					kindLabel: said.label,
					title: subjects.get(item.id) || said.label,
					text: isNote(item) && item.file ? [item.file.name, item.text].filter(Boolean).join(' – ') : isMeasured(item) ? measureText(item) : isCaret(item) && item.replaces ? [item.marked, item.text].filter(Boolean).join(' → ') : isNote(item) || isText(item) || isMarkup(item) || isCaret(item) ? item.text : isStamp(item) ? [item.text, item.sub].filter(Boolean).join(' – ') : '',
					state: states.get(item.id)?.at(-1) ?? null,
					replies: (replies.get(item.id) ?? []).map((r) => ({ ...r, subject: subjects.get(r.id) ?? '', state: states.get(r.id)?.at(-1) ?? null }))
				};
			})
		}))
		.filter((p) => p.entries.length);
}

/** What the comments panel lists by */
export const COMMENT_SORTS = ['page', 'date', 'author', 'kind', 'status'] as const;
export type CommentSort = (typeof COMMENT_SORTS)[number];

/** What the comments panel shows: one kind, one author (null: unknown), one review status – or all of each */
export interface CommentFilter {
	kind: CommentKind | 'all';
	author: string | null | 'all';
	status: ReviewState | 'all';
	/** Words to find in subjects, texts and authors (of comments and replies) */
	words: string;
}

/** A comment with the page it lies on (`index`: the page's place, `number` as the panel names it) */
export type PlacedComment = CommentEntry & { index: number; number: number };

/**
 * The comments as the panel lists them: those the filter lets through, in groups by what they are sorted by – pages
 * (as in the PDF), days (newest first), authors and kinds (by name), review states (their order). Inside a group
 * they stay in the PDF's order, by date the newest first.
 */
export function arrangeComments(list: ReturnType<typeof commentList>, sort: CommentSort, filter: CommentFilter, day: (date: Date) => string): { key: string; label: string; entries: PlacedComment[] }[] {
	const words = filter.words.trim().toLowerCase();
	const shown = list.flatMap((page) =>
		page.entries
			.filter(
				(e) =>
					(filter.kind === 'all' || e.kind === filter.kind) &&
					(filter.author === 'all' || (e.info.author || null) === filter.author) &&
					(filter.status === 'all' || (e.state?.state ?? 'None') === filter.status) &&
					(!words || [e.title, e.text, e.info.author, ...e.replies.flatMap((r) => [r.text, r.author, r.subject])].some((s) => s.toLowerCase().includes(words)))
			)
			.map((e): PlacedComment => ({ ...e, index: page.index, number: page.number }))
	);
	if (sort === 'date') shown.sort((a, b) => (b.info.modified?.getTime() ?? 0) - (a.info.modified?.getTime() ?? 0));
	const groupOf = (e: PlacedComment): { key: string; label: string; rank: number | string } => {
		if (sort === 'page') return { key: `p${e.index}`, label: m.comments.page(e.number), rank: e.index };
		if (sort === 'date') {
			const date = e.info.modified;
			// Days in the order of the sorted comments; those without a date last
			return date ? { key: day(date), label: day(date), rank: 0 } : { key: '', label: m.comments.noDate, rank: 0 };
		}
		if (sort === 'author') return { key: e.info.author, label: e.info.author || m.comments.unknownAuthor, rank: e.info.author ? e.info.author.toLowerCase() : '\uffff' };
		if (sort === 'kind') return { key: e.kindLabel, label: e.kindLabel, rank: e.kindLabel.toLowerCase() };
		const state = e.state?.state ?? 'None';
		return { key: state, label: state === 'None' ? m.comments.noStatus : m.comments.states[state], rank: REVIEW_STATES.indexOf(state) };
	};
	const groups = new Map<string, { key: string; label: string; rank: number | string; entries: PlacedComment[] }>();
	for (const e of shown) {
		const g = groupOf(e);
		if (!groups.has(g.key)) groups.set(g.key, { ...g, entries: [] });
		groups.get(g.key)!.entries.push(e);
	}
	const out = [...groups.values()];
	if (sort !== 'date') out.sort((a, b) => (typeof a.rank === 'number' && typeof b.rank === 'number' ? a.rank - b.rank : String(a.rank).localeCompare(String(b.rank))));
	return out;
}

/** The authors of all comments, by name (null: comments without one) */
export function commentAuthors(list: ReturnType<typeof commentList>): (string | null)[] {
	const names = new Set(list.flatMap((page) => page.entries.map((e) => e.info.author || null)));
	return [...names].sort((a, b) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)));
}
