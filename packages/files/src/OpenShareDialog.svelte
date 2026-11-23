<script lang="ts">
	// Opening a share by its four words (`p2p/words.ts`): typed in either language, the word being typed is completed
	// from the lists. The sharing device hands the share's key over; then it opens like a link (`onopened` gets its
	// root path).
	import { onMount } from 'svelte';
	import Modal from '@in-browser/brand/Modal.svelte';
	import { FilesError } from './entry.js';
	import { filesErrorText, filesMessages } from './i18n/index.svelte.js';
	import { openShareByWords } from './sources/connections.svelte.js';
	import { completions, parseWords, wordLists, WORD_COUNT, type WordLists } from './p2p/words.js';

	let { onopened, onclose }: { onopened: (root: string) => void; onclose: () => void } = $props();

	const t = $derived(filesMessages().openShare);
	let text = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let lists = $state<WordLists | null>(null);
	let field = $state<HTMLInputElement>();

	onMount(() => {
		void wordLists().then((l) => (lists = l));
		field?.focus();
	});

	/** The word being typed (the last one, while no space follows it) */
	const typing = $derived(/\p{L}+$/u.exec(text)?.[0] ?? '');
	const words = $derived(text.split(/[^\p{L}]+/u).filter(Boolean));
	const suggestions = $derived(lists && typing && words.length <= WORD_COUNT ? completions(typing, lists, 5).filter((w) => w !== typing.toLowerCase()) : []);

	function complete(word: string) {
		text = `${text.slice(0, text.length - typing.length)}${word}${words.length < WORD_COUNT ? ' ' : ''}`;
		field?.focus();
	}

	async function open(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		if (!lists || !parseWords(text, lists)) {
			error = t.notWords;
			return;
		}
		busy = true;
		try {
			onopened(await openShareByWords(text));
		} catch (err) {
			error = err instanceof FilesError && err.code === 'ended' ? t.ended : err instanceof FilesError && err.code === 'offline' ? t.offline : filesErrorText(err);
		} finally {
			busy = false;
		}
	}
</script>

<Modal {onclose} {busy}>
	<form class="modal-box flex max-w-md flex-col gap-3" onsubmit={open}>
		<h3 class="text-lg font-bold">{t.title}</h3>
		<p class="text-sm">{t.intro}</p>
		<label class="flex flex-col gap-1">
			<span class="text-sm font-semibold">{t.label}</span>
			<input
				bind:this={field}
				bind:value={text}
				class="input w-full font-mono"
				autocomplete="off"
				autocapitalize="none"
				spellcheck="false"
				placeholder={t.placeholder}
				disabled={busy}
			/>
		</label>
		<div class="flex min-h-8 flex-wrap gap-1">
			{#each suggestions as word (word)}
				<button type="button" class="btn btn-sm btn-ghost font-mono" onclick={() => complete(word)}>{word}</button>
			{/each}
		</div>
		<p class="min-h-5 text-sm" class:text-error={!!error} role={error ? 'alert' : 'status'}>
			{#if busy}<span class="loading loading-spinner loading-xs mr-1"></span>{t.opening}{:else if error}{error}{/if}
		</p>
		<div class="modal-action mt-0">
			<button type="button" class="btn btn-ghost" onclick={onclose} disabled={busy}>{t.cancel}</button>
			<button type="submit" class="btn btn-primary" disabled={busy}>{t.open}</button>
		</div>
	</form>
</Modal>
