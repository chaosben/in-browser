/** Text on one line: line breaks and runs of whitespace become one space; longer than `max` is cut with "…" */
export function oneLine(text: string, max = 120): string {
	const line = text.replace(/\s+/g, ' ').trim();
	return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
