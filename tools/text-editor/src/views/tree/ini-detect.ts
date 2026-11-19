// Tells INI text apart from other `.conf` formats. Kept apart from `ini.ts`, so the registry can ask without loading
// the parser.

export const HEADER = /^\[([^\]]*)\]\s*(?:[;#].*)?$/;
export const PAIR = /^[^=:\s][^=:]*[=:]/;

/** At least ~80 % of the lines with content are section headers or `key = value` pairs */
export function looksLikeIni(doc: string): boolean {
	let total = 0;
	let matching = 0;
	for (const line of doc.split('\n')) {
		const t = line.trim();
		if (!t || t[0] === ';' || t[0] === '#') continue;
		total++;
		if (HEADER.test(t) || PAIR.test(t)) matching++;
	}
	return total > 0 && matching >= total * 0.8;
}
