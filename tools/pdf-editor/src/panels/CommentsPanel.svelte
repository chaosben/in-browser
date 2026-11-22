<script lang="ts">
	// All comments of the PDF: subject (else the kind), author, date, review
	// status and the first line of the text – in groups by page, day, author, kind or status ("Sort by"), with a
	// search and a filter by kind, author and status. A click shows and selects a comment; the
	// selected one shows its whole text and replies, takes a new subject, a status and – after "Reply" – a reply.
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import { loadJson, storeJson } from '@in-browser/brand/storage.js';
	import { openMenuBelow, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { REVIEW_STATES, type ReviewState } from '@in-browser/pdf/write/annotations.js';
	import { formatDateTime, intlLocale, m } from '#lib/i18n/index.js';
	import { arrangeComments, COMMENT_SORTS, commentAuthors, commentList, type CommentKind as Kind, type CommentSort } from '#lib/model/comments.js';
	import type { StateEntry } from '#lib/model/document.svelte.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';

	let { context, close }: PanelProps<EditorState> = $props();

	const KINDS: { value: Kind | 'all'; label: string }[] = [
		{ value: 'all', label: m.comments.all },
		{ value: 'notes', label: m.comments.notes },
		{ value: 'texts', label: m.comments.texts },
		{ value: 'marks', label: m.comments.marks },
		{ value: 'drawings', label: m.comments.drawings }
	];
	const STATE_ICONS: Record<ReviewState, string> = {
		None: 'icon-[material-symbols-light--radio-button-unchecked]',
		Accepted: 'icon-[material-symbols-light--thumb-up-outline]',
		Rejected: 'icon-[material-symbols-light--thumb-down-outline]',
		Cancelled: 'icon-[material-symbols-light--cancel-outline]',
		Completed: 'icon-[material-symbols-light--check-circle-outline]'
	};
	/** Role colors of the states (`theme.css`): badges filled, the status button's icon tinted */
	const STATE_BADGES: Record<ReviewState, string> = {
		None: 'badge-ghost',
		Accepted: 'bg-review-accepted text-review-accepted-content border-review-accepted',
		Rejected: 'bg-review-rejected text-review-rejected-content border-review-rejected',
		Cancelled: 'bg-review-cancelled text-review-cancelled-content border-review-cancelled',
		Completed: 'bg-review-completed text-review-completed-content border-review-completed'
	};
	const STATE_TEXT: Record<ReviewState, string> = {
		None: '',
		Accepted: 'text-review-accepted',
		Rejected: 'text-review-rejected',
		Cancelled: 'text-review-cancelled',
		Completed: 'text-review-completed'
	};

	/** How the list is sorted and which kind it shows are kept for the device; author and status belong to the PDF */
	const STORE = 'pdf-editor:comments';
	const stored = loadJson<{ sort?: unknown; kind?: unknown }>(STORE, {});
	let query = $state('');
	let sort = $state<CommentSort>(COMMENT_SORTS.includes(stored.sort as CommentSort) ? (stored.sort as CommentSort) : 'page');
	let kind = $state<Kind | 'all'>(KINDS.some((k) => k.value === stored.kind) ? (stored.kind as Kind | 'all') : 'all');
	/** The author picked; one who has no comment any more is no filter (`author`) */
	let pickedAuthor = $state<string | null | 'all'>('all');
	let status = $state<ReviewState | 'all'>('all');

	const day = new Intl.DateTimeFormat(intlLocale, { dateStyle: 'full' });
	let draft = $state('');
	/** The comment whose reply field is open (after "Reply"; another selection closes it) */
	let replyingTo = $state<string | null>(null);
	/** The subject being renamed (comment id) */
	let renaming = $state<string | null>(null);

	/** All comments by page (follows every change of the pages, replies, subjects and states) */
	const all = $derived.by(() => {
		const doc = context.doc;
		if (!doc) return [];
		void doc.changes;
		return commentList(doc);
	});
	const authors = $derived(commentAuthors(all));
	const author = $derived(pickedAuthor !== 'all' && !authors.includes(pickedAuthor) ? 'all' : pickedAuthor);
	const filtered = $derived(kind !== 'all' || author !== 'all' || status !== 'all');
	/** The comments as sorted and filtered, in groups */
	const groups = $derived(arrangeComments(all, sort, { kind, author, status, words: query }, (date) => day.format(date)));

	function keep() {
		storeJson(STORE, { sort, kind });
	}
	const SORT_LABELS: Record<CommentSort, string> = { page: m.comments.byPage, date: m.comments.byDate, author: m.comments.byAuthor, kind: m.comments.byKind, status: m.comments.byStatus };
	const sortMenu = (): MenuEntry[] =>
		COMMENT_SORTS.map((value) => ({
			label: SORT_LABELS[value],
			checked: sort === value,
			run: () => {
				sort = value;
				keep();
			}
		}));
	const filterMenu = (): MenuEntry[] => [
		{ heading: m.comments.kind },
		...KINDS.map((k) => ({
			label: k.label,
			checked: kind === k.value,
			run: () => {
				kind = k.value;
				keep();
			}
		})),
		{ heading: m.comments.author },
		{ label: m.comments.allAuthors, checked: author === 'all', run: () => (pickedAuthor = 'all') },
		...authors.map((name) => ({ label: name ?? m.comments.unknownAuthor, checked: author === name, run: () => (pickedAuthor = name) })),
		{ heading: m.comments.status },
		{ label: m.comments.allStates, checked: status === 'all', run: () => (status = 'all') },
		...REVIEW_STATES.map((state) => ({ label: state === 'None' ? m.comments.noStatus : m.comments.states[state], icon: `${STATE_ICONS[state]} ${STATE_TEXT[state]}`, checked: status === state, run: () => (status = state) })),
		{ separator: true },
		{
			label: m.comments.showAll,
			icon: 'icon-[material-symbols-light--filter-alt-off-outline]',
			disabled: !filtered,
			run: () => {
				kind = pickedAuthor = status = 'all';
				keep();
			}
		}
	];
	/** The comment selected on the page (it shows everything and takes a reply) */
	const selected = $derived(context.selection?.count === 1 ? context.selection.items[0]?.id : null);
	const editable = $derived(context.doc?.editable === 'yes');
	const replying = $derived(replyingTo !== null && replyingTo === selected);

	function startReply(id: string) {
		draft = '';
		replyingTo = id;
	}

	function show(index: number, id: string) {
		context.showItem(index, id);
		if (matchMedia('(pointer: coarse), (max-width: 639px)').matches) close();
	}

	function reply(id: string) {
		context.doc?.addReply(id, draft);
		draft = '';
		replyingTo = null;
	}

	const when = (d: Date | null) => (d ? formatDateTime(d) : '');
	const stateTitle = (s: StateEntry) => m.comments.statusBy(m.comments.states[s.state], s.author, when(s.modified));

	/** The review states to choose from (the current one checked) */
	const stateEntries = (target: string) => {
		const current = context.doc?.stateOf(target)?.state ?? 'None';
		return REVIEW_STATES.map((state) => ({
			label: m.comments.states[state],
			icon: `${STATE_ICONS[state]} ${STATE_TEXT[state]}`,
			checked: state === current,
			run: () => context.doc?.setState(target, state)
		}));
	};

	function replyMenu(ev: MouseEvent, parent: string, id: string) {
		openMenuBelow(ev, [
			{ heading: m.comments.status },
			...stateEntries(id),
			{ separator: true },
			{ label: m.comments.deleteReply, icon: 'icon-[material-symbols-light--delete-outline]', run: () => context.doc?.removeReply(parent, id) }
		]);
	}

	function focus(el: HTMLElement) {
		el.focus();
		if (el instanceof HTMLInputElement) el.select();
	}
</script>

{#snippet badge(state: StateEntry | null)}
	{#if state && state.state !== 'None'}
		<span class="badge badge-sm shrink-0 gap-1 {STATE_BADGES[state.state]}" title={stateTitle(state)}>
			<span class="{STATE_ICONS[state.state]} size-3.5" aria-hidden="true"></span>{m.comments.states[state.state]}
		</span>
	{/if}
{/snippet}

<div class="flex h-full flex-col gap-2 p-2">
	<div class="flex gap-1">
		<input class="input input-sm min-w-0 flex-1" type="search" placeholder={m.comments.find} aria-label={m.comments.find} bind:value={query} />
		<button class="btn btn-sm btn-square" onclick={(e) => openMenuBelow(e, sortMenu())} title={m.comments.sortBy(SORT_LABELS[sort])} aria-label={m.comments.sortBy(SORT_LABELS[sort])}>
			<span class="icon-[material-symbols-light--sort] size-5" aria-hidden="true"></span>
		</button>
		<!-- Tinted while it hides something -->
		<button class={['btn btn-sm btn-square', filtered && 'text-primary']} onclick={(e) => openMenuBelow(e, filterMenu())} title={filtered ? m.comments.filterOn : m.comments.filter} aria-label={filtered ? m.comments.filterOn : m.comments.filter} aria-pressed={filtered}>
			<span class="icon-[material-symbols-light--filter-alt-outline] size-5" aria-hidden="true"></span>
		</button>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto">
		{#if !groups.length}
			<p class="p-2 text-sm opacity-70">{query || filtered ? m.comments.noneFound : m.comments.none}</p>
		{/if}
		{#each groups as page (page.key)}
			<h3 class="px-1 pt-2 pb-1 text-xs font-semibold opacity-70">{page.label}</h3>
			<ul class="flex flex-col gap-1">
				{#each page.entries as e (e.item.id)}
					{@const active = selected === e.item.id}
					<li class={['rounded border', active ? 'border-selection bg-selection/20' : 'border-base-300']}>
						{#if active}
							<!-- Selected: everything; the subject can be renamed -->
							<div class="flex flex-col gap-0.5 px-2 py-1.5">
								<span class="flex items-center gap-1.5 text-xs">
									<span class="{e.icon} size-4 shrink-0" aria-hidden="true"></span>
									{#if renaming === e.item.id}
										<input
											class="input input-xs min-w-0 flex-1 font-medium"
											aria-label={m.comments.subject}
											value={e.title}
											{@attach focus}
											onkeydown={(ev) => {
												if (ev.key === 'Enter') ev.currentTarget.blur();
												else if (ev.key === 'Escape') {
													ev.stopPropagation();
													renaming = null;
												}
											}}
											onblur={(ev) => {
												const value = ev.currentTarget.value.trim();
												if (renaming === e.item.id) context.doc?.setSubject(e.item.id, value === e.kindLabel ? '' : value);
												renaming = null;
											}}
										/>
									{:else if editable}
										<button
											class="hover:bg-base-200 min-w-0 truncate rounded px-0.5 text-left font-medium"
											title={m.comments.renameSubject}
											onclick={() => (renaming = e.item.id)}
										>
											{e.title}
										</button>
									{:else}
										<span class="min-w-0 truncate font-medium">{e.title}</span>
									{/if}
									<span class="ml-auto shrink-0 opacity-60">{when(e.info.modified)}</span>
								</span>
								<span class="flex items-center gap-1 text-xs">
									<span class="min-w-0 flex-1 truncate opacity-70">{e.info.author || m.comments.unknownAuthor}</span>
									{@render badge(e.state)}
								</span>
								{#if e.text}<p class="text-sm break-words whitespace-pre-line">{e.text}</p>{/if}
							</div>
							{#if e.replies.length}
								<ul class="border-base-300 ml-3 flex flex-col gap-1 border-l py-1 pr-1 pl-2">
									{#each e.replies as r (r.id)}
										<li class="flex items-start gap-1">
											<div class="min-w-0 flex-1">
												<div class="flex flex-wrap items-center gap-x-2 text-xs">
													<span class="font-medium break-all">{r.author || m.comments.unknownAuthor}</span>
													<span class="opacity-60">{when(r.modified)}</span>
													{@render badge(r.state)}
												</div>
												<p class="text-sm break-words whitespace-pre-line">{r.text}</p>
											</div>
											<button
												class="btn btn-ghost btn-xs btn-square"
												title={m.comments.replyActions}
												aria-label={m.comments.replyActions}
												disabled={!editable}
												onclick={(ev) => replyMenu(ev, e.item.id, r.id)}
											>
												<span class="icon-[material-symbols-light--more-horiz] size-4" aria-hidden="true"></span>
											</button>
										</li>
									{/each}
								</ul>
							{/if}
							{#if !editable}
								<p class="p-1 text-xs opacity-70">{m.comments.readOnly}</p>
							{:else if replying}
								<form
									class="flex flex-col gap-1 p-1"
									onsubmit={(ev) => {
										ev.preventDefault();
										reply(e.item.id);
									}}
								>
									<textarea
										class="textarea textarea-sm min-h-0 w-full"
										rows="2"
										placeholder={m.comments.replyPlaceholder}
										aria-label={m.comments.replyPlaceholder}
										bind:value={draft}
										{@attach focus}
										onkeydown={(ev) => {
											if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
												ev.preventDefault();
												reply(e.item.id);
											} else if (ev.key === 'Escape') {
												ev.stopPropagation();
												replyingTo = null;
											}
										}}
									></textarea>
									<div class="flex justify-end gap-1">
										<button class="btn btn-ghost btn-sm" type="button" onclick={() => (replyingTo = null)}>{m.comments.cancel}</button>
										<button class="btn btn-sm" type="submit" disabled={!draft.trim()}>{m.comments.send}</button>
									</div>
								</form>
							{:else}
								<div class="flex gap-1 p-1">
									<button class="btn btn-ghost btn-sm" onclick={() => startReply(e.item.id)}>
										<span class="icon-[material-symbols-light--reply] size-4" aria-hidden="true"></span>{m.comments.reply}
									</button>
									<button class="btn btn-ghost btn-sm" onclick={(ev) => openMenuBelow(ev, stateEntries(e.item.id))}>
										<span class="{STATE_ICONS[e.state?.state ?? 'None']} {STATE_TEXT[e.state?.state ?? 'None']} size-4" aria-hidden="true"></span>{m.comments.status}
										<span class="icon-[material-symbols-light--arrow-drop-down] size-4" aria-hidden="true"></span>
									</button>
								</div>
							{/if}
						{:else}
							<button class="hover:bg-base-200 flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left" onclick={() => show(e.index, e.item.id)}>
								<span class="flex w-full items-center gap-1.5 text-xs">
									<span class="{e.icon} size-4 shrink-0" aria-hidden="true"></span>
									<span class="min-w-0 truncate font-medium">{e.title}</span>
									<span class="ml-auto shrink-0 opacity-60">{when(e.info.modified)}</span>
								</span>
								<span class="flex w-full items-center gap-1 text-xs">
									<span class="min-w-0 flex-1 truncate opacity-70">{e.info.author || m.comments.unknownAuthor}</span>
									{@render badge(e.state)}
								</span>
								{#if e.text}<span class="w-full truncate text-sm">{e.text}</span>{/if}
								{#if e.replies.length}<span class="text-xs opacity-60">{m.comments.replies(e.replies.length)}</span>{/if}
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/each}
	</div>
</div>
