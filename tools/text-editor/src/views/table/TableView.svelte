<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import PickMark from '@in-browser/brand/PickMark.svelte';
	import { openContextMenu, openMenuBelow, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { Picker } from '@in-browser/brand/ui/pick.svelte.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import CellEditor from '../CellEditor.svelte';
	import { entryOf, TABLE, viewKey, type ViewCommandSpec } from '../commands.js';
	import { freeName } from '../names.js';
	import ParseError from '../ParseError.svelte';
	import { parsedView, undoKeys } from '../parsed.svelte.js';
	import { VisibleRows } from '../rows.svelte.js';
	import type { ViewAction, ViewProps } from '../types.js';
	import { DELIMITERS } from './csv.js';
	import { moveOrder, removeRows, rewriteRows, type Row, type TableFormat, type TableParse } from './model.js';

	// A table of the text (CSV, TSV, JSON Lines). Only the rows in sight are rendered, so large files stay smooth.
	// Every edit goes through the format into the text; filters only hide rows. Rows are picked like entries in
	// Files (`Picker`); the commands of the ribbon tab "Table" and of the menus act on the picked rows, else on the
	// current cell.

	let { tab, host, format: anyFormat }: ViewProps = $props();
	const format = untrack(() => anyFormat as TableFormat);

	/** CSV: delimiter picked by the user for this file (`null`: detected) */
	let delimiter = $state<string | null>(null);
	const options = () => ({ header: format.delimited && host.tableHeader, delimiter: delimiter ?? undefined });

	/** The table, or the last one without errors (read-only) while the text doesn't parse */
	const parsed = parsedView<TableParse>(
		() => tab,
		() => host,
		(text) => format.parse(text, options())
	);
	// Options changed: read again at once
	$effect(() => {
		void host.tableHeader;
		void delimiter;
		untrack(() => parsed.refresh());
	});

	const table = $derived(parsed.shown);
	const editable = $derived(parsed.editable);

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

	function closeFilter(column: number) {
		delete filters[column];
		rows.scroller?.focus();
	}

	// --- Layout: fixed row height, only the rows in sight ---

	const rows = new VisibleRows(() => shown.length);

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

	// --- Picked rows, current cell and editing ---

	const picker = new Picker<number>();
	/** Touch selection mode: marks in the row numbers, which then need room for them */
	const numberWidth = $derived(picker.marking ? '2.5rem' : `${Math.max(3, String(table.rows.length).length + 1)}ch`);
	const template = $derived(`${numberWidth} ${widths.map((w) => `calc(${w}ch + 1rem)`).join(' ')}`);
	// Rows that are gone (shorter text, filter) are no longer picked
	$effect(() => {
		const count = table.rows.length;
		untrack(() => picker.keep(Array.from({ length: count }, (_, i) => i)));
	});

	/** Current cell: data row index (`-1`: the header) and column */
	let cur = $state<{ row: number; column: number } | null>(null);
	let editing = $state<{ row: number; column: number; text: string; select: boolean } | null>(null);
	/** A column just added: its name is typed into the same undo step (`version`: the text right after adding it) */
	let fresh: { column: number; name: string; version: number } | null = null;

	const rowOf = (t: TableParse, row: number): Row | null => (row < 0 ? t.header : (t.rows[row] ?? null));
	const canRename = $derived(!format.delimited || !!table.header);
	/** Rows the row commands act on: the picked ones, else the current one */
	const targets = (): number[] => (picker.selected.size ? picker.ordered(shown) : cur && cur.row >= 0 && table.rows[cur.row] ? [cur.row] : []);

	function select(row: number, column: number, reveal = true) {
		cur = { row, column };
		scrollTo(row);
		const cell = rowOf(table, row)?.cells[column];
		if (reveal && host.textVisible && cell) host.reveal(cell.range.from, cell.range.to);
	}

	function scrollTo(row: number) {
		const { scroller, height } = rows;
		if (!scroller || row < 0) return;
		const index = shown.indexOf(row);
		if (index < 0) return;
		const top = (index + 1) * height;
		if (top < scroller.scrollTop + height) scroller.scrollTop = top - height;
		else if (top + height > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = top + height * 2 - scroller.clientHeight;
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
		const added = fresh;
		fresh = null;
		if (added && e.row < 0 && e.column === added.column && added.version === tab.version && e.text !== added.name) {
			// The new column and its name become one step: take the column back, add it with the name
			host.undo();
			parsed.apply((doc, t) => format.insertColumn(doc, t, e.column, e.text));
		} else {
			parsed.apply((doc, t) => {
				if (e.row < 0) return format.renameColumn(doc, t, e.column, e.text);
				const row = t.rows[e.row];
				return row ? format.setCell(doc, t, row, e.column, e.text) : null;
			});
		}
		if (next) move(next === 'down' ? 1 : 0, next === 'right' ? 1 : next === 'left' ? -1 : 0);
		rows.scroller?.focus();
	}

	function cancel() {
		editing = null;
		fresh = null;
		rows.scroller?.focus();
	}

	/** Moves the current cell by rows (among the shown ones) and columns; `extend` picks from the anchor (Shift) */
	function move(by: number, columns: number, extend = false) {
		const at = cur ?? { row: shown[0] ?? -1, column: 0 };
		const index = at.row < 0 ? -1 : shown.indexOf(at.row);
		const nextIndex = Math.min(shown.length - 1, Math.max(table.header ? -1 : 0, index + by));
		const row = nextIndex < 0 ? -1 : shown[nextIndex];
		const column = Math.min(table.columns.length - 1, Math.max(0, at.column + columns));
		if (row === undefined) return;
		if (by && row >= 0) {
			if (extend) picker.extend(row, shown);
			else picker.only(row);
		}
		select(row, column);
	}

	function onkey(e: KeyboardEvent) {
		// Keys of the grid itself or of a focused cell/row in it, not of the edit fields
		if (editing || (e.target as Element).closest('input, textarea, button')) return;
		if (undoKeys(e, host)) return;
		const mod = e.ctrlKey || e.metaKey;
		const handled = () => e.preventDefault();
		if (e.key === 'Escape') {
			// First the selection ends, then the text gets the focus
			handled();
			if (picker.selected.size > 1 || picker.selecting) picker.clear();
			else host.focusText();
			return;
		}
		if (viewKey(e, TABLE, actions)) return;
		if (e.key === 'Backspace') return handled(), actions.clearCells?.run?.();
		if (e.key === 'ArrowDown') return handled(), move(1, 0, e.shiftKey);
		if (e.key === 'ArrowUp') return handled(), move(-1, 0, e.shiftKey);
		if (e.key === 'ArrowRight') return handled(), move(0, 1);
		if (e.key === 'ArrowLeft') return handled(), move(0, -1);
		if (e.key === 'Tab') return handled(), move(0, e.shiftKey ? -1 : 1);
		if (e.key === 'PageDown') return handled(), move(Math.floor(rows.viewHeight / rows.height) - 1, 0, e.shiftKey);
		if (e.key === 'PageUp') return handled(), move(-Math.floor(rows.viewHeight / rows.height) + 1, 0, e.shiftKey);
		if (!cur) return;
		if (e.key === 'Enter') return handled(), startEdit(cur.row, cur.column);
		// Typing starts editing with that character, as in a spreadsheet
		if (e.key.length === 1 && !mod && !e.altKey && cur.row >= 0) return handled(), startEdit(cur.row, cur.column, e.key);
	}

	/** A click or tap on a cell: picks its row (Ctrl/Shift, touch selection mode) or makes it the current cell */
	function cellClick(e: MouseEvent, row: number, column: number) {
		const result = picker.click(e, row, shown);
		if (result === 'picked') {
			cur = { row, column };
			return;
		}
		// Touch: a tap on the current cell edits it (no double-tap needed)
		if (result === 'open' && coarsePointer.current && cur?.row === row && cur.column === column) return startEdit(row, column);
		select(row, column);
	}

	/** The row number: picks the row; a tap (touch) opens its menu */
	function numberClick(e: MouseEvent, row: number) {
		const result = picker.click(e, row, shown);
		if (result === 'open') {
			cur = { row, column: cur?.column ?? 0 };
			return openMenuBelow(e, rowEntries());
		}
		cur = { row, column: cur?.column ?? 0 };
	}

	// --- Structure ---

	function insertRow(index: number) {
		if (parsed.apply((doc, t) => format.insertRow(doc, t, index))) {
			filters = {};
			cur = { row: index, column: cur?.column ?? 0 };
			picker.only(index);
			tick().then(() => scrollTo(index));
		}
	}

	async function insertColumn(index: number) {
		const name = canRename ? freeName(table.columns, m.table.newColumn) : '';
		if (!parsed.apply((doc, t) => format.insertColumn(doc, t, index, name))) return;
		await tick();
		parsed.now();
		await tick();
		if (canRename) {
			fresh = { column: index, name, version: tab.version };
			startEdit(-1, index);
		} else select(cur?.row ?? 0, index, false);
	}

	function removeColumn(column: number) {
		if (parsed.apply((doc, t) => format.removeColumn(doc, t, column))) {
			delete filters[column];
			cur = null;
		}
	}

	function moveColumn(column: number, delta: -1 | 1) {
		if (parsed.apply((doc, t) => format.moveColumn(doc, t, column, delta))) cur = { row: cur?.row ?? -1, column: column + delta };
	}

	/** The picked rows (or the current one) one place up or down, as one change */
	function moveRows(delta: -1 | 1) {
		const picked = new Set(targets());
		const order = moveOrder(table.rows.length, picked, delta);
		if (!parsed.apply((doc, t) => (t.rows.length === order.length ? rewriteRows(doc, t.rows, order.map((i) => t.rows[i])) : null))) return;
		const at = (i: number) => order.indexOf(i);
		if (picker.selected.size) picker.set([...picked].map(at));
		if (cur && cur.row >= 0) cur = { row: at(cur.row), column: cur.column };
		if (cur) tick().then(() => scrollTo(cur!.row));
	}

	const canMove = (delta: -1 | 1) => {
		const picked = targets();
		if (!editable || !picked.length) return false;
		return delta < 0 ? picked.some((row, i) => row > i) : picked.some((row, i) => row < table.rows.length - picked.length + i);
	};

	function deleteRows() {
		const picked = targets();
		if (!parsed.apply((doc, t) => removeRows(doc, t.rows, picked.map((i) => t.rows[i]).filter(Boolean)))) return;
		picker.clear();
		const first = Math.min(...picked);
		cur = table.rows.length > picked.length ? { row: Math.min(first, table.rows.length - picked.length - 1), column: cur?.column ?? 0 } : null;
	}

	function clearCells() {
		if (!cur) return;
		const { column } = cur;
		const picked = targets();
		// Cells of different rows never overlap: one change for all of them
		parsed.apply((doc, t) => {
			const changes = picked.flatMap((i) => (t.rows[i] ? (format.setCell(doc, t, t.rows[i], column, '') ?? []) : []));
			return changes.length ? changes : null;
		});
	}

	function sort(column: number, descending: boolean) {
		parsed.apply((doc, t) => format.sort(doc, t, column, descending, intlLocale));
	}

	// --- Commands (ribbon tab "Table", menus, keys) ---

	const can = (test: () => boolean) => () => editable && test();
	const hasCell = () => !!cur && cur.column < table.columns.length;
	const actions: Partial<Record<string, ViewAction>> = {
		[TABLE.editCell.id]: {
			enabled: can(() => hasCell() && (cur!.row < 0 ? canRename : !!table.rows[cur!.row] && !table.rows[cur!.row].broken)),
			run: () => cur && startEdit(cur.row, cur.column)
		},
		[TABLE.clearCells.id]: { enabled: can(() => hasCell() && targets().length > 0), run: clearCells },
		[TABLE.insertAbove.id]: { enabled: can(() => true), run: () => insertRow(targets()[0] ?? 0) },
		[TABLE.insertBelow.id]: { enabled: can(() => true), run: () => insertRow((targets().at(-1) ?? table.rows.length - 1) + 1) },
		[TABLE.moveUp.id]: { enabled: () => canMove(-1), run: () => moveRows(-1) },
		[TABLE.moveDown.id]: { enabled: () => canMove(1), run: () => moveRows(1) },
		[TABLE.removeRows.id]: { enabled: can(() => targets().length > 0), run: deleteRows },
		[TABLE.insertLeft.id]: { enabled: can(() => true), run: () => insertColumn(cur?.column ?? 0) },
		[TABLE.insertRight.id]: { enabled: can(() => true), run: () => insertColumn(cur ? cur.column + 1 : table.columns.length) },
		[TABLE.renameColumn.id]: { enabled: can(() => hasCell() && canRename), run: () => cur && startEdit(-1, cur.column) },
		[TABLE.moveLeft.id]: { enabled: can(() => hasCell() && cur!.column > 0), run: () => cur && moveColumn(cur.column, -1) },
		[TABLE.moveRight.id]: { enabled: can(() => hasCell() && cur!.column < table.columns.length - 1), run: () => cur && moveColumn(cur.column, 1) },
		[TABLE.removeColumn.id]: { enabled: can(hasCell), run: () => cur && removeColumn(cur.column) },
		[TABLE.sortUp.id]: { enabled: can(() => hasCell() && table.rows.length > 1), run: () => cur && sort(cur.column, false) },
		[TABLE.sortDown.id]: { enabled: can(() => hasCell() && table.rows.length > 1), run: () => cur && sort(cur.column, true) },
		[TABLE.filter.id]: { enabled: hasCell, run: () => cur && addFilter(cur.column) },
		[TABLE.removeFilters.id]: { enabled: () => Object.keys(filters).length > 0, run: () => (filters = {}) },
		[TABLE.header.id]: format.delimited ? { active: () => host.tableHeader, run: () => (host.tableHeader = !host.tableHeader) } : undefined,
		[TABLE.delimiter.id]: format.delimited
			? {
					menu: () =>
						[null, ...DELIMITERS].map((d) => ({
							label: d === null ? m.table.delimiterAuto : m.table.delimiters[d],
							checked: delimiter === d,
							run: () => (delimiter = d)
						}))
				}
			: undefined,
		[TABLE.selectAll.id]: { enabled: () => shown.length > 0, run: () => picker.selectAll(shown) },
		[TABLE.clearSelection.id]: { enabled: () => picker.selected.size > 0, run: () => picker.clear() }
	};

	const entries = (...specs: ViewCommandSpec[]): MenuEntry[] => specs.flatMap((spec) => entryOf(spec, actions[spec.id]));

	function rowEntries(): MenuEntry[] {
		const picked = targets();
		return [
			{ heading: picked.length > 1 ? m.table.rowsTitle(picked.length) : m.table.rowTitle((picked[0] ?? 0) + 1) },
			...entries(TABLE.insertAbove, TABLE.insertBelow, TABLE.moveUp, TABLE.moveDown),
			{ separator: true },
			...entries(TABLE.removeRows)
		];
	}

	function columnEntries(): MenuEntry[] {
		return [
			{ heading: (cur && table.columns[cur.column]) || m.table.column },
			...entries(TABLE.sortUp, TABLE.sortDown, TABLE.filter),
			{ separator: true },
			...entries(TABLE.renameColumn, TABLE.insertLeft, TABLE.insertRight, TABLE.moveLeft, TABLE.moveRight),
			{ separator: true },
			...entries(TABLE.removeColumn)
		];
	}

	function columnMenu(e: MouseEvent, column: number, below = false) {
		cur = { row: cur?.row ?? -1, column };
		if (below) openMenuBelow(e, columnEntries());
		else openContextMenu(e, columnEntries());
	}

	/** Right click or long press on a cell or row number: the row is picked (touch: the selection mode starts) */
	function cellMenu(e: MouseEvent, row: number, column: number) {
		picker.menu(e, row);
		cur = { row, column };
		const broken = table.rows[row]?.broken;
		openContextMenu(e, [
			...(broken ? [] : [...entries(TABLE.editCell, TABLE.clearCells), { separator: true } as const]),
			...rowEntries(),
			{ separator: true },
			...columnEntries()
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
			if (index >= 0 && !picker.selecting) picker.only(index);
			scrollTo(index);
		});
	});

	// --- Commands and status of the page ---

	onMount(() =>
		host.register({
			kind: 'table',
			actions,
			picked: () => picker.selected.size,
			status: () =>
				active.length ? m.table.filtered(shown.length, table.rows.length) : m.table.size(table.rows.length, table.columns.length)
		})
	);

	const NUMBER = /^\s*[-+]?(\d+([.,]\d+)?|[.,]\d+)([eE][-+]?\d+)?\s*$/;
	const display = (text: string) => text.replaceAll('\n', ' ⏎ ');
	/** Picked rows show as a band once more than one is picked (or while marking) */
	const band = $derived(picker.selected.size > 1 || picker.marking);
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
				selected ? 'outline-selection bg-selection/10 outline-2 -outline-offset-2' : band && picker.has(row) && 'bg-selection/20'
			]}
			style:line-height="{rows.height - 1}px"
			title={text.length > 30 || text.includes('\n') ? text : undefined}
			onclick={(e) => cellClick(e, row, column)}
			ondblclick={() => !coarsePointer.current && startEdit(row, column)}
			oncontextmenu={(e) => cellMenu(e, row, column)}
		>
			{display(text)}
		</div>
	{/if}
{/snippet}

