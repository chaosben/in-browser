// Picking entries of a list or grid the same way in every tool (`ui.md` Selection): a click picks one, Ctrl/⌘+click
// adds or removes, Shift+click picks the range from the last click, Ctrl+A everything. Touch: a tap opens; a long
// press (the `contextmenu` of `installLongPress`) opens the entry's menu and starts the selection mode – marks show,
// taps pick and unpick, the mode ends with the last one or “Clear selection”. Whether a press was a touch comes from
// the last `pointerdown` (also on touch laptops, whose main pointer is fine).

import { SvelteSet } from 'svelte/reactivity';

export type PickResult = 'open' | 'picked' | 'plain';

export class Picker<K = string> {
	readonly selected = new SvelteSet<K>();
	/** Last entry clicked (Shift picks from there) */
	anchor = $state<K | null>(null);
	/** Touch selection mode */
	selecting = $state(false);
	/** The last press came from a finger or pen */
	touch = false;

	/** Call from `onpointerdown` of the list */
	pointerdown(e: PointerEvent) {
		this.touch = e.pointerType !== 'mouse';
	}

	/** Marks show and taps pick (touch selection mode with something picked) */
	get marking(): boolean {
		return this.selecting && this.selected.size > 0;
	}

	has(id: K) {
		return this.selected.has(id);
	}

	/**
	 * A click on an entry (`order`: the entries as shown). `open`: a tap outside the selection mode – open it;
	 * `plain`: a plain click picked only it (a caller may do more, e.g. go there); `picked`: the pick changed.
	 */
	click(e: MouseEvent, id: K, order: readonly K[]): PickResult {
		const mod = e.ctrlKey || e.metaKey;
		if (this.touch && !mod && !e.shiftKey) {
			if (!this.marking) return 'open';
			this.toggle(id);
			return 'picked';
		}
		if (mod) {
			this.toggle(id);
			return 'picked';
		}
		if (e.shiftKey && this.anchor !== null && order.includes(this.anchor)) {
			this.range(this.anchor, id, order);
			return 'picked';
		}
		this.only(id);
		return 'plain';
	}

	/** Right click or long press on an entry: what its menu acts on */
	menu(e: MouseEvent, id: K) {
		if (this.touch && e.type === 'contextmenu') {
			if (this.marking) this.selected.add(id);
			else {
				this.only(id);
				this.selecting = true;
			}
			this.anchor = id;
		} else if (!this.selected.has(id)) this.only(id);
	}

	/** Shift+arrow: from the anchor to `id` */
	extend(id: K, order: readonly K[]) {
		if (this.anchor === null || !order.includes(this.anchor)) return this.only(id);
		const anchor = this.anchor;
		this.range(anchor, id, order);
		this.anchor = anchor;
	}

	toggle(id: K) {
		if (this.selected.has(id)) this.selected.delete(id);
		else this.selected.add(id);
		this.anchor = id;
		if (!this.selected.size) this.selecting = false;
	}

	only(id: K) {
		this.selected.clear();
		this.selected.add(id);
		this.anchor = id;
	}

	selectAll(ids: Iterable<K>) {
		for (const id of ids) this.selected.add(id);
		if (this.touch) this.selecting = true;
	}

	/** Picks exactly these (e.g. after pasting); keeps the mode */
	set(ids: Iterable<K>) {
		this.selected.clear();
		for (const id of ids) this.selected.add(id);
		if (!this.selected.size) this.selecting = false;
	}

	/** Clears the pick and ends the selection mode */
	clear() {
		this.selected.clear();
		this.selecting = false;
	}

	/** Drops what is gone (after a list changed) */
	keep(ids: Iterable<K>) {
		const there = new Set(ids);
		for (const id of [...this.selected]) if (!there.has(id)) this.selected.delete(id);
		if (!this.selected.size) this.selecting = false;
	}

	/** The picked ones in the order shown */
	ordered(order: readonly K[]): K[] {
		return order.filter((id) => this.selected.has(id));
	}

	private range(from: K, to: K, order: readonly K[]) {
		const a = order.indexOf(from);
		const b = order.indexOf(to);
		this.selected.clear();
		for (const id of order.slice(Math.min(a, b), Math.max(a, b) + 1)) this.selected.add(id);
		this.anchor = to;
	}
}
