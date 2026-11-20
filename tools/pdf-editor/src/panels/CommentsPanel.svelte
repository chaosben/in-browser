<script lang="ts">
	// All comments of the PDF by page (like PDF-XChange's comments pane): subject (else the kind), author, date, review
	// status and the first line of the text; a search and a filter by kind. A click shows and selects a comment; the
	// selected one shows its whole text and replies, takes a new subject, a status and – after "Reply" – a reply.
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import { openMenuBelow } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { REVIEW_STATES, type ReviewState } from '@in-browser/pdf/write/annotations.js';
	import { formatDateTime, m } from '#lib/i18n/index.js';
	import { kindOf as describe } from '#lib/model/comments.js';
	import type { StateEntry } from '#lib/model/document.svelte.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';
	import { isAnnotatable, isMarkup, type PdfItem } from '#lib/render/markup.js';
	import { isNote } from '#lib/render/note.js';
	import { isText } from '#lib/render/textbox.js';

	let { context, close }: PanelProps<EditorState> = $props();

	type Kind = 'notes' | 'texts' | 'marks' | 'drawings';
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

	let query = $state('');
	let kind = $state<Kind | 'all'>('all');
	let draft = $state('');
	/** The comment whose reply field is open (after "Reply"; another selection closes it) */
	let replyingTo = $state<string | null>(null);
	/** The subject being renamed (comment id) */
	let renaming = $state<string | null>(null);

	const kindOf = (item: PdfItem): Kind => (isNote(item) ? 'notes' : isText(item) ? 'texts' : isMarkup(item) ? 'marks' : 'drawings');
	const textOf = (item: PdfItem) => (isNote(item) || isText(item) || isMarkup(item) ? item.text : '');

	/** The comments by page, as filtered (follows every change of the pages, replies, subjects and states) */
	const pages = $derived.by(() => {
		const doc = context.doc;
		if (!doc) return [];
		void doc.changes;
		const { replies, subjects, states } = doc;
		const words = query.trim().toLowerCase();
		return doc.pages
			.map((page, index) => {
				const items = (doc.scene(page.id)?.items ?? []).filter((i) => isAnnotatable(i) && (kind === 'all' || kindOf(i) === kind));
				const entries = items
					.map((item) => {
						const said = describe(item);
						return {
							item,
							info: doc.infoOf(item.id),
							icon: said.icon,
							kindLabel: said.label,
							title: subjects.get(item.id) || said.label,
							text: textOf(item),
							state: states.get(item.id)?.at(-1) ?? null,
							replies: (replies.get(item.id) ?? []).map((r) => ({ ...r, subject: subjects.get(r.id) ?? '', state: states.get(r.id)?.at(-1) ?? null }))
						};
					})
					.filter(
						(e) =>
							!words ||
							[e.title, e.text, e.info.author, ...e.replies.flatMap((r) => [r.text, r.author, r.subject])].some((s) => s.toLowerCase().includes(words))
					);
				return { index, number: page.number, entries };
			})
			.filter((p) => p.entries.length);
	});
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
		<select class="select select-sm w-auto" aria-label={m.comments.kind} bind:value={kind}>
			{#each KINDS as k (k.value)}<option value={k.value}>{k.label}</option>{/each}
		</select>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto">
		{#if !pages.length}
			<p class="p-2 text-sm opacity-70">{query || kind !== 'all' ? m.comments.noneFound : m.comments.none}</p>
		{/if}
		{#each pages as page (page.index)}
			<h3 class="px-1 pt-2 pb-1 text-xs font-semibold opacity-70">{m.comments.page(page.number)}</h3>
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
							<button class="hover:bg-base-200 flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left" onclick={() => show(page.index, e.item.id)}>
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
