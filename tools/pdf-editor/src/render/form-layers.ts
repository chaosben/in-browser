// The form fields of the visible pages as real inputs over their widgets (like the text layer: built per page at
// scale 1, then only moved and scaled via `--total-scale-factor` in the view's frame). The page itself shows the
// values (PDF.js draws them from its storage), so an input stays see-through until it has the focus – then it is the
// field: typed into, a check box switched, a choice made. A value is handed on when the input is left (text) or at
// once (boxes, choices); Tab goes through the fields in order across pages (`ontab`), Esc puts the value back.
// Styles: `form-layer.css`.

import type { FieldValue, FormField, FormWidget } from '@in-browser/pdf/forms.js';
import type { PagePlace } from '@in-browser/pdf/text-layer.js';
import { FILLABLE } from '#lib/model/document.svelte.js';
import { boxOf, cssFontOf, FIELD_PAD_H, fontSizeOf, shownBox, shownText } from '#lib/model/fields.js';

export interface FormHost {
	/** Fields of the file and their values now */
	fields(): readonly FormField[];
	/** The form's font by its name in `/DR` (`/BaseFont`) */
	font(name: string): string | undefined;
	value(name: string): FieldValue | undefined;
	/** The page at an index as shown, and where the widget's page stands (-1: gone) */
	page(index: number): { view: readonly number[]; rotate: number } | undefined;
	placeOf(widget: FormWidget): number;
	/** The page shows the widget's value now (drawn anew after a change) */
	shows(widget: FormWidget): boolean;
	/** Values can be changed (the file is editable) */
	editable(): boolean;
	/** `how`: the widget and how a text was left (form scripts' `commitKey`: 1 leaving it, 2 Enter, 3 Tab) */
	commit(name: string, value: FieldValue, how?: { widget: string; commitKey: number }): void;
	/** Tab (Shift+Tab: `back`) in a field: the next one should get the focus */
	tab(widget: string, back: boolean): void;
}

type Input = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

interface Layer {
	key: string;
	wrapper: HTMLDivElement;
	inputs: Map<string, { field: FormField; widget: FormWidget; el: Input }>;
}

export class FormLayers {
	private readonly layers = new Map<number, Layer>();
	/** Rebuilds the layers when the fields arrive or the pages change */
	private version = 0;
	/** A field to focus once its page's layer is there */
	private pending: string | null = null;
	/** Inputs left with a new value: they keep showing it until the page shows it too (`settle`) */
	private readonly holding = new Map<Input, { widget: FormWidget; since: number }>();

	constructor(
		/** Element the layers are placed in (over the canvases) */
		private readonly host: HTMLElement,
		private readonly form: FormHost
	) {}

	/** The fields of these pages where they are now; other pages' layers go */
	update(places: ReadonlyMap<number, PagePlace>) {
		for (const [index, layer] of this.layers) {
			if (places.has(index)) continue;
			layer.wrapper.remove();
			this.layers.delete(index);
		}
		for (const [index, place] of places) {
			const key = `${place.key}|${place.rotate}|${this.version}`;
			let layer = this.layers.get(index);
			if (layer && layer.key !== key) {
				layer.wrapper.remove();
				layer = undefined;
			}
			if (!layer) {
				const made = this.create(index, key);
				if (!made) continue;
				this.layers.set(index, (layer = made));
			}
			const s = layer.wrapper.style;
			s.transform = `translate(${place.x}px, ${place.y}px)`;
			s.width = `${place.w * place.zoom}px`;
			s.height = `${place.h * place.zoom}px`;
			s.setProperty('--total-scale-factor', String(place.zoom));
		}
		if (this.pending) this.focus(this.pending);
	}

	/** Fields or pages changed: the layers are built anew at the next `update` */
	rebuild() {
		this.version++;
	}

	/** Values changed (undo, another widget of the same field): inputs show them, except the one typed into */
	refresh() {
		for (const layer of this.layers.values()) for (const { field, el } of layer.inputs.values()) if (el !== document.activeElement) this.show(field, el);
	}

