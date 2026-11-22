<script lang="ts">
	// Stamps: the words (the PDF standard's to begin with; changed, removed and added to by the user) and the user's
	// own pictures ("My stamps": pictures, SVGs and PDFs). Both are kept with the files, so they are on every
	// device. A click chooses one for the stamp tool; own ones are added from the files, made of the selection or of
	// an area of a page, and deleted into the trash.
	import MoreButton from '@in-browser/brand/MoreButton.svelte';
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import { openContextMenu, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { chooseFile } from '@in-browser/files/dialog.svelte.js';
	import { showError } from '@in-browser/files/errors.js';
	import { read } from '@in-browser/files/fs.js';
	import { m } from '#lib/i18n/index.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';
	import { stampFromSelection } from '#lib/model/stamp-actions.js';
	import { choosePdfPage, editWord } from '#lib/model/stamp-dialogs.svelte.js';
	import { defaultWords, wordText, type StampWord } from '#lib/model/stamp-words.js';
	import { addStamp, customStamps, loadStamps, loadWords, removeStamp, saveWords, STAMP_TYPES, stampThumbnail, stampWords } from '#lib/model/stamps.svelte.js';
	import { choose, setStamp, stampChoice, tools } from '#lib/model/tools.svelte.js';

	let { context, close }: PanelProps<EditorState> = $props();

	void loadStamps();
	void loadWords();

	const editable = $derived(context.doc?.editable === 'yes');
	const stamping = $derived(tools.tool === 'stamp');

	function pick(choice: Parameters<typeof setStamp>[0]) {
		setStamp(choice);
		choose('stamp');
		if (matchMedia('(pointer: coarse), (max-width: 639px)').matches) close();
	}

	/** Shows a stamp: a PDF drawn, any other picture as its file (small, read as a whole) */
	const picture = (path: string) => (canvas: HTMLCanvasElement) => {
		let gone = false;
		const draw = (source: CanvasImageSource, width: number, height: number) => {
			if (gone || !width || !height) return;
			const k = Math.min(1, 320 / Math.max(width, height));
			canvas.width = Math.max(1, Math.round(width * k));
			canvas.height = Math.max(1, Math.round(height * k));
			canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
		};
		(async () => {
			const bitmap = await stampThumbnail(path);
			if (bitmap) {
				draw(bitmap, bitmap.width, bitmap.height);
				bitmap.close();
				return;
			}
			const url = URL.createObjectURL(await read(path));
			try {
				const img = new Image();
				img.src = url;
				await img.decode();
				draw(img, img.naturalWidth, img.naturalHeight);
			} finally {
				URL.revokeObjectURL(url);
			}
		})().catch((e) => console.warn('[pdf-editor] stamp picture', e));
		return () => {
			gone = true;
		};
	};

	/** A file becomes a stamp of "My stamps" and is the one placed next */
	async function add() {
		const from = await chooseFile({ mode: 'open', folder: '/', accept: STAMP_TYPES, title: m.stamps.addTitle });
		if (!from) return;
		try {
			const which = await choosePdfPage(from);
			if (!which) return;
			const path = await addStamp(from, which.page, which.pages);
			if (editable) pick({ custom: path });
		} catch (e) {
			showError(e, { context: '[pdf-editor] stamp' });
		}
	}

	async function keepWords(words: StampWord[], undo?: { text: string }) {
		const before = stampWords.list;
		try {
			await saveWords(words);
			if (undo) toast(undo.text, 'info', 8000, { label: m.stamps.undo, run: () => void saveWords(before).catch((e) => showError(e, { context: '[pdf-editor] stamp words' })) });
		} catch (e) {
			showError(e, { context: '[pdf-editor] stamp words' });
		}
	}
	const wordMenu = (word: StampWord): MenuEntry[] => [
		{ label: m.stamps.editWord, icon: 'icon-[material-symbols-light--edit-outline]', disabled: stampWords.locked, run: () => editWord(word) },
		{
			label: m.stamps.removeWord,
			icon: 'icon-[material-symbols-light--delete-outline]',
			disabled: stampWords.locked || stampWords.list.length < 2,
			run: () => void keepWords(stampWords.list.filter((w) => w.id !== word.id), { text: m.stamps.wordRemoved(wordText(word, m.stamps.names)) })
		}
	];
</script>

<div class="flex flex-col gap-3 p-2">
	<div class="flex flex-wrap gap-1">
		<button class="btn btn-sm" onclick={() => void add()} title={m.stamps.addTip}>
			<span class="icon-[material-symbols-light--add] size-5" aria-hidden="true"></span>{m.stamps.add}
		</button>
		<button class="btn btn-sm" onclick={() => stampFromSelection(context)} disabled={!context.selection?.count} title={m.stamps.fromSelectionTip}>
			<span class="icon-[material-symbols-light--select-all] size-5" aria-hidden="true"></span>{m.stamps.fromSelection}
		</button>
		<button class="btn btn-sm" class:btn-active={tools.tool === 'capture'} onclick={() => choose('capture')} disabled={!context.doc} title={m.stamps.fromAreaTip}>
			<span class="icon-[material-symbols-light--screenshot-region] size-5" aria-hidden="true"></span>{m.stamps.fromArea}
		</button>
	</div>

	<section class="flex flex-col gap-1">
		<h3 class="text-xs font-semibold opacity-70">{m.stamps.mineTitle}</h3>
		{#if customStamps.list.length}
			<ul class="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
				<!-- Another picture under the same name is another stamp: drawn anew -->
				{#each customStamps.list as stamp (`${stamp.path}|${stamp.modified}`)}
					{@const chosen = stamping && stampChoice.custom === stamp.path}
					<li class={['border-base-300 flex flex-col rounded border', chosen && 'bg-selection/20']}>
						<button class="hover:bg-base-200 flex flex-1 flex-col items-center gap-1 rounded-t p-1.5" onclick={() => pick({ custom: stamp.path })} disabled={!editable} title={m.stamps.use(stamp.name)} aria-pressed={chosen}>
							<!-- A picture of the user: on white, as on a page -->
							<canvas class="h-16 w-full rounded bg-white object-contain" {@attach picture(stamp.path)}></canvas>
							<span class="w-full truncate text-center text-xs">{stamp.name}</span>
						</button>
						<button class="btn btn-ghost btn-xs rounded-t-none" onclick={() => void removeStamp(stamp.path)} title={m.stamps.remove(stamp.name)} aria-label={m.stamps.remove(stamp.name)}>
							<span class="icon-[material-symbols-light--delete-outline] size-4" aria-hidden="true"></span>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm opacity-70">{m.stamps.none}</p>
		{/if}
	</section>

	<section class="flex flex-col gap-1">
		<h3 class="text-xs font-semibold opacity-70">{m.stamps.words}</h3>
		<ul class="flex flex-col gap-1">
			{#each stampWords.list as word (word.id)}
				{@const chosen = stamping && !stampChoice.custom && stampChoice.word === word.id}
				{@const text = wordText(word, m.stamps.names)}
				<li class={['flex items-center rounded', chosen && 'bg-selection/20']} oncontextmenu={(e) => openContextMenu(e, wordMenu(word))}>
					<button class="hover:bg-base-200 flex min-w-0 flex-1 items-center rounded p-1.5" onclick={() => pick({ word: word.id, custom: null })} disabled={!editable} title={m.stamps.use(text)} aria-pressed={chosen}>
						<!-- As on the page: its own color on white -->
						<span class="truncate rounded border-2 bg-white px-2 py-0.5 text-sm font-bold" style:color={word.color} style:border-color={word.color}>{text}</span>
					</button>
					<MoreButton name={text} entries={() => wordMenu(word)} />
				</li>
			{/each}
		</ul>
		<div class="flex flex-wrap gap-1">
			<button class="btn btn-sm" onclick={() => editWord(null)} disabled={stampWords.locked} title={m.stamps.addWordTip}>
				<span class="icon-[material-symbols-light--add] size-5" aria-hidden="true"></span>{m.stamps.addWord}
			</button>
			<button class="btn btn-ghost btn-sm" onclick={() => void keepWords(defaultWords(), { text: m.stamps.wordsReset })} disabled={stampWords.locked} title={m.stamps.resetWordsTip}>
				<span class="icon-[material-symbols-light--restart-alt] size-5" aria-hidden="true"></span>{m.stamps.resetWords}
			</button>
		</div>
		{#if stampWords.locked}
			<p class="text-sm opacity-70">{m.stamps.wordsNewer}</p>
		{/if}
		<fieldset class="flex flex-col gap-1 p-1.5 text-sm">
			<legend class="mb-1 text-xs font-semibold opacity-70">{m.stamps.lineBelow}</legend>
			<label class="flex items-center gap-2">
				<input type="checkbox" class="checkbox checkbox-sm" checked={stampChoice.withName} onchange={(e) => setStamp({ withName: e.currentTarget.checked })} />
				{m.stamps.withName}
			</label>
			<label class="flex items-center gap-2">
				<input type="checkbox" class="checkbox checkbox-sm" checked={stampChoice.withDate} onchange={(e) => setStamp({ withDate: e.currentTarget.checked })} />
				{m.stamps.withDate}
			</label>
			<label class="flex items-center gap-2">
				<input type="checkbox" class="checkbox checkbox-sm" checked={stampChoice.withTime} onchange={(e) => setStamp({ withTime: e.currentTarget.checked })} />
				{m.stamps.withTime}
			</label>
		</fieldset>
	</section>
</div>
