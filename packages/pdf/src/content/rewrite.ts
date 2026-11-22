// A content stream written again with some of its objects moved, scaled or left out. Every operator that isn't
// part of a changed object is copied byte for byte; a changed piece is written where it stood (the drawing order
// never changes), closed in itself so nothing after it is affected.

import type { Matrix } from '../geometry.js';
import { inverse, mul, SHOWS, type ContentObject, type ContentPart } from './objects.js';
import type { Op } from './tokens.js';

/** What happens to an object: a transformation in user space (applied after everything the file does), or it goes */
export type ContentChange = { matrix: Matrix } | { remove: true };

const MARKS = new Set(['BMC', 'BDC', 'EMC', 'MP', 'DP']);
const encoder = new TextEncoder();

/** A number as PDF source: no exponent, at most six decimals */
export function pdfNumber(v: number): string {
	if (!Number.isFinite(v)) return '0';
	const s = v.toFixed(6).replace(/\.?0+$/, '');
	return s === '-0' ? '0' : s;
}

const source = (m: Matrix) => m.map(pdfNumber).join(' ');

/**
 * The stream with the changes (object id → change); the same bytes when nothing changes. `put`: what is drawn in
 * the place of an object that is taken out (operators for the page's user space – e.g. `/X1 Do` –, written where
 * its first piece stood; not for text).
 */
export function rewriteContent(
	data: Uint8Array,
	ops: readonly Op[],
	objects: readonly ContentObject[],
	changes: ReadonlyMap<number, ContentChange>,
	put: ReadonlyMap<number, string> = new Map()
): Uint8Array {
	const todo: { part: ContentPart; text: boolean; change: ContentChange; put?: string }[] = [];
	for (const object of objects) {
		const change = changes.get(object.id);
		if (!change) continue;
		if ('matrix' in change && change.matrix.every((v, i) => Math.abs(v - (i === 0 || i === 3 ? 1 : 0)) < 1e-9)) continue;
		object.parts.forEach((part, i) => todo.push({ part, text: object.kind === 'text', change, ...(i === 0 && 'remove' in change && object.kind !== 'text' && { put: put.get(object.id) }) }));
	}
	if (!todo.length) return data;
	todo.sort((a, b) => a.part.from - b.part.from);

	const chunks: Uint8Array[] = [];
	const text = (s: string) => chunks.push(encoder.encode(s));
	const raw = (from: number, to: number) => chunks.push(data.subarray(from, to));
	const op = (o: Op) => {
		raw(o.start, o.end);
		text('\n');
	};
	/** A show operator as plain `Tj`/`TJ` (the line was already moved to, spacing already set) */
	const shown = (o: Op) => {
		if (o.op === "'") {
			raw(o.spans[0][0], o.spans[0][1]);
			text(' Tj\n');
		} else if (o.op === '"') {
			raw(o.spans[2][0], o.spans[2][1]);
			text(' Tj\n');
		} else op(o);
	};
	/** What a show operator does besides showing: the state later operators build on */
	const sideEffects = (o: Op, lineToo: boolean) => {
		if (o.op === '"') {
			raw(o.spans[0][0], o.spans[0][1]);
			text(' Tw ');
			raw(o.spans[1][0], o.spans[1][1]);
			text(' Tc\n');
		}
		if (lineToo && (o.op === "'" || o.op === '"')) text('T*\n');
	};

	let at = 0;
	for (const { part, text: isText, change, put: drawn } of todo) {
		const first = ops[part.from];
		const last = ops[part.to];
		if (first.start < at) continue; // overlapping parts: never happens with objects of one walk
		raw(at, first.start);
		at = last.end;
		const range = ops.slice(part.from, part.to + 1);
		if ('remove' in change) {
			// Text: what sets state stays (later text builds on it). Paths and images leave nothing behind.
			if (part.built !== undefined) {
				// A path painted later: its points and its painting go, what stands between stays
				raw(ops[part.built].end, last.start);
			} else if (isText) {
				for (const o of range) {
					if (SHOWS.has(o.op)) sideEffects(o, true);
					else op(o);
				}
			}
			// Something else in its place: drawn in the page's space, whatever transformation holds here
			const home = drawn ? inverse(part.ctm) : null;
			if (drawn && home) text(`q ${source(home)} cm ${drawn} Q`);
			text('\n');
			continue;
		}
		// In the object's own space: its transformation, then ours, as one step before it
		const back = inverse(part.ctm);
		if (!back) {
			raw(first.start, last.end);
			continue;
		}
		const own = mul(mul(part.ctm, change.matrix), back);
		const cm = source(own);
		if (part.built !== undefined) {
			// Built and painted in one place under our transformation; the states that ended between them end after
			text(`q ${cm} cm\n`);
			raw(first.start, ops[part.built].end);
			text('\n');
			raw(last.start, last.end);
			text('\nQ\n');
			raw(ops[part.built].end, last.start);
			continue;
		}
		if (!isText) {
			text(`q ${cm} cm\n`);
			raw(first.start, last.end);
			text('\nQ\n');
			continue;
		}
		const tm = source(part.tm!);
		text(`ET q ${cm} cm BT ${tm} Tm\n`);
		for (const o of range) {
			if (SHOWS.has(o.op)) {
				sideEffects(o, false);
				shown(o);
			} else op(o);
		}
		// Back in the text object as it was: the line's start, and the state the piece set for what follows
		text(`ET Q BT ${tm} Tm\n`);
		for (const o of range) {
			if (SHOWS.has(o.op)) sideEffects(o, false);
			else if (!MARKS.has(o.op)) op(o);
		}
	}
	raw(at, data.length);

	const out = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.length;
	}
	return out;
}

/** Names of the resources a stream uses, by kind (`XObject`, `Font`): what a page's resources may drop otherwise */
export function usedResources(ops: readonly Op[]): { xobjects: Set<string>; fonts: Set<string> } {
	const xobjects = new Set<string>();
	const fonts = new Set<string>();
	for (const o of ops) {
		const name = o.args[0];
		if (typeof name !== 'object' || name === null || !('n' in name)) continue;
		if (o.op === 'Do') xobjects.add(name.n);
		else if (o.op === 'Tf') fonts.add(name.n);
	}
	return { xobjects, fonts };
}