	/** A page was drawn: inputs held since a change let go once their page shows the value (a frame later, when the
	 * surface has its new tiles; after 3 s at the latest) */
	settle() {
		for (const [el, { widget, since }] of this.holding) {
			if (!this.form.shows(widget) && performance.now() - since < 3000) continue;
			this.holding.delete(el);
			requestAnimationFrame(() => requestAnimationFrame(() => !this.holding.has(el) && el.classList.remove('holding')));
		}
	}

	/** Hands a value on; a text or choice input keeps showing it until the page does */
	private commit(field: FormField, widget: FormWidget, el: Input, value: FieldValue, commitKey = 1) {
		if (el.type !== 'checkbox') {
			el.classList.add('holding');
			this.holding.set(el, { widget, since: performance.now() });
		}
		this.form.commit(field.name, value, { widget: widget.id, commitKey });
	}

	/** Fields take presses (tools "Select", "Hand", "Select text"); otherwise presses go to the surface */
	setActive(on: boolean) {
		this.host.classList.toggle('pdfFormsActive', on);
	}

	/** Fields are tinted, required ones framed */
	setHighlight(on: boolean) {
		this.host.classList.toggle('pdfFormsHighlight', on);
	}

	/** Focuses a widget's input (when its page's layer isn't there yet: as soon as it is) */
	focus(widget: string) {
		for (const layer of this.layers.values()) {
			const input = layer.inputs.get(widget);
			if (!input) continue;
			this.pending = null;
			input.el.focus({ preventScroll: true });
			if (input.el instanceof HTMLInputElement && input.el.type === 'text') input.el.select();
			return;
		}
		this.pending = widget;
	}

	destroy() {
		for (const layer of this.layers.values()) layer.wrapper.remove();
		this.layers.clear();
	}

	private create(index: number, key: string): Layer | null {
		const page = this.form.page(index);
		if (!page) return null;
		const wrapper = document.createElement('div');
		wrapper.className = 'pdfFormLayer';
		const inputs = new Map<string, { field: FormField; widget: FormWidget; el: Input }>();
		for (const field of this.form.fields()) {
			if (!FILLABLE.has(field.kind)) continue;
			for (const widget of field.widgets) {
				if (widget.hidden || this.form.placeOf(widget) !== index) continue;
				const el = this.input(field, widget, page);
				wrapper.append(el);
				inputs.set(widget.id, { field, widget, el });
			}
		}
		this.host.append(wrapper);
		return { key, wrapper, inputs };
	}

