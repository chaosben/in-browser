<script lang="ts">
	// The form's fields by page (like PDF-XChange's form fields pane): what each asks for, its kind and value now,
	// required ones marked, with how many of them are filled in; a filter for the required ones. A click goes to the
	// field and focuses it, so it can be filled in right away.
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import type { FieldValue, FormField } from '@in-browser/pdf/forms.js';
	import { m } from '#lib/i18n/index.js';
	import { FILLABLE } from '#lib/model/document.svelte.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';
	import { shownText } from '#lib/model/fields.js';

	let { context, close }: PanelProps<EditorState> = $props();

	let onlyRequired = $state(false);

	const ICONS: Record<FormField['kind'], string> = {
		text: 'icon-[material-symbols-light--text-fields]',
		checkbox: 'icon-[material-symbols-light--check-box-outline]',
		radio: 'icon-[material-symbols-light--radio-button-checked-outline]',
		combo: 'icon-[material-symbols-light--arrow-drop-down-circle-outline]',
		list: 'icon-[material-symbols-light--list]',
		button: 'icon-[material-symbols-light--select]',
		signature: 'icon-[material-symbols-light--signature]'
	};

	const isEmpty = (f: FormField, v: FieldValue) => (typeof v === 'string' ? v === '' || ((f.kind === 'checkbox' || f.kind === 'radio') && v === 'Off') : v.length === 0);

	/** What a field holds now, in words */
	function describe(f: FormField, v: FieldValue): string {
		if (f.kind === 'checkbox') return v !== 'Off' ? m.panels.checked : m.panels.unchecked;
		if (f.kind === 'radio') return typeof v !== 'string' || v === 'Off' ? m.panels.empty : v;
		if (f.kind === 'list') return typeof v === 'string' ? v : v.map((x) => f.options.find((o) => o.value === x)?.label ?? x).join(', ') || m.panels.empty;
		return shownText(f, v) || m.panels.empty;
	}

	const doc = $derived(context.doc);
	const fields = $derived((doc?.fields ?? []).filter((f) => FILLABLE.has(f.kind)));
	const required = $derived(fields.filter((f) => f.required));
	const filled = $derived(required.filter((f) => !isEmpty(f, doc?.values.get(f.name) ?? f.value)).length);

	/** By the page of the first widget still there */
	const pages = $derived.by(() => {
		const byPage = new Map<number, { field: FormField; widget: string; value: FieldValue }[]>();
		for (const field of fields) {
			if (onlyRequired && !field.required) continue;
			const widget = field.widgets.find((w) => (doc?.placeOf(w) ?? -1) >= 0);
			if (!widget || !doc) continue;
			const index = doc.placeOf(widget);
			const list = byPage.get(index) ?? [];
			list.push({ field, widget: widget.id, value: doc.values.get(field.name) ?? field.value });
			byPage.set(index, list);
		}
		return [...byPage].sort((a, b) => a[0] - b[0]).map(([index, entries]) => ({ index, entries }));
	});

	function show(widget: string) {
		// On a phone the panel covers the page: back to it
		if (matchMedia('(pointer: coarse), (max-width: 639px)').matches) close();
		context.showField(widget);
	}
</script>

<div class="flex h-full flex-col gap-2 p-2">
	{#if !fields.length}
		<p class="p-2 text-sm opacity-70">{m.panels.noFields}</p>
	{:else}
		{#if required.length}
			<p class="px-1 text-xs opacity-70">{m.panels.fieldsFilled(filled, required.length)}</p>
		{/if}
		<label class="flex cursor-pointer items-center gap-2 px-1 text-sm">
			<input type="checkbox" class="toggle toggle-sm" bind:checked={onlyRequired} />
			{m.panels.onlyRequired}
		</label>
		<div class="min-h-0 flex-1 overflow-y-auto">
			{#each pages as page (page.index)}
				<h3 class="px-1 pt-2 pb-1 text-xs font-semibold opacity-70">{m.comments.page(page.index + 1)}</h3>
				<ul class="flex flex-col gap-0.5">
					{#each page.entries as e (e.field.name)}
						{@const empty = isEmpty(e.field, e.value)}
						<li>
							<button
								class="hover:bg-base-200 flex w-full items-start gap-2 rounded px-2 py-1.5 text-left"
								onclick={() => show(e.widget)}
								title={e.field.readOnly ? m.panels.readOnlyField : undefined}
							>
								<span class="{ICONS[e.field.kind]} mt-0.5 size-4 shrink-0 opacity-70" aria-hidden="true"></span>
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="truncate text-sm">
										{e.field.label}{#if e.field.required}<span class="text-field ml-0.5" aria-label={m.panels.required}>*</span>{/if}
									</span>
									<span class={['truncate text-xs', empty ? 'italic opacity-50' : 'opacity-80']}>{describe(e.field, e.value)}</span>
								</span>
								{#if e.field.readOnly}
									<span class="icon-[material-symbols-light--lock-outline] mt-0.5 size-4 shrink-0 opacity-50" aria-hidden="true"></span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/each}
		</div>
	{/if}
</div>
