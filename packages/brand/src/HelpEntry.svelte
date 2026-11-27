<script lang="ts">
	import type { HelpItem } from './help.js';
	import { brandMessages } from './i18n/index.svelte.js';

	interface Props {
		item: HelpItem;
		/** Links open in a new tab (help window: the tool stays as it is) */
		newTab?: boolean;
	}

	let { item, newTab = false }: Props = $props();

	const t = $derived(brandMessages());
	let copied = $state(false);

	async function copy(code: string) {
		try {
			await navigator.clipboard.writeText(code);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (e) {
			console.error(e);
		}
	}
</script>

<!-- One help entry: title, its keys, the text, the meaning of each choice, how to decide and where to read more.
	 Spans only, so it also fits into a search result button. -->
<span class="flex flex-wrap items-center gap-x-2 gap-y-1">
	<span class="font-semibold">{item.title}</span>
	{#each item.keys ?? [] as combo, i (i)}
		<span class="flex items-center gap-0.5">
			{#each combo as key, j (j)}
				{#if j}<span class="text-xs opacity-50">+</span>{/if}
				<kbd class="kbd kbd-xs">{key}</kbd>
			{/each}
		</span>
	{/each}
</span>
<span class="block text-sm opacity-80">{item.text}</span>
{#if item.options}
	<span class="mt-1 grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-1 text-sm">
		{#each Object.entries(item.options) as [key, option] (key)}
			<span class="font-medium">{option.label}</span>
			<span class="opacity-80">{option.text}</span>
		{/each}
	</span>
{/if}
{#if item.code}
	{@const code = item.code}
	<span class="bg-base-200 rounded-field relative mt-1 block">
		<pre class="overflow-x-auto p-2 pr-10 font-mono text-sm"><code>{code}</code></pre>
		<button
			class="btn btn-ghost btn-xs btn-square absolute top-1 right-1"
			onclick={(e) => {
				e.stopPropagation();
				copy(code);
			}}
			title={copied ? t.help.copied : t.help.copy}
			aria-label={copied ? t.help.copied : t.help.copy}
		>
			{#if copied}
				<span class="icon-[material-symbols-light--check] text-success size-4" aria-hidden="true"></span>
			{:else}
				<span class="icon-[material-symbols-light--content-copy-outline] size-4" aria-hidden="true"></span>
			{/if}
		</button>
	</span>
{/if}
{#if item.tip}
	<span class="bg-base-200 rounded-field mt-1 flex gap-2 p-2 text-sm">
		<span class="icon-[material-symbols-light--lightbulb-outline] text-hint size-5 shrink-0" aria-hidden="true"></span>
		<span><span class="font-semibold">{t.help.tipLabel}:</span> {item.tip}</span>
	</span>
{/if}
{#if item.link}
	<a
		class="link link-primary mt-0.5 inline-flex w-fit items-center gap-1 text-sm"
		href={item.link.href}
		target={newTab ? '_blank' : undefined}
		rel={newTab ? 'noopener' : undefined}
		onclick={(e) => e.stopPropagation()}
	>
		{item.link.label}
		<span class="icon-[material-symbols-light--arrow-forward] size-4" aria-hidden="true"></span>
	</a>
{/if}