<div class="flex size-full flex-col text-sm">
	{#if parsed.error !== null}
		<ParseError {tab} {host} pos={parsed.error} stale={parsed.stale} />
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
						onkeydown={(e) => e.key === 'Escape' && (e.preventDefault(), closeFilter(column))}
						/>
					<button
						class="btn btn-ghost btn-xs btn-square"
						title={m.table.removeFilter}
						aria-label={m.table.removeFilter}
						onclick={() => closeFilter(column)}
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
			bind:this={rows.scroller}
			bind:clientHeight={rows.viewHeight}
			class={['relative min-h-0 flex-1 overflow-auto outline-none', !editable && 'opacity-60']}
			role="grid"
			tabindex="0"
			aria-label={m.table.title}
			aria-rowcount={shown.length + 1}
			aria-colcount={table.columns.length}
			aria-readonly={!editable}
			onscroll={rows.onscroll}
			onkeydown={onkey}
			onpointerdown={(e) => picker.pointerdown(e)}
		>
			<div class="relative min-w-full" style:width="max-content" style:height="{(shown.length + 1) * rows.height}px">
				<!-- Same font as the rows: the widths are in `ch` of it -->
				<div role="row" class="bg-base-200 sticky top-0 z-20 grid" style:grid-template-columns={template} style:height="{rows.height}px">
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
								onclick={(e) => columnMenu(e, column, true)}
								ondblclick={() => canRename && startEdit(-1, column)}
								oncontextmenu={(e) => columnMenu(e, column)}
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
				{#each shown.slice(rows.first, rows.last) as row, i (row)}
					{@const r = table.rows[row]}
					<div
						role="row"
						class="absolute left-0 grid min-w-full"
						style:grid-template-columns={template}
						style:top="{(rows.first + i + 1) * rows.height}px"
						style:height="{rows.height}px"
					>
						<button
							class={[
								'bg-base-200 border-base-300 hover:bg-base-300 sticky left-0 z-10 border-r border-b px-1 text-right text-xs tabular-nums opacity-80',
									(picker.has(row) || cur?.row === row) && 'bg-selection/20'
							]}
							title={m.table.rowMenu(row + 1)}
							aria-label={m.table.rowMenu(row + 1)}
							aria-pressed={picker.marking ? picker.has(row) : undefined}
							onclick={(e) => numberClick(e, row)}
							oncontextmenu={(e) => cellMenu(e, row, cur?.column ?? 0)}
						>
							{#if picker.marking}<PickMark picked={picker.has(row)} class="mx-auto" />{:else}{row + 1}{/if}
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
