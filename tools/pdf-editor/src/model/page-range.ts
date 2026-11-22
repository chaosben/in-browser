// Pages typed as a range, e.g. "1-3, 7": places from 1 as the user counts them.

/**
 * The pages (indexes from 0, ascending, each once) a text like `1-3, 7` names in a document of `count` pages; `null`
 * when it names none or something that isn't a page
 */
export function parsePageRange(text: string, count: number): number[] | null {
	const picked = new Set<number>();
	for (const part of text.split(/[,;]/)) {
		const range = /^\s*(\d+)\s*(?:[-–]\s*(\d+)\s*)?$/.exec(part);
		if (!range) {
			if (part.trim()) return null;
			continue;
		}
		const from = Number(range[1]);
		const to = range[2] === undefined ? from : Number(range[2]);
		if (from < 1 || to < from || to > count) return null;
		for (let n = from; n <= to; n++) picked.add(n - 1);
	}
	return picked.size ? [...picked].sort((a, b) => a - b) : null;
}
