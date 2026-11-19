<script lang="ts">
	import { openMenuAbove, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { CHARSET_NAMES, CHARSETS, hasBom, type Encoding, type LineEnding } from '#lib/document.js';
	import { m } from '#lib/i18n/index.js';
	import type { Tab } from '#lib/tab.svelte.js';
	import { encodingName, type Workspace } from '#lib/workspace.svelte.js';

	// Position, language, status of the view (rows, path of the selected node), line ending and encoding of the active
	// tab (left in the BrandFooter); the last two can be changed here.

	let { workspace, tab }: { workspace: Workspace; tab: Tab } = $props();
	const viewStatus = $derived(workspace.viewUi?.status?.());

	const CHECK = 'icon-[material-symbols-light--check]';
	const ENCODINGS = CHARSETS.flatMap((charset): Encoding[] =>
		hasBom(charset) ? [{ charset, bom: false }, { charset, bom: true }] : [{ charset, bom: false }]
	);
	const EOLS: [LineEnding, string][] = [
		['\n', 'LF'],
		['\r\n', 'CRLF']
	];

	function encodingMenu(e: MouseEvent) {
		const entries: MenuEntry[] = [];
		if (tab.path) {
			entries.push({ heading: m.encoding.reopen });
			for (const charset of CHARSETS) {
				entries.push({ label: CHARSET_NAMES[charset], run: () => workspace.reopenWith(tab, charset) });
			}
			entries.push({ separator: true });
		}
		entries.push({ heading: m.encoding.saveWith });
		for (const encoding of ENCODINGS) {
			const current = encoding.charset === tab.encoding.charset && encoding.bom === tab.encoding.bom;
			entries.push({ label: encodingName(encoding), icon: current ? CHECK : undefined, run: () => workspace.setEncoding(tab, encoding) });
		}
		openMenuAbove(e, entries);
	}

	function eolMenu(e: MouseEvent) {
		openMenuAbove(
			e,
			EOLS.map(([eol, label]) => ({ label, icon: eol === tab.eol ? CHECK : undefined, run: () => workspace.setEol(tab, eol) }))
		);
	}
</script>

<span class="opacity-70">{m.status.position(tab.cursor.line, tab.cursor.column)}</span>
{#if tab.cursor.selected}<span class="ml-2 opacity-70">{m.status.selected(tab.cursor.selected)}</span>{/if}
<span class="ml-2 opacity-70">{tab.language ?? m.status.plainText}</span>
{#if viewStatus}<span class="ml-2 max-w-64 truncate opacity-70">{viewStatus}</span>{/if}
<button class="btn btn-ghost btn-xs font-normal" title={m.status.lineEnding} onclick={eolMenu}>
	{tab.eol === '\r\n' ? 'CRLF' : 'LF'}
</button>
<button class="btn btn-ghost btn-xs font-normal" title={m.status.encoding} onclick={encodingMenu}>
	{encodingName(tab.encoding)}
</button>
