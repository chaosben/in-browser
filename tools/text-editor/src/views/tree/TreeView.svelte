<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { ChangeSpec } from '@codemirror/state';
	import MoreButton from '@in-browser/brand/MoreButton.svelte';
	import PickMark from '@in-browser/brand/PickMark.svelte';
	import { openContextMenu, openMenuBelow, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { Picker } from '@in-browser/brand/ui/pick.svelte.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import CellEditor from '../CellEditor.svelte';
	import { entryOf, TREE, viewKey, type ViewCommandSpec } from '../commands.js';
	import ParseError from '../ParseError.svelte';
	import { parsedView, undoKeys } from '../parsed.svelte.js';
	import { VisibleRows } from '../rows.svelte.js';
	import type { ViewAction, ViewProps } from '../types.js';
	import { chainChanges, freeKey, guessKind, nodeAt, type ChildKind, type NewChild, type TreeFormat, type TreeNode, type TreeParse, type ValueKind } from './model.js';

	// A tree of the text (JSON, YAML, TOML, INI, XML …): nodes open and close, keys and values are edited in place.
	// Only the rows in sight are rendered; every edit goes through the format into the text, the filter only hides.
	// Nodes are picked like entries in Files (`Picker`); the commands of the ribbon tab "Tree" and of the menus act
	// on the picked nodes, else on the current one.

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

	function closeFilter() {
		filter = null;
		rows.scroller?.focus();
	}

	// --- Layout: fixed row height, only the rows in sight ---

	const rows = new VisibleRows(() => lines.length);

	// --- Picked nodes, current node and editing ---

	const picker = new Picker<string>();
	const order = $derived(lines.map((l) => l.node.id));
	// Nodes that are hidden or gone are no longer picked
	$effect(() => {
		const ids = order;
		untrack(() => picker.keep(ids));
	});

	/** The current node (keys go from here; the text marks it) */
	let selected = $state<string | null>(null);
	const current = $derived(lines.find((l) => l.node.id === selected) ?? null);
	let editing = $state<{ id: string; field: 'key' | 'value'; text: string } | null>(null);
	let input = $state<HTMLInputElement>();
	/**
	 * A node just added: its name (or value) is typed into the same undo step – `version` is the text right after
	 * adding it, `make` adds it again with what was typed
	 */
	let fresh: { id: string; text: string; version: number; make: (text: string) => void } | null = null;

	/** The nodes the commands act on: the picked ones, else the current one (in the order shown) */
	const targets = (): Line[] => (picker.selected.size ? lines.filter((l) => picker.has(l.node.id)) : current ? [current] : []);

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

	/** Applies an edit to several nodes as one change: one after another, each found anew in the text before it */
	function applyEach(ids: string[], make: (doc: string, node: TreeNode, parent: TreeNode) => ChangeSpec | null) {
		return parsed.apply((doc) =>
			chainChanges(
				doc,
				ids.map((id) => (text: string) => {
					const found = find(format.parse(text).root, id);
					return found ? make(text, found.node, found.parent) : null;
				})
			)
		);
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
		const added = fresh;
		fresh = null;
		if (added && added.id === e.id && added.version === tab.version && e.text && e.text !== added.text) {
			// The new node and its name become one step: take the node back, add it with what was typed
			host.undo();
			added.make(e.text);
		} else {
			apply(e.id, (doc, node) => {
				if (e.field === 'key') return e.text && e.text !== node.key ? format.rename(doc, node, e.text) : null;
				return e.text === node.value ? null : format.setValue(doc, node, { kind: kindFor(node, e.text), text: e.text });
			});
		}
		rows.scroller?.focus();
	}

	function cancel() {
		editing = null;
		fresh = null;
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

	/** A new child; `text` is its key, or the value where it has none */
	function newChild(parent: TreeNode, kind: ChildKind, text?: string): NewChild {
		switch (kind) {
			case 'entry':
				return { kind, key: text ?? freeKey(parent, m.tree.newKey), value: { kind: 'string', text: '' } };
			case 'item':
				return { kind, value: { kind: 'string', text: text ?? '' } };
			case 'element':
				return { kind, key: text ?? m.tree.newElement };
			case 'attribute':
				return { kind, key: text ?? freeKey(parent, m.tree.newAttribute, '-'), value: '' };
			case 'text':
				return { kind, value: text ?? m.tree.newText };
		}
	}

	/** Adds a child and starts editing what the user will want to type first (both one undo step) */
	async function add(parentId: string, index: number, kind: ChildKind) {
		const parent = find(parsed.now().root, parentId)?.node;
		if (!parent) return;
		if (!apply(parentId, (doc, p) => format.insert(doc, p, index, newChild(p, kind)))) return;
		if (parentId) open.add(parentId);
		await tick();
		const inParent = find(parsed.now().root, parentId)?.node;
		const node = inParent?.children?.[Math.min(index, inParent.children.length - 1)];
		if (!node) return;
		selected = node.id;
		picker.only(node.id);
		await tick();
		scrollTo(node.id);
		const field = node.can.rename ? 'key' : node.can.edit ? 'value' : null;
		if (!field) return;
		fresh = {
			id: node.id,
			text: (field === 'key' ? node.key : node.value) ?? '',
			version: tab.version,
			make: (text) => apply(parentId, (doc, p) => format.insert(doc, p, index, newChild(p, kind, text)))
		};
		startEdit(node, field);
	}

	/** INI: a new section at the end, its name ready to type */
	async function addSection() {
		const root = parsed.now().root;
		const name = freeKey(root, m.tree.newSection);
		if (!apply('', (doc, r) => format.addSection?.(doc, r, name) ?? null)) return;
		await tick();
		const node = parsed.now().root.children?.findLast((c) => c.kind === 'section');
		if (!node) return;
		selected = node.id;
		picker.only(node.id);
		await tick();
		scrollTo(node.id);
		fresh = { id: node.id, text: name, version: tab.version, make: (text) => apply('', (doc, r) => format.addSection?.(doc, r, text) ?? null) };
		startEdit(node, 'key');
	}

	/** Kind of a new neighbour of `node` */
	function siblingKind(parent: TreeNode, node: TreeNode): ChildKind | undefined {
		const kinds = parent.can.add ?? [];
		if (node.kind === 'attribute') return kinds.includes('attribute') ? 'attribute' : undefined;
		return kinds.find((k) => k !== 'attribute');
	}

	/** Picked nodes without those inside another picked one (they go with it) */
	function outermost(list: Line[]): Line[] {
		const ids = list.map((l) => l.node.id);
		return list.filter((l) => !ids.some((id) => id !== l.node.id && l.node.id.startsWith(`${id}/`)));
	}

	/** Last in the text first: what comes before keeps its place and id */
	const fromEnd = (list: Line[]) => [...list].sort((a, b) => b.node.range.from - a.node.range.from).map((l) => l.node.id);

	function canMove(delta: -1 | 1) {
		const list = targets();
		if (!editable || !list.length) return false;
		const ids = new Set(list.map((l) => l.node.id));
		return list.every((l) => {
			if (!l.node.can.move) return false;
			// A neighbour that moves along is fine; the first (last) of a block needs a free one
			let i = l.index + delta;
			const siblings = l.parent.children ?? [];
			while (siblings[i] && ids.has(siblings[i].id)) i += delta;
			return !!siblings[i]?.can.move;
		});
	}

	async function moveNodes(delta: -1 | 1) {
		const list = targets();
		// Up: the first first, down: the last first – each passes the neighbour that doesn't move
		const ordered = [...list].sort((a, b) => delta * (b.node.range.from - a.node.range.from));
		const places = ordered.map((l) => ({ parent: l.parent.id, index: l.index + delta }));
		if (!applyEach(ordered.map((l) => l.node.id), (doc, node, parent) => format.move(doc, parent, node, delta))) return;
		// Ids of items follow their place: find the moved nodes there
		await tick();
		const root = parsed.now().root;
		const moved = places.map((p) => find(root, p.parent)?.node.children?.[p.index]?.id).filter((id): id is string => !!id);
		if (picker.selected.size) picker.set(moved);
		const at = current && list.indexOf(current) >= 0 ? moved[ordered.indexOf(current)] : undefined;
		if (at) {
			selected = at;
			tick().then(() => scrollTo(at));
		}
	}

	function removeNodes() {
		const list = outermost(targets());
		const after = lines.slice(lines.indexOf(list[list.length - 1]) + 1).find((l) => !list.some((r) => l.node.id.startsWith(`${r.node.id}/`)));
		if (!applyEach(fromEnd(list), (doc, node, parent) => format.remove(doc, parent, node))) return;
		picker.clear();
		selected = after && after.parent !== list[0].parent ? after.node.id : null;
	}

	function duplicateNodes() {
		applyEach(fromEnd(outermost(targets())), (doc, node, parent) => format.duplicate(doc, parent, node));
	}

	function setType(kind: ValueKind) {
		const ids = targets()
			.filter((l) => l.node.can.types?.includes(kind) && l.node.kind !== kind)
			.map((l) => l.node.id);
		applyEach(ids, (doc, n) => format.setValue(doc, n, { kind, text: n.value ?? '' }));
	}

	const TYPE_LABELS: Record<ValueKind, () => string> = {
		string: () => m.tree.types.string,
		number: () => m.tree.types.number,
		boolean: () => m.tree.types.boolean,
		null: () => m.tree.types.null,
		object: () => m.tree.types.object,
		array: () => m.tree.types.array
	};

	/** Adding inside the current node, next to it, or (INI) a section */
	function insertEntries(): MenuEntry[] {
		const out: MenuEntry[] = [];
		const line = current;
		if (line) {
			const { node, parent, index } = line;
			for (const kind of node.can.add ?? []) {
				const at = kind === 'attribute' ? (node.children?.filter((c) => c.kind === 'attribute').length ?? 0) : (node.children?.length ?? 0);
				out.push({ label: ADD_LABELS[kind](), icon: 'icon-[material-symbols-light--add]', run: () => add(node.id, at, kind) });
			}
			const sibling = siblingKind(parent, node);
			if (sibling) {
				out.push({ label: m.tree.insertBefore, icon: 'icon-[material-symbols-light--vertical-align-top]', run: () => add(parent.id, index, sibling) });
				out.push({ label: m.tree.insertAfter, icon: 'icon-[material-symbols-light--vertical-align-bottom]', run: () => add(parent.id, index + 1, sibling) });
			}
		} else {
			// Nothing chosen: a new entry at the end of the top level
			const kind = tree.root.can.add?.find((k) => k !== 'attribute');
			if (kind) out.push({ label: ADD_LABELS[kind](), icon: 'icon-[material-symbols-light--add]', run: () => add(tree.root.id, tree.root.children?.length ?? 0, kind) });
		}
		if (format.addSection) out.push({ label: m.tree.addSection, icon: 'icon-[material-symbols-light--add-box-outline]', run: addSection });
		return out;
	}

	/** Kinds every target can become (the type of a single node is checked) */
	function typeEntries(): MenuEntry[] {
		const list = targets();
		const kinds = (list[0]?.node.can.types ?? []).filter((k) => list.every((l) => l.node.can.types?.includes(k)));
		if (kinds.length < 2) return [];
		return kinds.map((kind) => ({ label: TYPE_LABELS[kind](), checked: list.every((l) => l.node.kind === kind), run: () => setType(kind) }));
	}

	// --- Commands (ribbon tab "Tree", menus, keys) ---

	const can = (test: () => boolean) => () => editable && test();
	const actions: Partial<Record<string, ViewAction>> = {
		[TREE.editValue.id]: { enabled: can(() => !!current?.node.can.edit), run: () => current && startEdit(current.node, 'value') },
		[TREE.rename.id]: { enabled: can(() => !!current?.node.can.rename), run: () => current && startEdit(current.node, 'key') },
		[TREE.duplicate.id]: { enabled: can(() => targets().length > 0 && targets().every((l) => l.node.can.duplicate)), run: duplicateNodes },
		[TREE.remove.id]: { enabled: can(() => targets().length > 0 && targets().every((l) => l.node.can.remove)), run: removeNodes },
		[TREE.insert.id]: { enabled: can(() => insertEntries().length > 0), menu: insertEntries },
		[TREE.moveUp.id]: { enabled: () => canMove(-1), run: () => moveNodes(-1) },
		[TREE.moveDown.id]: { enabled: () => canMove(1), run: () => moveNodes(1) },
		[TREE.type.id]: { enabled: can(() => typeEntries().length > 0), menu: typeEntries },
		[TREE.expandAll.id]: { run: () => setAll(true) },
		[TREE.collapseAll.id]: { run: () => setAll(false) },
		[TREE.filter.id]: { run: showFilter },
		[TREE.selectAll.id]: { enabled: () => lines.length > 0, run: () => picker.selectAll(order) },
		[TREE.clearSelection.id]: { enabled: () => picker.selected.size > 0, run: () => picker.clear() }
	};

	const entries = (...specs: ViewCommandSpec[]): MenuEntry[] => specs.flatMap((spec) => entryOf(spec, actions[spec.id]));

	/** The menu of a node: what the ribbon tab "Tree" offers for it */
	const nodeEntries = (): MenuEntry[] => [
		...entries(TREE.editValue, TREE.rename),
		...entries(TREE.insert),
		...entries(TREE.duplicate, TREE.moveUp, TREE.moveDown),
		...entries(TREE.type),
		{ separator: true },
		...entries(TREE.remove)
	];

	/** The ⋯ of a row: its menu acts on it (and on the other picked ones when it is one of them) */
	function pickFor(line: Line) {
		if (!picker.has(line.node.id)) picker.only(line.node.id);
		select(line);
	}

	/** Right click or long press: the node is picked (touch: the selection mode starts) and its menu opens */
	function menu(e: MouseEvent, line: Line) {
		picker.menu(e, line.node.id);
		select(line);
		openContextMenu(e, nodeEntries());
	}

	// --- Keyboard ---

	function onkey(e: KeyboardEvent) {
		// Keys of the grid itself or of a focused cell/row in it, not of the edit fields
		if (editing || (e.target as Element).closest('input, textarea, button')) return;
		if (undoKeys(e, host)) return;
		const handled = () => e.preventDefault();
		if (e.key === 'Escape') {
			// First the selection ends, then the text gets the focus
			handled();
			if (picker.selected.size > 1 || picker.selecting) picker.clear();
			else host.focusText();
			return;
		}
		// Enter opens or closes what has no value to edit
		if (e.key === 'Enter' && current && !current.node.can.edit) return handled(), toggle(current.node);
		if (viewKey(e, TREE, actions)) return;
		const index = current ? lines.indexOf(current) : -1;
		const go = (i: number) => {
			const line = lines[i];
			if (!line) return;
			if (e.shiftKey) picker.extend(line.node.id, order);
			else picker.only(line.node.id);
			select(line);
		};
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
	}

	function editKey(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Enter') return e.preventDefault(), commit();
		if (e.key === 'Escape') return e.preventDefault(), cancel();
	}

	/**
	 * A click or tap on a row (`field`: on its key or value): picks it (Ctrl/Shift, touch selection mode) or makes
	 * it the current node; by touch a tap on the key or value of the current node edits it
	 */
	function rowClick(e: MouseEvent, line: Line, field?: 'key' | 'value') {
		const id = line.node.id;
		const result = picker.click(e, id, order);
		if (result === 'picked') {
			selected = id;
			return;
		}
		if (result === 'open' && field && selected === id && (field === 'key' ? line.node.can.rename : line.node.can.edit)) {
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
			if (!picker.selecting) picker.only(node.id);
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
			kind: 'tree',
			actions,
			picked: () => picker.selected.size,
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
			onclick={(e) => (e.stopPropagation(), rowClick(e, line, which))}
			ondblclick={(e) => (e.stopPropagation(), !coarsePointer.current && startEdit(line.node, which))}>{text === '' && which === 'value' ? m.tree.emptyValue : showValue(text)}</span
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
				<input
					bind:this={filterInput}
					bind:value={filter}
					placeholder={m.tree.filterPlaceholder}
					aria-label={m.tree.filter}
					onkeydown={(e) => e.key === 'Escape' && (e.preventDefault(), closeFilter())}
				/>
				<button class="btn btn-ghost btn-xs btn-square" title={m.tree.removeFilter} aria-label={m.tree.removeFilter} onclick={closeFilter}>
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
			onpointerdown={(e) => picker.pointerdown(e)}
		>
			<div class="relative min-w-full" style:width="max-content" style:height="{lines.length * rows.height}px">
				{#each lines.slice(rows.first, rows.last) as line, i (line.node.id)}
					{@const node = line.node}
					{@const key = keyOf(line)}
					{@const isCurrent = selected === node.id}
					{@const isPicked = picker.has(node.id)}
					{@const container = isContainer(node)}
					<div
						role="treeitem"
						tabindex="-1"
						aria-selected={isPicked || isCurrent}
						aria-expanded={container ? open.has(node.id) || !!query : undefined}
						aria-level={line.depth + 1}
						class={[
							'group absolute left-0 flex min-w-full items-center gap-1 pr-2 whitespace-nowrap',
							isPicked ? 'bg-selection/20' : isCurrent ? 'bg-selection/10' : 'hover:bg-base-200'
						]}
						style:top="{(rows.first + i) * rows.height}px"
						style:height="{rows.height}px"
						style:padding-left="{line.depth * 1.25 + 0.25}rem"
						onclick={(e) => rowClick(e, line)}
						ondblclick={() => !coarsePointer.current && (node.can.edit ? startEdit(node, 'value') : toggle(node))}
						oncontextmenu={(e) => menu(e, line)}
						onkeydown={() => {}}
					>
						{#if picker.marking}
							<PickMark picked={isPicked} class="shrink-0" />
						{/if}
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
						{#if coarsePointer.current}
							<MoreButton class="ml-auto" name={keyOf(line) ?? m.tree.title} entries={() => (pickFor(line), nodeEntries())} />
						{:else}
							<button
								class={[
									'btn btn-ghost btn-xs btn-square ml-auto shrink-0',
									!isPicked && !isCurrent && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
								]}
								tabindex="-1"
								title={m.tree.menu}
								aria-label={m.tree.menu}
								onclick={(e) => (pickFor(line), openMenuBelow(e, nodeEntries()))}
							>
								<span class="icon-[material-symbols-light--more-horiz] size-5" aria-hidden="true"></span>
							</button>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
