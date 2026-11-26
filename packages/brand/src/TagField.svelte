<script lang="ts">
	// Choosing several entries of a long list by typing (`ui.md` “Choosing from many”): the chosen ones as chips, the
	// list of the others below while the field has the focus, narrowed by what is typed. ↑/↓ move in it, Enter takes
	// the marked one (else the first), Backspace in the empty field drops the last chip, Esc closes the list first.
	// With `create` a name nothing is called yet can be made; `partial` are entries only some of a selection have
	// (dashed chips: a click puts them on all, × takes them off all).
	import { brandMessages } from './i18n/index.svelte.js';
	import { matchesQuery, normalize } from './ui/search.js';

	interface Option {
		id: string;
		label: string;
	}

	interface Props {
		options: Option[];
		/** The chosen ids */
		value: string[];
		/** Ids only a part of what is edited has */
		partial?: string[];
		/** Makes an entry of the typed name and returns its id (it may only be made for real when the caller keeps) */
		create?: (name: string) => string;
		/** The entry offered to make one, e.g. “New tag “Study”” */
		createLabel?: (name: string) => string;
		/** The field's name for screen readers */
		label: string;
		placeholder?: string;
		size?: 'sm' | 'md';
		/** The text field, to give it the focus */
		input?: HTMLInputElement;
	}

	let {
		options,
		value = $bindable([]),
		partial = $bindable([]),
		create,
		createLabel,
		label,
		placeholder = '',
		size = 'md',
		input = $bindable()
	}: Props = $props();

	const t = $derived(brandMessages().tagField);
	const uid = $props.id();
	let query = $state('');
	let open = $state(false);
	let active = $state(0);
	/** Entries made here that `options` doesn't have (yet) */
	let made = $state<Option[]>([]);

	const all = $derived([...options, ...made.filter((m) => !options.some((o) => o.id === m.id))]);
	const labelOf = (id: string) => all.find((o) => o.id === id)?.label ?? id;
	const matches = $derived(all.filter((o) => !value.includes(o.id) && matchesQuery(query, o.label)));
	const name = $derived(query.trim());
	const offerNew = $derived(!!create && !!name && !all.some((o) => normalize(o.label) === normalize(name)));
	const count = $derived(matches.length + (offerNew ? 1 : 0));

	function take(id: string) {
		value = [...value, id];
		partial = partial.filter((p) => p !== id);
		query = '';
		active = 0;
		// Closed until typing again, so it covers nothing (a dialog's buttons) after the choice
		open = false;
	}

	function pick(i: number) {
		if (i < matches.length) return take(matches[i].id);
		if (!offerNew || !create) return;
		const id = create(name);
		if (!all.some((o) => o.id === id)) made = [...made, { id, label: name }];
		if (!value.includes(id)) take(id);
		else query = '';
	}

	function remove(id: string) {
		value = value.filter((v) => v !== id);
		partial = partial.filter((p) => p !== id);
		input?.focus();
	}

	function clear() {
		value = [];
		partial = [];
		input?.focus();
	}

	function keydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!open) open = true;
			else if (count) active = (active + (e.key === 'ArrowDown' ? 1 : count - 1)) % count;
		} else if (e.key === 'Enter') {
			if (!open || !count) return;
			e.preventDefault();
			pick(Math.min(active, count - 1));
		} else if (e.key === 'Backspace' && !query && value.length) {
			remove(value[value.length - 1]);
		} else if (e.key === 'Escape' && (open || query)) {
			// Closes the list (and empties the field) before Esc closes a dialog around it
			e.preventDefault();
			e.stopPropagation();
			open = false;
			query = '';
		}
	}
</script>

<div
	class="relative w-full"
	onfocusout={(e) => {
		if (!e.currentTarget.contains(e.relatedTarget as Node | null)) open = false;
	}}
>
	<!-- A click beside the chips focuses the text field, which has the keys -->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class={['input flex h-auto w-full flex-wrap items-center gap-1', size === 'sm' ? 'input-sm min-h-8 py-0.5' : 'min-h-10 py-1']} onclick={() => input?.focus()}>
		{#each value as id (id)}
			<span class="badge badge-sm gap-0.5 pr-0">
				{labelOf(id)}
				<button type="button" class="btn btn-ghost btn-xs btn-circle size-5 min-h-0" title={t.remove(labelOf(id))} aria-label={t.remove(labelOf(id))} onclick={() => remove(id)}>
					<span class="icon-[material-symbols-light--close] size-3.5" aria-hidden="true"></span>
				</button>
			</span>
		{/each}
		{#each partial as id (id)}
			<span class="badge badge-sm badge-dash gap-0.5 pr-0">
				<button type="button" class="cursor-pointer" title={t.partial(labelOf(id))} onclick={() => take(id)}>{labelOf(id)}</button>
				<button type="button" class="btn btn-ghost btn-xs btn-circle size-5 min-h-0" title={t.remove(labelOf(id))} aria-label={t.remove(labelOf(id))} onclick={() => remove(id)}>
					<span class="icon-[material-symbols-light--close] size-3.5" aria-hidden="true"></span>
				</button>
			</span>
		{/each}
		<input
			bind:this={input}
			bind:value={query}
			type="text"
			class="w-auto! min-w-24 flex-1"
			role="combobox"
			aria-label={label}
			aria-expanded={open}
			aria-controls="{uid}-list"
			aria-autocomplete="list"
			aria-activedescendant={open && count ? `${uid}-${Math.min(active, count - 1)}` : undefined}
			placeholder={value.length || partial.length ? '' : placeholder}
			autocomplete="off"
			onfocus={() => (open = true)}
			oninput={() => {
				open = true;
				active = 0;
			}}
			onkeydown={keydown}
		/>
		{#if value.length || partial.length}
			<button type="button" class="btn btn-ghost btn-xs btn-circle ml-auto shrink-0" title={t.clear} aria-label={t.clear} onclick={clear}>
				<span class="icon-[material-symbols-light--close] size-4" aria-hidden="true"></span>
			</button>
		{/if}
	</div>
	{#if open && (count || name)}
		<!-- Over what follows, so nothing moves while it opens and closes (a tap aimed below it would hit something else) -->
		<ul id="{uid}-list" role="listbox" aria-label={label} class="menu menu-sm border-base-300 rounded-box bg-base-100 absolute top-full left-0 z-20 mt-1 max-h-56 w-full flex-nowrap overflow-y-auto border shadow-lg">
			{#each matches as o, i (o.id)}
				<li role="option" id="{uid}-{i}" aria-selected={i === active}>
					<button type="button" tabindex="-1" class={i === active ? 'menu-focus' : undefined} onpointerdown={(e) => e.preventDefault()} onclick={() => pick(i)}>{o.label}</button>
				</li>
			{/each}
			{#if offerNew}
				<li role="option" id="{uid}-{matches.length}" aria-selected={active === matches.length}>
					<button type="button" tabindex="-1" class={active === matches.length ? 'menu-focus' : undefined} onpointerdown={(e) => e.preventDefault()} onclick={() => pick(matches.length)}>
						<span class="icon-[material-symbols-light--add] size-4" aria-hidden="true"></span>
						{(createLabel ?? t.create)(name)}
					</button>
				</li>
			{/if}
			{#if !count}
				<li class="menu-disabled"><span>{t.noMatch}</span></li>
			{/if}
		</ul>
	{/if}
</div>