	/** The input of one widget, placed over it (upright as its text runs, turned with the page) */
	private input(field: FormField, widget: FormWidget, page: { view: readonly number[]; rotate: number }): Input {
		const value = this.form.value(field.name) ?? field.value;
		let el: Input;
		if (field.kind === 'checkbox' || field.kind === 'radio') {
			const box = document.createElement('input');
			box.type = 'checkbox';
			box.addEventListener('click', () => {
				const now = this.form.value(field.name);
				// A radio button stays on when clicked again; a check box switches off
				const next = box.checked ? widget.on! : field.kind === 'radio' ? (now ?? 'Off') : 'Off';
				box.checked = next === widget.on;
				this.form.commit(field.name, next, { widget: widget.id, commitKey: 1 });
			});
			el = box;
		} else if (field.kind === 'combo' || field.kind === 'list') {
			const select = document.createElement('select');
			select.multiple = field.kind === 'list' && field.multiSelect;
			if (field.kind === 'list') select.size = Math.max(2, field.options.length);
			for (const o of field.options) select.append(new Option(o.label, o.value));
			select.addEventListener('change', () => {
				const chosen = [...select.selectedOptions].map((o) => o.value);
				this.commit(field, widget, select, field.kind === 'list' ? chosen : (chosen[0] ?? ''));
			});
			el = select;
		} else {
			const text = field.multiLine ? document.createElement('textarea') : document.createElement('input');
			if (text instanceof HTMLInputElement) text.type = field.password ? 'password' : 'text';
			if (field.maxLen > 0) text.maxLength = field.maxLen;
			text.spellcheck = false;
			text.addEventListener('blur', () => {
				if (text.value !== (this.form.value(field.name) ?? '')) this.commit(field, widget, text, text.value);
			});
			text.addEventListener('keydown', (event) => {
				const e = event as KeyboardEvent;
				if (e.key === 'Escape') {
					text.value = String(this.form.value(field.name) ?? '');
					text.blur();
				} else if (e.key === 'Enter' && text instanceof HTMLInputElement) {
					if (text.value !== (this.form.value(field.name) ?? '')) this.commit(field, widget, text, text.value, 2);
				}
			});
			el = text;
			if (field.comb && field.maxLen > 0) el.classList.add('comb');
		}
		el.classList.add('pdfField', `pdfField-${field.kind}`);
		if (field.required) el.classList.add('required');
		el.dataset.formField = widget.id;
		el.setAttribute('aria-label', field.label);
		if (field.required) el.setAttribute('aria-required', 'true');
		el.disabled = field.readOnly || !this.form.editable();
		el.addEventListener('keydown', (e) => {
			const ke = e as KeyboardEvent;
			if (ke.key !== 'Tab') return;
			ke.preventDefault();
			if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
				if (el.type !== 'checkbox' && el.value !== (this.form.value(field.name) ?? '')) this.commit(field, widget, el, el.value, 3);
			}
			this.form.tab(widget.id, ke.shiftKey);
		});
		// Keys typed here are the field's (Space, Delete …); shortcuts with Ctrl/⌘ (undo …) stay the editor's
		el.addEventListener('keydown', (e) => {
			const ke = e as KeyboardEvent;
			if (!ke.ctrlKey && !ke.metaKey) ke.stopPropagation();
		});

		const shown = shownBox(widget, page);
		const { w, h } = boxOf(widget);
		const turn = (((page.rotate - widget.rotation) % 360) + 360) % 360;
		const px = (v: number) => `calc(var(--total-scale-factor) * ${v}px)`;
		const size = fontSizeOf(field, widget, shownText(field, value));
		const s = el.style;
		s.left = px(shown.x + shown.w / 2);
		s.top = px(shown.y + shown.h / 2);
		s.width = px(w);
		s.height = px(h);
		s.transform = `translate(-50%, -50%)${turn ? ` rotate(${turn}deg)` : ''}`;
		s.fontSize = px(size);
		s.fontFamily = field.comb ? 'monospace' : cssFontOf(this.form.font(field.fontName));
		s.padding = `0 ${px(FIELD_PAD_H)}`;
		// Fitted to the box: smaller as the text grows, like the page will show it
		if (field.kind === 'text' && field.fontSize === 0 && !field.multiLine) {
			el.addEventListener('input', () => (s.fontSize = px(fontSizeOf(field, widget, (el as HTMLInputElement).value))));
		}
		s.setProperty('--field-color', `rgb(${field.color.map((c) => Math.round(c * 255)).join(' ')})`);
		if (field.kind === 'text') s.textAlign = ['left', 'center', 'right'][field.align];
		if (field.comb && field.maxLen > 0) s.setProperty('--comb', px(w / field.maxLen));
		this.show(field, el, widget);
		return el;
	}

	/** Puts the field's value into its input */
	private show(field: FormField, el: Input, widget?: FormWidget) {
		const value = this.form.value(field.name) ?? field.value;
		if (el instanceof HTMLSelectElement) {
			const chosen = new Set(typeof value === 'string' ? [value] : value);
			for (const o of el.options) o.selected = chosen.has(o.value);
		} else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
			const on = widget?.on ?? field.widgets.find((w) => w.id === el.dataset.formField)?.on;
			el.checked = typeof value === 'string' && value !== 'Off' && value === on;
		} else {
			el.value = typeof value === 'string' ? value : (value[0] ?? '');
		}
	}
}
