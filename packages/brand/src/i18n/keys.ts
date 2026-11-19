// For the translation specs: every text as `path:type`, so both languages can be compared key by key.

type Tree = { [key: string]: unknown };

export function messageKeys(tree: object, prefix = ''): string[] {
	return Object.entries(tree as Tree).flatMap(([k, v]) =>
		v && typeof v === 'object' ? messageKeys(v, `${prefix}${k}.`) : [`${prefix}${k}:${typeof v}`]
	);
}
