<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { redo, undo } from '@codemirror/commands';
	import { gotoLine, openSearchPanel } from '@codemirror/search';
	import type { EditorView } from '@codemirror/view';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { brandBar, setBrandBar, startRename } from '@in-browser/brand/brand-bar.svelte.js';
	import CommitLink from '@in-browser/brand/CommitLink.svelte';
	import { openMenuBelow, type MenuAction, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import FileIcon from '@in-browser/files/FileIcon.svelte';
	import { supported, watch } from '@in-browser/files/fs.js';
	import { TEXT_EXTENSIONS } from '@in-browser/files/kinds.js';
	import { basename, normalize, parent } from '@in-browser/files/path.js';
	import { BRAND } from '#lib/brand.js';
	import Editor from '#lib/components/Editor.svelte';
	import MarkdownPreview from '#lib/components/MarkdownPreview.svelte';
	import StatusBar from '#lib/components/StatusBar.svelte';
	import TabBar from '#lib/components/TabBar.svelte';
	import { bold, codeBlock, inlineCode, insertLink, italic, openReplace, toggleLinePrefix } from '#lib/editor/commands.js';
	import { isMarkdown } from '#lib/editor/languages.js';
	import { m } from '#lib/i18n/index.js';
	import { encodingName, FONT_SIZES, Workspace, type Tab } from '#lib/workspace.svelte.js';

	const workspace = new Workspace();
	const active = $derived(workspace.active);
	const markdown = $derived(!!active && isMarkdown(active.name));
	let ready = $state(false);
	let dropping = $state(false);
	let fileInput = $state<HTMLInputElement>();

	onMount(() => {
		if (!supported()) return;
		const stop = watch((paths) => workspace.changed(paths));
		// Pending saves and drafts go out before the page is hidden or closed
		const flush = () => workspace.flush();
		const hidden = () => document.visibilityState === 'hidden' && flush();
		document.addEventListener('visibilitychange', hidden);
		window.addEventListener('pagehide', flush);
		workspace.restore().finally(() => (ready = true));
		return () => {
			stop();
			document.removeEventListener('visibilitychange', hidden);
			window.removeEventListener('pagehide', flush);
			flush();
		};
	});

	// `?path=` (e.g. from Files) opens that file; the parameter goes away so a reload doesn't bring back a closed tab
	$effect(() => {
		const path = page.url.searchParams.get('path');
		if (!ready || !path) return;
		untrack(async () => {
			await workspace.open(normalize(path));
			goto(resolve('/text-editor'), { replace: true, shallow: true });
		});
	});

	const run = (command: (view: EditorView) => boolean) => () => workspace.run(command);

	/** Every action once: the buttons next to the file name and the menu at the file name use the same entries */
	const cmd = $derived.by(() => {
		const tab = active;
		const history = tab?.history ?? { undo: 0, redo: 0 };
		return {
			save: {
				label: tab?.path ? m.actions.save : m.actions.saveTo,
				icon: 'icon-[material-symbols-light--save-outline]',
				keys: 'Ctrl+S',
				run: () => tab && workspace.save(tab)
			},
			saveAs: {
				label: m.actions.saveAs,
				icon: 'icon-[material-symbols-light--save-as-outline]',
				keys: 'Ctrl+Shift+S',
				run: () => tab && workspace.save(tab, { as: true })
			},
			undo: { label: m.edit.undo, icon: 'icon-[material-symbols-light--undo]', keys: 'Ctrl+Z', disabled: !history.undo, run: run(undo) },
			redo: { label: m.edit.redo, icon: 'icon-[material-symbols-light--redo]', keys: 'Ctrl+Y', disabled: !history.redo, run: run(redo) },
			find: { label: m.edit.find, icon: 'icon-[material-symbols-light--search]', keys: 'Ctrl+F', run: run(openSearchPanel) },
			replace: { label: m.edit.replace, icon: 'icon-[material-symbols-light--find-replace]', keys: 'Ctrl+H', run: run(openReplace) },
			gotoLine: { label: m.edit.gotoLine, icon: 'icon-[material-symbols-light--move-down]', keys: 'Ctrl+G', run: run(gotoLine) },
			bold: { label: m.format.bold, icon: 'icon-[material-symbols-light--format-bold]', keys: 'Ctrl+B', run: run(bold) },
			italic: { label: m.format.italic, icon: 'icon-[material-symbols-light--format-italic]', keys: 'Ctrl+I', run: run(italic) },
			link: { label: m.format.link, icon: 'icon-[material-symbols-light--link]', keys: 'Ctrl+K', run: run(insertLink) },
			rename: { label: m.actions.rename, icon: 'icon-[material-symbols-light--edit-outline]', run: startRename },
			download: { label: m.actions.download, icon: 'icon-[material-symbols-light--download]', run: () => tab && workspace.download(tab) },
			showInFiles: {
				label: m.actions.showInFiles,
				icon: 'icon-[material-symbols-light--open-in-new]',
				run: () => tab && workspace.showInFiles(tab)
			},
			close: { label: m.actions.close, icon: 'icon-[material-symbols-light--close]', keys: 'Alt+W', run: () => tab && workspace.close(tab) }
		} satisfies Record<string, MenuAction>;
	});

	const paragraph: MenuEntry[] = [
		{ label: m.format.heading(1), icon: 'icon-[material-symbols-light--format-h1]', run: run(toggleLinePrefix('h1')) },
		{ label: m.format.heading(2), icon: 'icon-[material-symbols-light--format-h2]', run: run(toggleLinePrefix('h2')) },
		{ label: m.format.heading(3), icon: 'icon-[material-symbols-light--format-h3]', run: run(toggleLinePrefix('h3')) },
		{ separator: true },
		{ label: m.format.bulletList, icon: 'icon-[material-symbols-light--format-list-bulleted]', run: run(toggleLinePrefix('bullet')) },
		{ label: m.format.numberedList, icon: 'icon-[material-symbols-light--format-list-numbered]', run: run(toggleLinePrefix('number')) },
		{ label: m.format.taskList, icon: 'icon-[material-symbols-light--checklist]', run: run(toggleLinePrefix('task')) },
		{ separator: true },
		{ label: m.format.quote, icon: 'icon-[material-symbols-light--format-quote-outline]', run: run(toggleLinePrefix('quote')) },
		{ label: m.format.codeBlock, icon: 'icon-[material-symbols-light--code-blocks-outline]', run: run(codeBlock) },
		{ label: m.format.inlineCode, icon: 'icon-[material-symbols-light--code]', run: run(inlineCode) }
	];

	const openEntries: MenuEntry[] = [
		{ label: m.actions.openFromFiles, icon: 'icon-[material-symbols-light--folder-open-outline]', keys: 'Ctrl+O', run: () => workspace.openDialog() },
		{ label: m.actions.openFromComputer, icon: 'icon-[material-symbols-light--upload-file]', run: () => fileInput?.click() }
	];

	const CHECK = 'icon-[material-symbols-light--check]';
	const viewEntries = $derived<MenuEntry[]>([
		{ label: m.view.wrap, icon: workspace.wrap ? CHECK : undefined, run: () => workspace.setWrap(!workspace.wrap) },
		...(markdown ? [{ label: m.view.preview, icon: workspace.preview ? CHECK : undefined, run: () => workspace.setPreview(!workspace.preview) }] : []),
		{ separator: true },
		{
			label: m.view.fontLarger,
			icon: 'icon-[material-symbols-light--text-increase]',
			disabled: workspace.fontSize >= FONT_SIZES.max,
			run: () => workspace.setFontSize(workspace.fontSize + 1)
		},
		{
			label: m.view.fontSmaller,
			icon: 'icon-[material-symbols-light--text-decrease]',
			disabled: workspace.fontSize <= FONT_SIZES.min,
			run: () => workspace.setFontSize(workspace.fontSize - 1)
		},
		{
			label: m.view.fontReset,
			icon: 'icon-[material-symbols-light--format-size]',
			disabled: workspace.fontSize === FONT_SIZES.default,
			run: () => workspace.setFontSize(null)
		}
	]);

	/** Files with a place save themselves: how far that is; without a place a dot (and "Save …") */
	function statusOf(tab: Tab) {
		if (tab.conflict === 'deleted') return m.status.deleted;
		if (!tab.path) return tab.dirty ? '•' : undefined;
		if (tab.pending || tab.saving) return m.status.saving;
		return tab.dirty ? m.status.notSaved : m.status.saved;
	}

	// The active file with all its actions on the left of the BrandBar, the main ones as buttons right after it,
	// new/open/view on the right. Only rebuilt when the file changes (rebuilding would close the rename field);
	// the menu reads undo/redo live, the status follows in the effect below.
	$effect(() => {
		const tab = active;
		if (!tab) {
			const menu: MenuEntry[] = [
				{ label: m.actions.new, icon: 'icon-[material-symbols-light--note-add-outline]', keys: 'Alt+N', run: () => workspace.newTab() },
				...openEntries
			];
			return setBrandBar({ menu, actions: barActions });
		}
		const { name, path } = tab;
		const md = markdown;
		return untrack(() => {
			const c = cmd;
			const menu: MenuEntry[] = [
				c.save,
				c.saveAs,
				{ separator: true },
				{ ...c.undo, disabled: false },
				{ ...c.redo, disabled: false },
				{ separator: true },
				c.find,
				c.replace,
				c.gotoLine,
				...(md ? [{ separator: true } as const, { heading: m.format.title }, c.bold, c.italic, c.link, ...paragraph] : []),
				{ separator: true },
				...(path ? [c.rename] : []),
				c.download,
				...(path ? [c.showInFiles] : []),
				{ separator: true },
				c.close
			];
			return setBrandBar({
				crumbs: [{ label: name, status: statusOf(tab), rename: path ? (newName) => workspace.rename(tab, newName) : undefined, menu }],
				primary: barPrimary,
				actions: barActions
			});
		});
	});

	$effect(() => {
		const status = active ? statusOf(active) : undefined;
		untrack(() => {
			const crumb = brandBar.crumbs.at(-1);
			if (crumb && crumb.status !== status) crumb.status = status;
		});
	});

	function onKey(e: KeyboardEvent) {
		if (!ready || document.querySelector('dialog[open]')) return;
		const mod = e.ctrlKey || e.metaKey;
		const handled = () => e.preventDefault();
		if (mod && e.code === 'KeyS') return handled(), active && workspace.save(active, { as: e.shiftKey });
		if (mod && e.code === 'KeyO') return handled(), workspace.openDialog();
		// Ctrl+N/W belong to the browser
		if (e.altKey && !mod && e.code === 'KeyN') return handled(), workspace.newTab();
		if (e.altKey && !mod && e.code === 'KeyW') return handled(), active && workspace.close(active);
	}

	// Files from the computer: caught before CodeMirror, which would paste their content into the text
	const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

	function dragOver(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault();
		e.stopPropagation();
		e.dataTransfer!.dropEffect = 'copy';
		dropping = true;
	}

	function drop(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault();
		e.stopPropagation();
		dropping = false;
		// The items are only readable during the event
		const files: File[] = [];
		let folders = 0;
		for (const item of e.dataTransfer!.items) {
			if (item.kind !== 'file') continue;
			if (item.webkitGetAsEntry()?.isDirectory) folders++;
			else {
				const file = item.getAsFile();
				if (file) files.push(file);
			}
		}
		if (folders) toast(m.toasts.foldersSkipped(folders));
		workspace.openLocal(files);
	}
</script>

{#snippet tool(action: MenuAction)}
	<button
		class="btn btn-ghost btn-sm btn-square"
		disabled={action.disabled}
		onclick={action.run}
		title={action.keys ? `${action.label} (${action.keys})` : action.label}
		aria-label={action.label}
	>
		<span class="{action.icon} size-5" aria-hidden="true"></span>
	</button>
{/snippet}

{#snippet menuButton(label: string, icon: string, entries: MenuEntry[], showLabel = false)}
	<button class="btn btn-ghost btn-sm gap-0.5 px-1.5" onclick={(e) => openMenuBelow(e, entries)} title={label} aria-label={label}>
		<span class="{icon} size-5" aria-hidden="true"></span>
		{#if showLabel}<span class="ml-1 hidden lg:inline">{label}</span>{/if}
		<span class="icon-[material-symbols-light--keyboard-arrow-down] size-4 opacity-70" aria-hidden="true"></span>
	</button>
{/snippet}

{#snippet barPrimary()}
	{#if active}
		{#if !active.path}
			<button class="btn btn-primary btn-sm" onclick={cmd.save.run} title="{cmd.save.label} (Ctrl+S)">
				<span class="icon-[material-symbols-light--save-outline] size-5" aria-hidden="true"></span>
				{cmd.save.label}
			</button>
		{/if}
		{@render tool(cmd.undo)}
		{@render tool(cmd.redo)}
		{@render menuButton(m.edit.search, 'icon-[material-symbols-light--search]', [cmd.find, cmd.replace, cmd.gotoLine])}
		{#if markdown}
			<span class="bg-base-content/20 mx-1 h-5 w-px" aria-hidden="true"></span>
			{@render tool(cmd.bold)}
			{@render tool(cmd.italic)}
			{@render tool(cmd.link)}
			{@render menuButton(m.format.paragraph, 'icon-[material-symbols-light--format-paragraph]', paragraph)}
		{/if}
	{/if}
{/snippet}

{#snippet barActions()}
	<button class="btn btn-ghost btn-sm" onclick={() => workspace.newTab()} title="{m.actions.new} (Alt+N)">
		<span class="icon-[material-symbols-light--note-add-outline] size-5" aria-hidden="true"></span>
		<span class="hidden lg:inline">{m.actions.new}</span>
		<span class="sr-only lg:hidden">{m.actions.new}</span>
	</button>
	{@render menuButton(m.actions.open, 'icon-[material-symbols-light--folder-open-outline]', openEntries, true)}
	{#if active}
		{@render menuButton(m.view.title, 'icon-[material-symbols-light--visibility-outline]', viewEntries, true)}
	{/if}
{/snippet}

<svelte:window onkeydown={onKey} />

<input
	bind:this={fileInput}
	type="file"
	multiple
	hidden
	accept={TEXT_EXTENSIONS.join(',')}
	onchange={(e) => {
		workspace.openLocal([...(e.currentTarget.files ?? [])]);
		e.currentTarget.value = '';
	}}
/>

{#if !supported()}
	<div class="alert alert-error m-6">{m.home.unsupported}</div>
{:else if !ready}
	<div class="grid h-full place-items-center"><span class="loading loading-spinner"></span></div>
{:else}
	<div
		class="relative h-full"
		role="presentation"
		ondragovercapture={dragOver}
		ondragleave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && (dropping = false)}
		ondropcapture={drop}
	>
		{#if workspace.tabs.length === 0}
			<div class="h-full overflow-y-auto">
				<div class="mx-auto flex max-w-2xl flex-col gap-8 p-6 md:p-10">
					<p class="text-lg opacity-80">{m.home.tagline}</p>
					<div class="flex flex-col gap-2">
						<div class="flex flex-wrap gap-2">
							<button class="btn btn-primary" onclick={() => workspace.newTab()}>
								<span class="icon-[material-symbols-light--note-add-outline] size-5" aria-hidden="true"></span>
								{m.actions.new}
							</button>
							<button class="btn" onclick={() => workspace.openDialog()}>
								<span class="icon-[material-symbols-light--folder-open-outline] size-5" aria-hidden="true"></span>
								{m.actions.openFromFiles}
							</button>
							<button class="btn" onclick={() => fileInput?.click()}>
								<span class="icon-[material-symbols-light--upload-file] size-5" aria-hidden="true"></span>
								{m.actions.openFromComputer}
							</button>
						</div>
						<p class="text-sm opacity-60">{m.home.dropHint}</p>
					</div>
					<section>
						<h2 class="mb-2 font-semibold">{m.home.recent}</h2>
						{#if workspace.recent.length}
							<ul class="menu bg-base-200 rounded-box w-full">
								{#each workspace.recent as path (path)}
									<li>
										<button class="flex min-w-0" onclick={() => workspace.open(path)} title={path}>
											<FileIcon name={basename(path)} kind="file" />
											<span class="truncate">{basename(path)}</span>
											<span class="ml-auto truncate text-xs opacity-60">{m.home.inFolder(parent(path))}</span>
										</button>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="text-sm opacity-60">{m.home.noRecent}</p>
						{/if}
					</section>
					<p class="text-xs opacity-60">
						{m.brand.partOf} <a class="link link-hover" href={resolve('/')} data-sveltekit-reload>{BRAND.suite}</a> –
						{m.brand.suiteClaim}
						<br /><CommitLink />
					</p>
				</div>
			</div>
		{:else}
			<div class="flex h-full flex-col">
				<TabBar {workspace} />
				{#if active?.conflict}
					<div role="alert" class="alert alert-warning rounded-none py-2 text-sm">
						<span class="icon-[material-symbols-light--warning-outline] size-5" aria-hidden="true"></span>
						<span>{active.conflict === 'changed' ? m.conflict.changed(active.name) : m.conflict.deleted(active.name)}</span>
						<div class="flex gap-2">
							{#if active.conflict === 'changed'}
								<button class="btn btn-sm" onclick={() => workspace.reload(active)}>{m.conflict.reload}</button>
							{/if}
							<button class="btn btn-ghost btn-sm" onclick={() => workspace.keepMine(active)}>{m.conflict.keepMine}</button>
						</div>
					</div>
				{:else if active?.problem}
					<div role="alert" class="alert alert-warning rounded-none py-2 text-sm">
						<span class="icon-[material-symbols-light--warning-outline] size-5" aria-hidden="true"></span>
						<span>{m.problem.unmappable(active.problem.unmappable, encodingName(active.encoding))}</span>
						<button class="btn btn-sm" onclick={() => workspace.saveAsUtf8(active)}>{m.problem.asUtf8}</button>
					</div>
				{/if}
				<div class="flex min-h-0 flex-1">
					<div class="min-w-0 flex-1" style:--editor-font-size="{workspace.fontSize}px">
						<Editor {workspace} />
					</div>
					{#if active && markdown && workspace.preview}
						<div class="border-base-300 hidden min-w-0 flex-1 border-l md:block">
							<MarkdownPreview tab={active} />
						</div>
					{/if}
				</div>
				{#if active}
					<StatusBar {workspace} tab={active} />
				{/if}
			</div>
		{/if}
		{#if dropping}
			<div
				class="border-selection bg-base-300/80 rounded-box pointer-events-none absolute inset-2 z-10 grid place-items-center border-4 border-dashed"
			>
				<div class="flex flex-col items-center gap-2 text-lg font-semibold">
					<span class="icon-[material-symbols-light--upload-file] size-12" aria-hidden="true"></span>
					{m.drop.release}
				</div>
			</div>
		{/if}
	</div>
{/if}
