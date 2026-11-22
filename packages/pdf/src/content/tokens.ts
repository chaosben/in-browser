// A page's content stream as a list of operators with their operands and where each stands in the bytes – so a
// stream can be written again with single operators replaced and everything else byte for byte as it was.

/** An operand: a number, a name (`/F1` → `{ n: 'F1' }`), a string (its bytes), an array, or something kept as it is
 * (a dictionary, `true`, `null`) */
export type Value = number | { n: string } | { s: Uint8Array } | Value[] | { raw: true };

export interface Op {
	/** The operator (`Tj`, `cm`, `re` …); `BI` stands for a whole inline image (`BI … ID … EI`) */
	op: string;
	args: Value[];
	/** Where each operand stands in the bytes (start, end) */
	spans: [number, number][];
	/** From its first operand to the end of the operator */
	start: number;
	end: number;
}

export class ContentError extends Error {}

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);
const regular = (b: number) => !WS.has(b) && !DELIM.has(b);
const hex = (b: number) => (b >= 0x30 && b <= 0x39 ? b - 0x30 : b >= 0x41 && b <= 0x46 ? b - 55 : b >= 0x61 && b <= 0x66 ? b - 87 : -1);

export const isName = (v: Value | undefined): v is { n: string } => typeof v === 'object' && v !== null && 'n' in v;
export const isString = (v: Value | undefined): v is { s: Uint8Array } => typeof v === 'object' && v !== null && 's' in v;

/** Reads a content stream; throws `ContentError` when it can't be read to its end */
export function tokenize(data: Uint8Array): Op[] {
	const ops: Op[] = [];
	let at = 0;
	const n = data.length;

	const skip = () => {
		for (;;) {
			while (at < n && WS.has(data[at])) at++;
			if (at < n && data[at] === 0x25) {
				while (at < n && data[at] !== 10 && data[at] !== 13) at++;
			} else return;
		}
	};
	const word = () => {
		const from = at;
		while (at < n && regular(data[at])) at++;
		return String.fromCharCode(...data.subarray(from, at));
	};
	const literal = (): Value => {
		const out: number[] = [];
		let depth = 1;
		at++;
		while (at < n) {
			let b = data[at++];
			if (b === 0x5c) {
				b = data[at++];
				if (b === 0x6e) out.push(10);
				else if (b === 0x72) out.push(13);
				else if (b === 0x74) out.push(9);
				else if (b === 0x62) out.push(8);
				else if (b === 0x66) out.push(12);
				else if (b >= 0x30 && b <= 0x37) {
					let v = b - 0x30;
					for (let i = 0; i < 2 && data[at] >= 0x30 && data[at] <= 0x37; i++) v = v * 8 + data[at++] - 0x30;
					out.push(v & 0xff);
				} else if (b === 13) {
					if (data[at] === 10) at++;
				} else if (b !== 10) out.push(b);
			} else if (b === 0x28) {
				depth++;
				out.push(b);
			} else if (b === 0x29) {
				if (--depth === 0) return { s: Uint8Array.from(out) };
				out.push(b);
			} else out.push(b);
		}
		throw new ContentError('string without end');
	};
	const hexString = (): Value => {
		const out: number[] = [];
		let high = -1;
		at++;
		while (at < n) {
			const b = data[at++];
			if (b === 0x3e) {
				if (high >= 0) out.push(high << 4);
				return { s: Uint8Array.from(out) };
			}
			const v = hex(b);
			if (v < 0) continue;
			if (high < 0) high = v;
			else {
				out.push((high << 4) | v);
				high = -1;
			}
		}
		throw new ContentError('hex string without end');
	};
	/** An operand at `at`, or undefined when a keyword (an operator) stands there */
	const value = (): Value | undefined => {
		const b = data[at];
		if (b === 0x28) return literal();
		if (b === 0x3c) {
			if (data[at + 1] !== 0x3c) return hexString();
			at += 2;
			for (;;) {
				skip();
				if (at >= n) throw new ContentError('dictionary without end');
				if (data[at] === 0x3e && data[at + 1] === 0x3e) {
					at += 2;
					return { raw: true };
				}
				if (value() === undefined) word();
			}
		}
		if (b === 0x5b) {
			const out: Value[] = [];
			at++;
			for (;;) {
				skip();
				if (at >= n) throw new ContentError('array without end');
				if (data[at] === 0x5d) {
					at++;
					return out;
				}
				const v = value();
				if (v === undefined) word();
				else out.push(v);
			}
		}
		if (b === 0x2f) {
			at++;
			return { n: word() };
		}
		if ((b >= 0x30 && b <= 0x39) || b === 0x2b || b === 0x2d || b === 0x2e) {
			const from = at;
			const text = word();
			const v = Number(text);
			if (Number.isFinite(v)) return v;
			// `1-2`, `--3`: read as PDF readers do, the number as far as it goes
			const lenient = parseFloat(text);
			if (Number.isFinite(lenient)) return lenient;
			at = from;
			return undefined;
		}
		return undefined;
	};

	/** Reads on from `BI` to after the image's `EI` */
	const inlineImage = () => {
		let length = -1;
		let key = '';
		for (;;) {
			skip();
			if (at >= n) throw new ContentError('inline image without data');
			const v = value();
			if (v === undefined) {
				if (word() === 'ID') break;
				continue;
			}
			if (isName(v) && !key) key = v.n;
			else {
				if ((key === 'L' || key === 'Length') && typeof v === 'number') length = v;
				key = '';
			}
		}
		// One white-space byte, then the data
		at++;
		const isEnd = (i: number) => data[i] === 0x45 && data[i + 1] === 0x49 && (i + 2 >= n || WS.has(data[i + 2]));
		if (length >= 0) {
			let i = at + length;
			while (i < n && WS.has(data[i])) i++;
			if (isEnd(i)) {
				at = i + 2;
				return;
			}
		}
		for (let i = at; i < n - 1; i++) {
			if (isEnd(i) && WS.has(data[i - 1])) {
				at = i + 2;
				return;
			}
		}
		throw new ContentError('inline image without end');
	};

	let args: Value[] = [];
	let spans: [number, number][] = [];
	let start = -1;
	for (;;) {
		skip();
		if (at >= n) break;
		const from = at;
		const v = value();
		if (v !== undefined) {
			if (start < 0) start = from;
			args.push(v);
			spans.push([from, at]);
			continue;
		}
		if (!regular(data[at])) throw new ContentError(`unexpected byte ${data[at]} at ${at}`);
		const op = word();
		if (op === 'true' || op === 'false' || op === 'null') {
			if (start < 0) start = from;
			args.push({ raw: true });
			spans.push([from, at]);
			continue;
		}
		if (op === 'BI') inlineImage();
		ops.push({ op, args, spans, start: start < 0 ? from : start, end: at });
		args = [];
		spans = [];
		start = -1;
	}
	return ops;
}
