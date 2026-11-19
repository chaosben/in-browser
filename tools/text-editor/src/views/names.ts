/** A name not in `used`, based on `base`: `base`, then `base 2`, `base 3` … (`sep` goes before the number) */
export function freeName(used: Iterable<string | undefined>, base: string, sep = ' '): string {
	const taken = new Set(used);
	if (!taken.has(base)) return base;
	for (let n = 2; ; n++) if (!taken.has(`${base}${sep}${n}`)) return `${base}${sep}${n}`;
}
