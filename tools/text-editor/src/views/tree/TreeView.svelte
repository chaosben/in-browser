<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { ChangeSpec } from '@codemirror/state';
	import { openContextMenu, openMenuBelow, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import CellEditor from '../CellEditor.svelte';
	import ParseError from '../ParseError.svelte';
	import { parsedView, undoKeys } from '../parsed.svelte.js';
	import { VisibleRows } from '../rows.svelte.js';
	import type { ViewProps } from '../types.js';
	import { freeKey, guessKind, nodeAt, type ChildKind, type NewChild, type TreeFormat, type TreeNode, type TreeParse, type ValueKind } from './model.js';

	// A tree of the text (JSON, YAML, TOML, INI, XML …): nodes open and close, keys and values are edited in place.
	// Only the rows in sight are rendered; every edit goes through the format into the text, the filter only hides.

	let { tab, host, format: anyFormat }: ViewProps = $props();
	const format = untrack(() => anyFormat as TreeFormat);

	const parsed = parsedView<TreeParse>(
		() => tab,
		() => host,
		(text) => format.parse(text)
	);
	const tree = $derived(parsed.shown);
	const editable = $derived(parsed.editable);

	interface Line {
		node: TreeNode;
		parent: TreeNode;
		depth: number;
		/** Position among the parent's children */
		index: number;
	}

	const isContainer = (node: TreeNode) => node.children !== undefined;

	// --- Open nodes: the first level starts open (when it isn't huge) ---

	const open = new SvelteSet<string>();
	untrack(() => {
		const top = tree.root.children ?? [];
		if (top.length <= 50) for (const node of top) if (isContainer(node)) open.add(node.id);
	});

	function setAll(on: boolean) {
		open.clear();
		if (!on) return;
		const walk = (node: TreeNode) => {
			for (const child of node.children ?? []) {
				if (child.children?.length) {
					open.add(child.id);
					walk(child);
				}
			}
		};
		walk(tree.root);
	}

	// --- Filter (view only): matches and the nodes above them ---

	let filter = $state<string | null>(null);
	let filterInput = $state<HTMLInputElement>();
	const query = $derived(filter?.trim().toLocaleLowerCase(intlLocale) ?? '');

	const lines = $derived.by(() => {
		const out: Line[] = [];
		if (query) {
			const has = (s: string | undefined) => !!s && s.toLocaleLowerCase(intlLocale).includes(query);
			// Nodes that match or have a match below them
			const keep = new Set<TreeNode>();
			const mark = (node: TreeNode): boolean => {
				let found = has(node.key) || has(node.value);
				for (const child of node.children ?? []) if (mark(child)) found = true;
				if (found) keep.add(node);
				return found;
			};
			for (const child of tree.root.children ?? []) mark(child);
			const walk = (parent: TreeNode, depth: number) =>
				parent.children?.forEach((node, index) => {
					if (!keep.has(node)) return;
					out.push({ node, parent, depth, index });
					walk(node, depth + 1);
				});
			walk(tree.root, 0);
			return out;
		}
		const walk = (parent: TreeNode, depth: number) =>
			parent.children?.forEach((node, index) => {
				out.push({ node, parent, depth, index });
				if (open.has(node.id)) walk(node, depth + 1);
			});
		walk(tree.root, 0);
		return out;
	});

	async function showFilter() {
		filter ??= '';
		await tick();
		filterInput?.focus();
	}

	// --- Layout: fixed row height, only the rows in sight ---

	const rows = new VisibleRows(() => lines.length);

	// --- Selection and editing ---

	let selected = $state<string | null>(null);
	const current = $derived(lines.find((l) => l.node.id === selected) ?? null);
	let editing = $state<{ id: string; field: 'key' | 'value'; text: string } | null>(null);
	let input = $state<HTMLInputElement>();

	/** Finds a node of the current tree by id, with its parent */
	function find(root: TreeNode, id: string): { node: TreeNode; parent: TreeNode } | null {
		const walk = (parent: TreeNode): { node: TreeNode; parent: TreeNode } | null => {
			for (const node of parent.children ?? []) {
				if (node.id === id) return { node, parent };
				if (id.startsWith(`${node.id}/`)) return walk(node);
			}
			return null;
		};
		return id === '' ? { node: root, parent: root } : walk(root);
	}

	/**
	 * Applies an edit to the node with `id` in the tree of the current text (never on positions of an older text)
	 */
	function apply(id: string, make: (doc: string, node: TreeNode, parent: TreeNode) => ChangeSpec | null) {
		return parsed.apply((doc, t) => {
			const found = find(t.root, id);
			return found ? make(doc, found.node, found.parent) : null;
		});
	}

	function select(line: Line, reveal = true) {
		const { node } = line;
		selected = node.id;
		scrollTo(node.id);
		// The value (or the key of a container) is marked in the text, not the whole block
		const mark = isContainer(node) ? (node.keyRange ?? { from: node.range.from, to: node.range.from }) : (node.valueRange ?? node.range);
		if (reveal && host.textVisible) host.reveal(mark.from, mark.to);
	}

	function scrollTo(id: string) {
		const { scroller, height } = rows;
		if (!scroller) return;
		const index = lines.findIndex((l) => l.node.id === id);
		if (index < 0) return;
		const top = index * height;
		if (top < scroller.scrollTop) scroller.scrollTop = top;
		else if (top + height > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = top + height * 2 - scroller.clientHeight;
	}

	function toggle(node: TreeNode) {
		if (!isContainer(node)) return;
		if (open.has(node.id)) open.delete(node.id);
		else open.add(node.id);
	}

	async function startEdit(node: TreeNode, field: 'key' | 'value') {
		if (!editable || (field === 'key' ? !node.can.rename : !node.can.edit)) return;
		selected = node.id;
		editing = { id: node.id, field, text: (field === 'key' ? node.key : node.value) ?? '' };
		await tick();
		input?.focus();
		input?.select();
	}

	/** Kind a typed value gets: strings stay strings; other scalars follow what was typed */
	function kindFor(node: TreeNode, text: string): ValueKind {
		if (node.kind === 'string') return 'string';
		if (node.kind === 'number' || node.kind === 'boolean' || node.kind === 'null') return guessKind(text);
		return 'string';
	}

	function commit() {
		const e = editing;
		if (!e) return;
		editing = null;
		apply(e.id, (doc, node) => {
			if (e.field === 'key') return e.text && e.text !== node.key ? format.rename(doc, node, e.text) : null;
			return e.text === node.value ? null : format.setValue(doc, node, { kind: kindFor(node, e.text), text: e.text });
		});
		rows.scroller?.focus();
	}

	function cancel() {
		editing = null;
		rows.scroller?.focus();
	}

	// --- Structure ---

	const ADD_LABELS: Record<ChildKind, () => string> = {
		entry: () => m.tree.addEntry,
		item: () => m.tree.addItem,
		element: () => m.tree.addElement,
		attribute: () => m.tree.addAttribute,
		text: () => m.tree.addText
	};

	function newChild(parent: TreeNode, kind: ChildKind): NewChild {
		switch (kind) {
			case 'entry':
				return { kind, key: freeKey(parent, m.tree.newKey), value: { kind: 'string', text: '' } };
			case 'item':
				return { kind, value: { kind: 'string', text: '' } };
			case 'element':
				return { kind, key: m.tree.newElement };
			case 'attribute':
				return { kind, key: freeKey(parent, m.tree.newAttribute, '-'), value: '' };
			case 'text':
				return { kind, value: m.tree.newText };
		}
	}

	/** Adds a child and starts editing what the user will want to type first */
	async function add(parentId: string, index: number, kind: ChildKind) {
		const parent = find(parsed.now().root, parentId)?.node;
		if (!parent) return;
		if (!apply(parentId, (doc, p) => format.insert(doc, p, index, newChild(p, kind)))) return;
		if (parentId) open.add(parentId);
		await tick();
		const fresh = find(parsed.now().root, parentId)?.node;
		const node = fresh?.children?.[Math.min(index, fresh.children.length - 1)];
		if (!node) return;
		selected = node.id;
		await tick();
		scrollTo(node.id);
		if (node.can.rename) startEdit(node, 'key');
		else if (node.can.edit) startEdit(node, 'value');
	}

	/** Kind of a new neighbour of `node` */
	/** INI: a new section at the end, its name ready to type */
	async function addSection() {
		const root = parsed.now().root;
		const name = freeKey(root, m.tree.newSection);
		if (!apply('', (doc, r) => format.addSection?.(doc, r, name) ?? null)) return;
		await tick();
		const node = parsed.now().root.children?.findLast((c) => c.kind === 'section');
		if (!node) return;
		selected = node.id;
		await tick();
		scrollTo(node.id);
		startEdit(node, 'key');
	}

	function siblingKind(parent: TreeNode, node: TreeNode): ChildKind | undefined {
		const kinds = parent.can.add ?? [];
		if (node.kind === 'attribute') return kinds.includes('attribute') ? 'attribute' : undefined;
		return kinds.find((k) => k !== 'attribute');
	}

	function moveNode(line: Line, delta: -1 | 1) {
		const id = line.node.id;
		apply(id, (doc, node, parent) => format.move(doc, parent, node, delta));
	}

	function remove(line: Line) {
		const next = lines[lines.indexOf(line) + 1] ?? lines[lines.indexOf(line) - 1];
		if (apply(line.node.id, (doc, node, parent) => format.remove(doc, parent, node))) selected = next?.parent === line.parent ? null : (next?.node.id ?? null);
	}

	const TYPE_LABELS: Record<ValueKind, () => string> = {
		string: () => m.tree.types.string,
		number: () => m.tree.types.number,
		boolean: () => m.tree.types.boolean,
		null: () => m.tree.types.null,
		object: () => m.tree.types.object,
		array: () => m.tree.types.array
	};

	function entries(line: Line): MenuEntry[] {
		const { node, parent, index } = line;
		const can = node.can;
		const disabled = !editable;
		const sibling = siblingKind(parent, node);
		const siblings = parent.children ?? [];
		const out: MenuEntry[] = [];
		if (can.edit) out.push({ label: m.tree.edit, icon: 'icon-[material-symbols-light--edit-outline]', keys: 'Enter', disabled, run: () => startEdit(node, 'value') });
		if (can.rename) out.push({ label: m.tree.rename, icon: 'icon-[material-symbols-light--text-fields]', keys: 'F2', disabled, run: () => startEdit(node, 'key') });
		if (out.length) out.push({ separator: true });
		for (const kind of can.add ?? []) {
			out.push({ label: ADD_LABELS[kind](), icon: 'icon-[material-symbols-light--add]', disabled, run: () => add(node.id, kind === 'attribute' ? (node.children?.filter((c) => c.kind === 'attribute').length ?? 0) : (node.children?.length ?? 0), kind) });
		}
		if (sibling) {
			out.push({ label: m.tree.insertBefore, icon: 'icon-[material-symbols-light--vertical-align-top]', disabled, run: () => add(parent.id, index, sibling) });
			out.push({ label: m.tree.insertAfter, icon: 'icon-[material-symbols-light--vertical-align-bottom]', disabled, run: () => add(parent.id, index + 1, sibling) });
		}
		if (can.duplicate) {
			out.push({ label: m.tree.duplicate, icon: 'icon-[material-symbols-light--content-copy-outline]', disabled, run: () => apply(node.id, (doc, n, p) => format.duplicate(doc, p, n)) });
		}
		if (can.move) {
			out.push({ label: m.tree.moveUp, icon: 'icon-[material-symbols-light--arrow-upward]', keys: 'Alt+↑', disabled: disabled || !siblings[index - 1]?.can.move, run: () => moveNode(line, -1) });
			out.push({ label: m.tree.moveDown, icon: 'icon-[material-symbols-light--arrow-downward]', keys: 'Alt+↓', disabled: disabled || !siblings[index + 1]?.can.move, run: () => moveNode(line, 1) });
		}
		const types = can.types ?? [];
		if (types.length > 1) {
			out.push({ separator: true }, { heading: m.tree.type });
			for (const kind of types) {
				out.push({
					label: TYPE_LABELS[kind](),
					icon: node.kind === kind ? 'icon-[material-symbols-light--check]' : undefined,
					disabled: disabled || node.kind === kind,
					run: () => apply(node.id, (doc, n) => format.setValue(doc, n, { kind, text: n.value ?? '' }))
				});
			}
		}
		if (can.remove) {
			out.push({ separator: true }, { label: m.tree.remove, icon: 'icon-[material-symbols-light--delete-outline]', keys: m.tree.deleteKey, disabled, run: () => remove(line) });
		}
		return out;
	}

	function menu(e: MouseEvent, line: Line, below = false) {
		select(line);
		const list = entries(line);
		if (below) openMenuBelow(e, list);
		else openContextMenu(e, list);
	}

	// --- Keyboard ---

	function onkey(e: KeyboardEvent) {
		// Keys of the grid itself or of a focused cell/row in it, not of the edit fields
		if (editing || (e.target as Element).closest('input, textarea, button')) return;
		if (undoKeys(e, host)) return;
		const handled = () => e.preventDefault();
		const index = current ? lines.indexOf(current) : -1;
		const go = (i: number) => lines[i] && select(lines[i]);
		if (e.altKey && current && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return handled(), moveNode(current, e.key === 'ArrowUp' ? -1 : 1);
		if (e.key === 'ArrowDown') return handled(), go(index + 1);
		if (e.key === 'ArrowUp') return handled(), go(Math.max(0, index - 1));
		if (e.key === 'Home') return handled(), go(0);
		if (e.key === 'End') return handled(), go(lines.length - 1);
		if (!current) return;
		const { node } = current;
		if (e.key === 'ArrowRight') {
			handled();
			if (isContainer(node) && !open.has(node.id)) open.add(node.id);
			else if (lines[index + 1]?.parent === node) go(index + 1);
			return;
		}
		if (e.key === 'ArrowLeft') {
			handled();
			if (open.has(node.id)) open.delete(node.id);
			else {
				const parent = lines.findIndex((l) => l.node === current.parent);
				if (parent >= 0) go(parent);
			}
			return;
		}
		if (e.key === ' ') return handled(), toggle(node);
		if (e.key === 'Enter') return handled(), node.can.edit ? startEdit(node, 'value') : toggle(node);
		if (e.key === 'F2') return handled(), startEdit(node, 'key');
		if (e.key === 'Delete' && node.can.remove) return handled(), remove(current);
	}

	function editKey(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Enter') return e.preventDefault(), commit();
		if (e.key === 'Escape') return e.preventDefault(), cancel();
	}

	/** Touch: a tap on the key or value of the selected node edits it */
	function tap(line: Line, field: 'key' | 'value') {
		if (coarsePointer.current && selected === line.node.id && (field === 'key' ? line.node.can.rename : line.node.can.edit)) {
			return startEdit(line.node, field);
		}
		select(line);
	}

	// --- Text cursor → node ---

	$effect(() => {
		const head = tab.head;
		untrack(() => {
			if (editing || !document.activeElement?.closest('.cm-editor')) return;
			const path = nodeAt(tree.root, head);
			const node = path.at(-1);
			if (!node) return;
			for (const above of path.slice(0, -1)) open.add(above.id);
			selected = node.id;
			tick().then(() => scrollTo(node.id));
		});
	});

	// --- Menus and status of the page ---

	/** Path of a node for the footer: `server.ports[2]` */
	function pathOf(id: string): string {
		let out = '';
		let node: TreeNode = tree.root;
		for (;;) {
			const child: TreeNode | undefined = node.children?.find((c) => id === c.id || id.startsWith(`${c.id}/`));
			if (!child) break;
			const index = node.children!.indexOf(child);
			if (child.kind === 'document') out += m.tree.document(index + 1);
			else out += child.key !== undefined ? (out ? `.${child.key}` : child.key) : `[${index}]`;
			node = child;
		}
		return out;
	}

	onMount(() =>
		host.register({
			actions: [
				{ heading: m.tree.title },
				{
					label: m.tree.add,
					icon: 'icon-[material-symbols-light--add]',
					run: () => {
						const target = current && current.node.can.add?.length ? current.node : tree.root;
						const kind = target.can.add?.find((k) => k !== 'attribute');
						if (kind) add(target.id, target.children?.length ?? 0, kind);
					}
				},
				...(format.addSection ? [{ label: m.tree.addSection, icon: 'icon-[material-symbols-light--add-box-outline]', run: addSection }] : [])
			],
			view: [
				{ label: m.tree.expandAll, icon: 'icon-[material-symbols-light--unfold-more]', run: () => setAll(true) },
				{ label: m.tree.collapseAll, icon: 'icon-[material-symbols-light--unfold-less]', run: () => setAll(false) },
				{ label: m.tree.filter, icon: 'icon-[material-symbols-light--filter-alt-outline]', run: showFilter }
			],
			status: () => (selected ? pathOf(selected) || null : null)
		})
	);

	const VALUE_COLORS: Partial<Record<string, string>> = {
		string: 'text-code-string',
		number: 'text-code-number',
		boolean: 'text-code-number',
		null: 'text-code-number',
		date: 'text-code-number',
		alias: 'text-code-keyword',
		attribute: 'text-code-string',
		comment: 'text-code-comment italic',
		cdata: 'text-code-string',
		instruction: 'text-code-comment'
	};

	function summary(node: TreeNode): string {
		const count = node.children?.length ?? 0;
		if (node.kind === 'array') return m.tree.items(count);
		if (node.kind === 'element') return node.value ?? (count ? m.tree.children(count) : '');
		return m.tree.entries(count);
	}

	const keyOf = (line: Line) => {
		if (line.node.kind === 'document') return m.tree.document(line.index + 1);
		if (line.node.key !== undefined) return line.node.kind === 'element' ? `<${line.node.key}>` : line.node.key;
		return null;
	};

	const showValue = (text: string) => text.replaceAll('\n', ' ⏎ ');
</script>

{#snippet field(line: Line, which: 'key' | 'value', text: string, cls: string)}
	{#if editing && editing.id === line.node.id && editing.field === 'value' && which === 'value'}
		<!-- Values may have several lines (block strings, text in XML) -->
		<div class="relative h-full min-w-48 flex-1">
			<CellEditor bind:value={editing.text} label={m.tree.valueLabel} oncommit={() => commit()} oncancel={cancel} />
		</div>
	{:else if editing && editing.id === line.node.id && editing.field === which}
		<input
			bind:this={input}
			bind:value={editing.text}
			class="bg-base-100 outline-selection min-w-24 flex-1 rounded-sm px-1 outline-2"
			aria-label={which === 'key' ? m.tree.keyLabel : m.tree.valueLabel}
			onkeydown={editKey}
			onblur={commit}
		/>
	{:else}
		<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
		<span
			class={['truncate', cls, text === '' && which === 'value' && 'opacity-50']}
			title={text.length > 40 || text.includes('\n') ? text : undefined}
			onclick={(e) => (e.stopPropagation(), tap(line, which))}
			ondblclick={(e) => (e.stopPropagation(), startEdit(line.node, which))}>{text === '' && which === 'value' ? m.tree.emptyValue : showValue(text)}</span
		>
	{/if}
{/snippet}

<div class="flex size-full flex-col text-sm">
	{#if parsed.error !== null}
		<ParseError {tab} {host} pos={parsed.error} stale={parsed.stale} />
	{/if}
	{#if filter !== null}
		<div class="border-base-300 flex items-center gap-2 border-b px-2 py-1.5" role="search">
			<label class="input input-sm flex-1 gap-1 pr-1">
				<span class="icon-[material-symbols-light--filter-alt-outline] size-5 opacity-70" aria-hidden="true"></span>
				<input bind:this={filterInput} bind:value={filter} placeholder={m.tree.filterPlaceholder} aria-label={m.tree.filter} />
				<button class="btn btn-ghost btn-xs btn-square" title={m.tree.removeFilter} aria-label={m.tree.removeFilter} onclick={() => (filter = null)}>
					<span class="icon-[material-symbols-light--close] size-4" aria-hidden="true"></span>
				</button>
			</label>
			{#if query}<span class="text-xs whitespace-nowrap opacity-70">{m.tree.matches(lines.length)}</span>{/if}
		</div>
	{/if}
	{#if !lines.length}
		<div class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
			<p class="opacity-70">{query ? m.tree.noMatches : m.tree.empty}</p>
			{#if !query && tree.root.can.add?.length}
				{@const kind = tree.root.can.add[0]}
				<button class="btn btn-sm" disabled={!editable} onclick={() => add(tree.root.id, 0, kind)}>
					<span class="icon-[material-symbols-light--add] size-5" aria-hidden="true"></span>
					{ADD_LABELS[kind]()}
				</button>
			{/if}
		</div>
	{:else}
		<div
			bind:this={rows.scroller}
			bind:clientHeight={rows.viewHeight}
			class={['relative min-h-0 flex-1 overflow-auto outline-none', !editable && 'opacity-60']}
			role="tree"
			tabindex="0"
			aria-label={m.tree.title}
			onscroll={rows.onscroll}
			onkeydown={onkey}
		>
			<div class="relative min-w-full" style:width="max-content" style:height="{lines.length * rows.height}px">
				{#each lines.slice(rows.first, rows.last) as line, i (line.node.id)}
					{@const node = line.node}
					{@const key = keyOf(line)}
					{@const isSelected = selected === node.id}
					{@const container = isContainer(node)}
					<div
						role="treeitem"
						tabindex="-1"
						aria-selected={isSelected}
						aria-expanded={container ? open.has(node.id) || !!query : undefined}
						aria-level={line.depth + 1}
						class={[
							'group absolute left-0 flex min-w-full items-center gap-1 pr-2 whitespace-nowrap',
							isSelected ? 'bg-selection/20' : 'hover:bg-base-200'
						]}
						style:top="{(rows.first + i) * rows.height}px"
						style:height="{rows.height}px"
						style:padding-left="{line.depth * 1.25 + 0.25}rem"
						onclick={() => select(line)}
						ondblclick={() => (node.can.edit ? startEdit(node, 'value') : toggle(node))}
						oncontextmenu={(e) => menu(e, line)}
						onkeydown={() => {}}
					>
						{#if container && node.children?.length}
							<button
								class="btn btn-ghost btn-xs btn-square shrink-0"
								tabindex="-1"
								aria-label={open.has(node.id) ? m.tree.collapse : m.tree.expand}
								onclick={(e) => (e.stopPropagation(), toggle(node))}
							>
								<span
									class={['icon-[material-symbols-light--chevron-right] size-5 transition-transform', (open.has(node.id) || query) && 'rotate-90']}
									aria-hidden="true"
								></span>
							</button>
						{:else}
							<span class="w-6 shrink-0"></span>
						{/if}
						{#if key !== null}
							{@render field(
								line,
								'key',
								key,
								node.kind === 'element' ? 'text-code-type' : node.kind === 'document' ? 'font-semibold' : 'text-code-property'
							)}
							{#if node.kind !== 'element' && node.kind !== 'document'}<span class="opacity-50">{node.kind === 'attribute' ? '=' : ':'}</span>{/if}
						{:else if line.parent.kind === 'array' || line.parent.id === ''}
							<span class="text-base-content/50 tabular-nums">{line.index}</span>
							<span class="opacity-50">:</span>
						{/if}
						{#if node.can.edit || node.value !== undefined}
							{@render field(line, 'value', node.value ?? '', VALUE_COLORS[node.kind] ?? '')}
						{:else if container}
							<span class="text-base-content/60 truncate">{summary(node)}</span>
						{/if}
						{#if node.note}<span class="badge badge-ghost badge-sm shrink-0">{node.note}</span>{/if}
						<button
							class={[
								'btn btn-ghost btn-xs btn-square ml-auto shrink-0',
								!isSelected && !coarsePointer.current && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
							]}
							tabindex="-1"
							title={m.tree.menu}
							aria-label={m.tree.menu}
							onclick={(e) => menu(e, line, true)}
						>
							<span class="icon-[material-symbols-light--more-horiz] size-5" aria-hidden="true"></span>
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
