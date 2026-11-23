<script lang="ts">
	// Typing formatted text (`rich-text.ts`): an editable field that knows nothing but our model. Its content is built
	// from the model and read back from what the browser made of it after every input – paragraphs as blocks, spans
	// with their style. Formats never come from the browser: its own commands (bold …) and what is pasted are turned
	// into ours, pasted text is taken plain. Ctrl+B/I/U; in a list Enter goes on with it (on an empty item: out of it)
	// and Tab / Shift+Tab change the level. The caller places and sizes the field and gets every change (`oninput`).
	import { untrack } from 'svelte';
	import { fontCss } from './fonts.js';
	import { richEditing, type RichEditing } from './rich-editing.svelte.js';
	import {
		fullStyle,
		insertText,
		LIST_INDENT,
		markerOf,
		paragraphsIn,
		plainOf,
		rangeStyle,
		styleOf,
		styleRange,
		tidy,
		withLevel,
		withList,
		type FullStyle,
		type ListKind,
		type Paragraph,
		type RichText,
		type TextStyle
	} from './rich-text.js';

	interface Props {
		/** The text when typing starts (later changes come from the field itself) */
		value: RichText;
		/** The box's own style (sizes in the tool's unit) */
		base: FullStyle;
		/** CSS pixels per unit */
		zoom: number;
		label: string;
		/** CSS of the field itself (place, size, padding, background …) */
		style?: string;
		class?: string;
		oninput: (value: RichText) => void;
	}

	let { value, base, zoom, label, style = '', class: classes = '', oninput }: Props = $props();

	let root = $state<HTMLDivElement | null>(null);
	let model: RichText = untrack(() => tidy(value));
	/** The selection in positions of the plain text – kept while the field has lost the focus to a command */
	let sel = { from: 0, to: 0 };
	/** Formats for what is typed next at the caret */
	let pending: TextStyle | null = null;
	let marks = $state(untrack(() => rangeStyle(model, 0, 0, base)));
	let list = $state<ListKind | null>(null);

	const BLOCK = new Set(['DIV', 'P', 'LI']);

	// --- Model → field ---

	function spanCss(s: TextStyle): string {
		const css: string[] = [];
		if (s.bold !== undefined) css.push(`font-weight:${s.bold ? 700 : 400}`);
		if (s.italic !== undefined) css.push(`font-style:${s.italic ? 'italic' : 'normal'}`);
		if (s.underline !== undefined) css.push(`text-decoration:${s.underline ? 'underline' : 'none'}`);
		if (s.font) css.push(`font-family:${fontCss({ font: s.font, bold: false, italic: false }, 1).replace(/^1px /, '')}`);
		if (s.size) css.push(`font-size:${s.size * zoom}px`);
		if (s.color) css.push(`color:${s.color}`);
		return css.join(';');
	}

	/** Indent and mark of a paragraph's block */
	function dress(block: HTMLElement, p: Paragraph, index: number, all: RichText) {
		const indent = ((p.level ?? 0) + (p.list ? 1 : 0)) * LIST_INDENT * base.size * zoom;
		const first = fullStyle(p.spans[0] ?? {}, base);
		block.style.paddingLeft = indent ? `${indent}px` : '';
		block.style.setProperty('--marker-left', `${indent}px`);
		const mark = markerOf(all, index);
		if (mark) block.dataset.marker = mark;
		else delete block.dataset.marker;
		block.style.setProperty('--marker-font', fontCss({ ...first, italic: false }, first.size * zoom));
		block.style.setProperty('--marker-color', first.color);
		block.style.setProperty('--marker-gap', `${0.3 * base.size * zoom}px`);
		if (p.list) block.dataset.list = p.list;
		else delete block.dataset.list;
		if (p.level) block.dataset.level = String(p.level);
		else delete block.dataset.level;
	}

	function render() {
		if (!root) return;
		const blocks = model.map((p, i) => {
			const block = document.createElement('div');
			dress(block, p, i, model);
			for (const s of p.spans) {
				if (!s.text && p.spans.length > 1) continue;
				const span = document.createElement('span');
				const own = styleOf(s);
				if (Object.keys(own).length) {
					span.dataset.s = JSON.stringify(own);
					span.style.cssText = spanCss(own);
				}
				// An empty paragraph needs something to stand on
				span.append(s.text ? document.createTextNode(s.text) : document.createElement('br'));
				block.append(span);
			}
			return block;
		});
		root.replaceChildren(...blocks);
	}

	// --- Field → model ---

	interface Read {
		text: RichText;
		/** Each paragraph's block (the field itself for text outside one) and where it starts */
		blocks: { el: Node; start: number }[];
		/** Each text node and where it starts */
		nodes: { node: Text; start: number }[];
	}

	function read(): Read {
		const text: RichText = [];
		const blocks: Read['blocks'] = [];
		const nodes: Read['nodes'] = [];
		let at = 0;
		let current: Paragraph | null = null;
		const open = (el: Node, from?: HTMLElement) => {
			if (current) at++;
			current = { spans: [], ...(from?.dataset.list === 'bullet' || from?.dataset.list === 'number' ? { list: from.dataset.list } : {}), ...(Number(from?.dataset.level) > 0 ? { level: Number(from?.dataset.level) } : {}) };
			text.push(current);
			blocks.push({ el, start: at });
			return current;
		};
		const styleAt = (node: Node): TextStyle => {
			for (let el = node.parentElement; el && el !== root; el = el.parentElement) {
				if (el.dataset.s) {
					try {
						return styleOf(JSON.parse(el.dataset.s) as TextStyle);
					} catch {
						return {};
					}
				}
			}
			return {};
		};
		const walk = (parent: Node, block: HTMLElement | undefined) => {
			for (const node of parent.childNodes) {
				if (node.nodeType === 3) {
					const value = (node.nodeValue ?? '').replace(/​/g, '');
					const p = current ?? open(parent === root ? root! : parent, block);
					nodes.push({ node: node as Text, start: at });
					p.spans.push({ ...styleAt(node), text: value });
					at += value.length;
				} else if (node instanceof HTMLElement) {
					if (BLOCK.has(node.tagName)) {
						open(node, node);
						walk(node, node);
						// What follows it in its parent is another paragraph
						current = null;
						if (node.nextSibling && parent !== root) open(parent, block);
					} else if (node.tagName === 'BR') {
						// A line break inside a paragraph (not the one an empty paragraph stands on) splits it
						if (node.nextSibling || node.previousSibling) {
							if (node.nextSibling) open(node.parentNode!, block);
						} else if (!current) open(parent === root ? root! : parent, block);
					} else walk(node, block);
				}
			}
		};
		if (root) walk(root, undefined);
		if (!text.length) {
			text.push({ spans: [{ text: '' }] });
			blocks.push({ el: root!, start: 0 });
		}
		return { text: tidy(text), blocks, nodes };
	}

	/** A place in the field as a position of the plain text: the characters before it, and one for each paragraph
	 * that starts before it */
	function positionOf(r: Read, container: Node, offset: number): number {
		const range = document.createRange();
		range.setStart(root!, 0);
		range.setEnd(container, offset);
		const chars = range.toString().replace(/\u200b/g, '').length;
		let index = 0;
		const probe = document.createRange();
		r.blocks.forEach((b, i) => {
			if (b.el === root) return;
			probe.selectNodeContents(b.el);
			if (probe.comparePoint(container, offset) >= 0) index = i;
		});
		return chars + index;
	}

	function readSelection(r: Read): { from: number; to: number } | null {
		const s = getSelection();
		if (!root || !s || !s.rangeCount || !s.anchorNode || !root.contains(s.anchorNode) || !s.focusNode || !root.contains(s.focusNode)) return null;
		const a = positionOf(r, s.anchorNode, s.anchorOffset);
		const b = positionOf(r, s.focusNode, s.focusOffset);
		return { from: Math.min(a, b), to: Math.max(a, b) };
	}

	/** Puts the selection at positions of the plain text (the field shows the model as `render` built it) */
	function select(from: number, to: number) {
		if (!root) return;
		const place = (position: number): [Node, number] => {
			let at = 0;
			for (let i = 0; i < model.length; i++) {
				const block = root!.children[i];
				const length = model[i].spans.reduce((n, s) => n + s.text.length, 0);
				if (position <= at + length || i === model.length - 1) {
					let inside = Math.max(0, Math.min(length, position - at));
					for (const span of block.children) {
						const node = span.firstChild;
						if (!(node instanceof Text)) continue;
						if (inside <= node.length) return [node, inside];
						inside -= node.length;
					}
					return [block, 0];
				}
				at += length + 1;
			}
			return [root!, 0];
		};
		const range = document.createRange();
		range.setStart(...place(from));
		range.setEnd(...place(to));
		const s = getSelection();
		s?.removeAllRanges();
		s?.addRange(range);
		sel = { from, to };
	}

	function showMarks() {
		const now = rangeStyle(model, sel.from, sel.to, base);
		marks = sel.from === sel.to && pending ? { ...now, ...pending } : now;
		const [first, last] = paragraphsIn(model, sel.from, sel.to);
		const kinds = new Set(model.slice(first, last + 1).map((p) => p.list ?? null));
		list = kinds.size === 1 ? [...kinds][0] : null;
	}

	/** The model changed by a command: shown anew, the selection where it was (or at `caret`) */
	function changed(next: RichText, caret?: number) {
		model = next;
		render();
		root?.focus();
		select(caret ?? sel.from, caret ?? sel.to);
		pending = null;
		showMarks();
		oninput(model);
	}

	function apply(patch: TextStyle) {
		if (sel.from === sel.to) {
			// Nothing selected: what is typed next takes it
			pending = { ...pending, ...patch };
			root?.focus();
			select(sel.from, sel.to);
			showMarks();
			return;
		}
		changed(styleRange(model, sel.from, sel.to, patch));
	}

	const editing: RichEditing = {
		get marks() {
			return marks;
		},
		get list() {
			return list;
		},
		apply,
		setList(kind) {
			changed(withList(model, ...paragraphsIn(model, sel.from, sel.to), kind));
		},
		setLevel(by) {
			changed(withLevel(model, ...paragraphsIn(model, sel.from, sel.to), by));
		}
	};

	const toggle = (key: 'bold' | 'italic' | 'underline') => apply({ [key]: marks[key] !== true });

	function onbeforeinput(e: InputEvent) {
		const type = e.inputType;
		if (type === 'formatBold' || type === 'formatItalic' || type === 'formatUnderline') {
			e.preventDefault();
			toggle(type === 'formatBold' ? 'bold' : type === 'formatItalic' ? 'italic' : 'underline');
		} else if (type.startsWith('format')) {
			// No other format of the browser's
			e.preventDefault();
		} else if (type === 'insertFromPaste' || type === 'insertFromDrop') {
			// Pasted text comes plain
			e.preventDefault();
			const text = e.dataTransfer?.getData('text/plain') ?? '';
			if (text) document.execCommand('insertText', false, text);
		} else if (type === 'insertText' && pending && !e.isComposing && e.data && sel.from === sel.to) {
			e.preventDefault();
			changed(insertText(model, sel.from, e.data, pending), sel.from + e.data.length);
		} else if (type === 'insertParagraph') {
			// Enter on an empty list item ends the list there
			const [index] = paragraphsIn(model, sel.from, sel.to);
			const p = model[index];
			if (sel.from === sel.to && (p.list || p.level) && !p.spans.some((s) => s.text)) {
				e.preventDefault();
				changed(model.map((other, i) => (i === index ? { spans: other.spans } : other)));
			}
		}
	}

	function onkeydown(e: KeyboardEvent) {
		const key = e.key.toLowerCase();
		if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (key === 'b' || key === 'i' || key === 'u')) {
			e.preventDefault();
			toggle(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline');
		} else if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
			const [first, last] = paragraphsIn(model, sel.from, sel.to);
			if (model.slice(first, last + 1).some((p) => p.list)) {
				e.preventDefault();
				editing.setLevel(e.shiftKey ? -1 : 1);
			}
		}
	}

	function oninputEvent() {
		const r = read();
		model = r.text;
		const now = readSelection(r);
		if (now) sel = now;
		pending = null;
		// Marks and indents as the paragraphs are now (a new list item counts on) – without building the field anew,
		// so the caret and a composition in progress stay
		if (root) {
			let i = 0;
			for (const b of r.blocks) if (b.el instanceof HTMLElement && b.el !== root && model[i]) dress(b.el, model[i], i++, model);
		}
		showMarks();
		oninput(model);
	}

	$effect(() => {
		const onselection = () => {
			if (!root || document.activeElement !== root) return;
			const now = readSelection(read());
			if (!now) return;
			if (now.from !== sel.from || now.to !== sel.to) pending = null;
			sel = now;
			showMarks();
		};
		document.addEventListener('selectionchange', onselection);
		return () => document.removeEventListener('selectionchange', onselection);
	});

	// Built when the field is there, and anew when the zoom or the box's style changes (sizes are written per span)
	$effect(() => {
		void zoom;
		void base;
		if (!root) return;
		untrack(() => {
			const focused = document.activeElement === root;
			render();
			if (focused) select(sel.from, sel.to);
		});
	});

	$effect(() => {
		if (!root) return;
		untrack(() => {
			richEditing.current = editing;
			root!.focus();
			const end = plainOf(model).length;
			select(end, end);
			showMarks();
		});
		return () => {
			if (richEditing.current === editing) richEditing.current = null;
		};
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={root}
	class={['rich-text', classes]}
	{style}
	contenteditable="true"
	role="textbox"
	aria-multiline="true"
	aria-label={label}
	tabindex="0"
	spellcheck="true"
	{onbeforeinput}
	{onkeydown}
	oninput={oninputEvent}
></div>

<style>
	.rich-text {
		outline-offset: 0;
		overflow-wrap: anywhere;
	}
	.rich-text :global(div) {
		position: relative;
		min-height: 1lh;
	}
	.rich-text :global(div[data-marker])::before {
		content: attr(data-marker);
		position: absolute;
		left: var(--marker-left);
		font: var(--marker-font);
		color: var(--marker-color);
		transform: translateX(-100%);
		margin-left: calc(-1 * var(--marker-gap));
		white-space: pre;
		text-decoration: none;
	}
</style>
