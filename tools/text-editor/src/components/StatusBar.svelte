<script lang="ts">
	import CommitLink from '@in-browser/brand/CommitLink.svelte';
	import { openMenuBelow, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { CHARSET_NAMES, CHARSETS, hasBom, type Encoding, type LineEnding } from '#lib/document.js';
	import { m } from '#lib/i18n/index.js';
	import { encodingName, type Tab, type Workspace } from '#lib/workspace.svelte.js';

	// Position, language, line ending and encoding of the active tab; the last two can be changed here.

	let { workspace, tab }: { workspace: Workspace; tab: Tab } = $props();

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
		openMenuBelow(e, entries);
	}

	function eolMenu(e: MouseEvent) {
		openMenuBelow(
			e,
			EOLS.map(([eol, label]) => ({ label, icon: eol === tab.eol ? CHECK : undefined, run: () => workspace.setEol(tab, eol) }))
		);
	}
</script>

<div class="border-base-300 flex shrink-0 items-center gap-1 border-t px-2 py-0.5 text-xs">
	<span class="opacity-70">{m.status.position(tab.cursor.line, tab.cursor.column)}</span>
	{#if tab.cursor.selected}<span class="ml-2 opacity-70">{m.status.selected(tab.cursor.selected)}</span>{/if}
	<span class="ml-auto opacity-70">{tab.language ?? m.status.plainText}</span>
	<button class="btn btn-ghost btn-xs font-normal" title={m.status.lineEnding} onclick={eolMenu}>
		{tab.eol === '\r\n' ? 'CRLF' : 'LF'}
	</button>
	<button class="btn btn-ghost btn-xs font-normal" title={m.status.encoding} onclick={encodingMenu}>
		{encodingName(tab.encoding)}
	</button>
	<span class="ml-2 hidden opacity-70 sm:inline"><CommitLink /></span>
</div>
