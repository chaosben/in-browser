// Printing through the browser's print dialog: the caller hands over what goes on paper, everything else of the page
// is left out while printing (`theme.css`: `html.printing`). Sheets have a size of their own (a page of a document);
// text without one flows over as many sheets as it needs.

export interface PrintPart {
	node: HTMLElement;
	/** One sheet of this size in points (1/72 inch); without it the content flows over pages with a margin */
	size?: { width: number; height: number };
}

export interface PrintOptions {
	/**
	 * true: every sheet fills the paper chosen in the print dialog (turned to its orientation), its content scaled to
	 * fit; false: the paper is asked to be as big as the sheet, printed at its real size
	 */
	fit: boolean;
}

/** Margin around flowing text */
const MARGIN = '15mm';

/** Different paper per sheet needs named pages (`page`); without them every sheet gets the first one's paper */
const namedPages = () => typeof CSS !== 'undefined' && CSS.supports('page', 'sheet');

/** The `@page` rules of a job and each part's page name */
export function pageRules(parts: readonly PrintPart[], fit: boolean, named: boolean): { css: string; names: (string | null)[] } {
	const rules = new Map<string, string>();
	const names = parts.map((part) => {
		if (!named) return null;
		if (!part.size) {
			rules.set('flow', `@page flow { size: auto; margin: ${MARGIN}; }`);
			return 'flow';
		}
		const { width, height } = part.size;
		if (fit) {
			const name = width > height ? 'landscape' : 'portrait';
			rules.set(name, `@page ${name} { size: ${name}; }`);
			return name;
		}
		const name = `sheet-${Math.round(width * 100)}-${Math.round(height * 100)}`;
		rules.set(name, `@page ${name} { size: ${width}pt ${height}pt; margin: 0; }`);
		return name;
	});
	const first = parts.find((p) => p.size)?.size;
	// Browsers without named pages: one paper for all (real size), or the print dialog's (fit)
	const fallback = !named && !fit && first ? `@page { size: ${first.width}pt ${first.height}pt; margin: 0; }` : '';
	return { css: fallback + [...rules.values()].join('\n'), names };
}

/**
 * Opens the browser's print dialog for `parts` (in their order) and resolves when it is closed. The nodes are the
 * caller's: they are taken out of the page again afterwards.
 */
export function printParts(parts: readonly PrintPart[], options: PrintOptions): Promise<void> {
	const named = namedPages();
	const { css, names } = pageRules(parts, options.fit, named);
	const first = parts[0]?.size;
	const root = document.createElement('div');
	root.className = 'print-root';
	const style = document.createElement('style');
	style.textContent = css;
	root.append(style);
	parts.forEach((part, i) => {
		const holder = document.createElement('div');
		// Viewport units are those of the first sheet's paper: a sheet turned the other way is as high as that is wide
		const turned = named && !!part.size && !!first && part.size.width > part.size.height !== first.width > first.height;
		holder.className = part.size ? (options.fit ? (turned ? 'print-sheet print-fit-turned' : 'print-sheet print-fit') : 'print-sheet') : 'print-flow';
		if (part.size && !options.fit) {
			holder.style.width = `${part.size.width}pt`;
			holder.style.height = `${part.size.height}pt`;
		}
		// Without named pages flowing text has the sheets' paper without a margin: its own then
		if (!part.size && !named && !options.fit) holder.style.padding = MARGIN;
		if (names[i]) holder.style.setProperty('page', names[i]);
		holder.append(part.node);
		root.append(holder);
	});
	document.body.append(root);
	document.documentElement.classList.add('printing');

	return new Promise((resolve) => {
		const done = () => {
			removeEventListener('afterprint', done);
			document.documentElement.classList.remove('printing');
			root.remove();
			resolve();
		};
		addEventListener('afterprint', done);
		try {
			// Blocks until the dialog is closed in most browsers; where it doesn't, `afterprint` ends the job
			print();
		} catch (e) {
			done();
			throw e;
		}
	});
}
