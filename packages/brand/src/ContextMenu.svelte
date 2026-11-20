<script lang="ts">
	import { contextMenu, installLongPress, type MenuAction, type MenuEntry } from './ui/context-menu.svelte.js';

	let menu: HTMLElement;
	let hovered: MenuAction | undefined;

	const isAction = (entry: MenuEntry): entry is MenuAction => 'run' in entry;

	function hover(entry: MenuAction | undefined) {
		if (entry === hovered) return;
		hovered?.onhover?.(false);
		hovered = entry;
		entry?.onhover?.(true);
	}

	function close() {
		hover(undefined);
		contextMenu.close();
	}

	function run(entry: MenuAction, e?: MouseEvent) {
		close();
		// Like a link: Ctrl/⌘+click opens where it leads in a new tab
		if (entry.href && e && (e.ctrlKey || e.metaKey)) window.open(entry.href, '_blank', 'noopener');
		else entry.run();
	}

	/** The middle mouse button on an entry with `href`: a new tab (not the browser's scrolling) */
	function middle(e: MouseEvent, entry: MenuAction) {
		if (e.button !== 1 || !entry.href) return;
		e.preventDefault();
		if (e.type !== 'auxclick') return;
		close();
		window.open(entry.href, '_blank', 'noopener');
	}

	const buttons = () => [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' || e.key === 'Tab') {
			e.preventDefault();
			e.stopPropagation();
			return close();
		}
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
		e.preventDefault();
		e.stopPropagation();
		const all = buttons();
		const i = all.indexOf(document.activeElement as HTMLButtonElement);
		const next =
			e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length;
		all[next]?.focus();
	}

	// Long press with a finger opens the context menu like a right click
	$effect(() => installLongPress());

	function place() {
		const { offsetWidth: w, offsetHeight: h } = menu;
		menu.style.left = `${Math.max(4, Math.min(contextMenu.x, window.innerWidth - w - 4))}px`;
		const top = contextMenu.above ? contextMenu.y - h : contextMenu.y;
		menu.style.top = `${Math.max(4, Math.min(top, window.innerHeight - h - 4))}px`;
	}

	// Popover in the top layer at the mouse position, shifted into the window; closes on anything outside.
	// Scrolling closes it only where it was opened (the page, or a box around that point) – not inside the menu, not
	// elsewhere (a bar that scrolls to a new tab); a resize (mobile URL bar, keyboard) only moves it back into the window.
	$effect(() => {
		if (!contextMenu.open) return;
		menu.showPopover();
		place();
		buttons()[0]?.focus({ preventScroll: true });
		const outside = (e: Event) => {
			if (!menu.contains(e.target as Node)) close();
		};
		window.addEventListener('pointerdown', outside, { capture: true });
		const scrolled = (e: Event) => {
			const target = e.target;
			if (target instanceof Element && target !== document.scrollingElement) {
				if (menu.contains(target)) return;
				const r = target.getBoundingClientRect();
				const { x, y } = contextMenu;
				if (x < r.left || x > r.right || y < r.top - 4 || y > r.bottom + 4) return;
			}
			close();
		};
		window.addEventListener('scroll', scrolled, { capture: true });
		window.addEventListener('resize', place);
		window.addEventListener('blur', close);
		return () => {
			window.removeEventListener('pointerdown', outside, { capture: true });
			window.removeEventListener('scroll', scrolled, { capture: true });
			window.removeEventListener('resize', place);
			window.removeEventListener('blur', close);
			if (menu.matches(':popover-open')) menu.hidePopover();
		};
	});
</script>

<div
	bind:this={menu}
	popover="manual"
	class="bg-base-100 text-base-content border-base-300 rounded-box m-0 max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-0.5rem)] min-w-52 overflow-y-auto border p-1 shadow-lg"
	role="menu"
	tabindex="-1"
	onkeydown={onKeyDown}
	oncontextmenu={(e) => e.preventDefault()}
>
	<ul class="menu menu-sm w-full p-0">
		{#each contextMenu.entries as entry, i (i)}
			{#if 'separator' in entry}
				<li class="border-base-300 my-1 border-t" role="separator"></li>
			{:else if 'heading' in entry}
				<li class="menu-title pt-1">{entry.heading}</li>
			{:else if isAction(entry)}
				<li>
					<button
						role="menuitem"
						disabled={entry.disabled}
						class={entry.disabled ? 'pointer-events-none opacity-40' : ''}
						onclick={(e) => run(entry, e)}
						onmousedown={(e) => middle(e, entry)}
						onauxclick={(e) => middle(e, entry)}
						onpointerenter={() => hover(entry)}
						onpointerleave={() => hover(undefined)}
						onfocus={() => hover(entry)}
					>
						{#if entry.glyph}
							<svg class="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
								{#each typeof entry.glyph === 'string' ? [entry.glyph] : entry.glyph as points, i (i)}
									<polyline {points} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
								{/each}
							</svg>
						{:else}
							<span class="{entry.icon ?? ''} size-4 shrink-0" aria-hidden="true"></span>
						{/if}
						<span class="min-w-0 flex-1 truncate">{entry.label}</span>
						{#if entry.checked}<span class="icon-[material-symbols-light--check] size-4 shrink-0" aria-hidden="true"></span>{/if}
						{#if entry.keys}<kbd class="kbd kbd-xs pointer-coarse:hidden">{entry.keys}</kbd>{/if}
					</button>
				</li>
			{/if}
		{/each}
	</ul>
</div>
