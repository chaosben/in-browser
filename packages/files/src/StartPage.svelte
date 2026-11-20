<script lang="ts" module>
	/** A document on the start page (a recently opened file, a notebook …) */
	export interface StartEntry {
		path: string;
		/** Shown name (default: the file name) */
		name?: string;
		/** Last change; null: not reachable right now (a connected folder without access, a device offline) */
		modified: number | null;
		/** `directory` for packages (notebooks …), so the icon is the tool's */
		kind?: 'file' | 'directory';
		/** Shown before the date, e.g. the number of pages */
		detail?: string;
	}
</script>

<script lang="ts">
	// The start page of a tool with documents (`ui.md` “Start page”): a tagline, the main buttons (primary first), then
	// the documents as cards – each a link that opens, with its menu on right click, long press and ⋯.
	import type { Snippet } from 'svelte';
	import MoreButton from '@in-browser/brand/MoreButton.svelte';
	import { openContextMenu, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import AccessNotice from './AccessNotice.svelte';
	import FileIcon from './FileIcon.svelte';
	import { filesMessages } from './i18n/index.svelte.js';
	import { basename, parent } from './path.js';
	import { displayPath } from './sources/registry.js';

	interface Props {
		tagline: string;
		/** The row of main buttons, primary first */
		actions: Snippet;
		/** Below the buttons (a hint, a hidden file input …) */
		extra?: Snippet;
		/** Heading of the documents (default “Recently opened”) */
		heading?: string;
		/** null while loading */
		entries: StartEntry[] | null;
		href: (entry: StartEntry) => string;
		/** Opens a plain click in place instead of following the link (the link stays for a new tab) */
		onopen?: (entry: StartEntry) => void;
		/** The entry's complete menu */
		menu: (entry: StartEntry) => MenuEntry[];
		/** One sentence when there are no entries */
		empty: string;
		/** false: the browser lacks what the tool needs */
		available?: boolean;
		unsupported?: string;
		/** Tool name for the access notice of connected folders */
		tool: string;
		onallowed?: () => void;
		formatDate: (ms: number) => string;
		/** Del on a focused card */
		ondelete?: (entry: StartEntry) => void;
	}

	let {
		tagline,
		actions,
		extra,
		heading,
		entries,
		href,
		onopen,
		menu,
		empty,
		available = true,
		unsupported,
		tool,
		onallowed,
		formatDate,
		ondelete
	}: Props = $props();

	const t = $derived(filesMessages());
	const nameOf = (entry: StartEntry) => entry.name ?? basename(entry.path);

	function click(e: MouseEvent, entry: StartEntry) {
		if (!onopen || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		onopen(entry);
	}

	function keydown(e: KeyboardEvent, entry: StartEntry) {
		if (e.key !== 'Delete' || !ondelete) return;
		e.preventDefault();
		ondelete(entry);
	}
</script>

<main class="mx-auto flex min-h-0 w-full max-w-4xl flex-col gap-6 overflow-y-auto p-4 sm:p-8">
	<p class="text-base-content/80 max-w-2xl">{tagline}</p>

	{#if !available}
		<div role="alert" class="alert alert-warning">{unsupported ?? t.start.unsupported}</div>
	{:else}
		<div class="flex flex-col gap-2">
			<div class="flex flex-wrap gap-2">{@render actions()}</div>
			{@render extra?.()}
		</div>

		<section class="flex flex-col gap-2" aria-labelledby="start-entries">
			<h2 id="start-entries" class="text-lg font-semibold">{heading ?? t.start.recent}</h2>
			<AccessNotice {tool} {onallowed} />
			{#if entries === null}
				<span class="loading loading-spinner opacity-60"></span>
			{:else if entries.length === 0}
				<p class="opacity-70">{empty}</p>
			{:else}
				<ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each entries as entry (entry.path)}
						{@const name = nameOf(entry)}
						{@const kind = entry.kind ?? 'file'}
						<li
							class="bg-base-100 border-base-300 rounded-box hover:bg-base-200 flex items-center border"
							oncontextmenu={(e) => openContextMenu(e, menu(entry))}
						>
								<a
									class="flex min-w-0 flex-1 items-center gap-3 p-3"
									href={href(entry)}
									title={displayPath(entry.path, t.root)}
									onclick={(e) => click(e, entry)}
									onkeydown={(e) => keydown(e, entry)}
								>
									<FileIcon name={basename(entry.path)} {kind} />
									<span class="flex min-w-0 flex-col">
										<span class="truncate font-medium">{name}</span>
										<span class="truncate text-xs opacity-70">
											{[entry.detail, entry.modified ? formatDate(entry.modified) : null, displayPath(parent(entry.path), t.root)]
												.filter(Boolean)
												.join(' · ')}
										</span>
									</span>
								</a>
							<MoreButton {name} class="mr-1" entries={() => menu(entry)} />
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</main>
