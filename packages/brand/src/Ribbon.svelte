<script lang="ts">
	// The ribbon of a tool, modeled on Microsoft Office and LibreOffice (see `ribbon.ts`): tabs with labeled groups of
	// commands below the BrandBar; quick commands (undo/redo) fixed left of the tabs; contextual tabs for the current
	// object after the others. Room runs out → groups shrink (large → medium → small → collapsed), always the same way
	// for the same width. Displays: classic, simplified (one row), tabs only (Ctrl+F1 or a double click on a tab).
	// Alt or F10 show access keys. On phones (coarse pointer or narrow) it is one bar in the same place: a tab picker and
	// a row of icon buttons that scrolls sideways (a long press names a command; on a split button it opens its menu).
	// The page places it as the first child of a flex column.
	import { MediaQuery } from 'svelte/reactivity';
	import { untrack } from 'svelte';
	import { shortcutLabel, type Command } from './commands.js';
	import { brandMessages } from './i18n/index.svelte.js';
	import {
		COLLAPSED,
		fitGroups,
		isCustom,
		keyTips,
		LARGE,
		MEDIUM,
		RIBBON_MODES,
		shrinkOrder,
		SMALL,
		type GroupSize,
		type RibbonGroup,
		type RibbonItem,
		type RibbonMode,
		type RibbonTab
	} from './ribbon.js';
	import { loadJson, storeJson } from './storage.js';
	import { openMenuBelow, type MenuEntry } from './ui/context-menu.svelte.js';
	import { coarsePointer } from './ui/pointer.svelte.js';
	import { toast } from './ui/toast.svelte.js';

	interface Props {
		tabs: RibbonTab[];
		/** Always visible left of the tabs (undo, redo) */
		quick?: Command[];
		/** The tool's storage prefix: display and tab are kept as `<storage>:ribbon` */
		storage: string;
		/** The tab shown until the user picks one (default: the first; “File” comes first but isn't where work starts) */
		initial?: string;
	}

	let { tabs, quick = [], storage, initial }: Props = $props();

	const t = $derived(brandMessages());
	const narrow = new MediaQuery('max-width: 639px', false);
	const phone = $derived(coarsePointer.current || narrow.current);

	const stored = untrack(() => loadJson<{ mode?: RibbonMode; tab?: string }>(`${storage}:ribbon`, {}));
	let mode = $state<RibbonMode>(stored.mode && RIBBON_MODES.includes(stored.mode) ? stored.mode : 'classic');
	let tabId = $state(stored.tab ?? untrack(() => initial) ?? '');
	/** Tabs only: the open tab's panel lies over the page */
	let open = $state(false);
	/** The tab before a contextual one opened by itself (back to it when the object is gone) */
	let before: string | null = null;

	const shown = $derived(tabs.filter((tab) => !tab.contextual || tab.visible?.()));
	const current = $derived(shown.find((tab) => tab.id === tabId) ?? shown[0]);

	function store() {
		storeJson(`${storage}:ribbon`, { mode, tab: current?.contextual ? (before ?? shown[0]?.id) : current?.id });
	}

	function select(id: string) {
		if (id === current?.id && mode === 'tabs') {
			open = !open;
			return;
		}
		// Opening a contextual tab by hand: back to this one when it goes
		const to = shown.find((tab) => tab.id === id);
		if (to?.contextual) before = current?.contextual ? before : (current?.id ?? null);
		else before = null;
		tabId = id;
		if (mode === 'tabs') open = true;
		store();
	}

	function setMode(next: RibbonMode) {
		mode = next;
		open = false;
		store();
	}

	// A contextual tab: phones switch to it when it appears (Office mobile does; unless it says not to), every ribbon
	// leaves it when it goes – for the one that came instead (the object changed its kind) or the tab before
	let seen = new Set<string>();
	$effect(() => {
		const contextual = shown.filter((tab) => tab.contextual);
		untrack(() => {
			const appeared = contextual.find((tab) => !seen.has(tab.id));
			seen = new Set(contextual.map((tab) => tab.id));
			const gone = !shown.some((tab) => tab.id === tabId);
			const wasContextual = !!tabs.find((tab) => tab.id === tabId)?.contextual;
			if (gone && wasContextual && appeared) tabId = appeared.id;
			else if (appeared && phone && appeared.follow?.() !== false) {
				before = current?.contextual ? before : (current?.id ?? null);
				tabId = appeared.id;
			} else if (gone && before) {
				tabId = before;
				before = null;
			}
		});
	});

	// --- Fitting the groups ---

	let panel = $state<HTMLElement>();
	let measure = $state<HTMLElement>();
	let available = $state(0);
	/** Measured widths per group of the current tab: [large, medium, small, collapsed] */
	let widths = $state.raw<number[][]>([]);
	const GAP = 9;

	const sizes = $derived.by((): GroupSize[] => {
		const groups = current?.groups ?? [];
		if (widths.length !== groups.length || !available) return groups.map(() => LARGE);
		return fitGroups(widths, available, shrinkOrder(groups.length), GAP);
	});

	$effect(() => {
		if (!panel) return;
		const observer = new ResizeObserver(() => (available = panel!.clientWidth));
		observer.observe(panel);
		return () => observer.disconnect();
	});

	// Measure when the tab, the display or the fonts change (labels are fixed for a tool's lifetime)
	$effect(() => {
		void current;
		void mode;
		void phone;
		if (!measure) return;
		const el = measure;
		const run = () => {
			const groups = [...el.querySelectorAll<HTMLElement>(':scope > [data-group]')];
			const rows = new Map<number, number[]>();
			for (const g of groups) {
				const index = Number(g.dataset.group);
				const row = rows.get(index) ?? [0, 0, 0, 0];
				row[Number(g.dataset.size)] = Math.ceil(g.getBoundingClientRect().width);
				rows.set(index, row);
			}
			widths = [...rows.keys()].sort((a, b) => a - b).map((i) => rows.get(i)!);
		};
		const frame = requestAnimationFrame(run);
		document.fonts?.ready.then(() => requestAnimationFrame(run));
		return () => cancelAnimationFrame(frame);
	});

	// --- A collapsed group opens over the page ---

	let popover = $state<{ id: string; x: number; y: number } | null>(null);

	const openGroupOf = $derived(popover && current?.groups.find((group) => group.id === popover!.id));

	function openGroup(e: MouseEvent, group: RibbonGroup) {
		e.stopPropagation();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		popover = popover?.id === group.id ? null : { id: group.id, x: rect.left, y: rect.bottom + 2 };
	}

	// --- Running commands ---

	const enabled = (c: Command) => c.enabled?.() !== false;

	function run(c: Command) {
		if (!enabled(c)) return;
		popover = null;
		if (mode === 'tabs') open = false;
		c.run?.();
	}

	function openMenu(e: MouseEvent, c: Command) {
		const entries: MenuEntry[] = c.menu?.() ?? [];
		popover = null;
		openMenuBelow(e, entries);
	}

	function title(c: Command): string {
		const keys = c.shortcut ? ` (${shortcutLabel(c.shortcut, t.keys)})` : '';
		return c.tip ? `${c.label}${keys} – ${c.tip}` : `${c.label}${keys}`;
	}

	// --- Access keys (Alt, F10) ---

	/** null: off; `tabs`: letters on the tabs; `commands`: letters on the current tab's commands */
	let tips = $state<null | 'tabs' | 'commands'>(null);
	let typed = $state('');
	const tabTips = $derived(keyTips(shown.map((tab) => tab.label), quick.map((_, i) => String(i + 1))));
	const commandItems = $derived(
		(current?.groups ?? []).flatMap((g, i): (Command | RibbonGroup)[] => (sizes[i] === COLLAPSED ? [g] : g.items.filter((it): it is Command => !isCustom(it))))
	);
	const commandTips = $derived(keyTips(commandItems.map((c) => c.label)));

	function tipOf(item: Command | RibbonGroup): string | null {
		if (tips !== 'commands') return null;
		const i = commandItems.indexOf(item);
		return i < 0 ? null : commandTips[i];
	}

	$effect(() => {
		if (phone) return;
		let alone = false;
		const down = (e: KeyboardEvent) => {
			if (e.key === 'F1' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				setMode(mode === 'tabs' ? 'classic' : 'tabs');
				return;
			}
			if (e.key === 'Alt') {
				alone = !e.repeat && !e.ctrlKey && !e.shiftKey && !e.metaKey;
				return;
			}
			alone = false;
			if (e.key === 'F10' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
				e.preventDefault();
				tips = tips ? null : 'tabs';
				typed = '';
				return;
			}
			if (!tips) return;
			if (e.key === 'Escape') {
				e.preventDefault();
				tips = tips === 'commands' ? 'tabs' : null;
				typed = '';
				if (!tips) open = false;
				return;
			}
			if (e.key.length !== 1 || e.ctrlKey || e.metaKey) return;
			e.preventDefault();
			typed += e.key.toUpperCase();
			if (tips === 'tabs') {
				const q = quick.findIndex((_, i) => String(i + 1) === typed);
				if (q >= 0) {
					tips = null;
					run(quick[q]);
				} else {
					const i = tabTips.findIndex((tip) => tip === typed);
					if (i >= 0) {
						select(shown[i].id);
						if (mode === 'tabs') open = true;
						tips = 'commands';
					} else if (!tabTips.some((tip) => tip.startsWith(typed))) tips = null;
				}
				if (tips !== 'tabs') typed = '';
				return;
			}
			const i = commandTips.findIndex((tip) => tip === typed);
			if (i >= 0) {
				const item = commandItems[i];
				tips = null;
				typed = '';
				if ('items' in item) {
					const button = panel?.querySelector<HTMLElement>(`[data-group-button="${item.id}"]`);
					button?.click();
				} else if (item.run) run(item);
				else panel?.querySelector<HTMLElement>(`[data-command="${item.id}"]`)?.click();
			} else if (!commandTips.some((tip) => tip.startsWith(typed))) {
				tips = null;
				typed = '';
			}
		};
		const up = (e: KeyboardEvent) => {
			if (e.key === 'Alt' && alone) {
				e.preventDefault();
				tips = tips ? null : 'tabs';
				typed = '';
			}
			alone = false;
		};
		const away = () => {
			tips = null;
			alone = false;
		};
		window.addEventListener('keydown', down);
		window.addEventListener('keyup', up);
		window.addEventListener('pointerdown', away);
		window.addEventListener('blur', away);
		return () => {
			window.removeEventListener('keydown', down);
			window.removeEventListener('keyup', up);
			window.removeEventListener('pointerdown', away);
			window.removeEventListener('blur', away);
		};
	});

	// Tabs only, or a collapsed group open: a press elsewhere or Esc closes it
	let root = $state<HTMLElement>();
	$effect(() => {
		if (!open && !popover) return;
		const close = (e: Event) => {
			if (e instanceof KeyboardEvent ? e.key !== 'Escape' : root?.contains(e.target as Node)) return;
			open = false;
			popover = null;
		};
		window.addEventListener('pointerdown', close);
		window.addEventListener('keydown', close);
		return () => {
			window.removeEventListener('pointerdown', close);
			window.removeEventListener('keydown', close);
		};
	});

	/** Arrow keys move between the buttons of the panel (one tab stop for the whole toolbar would be next) */
	function arrows(e: KeyboardEvent) {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		const buttons = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not(:disabled)')].filter((b) => b.offsetParent);
		const i = buttons.indexOf(document.activeElement as HTMLElement);
		if (i < 0) return;
		e.preventDefault();
		buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length].focus();
	}

	function displayMenu(e: MouseEvent) {
		openMenuBelow(
			e,
			RIBBON_MODES.map((m) => ({
				label: t.ribbon.modes[m],
				icon: m === mode ? 'icon-[material-symbols-light--check]' : undefined,
				run: () => setMode(m)
			}))
		);
	}

	/** Phones: a long press on a command names it (buttons show icons only); a split button opens its menu too */
	function explain(e: MouseEvent, c: Command) {
		e.preventDefault();
		if (c.run && c.menu) openMenu(e, c);
		else toast(c.label, 'info', 2000);
	}

	function tabMenu(e: MouseEvent) {
		openMenuBelow(
			e,
			shown.map((tab) => ({ label: tab.label, icon: tab.id === current?.id ? 'icon-[material-symbols-light--check]' : undefined, run: () => select(tab.id) }))
		);
	}
