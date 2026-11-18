<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import type { ChangeSpec } from '@codemirror/state';
	import { openContextMenu, openMenuBelow, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import CellEditor from '../CellEditor.svelte';
	import { follow } from '../follow.svelte.js';
	import ParseError from '../ParseError.svelte';
	import type { ViewProps } from '../types.js';
	import { DELIMITERS } from './csv.js';
	import type { Row, TableFormat, TableParse } from './model.js';

	// A table of the text (CSV, TSV, JSON Lines). Only the rows in sight are rendered, so large files stay smooth.
	// Every edit goes through the format into the text; filters only hide rows.

	let { tab, host, format: anyFormat }: ViewProps = $props();
	const format = untrack(() => anyFormat as TableFormat);

	/** CSV: delimiter picked by the user for this file (`null`: detected) */
	let delimiter = $state<string | null>(null);
	const options = () => ({ header: format.delimited && host.tableHeader, delimiter: delimiter ?? undefined });

	const parsed = follow(
		() => tab,
		(text) => format.parse(text, options())
	);
	// Options changed: read again at once
	$effect(() => {
		void host.tableHeader;
		void delimiter;
		untrack(() => parsed.refresh());
	});

	/** Last table without errors: shown (read-only) while the text doesn't parse */
	let good = $state.raw<TableParse>(untrack(() => parsed.current));
	$effect(() => {
		if (parsed.current.error === null) good = parsed.current;
	});
	const error = $derived(parsed.current.error);
	const table = $derived(error === null ? parsed.current : good);
	const editable = $derived(error === null);

	// --- Filters (view only) ---

	let filters = $state<Record<number, string>>({});
	const active = $derived(Object.entries(filters).filter(([, text]) => text.trim()));
	/** Indices of the data rows shown */
	const shown = $derived.by(() => {
		const all = table.rows.map((_, i) => i);
		if (!active.length) return all;
		const tests = active.map(([column, text]) => [Number(column), text.trim().toLocaleLowerCase(intlLocale)] as const);
		return all.filter((i) =>
			tests.every(([column, text]) => (table.rows[i].cells[column]?.text ?? '').toLocaleLowerCase(intlLocale).includes(text))
		);
	});
	let filterInputs: Record<number, HTMLInputElement> = {};

	async function addFilter(column: number) {
		filters[column] ??= '';
		await tick();
		filterInputs[column]?.focus();
	}

	// --- Layout: fixed row height, only the rows in sight ---

	const rowHeight = $derived(coarsePointer.current ? 40 : 28);
	let scroller = $state<HTMLElement>();
	let scrollTop = $state(0);
	let viewHeight = $state(0);
	const first = $derived(Math.max(0, Math.floor(scrollTop / rowHeight) - 5));
	const last = $derived(Math.min(shown.length, Math.ceil((scrollTop + viewHeight) / rowHeight) + 5));

	/** Column widths in characters, from the header and the first rows */
	const widths = $derived.by(() => {
		const sample = table.rows.slice(0, 200);
		return table.columns.map((name, c) => {
			// The header also holds the menu arrow (and a filter mark)
			let width = name.length + 4;
			for (const row of sample) width = Math.max(width, Math.min(row.cells[c]?.text.length ?? 0, 60));
			return Math.min(Math.max(width, 6), 40);
		});
	});
	const numberWidth = $derived(`${Math.max(3, String(table.rows.length).length + 1)}ch`);
	const template = $derived(`${numberWidth} ${widths.map((w) => `calc(${w}ch + 1rem)`).join(' ')}`);

	// --- Selection and editing ---

	/** Selected cell: data row index (`-1`: the header) and column */
	let cur = $state<{ row: number; column: number } | null>(null);
	let editing = $state<{ row: number; column: number; text: string; select: boolean } | null>(null);

	const rowOf = (t: TableParse, row: number): Row | null => (row < 0 ? t.header : (t.rows[row] ?? null));
	const canRename = $derived(!format.delimited || !!table.header);

	/** Applies an edit made on the current text (never on positions of an older one) */
	function apply(make: (doc: string, t: TableParse) => ChangeSpec | null) {
		if (!editable) return false;
		const t = parsed.now();
		if (t.error !== null) return false;
		const spec = make(tab.state.doc.toString(), t);
		if (!spec || (Array.isArray(spec) && !spec.length)) return false;
		parsed.soon();
		host.edit(spec);
		return true;
	}

	function select(row: number, column: number, reveal = true) {
		cur = { row, column };
		scrollTo(row);
		const cell = rowOf(table, row)?.cells[column];
		if (reveal && host.textVisible && cell) host.reveal(cell.range.from, cell.range.to);
	}

	function scrollTo(row: number) {
		if (!scroller || row < 0) return;
		const index = shown.indexOf(row);
		if (index < 0) return;
		const top = (index + 1) * rowHeight;
		if (top < scroller.scrollTop + rowHeight) scroller.scrollTop = top - rowHeight;
		else if (top + rowHeight > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = top + rowHeight * 2 - scroller.clientHeight;
	}

	async function startEdit(row: number, column: number, text?: string) {
		if (!editable || (row < 0 && !canRename)) return;
		const r = rowOf(table, row);
		if (row >= 0 && (!r || r.broken)) return;
		const value = row < 0 ? (table.header?.cells[column]?.text ?? table.columns[column]) : (r?.cells[column]?.text ?? '');
		cur = { row, column };
		editing = { row, column, text: text ?? value, select: text === undefined };
		await tick();
	}

	function commit(next?: 'down' | 'right' | 'left') {
		const e = editing;
		if (!e) return;
		editing = null;
		apply((doc, t) => {
			if (e.row < 0) return format.renameColumn(doc, t, e.column, e.text);
			const row = t.rows[e.row];
			return row ? format.setCell(doc, t, row, e.column, e.text) : null;
		});
		if (next) move(next === 'down' ? 1 : 0, next === 'right' ? 1 : next === 'left' ? -1 : 0);
		scroller?.focus();
	}

	function cancel() {
		editing = null;
		scroller?.focus();
	}

	/** Moves the selection by rows (among the shown ones) and columns */
	function move(rows: number, columns: number) {
		const at = cur ?? { row: shown[0] ?? -1, column: 0 };
		const index = at.row < 0 ? -1 : shown.indexOf(at.row);
		const nextIndex = Math.min(shown.length - 1, Math.max(table.header ? -1 : 0, index + rows));
		const row = nextIndex < 0 ? -1 : shown[nextIndex];
		const column = Math.min(table.columns.length - 1, Math.max(0, at.column + columns));
		if (row !== undefined) select(row, column);
	}

	function onkey(e: KeyboardEvent) {
		// Keys of the grid itself or of a focused cell/row in it, not of the edit fields
		if (editing || (e.target as Element).closest('input, textarea, button')) return;
		const mod = e.ctrlKey || e.metaKey;
		const handled = () => e.preventDefault();
		if (mod && !e.altKey && e.code === 'KeyZ') return handled(), e.shiftKey ? host.redo() : host.undo();
		if (mod && !e.altKey && e.code === 'KeyY') return handled(), host.redo();
		if (e.key === 'ArrowDown') return handled(), move(1, 0);
		if (e.key === 'ArrowUp') return handled(), move(-1, 0);
		if (e.key === 'ArrowRight') return handled(), move(0, 1);
		if (e.key === 'ArrowLeft') return handled(), move(0, -1);
		if (e.key === 'Tab') return handled(), move(0, e.shiftKey ? -1 : 1);
		if (e.key === 'PageDown') return handled(), move(Math.floor(viewHeight / rowHeight) - 1, 0);
		if (e.key === 'PageUp') return handled(), move(-Math.floor(viewHeight / rowHeight) + 1, 0);
		if (!cur) return;
		if (e.key === 'Enter' || e.key === 'F2') return handled(), startEdit(cur.row, cur.column);
		if ((e.key === 'Delete' || e.key === 'Backspace') && cur.row >= 0) {
			const { row, column } = cur;
			return handled(), apply((doc, t) => (t.rows[row] ? format.setCell(doc, t, t.rows[row], column, '') : null));
		}
		// Typing starts editing with that character, as in a spreadsheet
		if (e.key.length === 1 && !mod && !e.altKey && cur.row >= 0) return handled(), startEdit(cur.row, cur.column, e.key);
	}

	function tap(row: number, column: number) {
		// Touch: a tap on the selected cell edits it (no double-tap needed)
		if (coarsePointer.current && cur?.row === row && cur.column === column) return startEdit(row, column);
		select(row, column);
	}

	// --- Structure ---

	const freeName = (base: string) => {
		const used = new Set(table.columns);
		if (!used.has(base)) return base;
		for (let n = 2; ; n++) if (!used.has(`${base} ${n}`)) return `${base} ${n}`;
	};

	function insertRow(index: number) {
		if (apply((doc, t) => format.insertRow(doc, t, index))) {
			filters = {};
			cur = { row: index, column: cur?.column ?? 0 };
			tick().then(() => scrollTo(index));
		}
	}

	async function insertColumn(index: number) {
		const name = canRename ? freeName(m.table.newColumn) : '';
		if (!apply((doc, t) => format.insertColumn(doc, t, index, name))) return;
		await tick();
		parsed.now();
		await tick();
		if (canRename) startEdit(-1, index);
		else select(cur?.row ?? 0, index, false);
	}

	function removeColumn(column: number) {
		if (apply((doc, t) => format.removeColumn(doc, t, column))) {
			delete filters[column];
			cur = null;
		}
	}

	function moveColumn(column: number, delta: -1 | 1) {
		if (apply((doc, t) => format.moveColumn(doc, t, column, delta))) cur = { row: cur?.row ?? -1, column: column + delta };
	}

	function moveRow(row: number, delta: -1 | 1) {
		if (apply((doc, t) => (t.rows[row] ? format.moveRow(doc, t, t.rows[row], delta) : null))) cur = { row: row + delta, column: cur?.column ?? 0 };
	}

	function sort(column: number, descending: boolean) {
		apply((doc, t) => format.sort(doc, t, column, descending, intlLocale));
	}

	function columnEntries(column: number): MenuEntry[] {
		const disabled = !editable;
		return [
			{ heading: table.columns[column] || m.table.column },
			{ label: m.table.sortUp, icon: 'icon-[material-symbols-light--arrow-upward]', disabled, run: () => sort(column, false) },
			{ label: m.table.sortDown, icon: 'icon-[material-symbols-light--arrow-downward]', disabled, run: () => sort(column, true) },
			{ label: m.table.filter, icon: 'icon-[material-symbols-light--filter-alt-outline]', run: () => addFilter(column) },
			{ separator: true },
			...(canRename
				? [{ label: m.table.rename, icon: 'icon-[material-symbols-light--edit-outline]', disabled, run: () => startEdit(-1, column) }]
				: []),
			{ label: m.table.insertLeft, icon: 'icon-[material-symbols-light--add-column-left-outline]', disabled, run: () => insertColumn(column) },
			{ label: m.table.insertRight, icon: 'icon-[material-symbols-light--add-column-right-outline]', disabled, run: () => insertColumn(column + 1) },
			{ label: m.table.moveLeft, icon: 'icon-[material-symbols-light--arrow-back]', disabled: disabled || column === 0, run: () => moveColumn(column, -1) },
			{
				label: m.table.moveRight,
				icon: 'icon-[material-symbols-light--arrow-forward]',
				disabled: disabled || column >= table.columns.length - 1,
				run: () => moveColumn(column, 1)
			},
			{ separator: true },
			{ label: m.table.removeColumn, icon: 'icon-[material-symbols-light--delete-outline]', disabled, run: () => removeColumn(column) }
		];
	}

	function rowEntries(row: number): MenuEntry[] {
		const disabled = !editable;
		return [
			{ heading: m.table.rowTitle(row + 1) },
			{ label: m.table.insertAbove, icon: 'icon-[material-symbols-light--add-row-above-outline]', disabled, run: () => insertRow(row) },
			{ label: m.table.insertBelow, icon: 'icon-[material-symbols-light--add-row-below-outline]', disabled, run: () => insertRow(row + 1) },
			{ label: m.table.moveUp, icon: 'icon-[material-symbols-light--arrow-upward]', disabled: disabled || row === 0, run: () => moveRow(row, -1) },
			{
				label: m.table.moveDown,
				icon: 'icon-[material-symbols-light--arrow-downward]',
				disabled: disabled || row >= table.rows.length - 1,
				run: () => moveRow(row, 1)
			},
			{ separator: true },
			{
				label: m.table.removeRow,
				icon: 'icon-[material-symbols-light--delete-outline]',
				disabled,
				run: () => apply((doc, t) => (t.rows[row] ? format.removeRow(doc, t, t.rows[row]) : null))
			}
		];
	}

	function cellMenu(e: MouseEvent, row: number, column: number) {
		select(row, column);
		const broken = table.rows[row]?.broken;
		openContextMenu(e, [
			...(broken ? [] : [{ label: m.table.edit, icon: 'icon-[material-symbols-light--edit-outline]', keys: 'F2', disabled: !editable, run: () => startEdit(row, column) }, { separator: true } as const]),
			...rowEntries(row),
			{ separator: true },
			...columnEntries(column)
		]);
	}

	// --- Text cursor → cell ---

	$effect(() => {
		const head = tab.head;
		untrack(() => {
			if (editing || !document.activeElement?.closest('.cm-editor')) return;
			const rows = table.header ? [table.header, ...table.rows] : table.rows;
			let lo = 0;
			let hi = rows.length - 1;
			while (lo < hi) {
				const mid = (lo + hi + 1) >> 1;
				if (rows[mid].range.from <= head) lo = mid;
				else hi = mid - 1;
			}
			const row = rows[lo];
			if (!row || head > row.range.to) return;
			const column = Math.max(0, row.cells.findIndex((c) => c && c.range.from <= head && head <= c.range.to));
			const index = table.header ? lo - 1 : lo;
			cur = { row: index, column };
			scrollTo(index);
		});
	});

	// --- Menus and status of the page ---

	onMount(() =>
		host.register({
			actions: [
				{ heading: m.table.title },
				{
					label: m.table.addRow,
					icon: 'icon-[material-symbols-light--add-row-below-outline]',
					run: () => insertRow(cur && cur.row >= 0 ? cur.row + 1 : table.rows.length)
				},
				{
					label: m.table.addColumn,
					icon: 'icon-[material-symbols-light--add-column-right-outline]',
					run: () => insertColumn(cur ? cur.column + 1 : table.columns.length)
				}
			],
			view: format.delimited
				? [
						{
							label: m.table.header,
							get icon() {
								return host.tableHeader ? 'icon-[material-symbols-light--check]' : undefined;
							},
							run: () => (host.tableHeader = !host.tableHeader)
						},
						{ heading: m.table.delimiter },
						...[null, ...DELIMITERS].map((d) => ({
							label: d === null ? m.table.delimiterAuto : m.table.delimiters[d],
							get icon() {
								return delimiter === d ? 'icon-[material-symbols-light--check]' : undefined;
							},
							run: () => (delimiter = d)
						}))
					]
				: [],
			status: () =>
				active.length ? m.table.filtered(shown.length, table.rows.length) : m.table.size(table.rows.length, table.columns.length)
		})
	);

	const NUMBER = /^\s*[-+]?(\d+([.,]\d+)?|[.,]\d+)([eE][-+]?\d+)?\s*$/;
	const display = (text: string) => text.replaceAll('\n', ' ⏎ ');
</script>

{#snippet cell(row: number, column: number, text: string, kind: string | undefined, broken: boolean)}
	{@const selected = cur?.row === row && cur.column === column}
	{#if editing && editing.row === row && editing.column === column}
		<div class="relative">
			<CellEditor
				bind:value={editing.text}
				select={editing.select}
				label={m.table.cellLabel(table.columns[column], row + 1)}
				oncommit={commit}
				oncancel={cancel}
			/>
		</div>
	{:else}
		<!-- svelte-ignore a11y_click_events_have_key_events (the grid handles the keyboard) -->
		<div
			role="gridcell"
			tabindex="-1"
			aria-selected={selected}
			class={[
				'border-base-300 truncate border-r border-b px-2',
				(kind === 'number' || NUMBER.test(text)) && 'text-right tabular-nums',
				broken && 'text-base-content/60 italic',
				selected && 'outline-selection bg-selection/10 outline-2 -outline-offset-2'
			]}
			style:line-height="{rowHeight - 1}px"
			title={text.length > 30 || text.includes('\n') ? text : undefined}
			onclick={() => tap(row, column)}
			ondblclick={() => startEdit(row, column)}
			oncontextmenu={(e) => cellMenu(e, row, column)}
		>
			{display(text)}
		</div>
	{/if}
{/snippet}

<div class="flex size-full flex-col text-sm">
	{#if error !== null}
		<ParseError {tab} {host} pos={error} stale={good !== parsed.current} />
	{/if}
	{#if Object.keys(filters).length}
		<div class="border-base-300 flex flex-wrap items-center gap-2 border-b px-2 py-1.5" role="search">
			<span class="icon-[material-symbols-light--filter-alt-outline] size-5 opacity-70" aria-hidden="true"></span>
			{#each Object.keys(filters).map(Number) as column (column)}
				<label class="input input-sm w-auto max-w-full gap-1 pr-1">
					<span class="max-w-32 truncate opacity-70">{table.columns[column]}</span>
					<input
						bind:this={filterInputs[column]}
						bind:value={filters[column]}
						class="w-28"
						placeholder={m.table.filterPlaceholder}
						aria-label={m.table.filterLabel(table.columns[column])}
					/>
					<button
						class="btn btn-ghost btn-xs btn-square"
						title={m.table.removeFilter}
						aria-label={m.table.removeFilter}
						onclick={() => delete filters[column]}
					>
						<span class="icon-[material-symbols-light--close] size-4" aria-hidden="true"></span>
					</button>
				</label>
			{/each}
		</div>
	{/if}
	{#if !table.columns.length}
		<div class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
			<p class="opacity-70">{m.table.empty}</p>
			<button class="btn btn-sm" disabled={!editable} onclick={() => insertRow(0)}>
				<span class="icon-[material-symbols-light--add-row-below-outline] size-5" aria-hidden="true"></span>
				{m.table.addRow}
			</button>
		</div>
	{:else}
		<div
			bind:this={scroller}
			bind:clientHeight={viewHeight}
			class={['relative min-h-0 flex-1 overflow-auto outline-none', !editable && 'opacity-60']}
			role="grid"
			tabindex="0"
			aria-label={m.table.title}
			aria-rowcount={shown.length + 1}
			aria-colcount={table.columns.length}
			aria-readonly={!editable}
			onscroll={() => (scrollTop = scroller!.scrollTop)}
			onkeydown={onkey}
		>
			<div class="relative min-w-full" style:width="max-content" style:height="{(shown.length + 1) * rowHeight}px">
				<!-- Same font as the rows: the widths are in `ch` of it -->
				<div role="row" class="bg-base-200 sticky top-0 z-20 grid" style:grid-template-columns={template} style:height="{rowHeight}px">
					<div class="bg-base-200 border-base-300 sticky left-0 z-10 border-r border-b"></div>
					{#each table.columns as name, column (column)}
						{#if editing && editing.row === -1 && editing.column === column}
							{@render cell(-1, column, name, undefined, false)}
						{:else}
							<button
								role="columnheader"
								class={[
									'border-base-300 hover:bg-base-300 flex min-w-0 items-center gap-1 border-r border-b px-2 text-left',
									cur?.column === column && 'bg-selection/15'
								]}
								title={m.table.columnMenu(name)}
								aria-label={m.table.columnMenu(name)}
								onclick={(e) => openMenuBelow(e, columnEntries(column))}
								ondblclick={() => canRename && startEdit(-1, column)}
								oncontextmenu={(e) => openContextMenu(e, columnEntries(column))}
							>
								<span class="truncate font-semibold">{name}</span>
								{#if filters[column]?.trim()}
									<span class="icon-[material-symbols-light--filter-alt] size-4 shrink-0 opacity-70" aria-hidden="true"></span>
								{/if}
								<span class="icon-[material-symbols-light--keyboard-arrow-down] ml-auto size-4 shrink-0 opacity-50" aria-hidden="true"></span>
							</button>
						{/if}
					{/each}
				</div>
				{#each shown.slice(first, last) as row, i (row)}
					{@const r = table.rows[row]}
					<div
						role="row"
						class="absolute left-0 grid min-w-full"
						style:grid-template-columns={template}
						style:top="{(first + i + 1) * rowHeight}px"
						style:height="{rowHeight}px"
					>
						<button
							class={[
								'bg-base-200 border-base-300 hover:bg-base-300 sticky left-0 z-10 border-r border-b px-1 text-right text-xs tabular-nums opacity-80',
								cur?.row === row && 'bg-selection/20'
							]}
							title={m.table.rowMenu(row + 1)}
							aria-label={m.table.rowMenu(row + 1)}
							onclick={(e) => openMenuBelow(e, rowEntries(row))}
							oncontextmenu={(e) => openContextMenu(e, rowEntries(row))}
						>
							{row + 1}
						</button>
						{#each table.columns as _, column (column)}
							{@const c = r.cells[column]}
							{@render cell(row, column, c?.text ?? '', c?.kind, !!r.broken)}
						{/each}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
