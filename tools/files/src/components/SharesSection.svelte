<script lang="ts">
	import { basename } from '@in-browser/files/path.js';
	import { p2pStatus } from '@in-browser/files/p2p/p2p.svelte.js';
	import type { ShareView } from '@in-browser/files/p2p/view.js';
	import { m } from '#lib/i18n/index.js';

	// “Shares” in the sidebar of Files: the folders this device shares with a guest right now, and sharing another one

	interface Props {
		/** Open the dialog of a share (link, end) */
		onshare: (share: ShareView) => void;
		onsharemenu: (e: MouseEvent, share: ShareView) => void;
		/** Choose a folder to share */
		onnew: () => void;
	}

	let { onshare, onsharemenu, onnew }: Props = $props();
	const shares = $derived(p2pStatus.view.shares);
</script>

<section class="flex flex-col gap-1" aria-label={m.share.section}>
	<h2 class="px-2 text-xs font-semibold opacity-60">{m.share.section}</h2>
	{#if p2pStatus.supported}
		{#if shares.length}
			<ul aria-label={m.share.panelLabel}>
				{#each shares as share (share.id)}
					<li>
						<button
							class="hover:bg-base-300 rounded-field flex w-full items-center gap-1.5 py-1 pr-2 pl-6.5 text-left text-sm"
							onclick={() => onshare(share)}
							oncontextmenu={(e) => {
								e.preventDefault();
								onsharemenu(e, share);
							}}
							title="{basename(share.folder)} – {share.connected ? m.share.guestConnected : m.share.guestWaiting}"
						>
							<span class="icon-[material-symbols-light--share-outline] size-5 shrink-0" aria-hidden="true"></span>
							<span class="min-w-0 flex-1 truncate">{basename(share.folder)}</span>
							<span class={['size-2 shrink-0 rounded-full', share.connected ? 'bg-success' : 'bg-base-content/30']} aria-hidden="true"></span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<button class="btn btn-ghost justify-start gap-2 px-2 font-normal" onclick={onnew}>
			<span class="icon-[material-symbols-light--share-outline] size-5 shrink-0" aria-hidden="true"></span>
			<span class="text-sm">{m.share.new}</span>
		</button>
	{:else}
		<p class="px-2 text-xs opacity-60">{m.share.unsupported}</p>
	{/if}
</section>