</script>

{#snippet tip(text: string | null)}
	{#if text}
		<kbd class="kbd kbd-xs bg-base-content text-base-100 pointer-events-none absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 border-0">{text}</kbd>
	{/if}
{/snippet}

{#snippet command(c: Command, size: GroupSize, inMenu = false)}
	{@const on = c.active?.() ?? false}
	{@const off = !enabled(c)}
	{@const big = mode === 'classic' && size === LARGE && !inMenu}
	{@const iconOnly = size === SMALL && !inMenu}
	{@const look = big
		? 'btn btn-ghost h-auto min-h-14 max-w-24 flex-col justify-start gap-0.5 px-1.5 py-1 text-xs leading-tight font-normal'
		: iconOnly
			? 'btn btn-ghost btn-sm btn-square'
			: 'btn btn-ghost btn-sm justify-start gap-1.5 px-2 font-normal'}
	{#if c.run && c.menu}
		<div class={['join relative', big && 'flex-col']}>
			<button
				class={[look, 'join-item', on && 'btn-active', big && 'rounded-b-none']}
				disabled={off}
				aria-pressed={c.active ? on : undefined}
				title={title(c)}
				aria-label={iconOnly ? c.label : undefined}
				data-command={c.id}
				onclick={() => run(c)}
			>
				<span class={[c.icon, big ? 'size-7' : 'size-5', 'shrink-0']} aria-hidden="true"></span>
				{#if !iconOnly}<span class={big ? 'line-clamp-2 text-center' : 'truncate'}>{c.label}</span>{/if}
			</button>
			<button
				class={['btn btn-ghost join-item px-0 font-normal', big ? 'btn-xs h-4 min-h-4 rounded-t-none' : 'btn-sm w-4']}
				disabled={off}
				title={c.label}
				aria-label={`${c.label}: ${t.ribbon.more}`}
				onclick={(e) => openMenu(e, c)}
			>
				<span class="icon-[material-symbols-light--arrow-drop-down] size-4" aria-hidden="true"></span>
			</button>
			{@render tip(tipOf(c))}
		</div>
	{:else}
		<button
			class={[look, 'relative', on && 'btn-active']}
			disabled={off}
			aria-pressed={c.active ? on : undefined}
			aria-haspopup={c.menu ? 'menu' : undefined}
			title={title(c)}
			aria-label={iconOnly ? c.label : undefined}
			data-command={c.id}
			onclick={(e) => (c.run ? run(c) : openMenu(e, c))}
		>
			<span class={[c.icon, big ? 'size-7' : 'size-5', 'shrink-0']} aria-hidden="true"></span>
			{#if !iconOnly}<span class={big ? 'line-clamp-2 text-center' : 'truncate'}>{c.label}</span>{/if}
			{#if c.menu && !iconOnly}<span class="icon-[material-symbols-light--arrow-drop-down] -ml-1 size-4 shrink-0" aria-hidden="true"></span>{/if}
			{@render tip(tipOf(c))}
		</button>
	{/if}
{/snippet}

{#snippet item(it: RibbonItem, size: GroupSize, inMenu = false)}
	{#if isCustom(it)}
		<!-- Custom items get the look commands have: large only in the classic display -->
		{@render it.custom(inMenu || (mode !== 'classic' && size === LARGE) ? MEDIUM : size)}
	{:else}
		{@render command(it, size, inMenu)}
	{/if}
{/snippet}

{#snippet group(g: RibbonGroup, size: GroupSize, index: number, measuring = false)}
	{@const first = g.items.find((it) => !isCustom(it)) as Command | undefined}
	{#if size === COLLAPSED}
		<div class="relative flex shrink-0" data-group={measuring ? index : undefined} data-size={size}>
			<button
				class={mode === 'classic'
					? 'btn btn-ghost h-auto min-h-14 max-w-24 flex-col gap-0.5 px-1.5 py-1 text-xs leading-tight font-normal'
					: 'btn btn-ghost btn-sm gap-1 px-2 font-normal'}
				aria-haspopup="true"
				aria-expanded={popover?.id === g.id}
				data-group-button={g.id}
				onclick={(e) => openGroup(e, g)}
			>
				{#if first}<span class={[first.icon, mode === 'classic' ? 'size-7' : 'size-5', 'shrink-0']} aria-hidden="true"></span>{/if}
				<span class="flex items-center">
					<span class="truncate">{g.label}</span><span class="icon-[material-symbols-light--arrow-drop-down] size-4 shrink-0" aria-hidden="true"></span>
				</span>
			</button>
			{@render tip(tipOf(g))}
		</div>
	{:else}
		<div
			class={['flex shrink-0', mode === 'classic' ? 'h-full flex-col' : 'items-center']}
			role="group"
			aria-label={g.label}
			data-group={measuring ? index : undefined}
			data-size={size}
		>
			<div
				class={[
					'flex-1',
					// Large commands top-aligned: icons and labels on one line, with or without an arrow below
					mode === 'classic' && size === LARGE
						? 'flex items-start gap-0.5'
						: mode !== 'classic'
							? 'flex items-center gap-0.5'
							: 'grid grid-flow-col grid-rows-3 content-center items-center gap-x-0.5'
				]}
			>
				{#each g.items as it (it.id)}
					{@render item(it, mode !== 'classic' && size === MEDIUM ? LARGE : size)}
				{/each}
			</div>
			{#if mode === 'classic'}
				<div class="flex h-4 items-center justify-center gap-1 text-[11px] leading-none opacity-60">
					<span class="truncate">{g.label}</span>
					{#if g.launcher}
						{@const launcher = g.launcher}
						<button class="btn btn-ghost btn-xs h-4 min-h-4 w-4 p-0" title={launcher.label} aria-label={launcher.label} onclick={() => run(launcher)}>
							<span class="icon-[material-symbols-light--south-east] size-3.5" aria-hidden="true"></span>
						</button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet groups(measuring = false)}
	{#each current?.groups ?? [] as g, i (g.id)}
		{#if measuring}
			{#each [LARGE, MEDIUM, SMALL, COLLAPSED] as size (size)}
				{@render group(g, size as GroupSize, i, true)}
			{/each}
		{:else}
			{#if i > 0}<div class={['bg-base-content/15 w-px shrink-0', mode === 'classic' ? 'my-1 self-stretch' : 'h-6']} aria-hidden="true"></div>{/if}
			{@render group(g, sizes[i] ?? LARGE, i)}
		{/if}
	{/each}
{/snippet}

{#if phone}
	<!-- Phones: one bar – the tab picker, quick commands, then the tab's commands as icons (scrolls sideways) -->
	<div class="border-base-300 bg-base-100 flex shrink-0 items-stretch border-b" role="toolbar" aria-label={t.ribbon.label} data-testid="ribbon">
		<button
			class={['btn btn-ghost h-auto min-h-11 max-w-20 shrink-0 gap-0 rounded-none px-1.5 text-xs font-normal', current?.contextual && 'text-selection bg-selection/15']}
			onclick={tabMenu}
			aria-haspopup="menu"
			aria-label={t.ribbon.tabs}
		>
			<span class="truncate">{current?.label}</span><span class="icon-[material-symbols-light--arrow-drop-down] size-5 shrink-0" aria-hidden="true"></span>
		</button>
		{#each quick as c (c.id)}
			<button
				class="btn btn-ghost btn-square h-auto min-h-11 w-11 shrink-0 rounded-none"
				disabled={!enabled(c)}
				aria-label={c.label}
				onclick={() => run(c)}
				oncontextmenu={(e) => explain(e, c)}
			>
				<span class={[c.icon, 'size-6']} aria-hidden="true"></span>
			</button>
		{/each}
		<div class="bg-base-content/15 my-2 w-px shrink-0" aria-hidden="true"></div>
		<div class="flex min-w-0 flex-1 items-stretch overflow-x-auto">
			{#each current?.groups ?? [] as g (g.id)}
				{#each g.items as it (it.id)}
					{#if isCustom(it)}
						<div class="flex shrink-0 items-center px-1">{@render it.custom(SMALL)}</div>
					{:else}
						{@const c = it}
						<button
							class={['btn btn-ghost btn-square relative h-auto min-h-11 w-11 shrink-0 rounded-none', c.active?.() && 'btn-active']}
							disabled={!enabled(c)}
							aria-label={c.label}
							aria-pressed={c.active ? (c.active() ?? false) : undefined}
							data-command={c.id}
							onclick={(e) => (c.run ? run(c) : openMenu(e, c))}
							oncontextmenu={(e) => explain(e, c)}
						>
							<span class={[c.icon, 'size-6']} aria-hidden="true"></span>
							{#if c.menu}<span class="icon-[material-symbols-light--arrow-drop-down] absolute right-0 bottom-0 size-3.5 opacity-60" aria-hidden="true"></span>{/if}
						</button>
					{/if}
				{/each}
			{/each}
		</div>
	</div>
{:else}
	<div bind:this={root} class="border-base-300 bg-base-100 relative z-20 shrink-0 border-b" data-testid="ribbon">
		<!-- Tabs, with the quick commands before them -->
		<div class="flex h-8 items-end gap-0.5 px-2">
			{#each quick as c, i (c.id)}
				<button class="btn btn-ghost btn-xs btn-square relative mb-0.5" disabled={!enabled(c)} title={title(c)} aria-label={c.label} onclick={() => run(c)}>
					<span class={[c.icon, 'size-5']} aria-hidden="true"></span>
					{@render tip(tips === 'tabs' ? String(i + 1) : null)}
				</button>
			{/each}
			{#if quick.length}<div class="bg-base-content/15 mx-1 mb-1.5 h-4 w-px" aria-hidden="true"></div>{/if}
			<div class="flex min-w-0 items-end gap-0.5 overflow-x-auto" role="tablist" aria-label={t.ribbon.tabs}>
				{#each shown as tab, i (tab.id)}
					{@const selected = tab.id === current?.id && (mode !== 'tabs' || open)}
					<button
						class={[
							'relative shrink-0 rounded-t px-3 py-1 text-sm whitespace-nowrap',
							tab.contextual
								? ['text-selection border-selection border-t-2', selected ? 'bg-selection/25 font-medium' : 'bg-selection/10 hover:bg-selection/20']
								: selected
									? 'bg-base-200 font-medium'
									: 'hover:bg-base-200/60'
						]}
						role="tab"
						aria-selected={tab.id === current?.id}
						data-tab={tab.id}
						onclick={() => select(tab.id)}
						ondblclick={() => setMode(mode === 'tabs' ? 'classic' : 'tabs')}
					>
						{tab.label}
						{@render tip(tips === 'tabs' ? tabTips[i] : null)}
					</button>
				{/each}
			</div>
			<div class="flex-1"></div>
			<button class="btn btn-ghost btn-xs mb-0.5 gap-0.5 font-normal" onclick={displayMenu} title={t.ribbon.display} aria-label={t.ribbon.display} aria-haspopup="menu">
				<span class="icon-[material-symbols-light--toolbar-outline] size-5" aria-hidden="true"></span>
				<span class="icon-[material-symbols-light--arrow-drop-down] size-4" aria-hidden="true"></span>
			</button>
			<button
				class="btn btn-ghost btn-xs btn-square mb-0.5"
				onclick={() => setMode(mode === 'tabs' ? 'classic' : 'tabs')}
				title={mode === 'tabs' ? t.ribbon.expand : t.ribbon.collapse}
				aria-label={mode === 'tabs' ? t.ribbon.expand : t.ribbon.collapse}
			>
				<span class={[mode === 'tabs' ? 'icon-[material-symbols-light--keyboard-arrow-down]' : 'icon-[material-symbols-light--keyboard-arrow-up]', 'size-5']} aria-hidden="true"></span>
			</button>
		</div>
		<!-- The current tab's groups; tabs only: over the page while open -->
		{#if mode !== 'tabs' || open}
			<div
				bind:this={panel}
				class={[
					'bg-base-200 flex items-stretch overflow-x-auto overflow-y-hidden px-1',
					mode === 'simplified' ? 'h-10 gap-1' : 'h-[5.75rem] gap-1 py-1',
					mode === 'tabs' && 'border-base-300 absolute inset-x-0 top-full border-b shadow-lg'
				]}
				role="toolbar"
				tabindex="-1"
				aria-label={current?.label}
				onkeydown={arrows}
			>
				{@render groups()}
			</div>
		{/if}
		<!-- Each group at every size, invisible, to know their widths (clipped: it is wider than the window) -->
		<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" inert>
			<div bind:this={measure} class={['invisible absolute top-0 left-0 flex w-max items-stretch', mode === 'simplified' ? 'h-10' : 'h-[5.75rem] py-1']}>
				{@render groups(true)}
			</div>
		</div>
		{#if popover && openGroupOf}
			{@const g = openGroupOf}
			<div
				class="bg-base-100 border-base-300 fixed z-40 flex h-[5.75rem] items-stretch rounded border p-1 shadow-lg"
				style="left: {Math.min(popover.x, innerWidth - 320)}px; top: {popover.y}px"
				role="group"
				aria-label={g.label}
			>
				<div class="flex flex-col">
					<div class="grid flex-1 grid-flow-col grid-rows-3 content-center items-center gap-x-0.5">
						{#each g.items as it (it.id)}
							{@render item(it, MEDIUM, true)}
						{/each}
					</div>
					<div class="h-4 text-center text-[11px] leading-none opacity-60">{g.label}</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
