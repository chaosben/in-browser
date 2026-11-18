// Help texts of the tools and the suite: shown in the help window of a tool (`HelpWindow.svelte`) and as pages
// under `/help/…` of the overview. Describe what users see and do: what each option means, what it costs and how
// to decide.

export interface HelpOption {
	label: string;
	text: string;
}

/** A link to another help page (path below the site root, e.g. `/help/sync`) */
export interface HelpLink {
	href: string;
	label: string;
}

export interface HelpItem {
	title: string;
	text: string;
	/** Meaning and consequences of each choice */
	options?: Record<string, HelpOption>;
	/** How to decide */
	tip?: string;
	/** Key combinations, each one a list of keys pressed together; alternatives are shown side by side */
	keys?: string[][];
	/** Commands to type or paste (one per line, shown as code with a copy button) */
	code?: string;
	/** Where to read more */
	link?: HelpLink;
}

export interface HelpTopic {
	title: string;
	items: Record<string, HelpItem>;
}

/** All topics of a tool or help page, in the order shown */
export type HelpContent = Record<string, HelpTopic>;

/** Everything the search looks at in an entry */
export function helpSearchTexts(item: HelpItem): string[] {
	const options = Object.values(item.options ?? {}).flatMap((o) => [o.label, o.text]);
	return [item.title, item.text, ...options, item.tip ?? '', ...(item.keys?.flat() ?? []), item.code ?? ''];
}
