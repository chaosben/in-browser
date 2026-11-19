<script lang="ts">
	import { BRAND } from '@in-browser/brand/brand.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { readStored, writeStored } from '@in-browser/brand/storage.js';
	import { diagnostics, p2pStatus, type Diagnostics } from '@in-browser/files/p2p/p2p.svelte.js';
	import { groupBase32 } from '@in-browser/files/p2p/base32.js';
	import { boldParts } from '#lib/devices.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import { resolve } from '$app/paths';

	// “How it works” in two versions: simple (four points and a picture) and for experts (the techniques, plus live
	// diagnostics). The chosen version is remembered. `onnext`: shown before connecting, with a button to go on.

	let { onclose, onnext }: { onclose: () => void; onnext?: () => void } = $props();

	const MODE_KEY = 'files:explain-mode';
	let mode = $state<'simple' | 'expert'>(readStored(MODE_KEY) === 'expert' ? 'expert' : 'simple');
	let info = $state<Diagnostics | null>(null);

	function setMode(next: 'simple' | 'expert') {
		mode = next;
		writeStored(MODE_KEY, next);
	}

	// Live diagnostics while the expert version is shown
	$effect(() => {
		if (mode !== 'expert' || p2pStatus.view.state !== 'online') return;
		let stopped = false;
		const load = () =>
			diagnostics()
				.then((d) => !stopped && (info = d))
				.catch(() => {});
		load();
		const timer = setInterval(load, 3000);
		return () => {
			stopped = true;
			clearInterval(timer);
		};
	});

	const names = $derived(new Map(p2pStatus.view.devices.map((d) => [d.id, d.name])));

	function diagnosticsText(d: Diagnostics): string {
		return [
			`${m.explain.ownFingerprint}: ${groupBase32(d.self)}`,
			...d.peers.map((p) => `${p.name} (${groupBase32(p.id)}): ${m.explain.connection[p.connection] ?? p.connection}${p.rtt === null ? '' : `, ${m.explain.rtt(p.rtt)}`}`),
			`STUN: ${d.stun}`,
			`${m.explain.relays}: ${d.relays.map((r) => `${r.url} ${r.connected ? m.explain.relayConnected : m.explain.relayDisconnected}`).join(', ')}`
		].join('\n');
	}

	async function copyDiagnostics() {
		if (!info) return;
		await navigator.clipboard.writeText(diagnosticsText(info));
		toast(m.explain.copied, 'success');
	}

	function start(dialog: HTMLDialogElement) {
		dialog.showModal();
	}
</script>

<dialog
	class="modal"
	{@attach start}
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
>
	<div class="modal-box flex max-w-2xl flex-col gap-4">
		<h3 class="text-lg font-bold">{m.explain.title}</h3>
		<div role="tablist" class="tabs tabs-border">
			<button role="tab" class={['tab', mode === 'simple' && 'tab-active']} aria-selected={mode === 'simple'} onclick={() => setMode('simple')}>{m.explain.simple}</button>
			<button role="tab" class={['tab', mode === 'expert' && 'tab-active']} aria-selected={mode === 'expert'} onclick={() => setMode('expert')}>{m.explain.expert}</button>
		</div>

		{#if mode === 'simple'}
			<!-- Three devices, each connected with each, no server in between -->
			<svg viewBox="0 0 240 110" class="text-base-content mx-auto h-28 w-full max-w-xs" role="img" aria-label={m.explain.diagram}>
				<g class="stroke-selection" stroke-width="2" stroke-dasharray="4 3">
					<line x1="45" y1="70" x2="120" y2="25" />
					<line x1="195" y1="70" x2="120" y2="25" />
					<line x1="45" y1="70" x2="195" y2="70" />
				</g>
				<g fill="none" stroke="currentColor" stroke-width="2">
					<rect x="100" y="8" width="40" height="28" rx="3" />
					<line x1="94" y1="40" x2="146" y2="40" />
					<rect x="35" y="55" width="20" height="34" rx="3" />
					<rect x="178" y="56" width="34" height="28" rx="3" />
				</g>
			</svg>
			<ol class="flex list-decimal flex-col gap-2 pl-5 text-sm">
				{#each m.explain.points as point (point)}
					<li>
						{#each boldParts(point) as part, i (i)}{#if part.bold}<strong>{part.text}</strong>{:else}{part.text}{/if}{/each}
					</li>
				{/each}
			</ol>
			<span class="flex flex-col gap-1">
				<a class="link text-sm" href={resolve('/help/sync')} target="_blank" rel="noopener">{m.explain.more}</a>
				<a class="link text-sm" href={resolve('/help/p2p-node')} target="_blank" rel="noopener">{m.explain.p2pNode}</a>
			</span>
		{:else}
			<dl class="flex flex-col gap-3 text-sm">
				{#each m.explain.expertSections as [title, text] (title)}
					<div>
						<dt class="font-semibold">{title}</dt>
						<dd class="opacity-80">{text}</dd>
					</div>
				{/each}
			</dl>
			<a class="link text-sm" href="{BRAND.repoUrl}/tree/main/packages/files/src/p2p" target="_blank" rel="noopener">{m.explain.source}</a>

			{#if p2pStatus.view.state === 'online'}
				<section class="bg-base-200 rounded-box flex flex-col gap-2 p-3 text-xs">
					<h4 class="text-sm font-semibold">{m.explain.diagnostics}</h4>
					{#if info}
						<p>{m.explain.ownFingerprint}: <code class="font-mono">{groupBase32(info.self)}</code></p>
						{#if info.peers.length}
							<ul class="flex flex-col gap-1">
								{#each info.peers as peer (peer.id)}
									<li>
										{names.get(peer.id) ?? peer.name}: <code class="font-mono">{groupBase32(peer.id)}</code> –
										{m.explain.connection[peer.connection] ?? peer.connection}{#if peer.rtt !== null}, {m.explain.rtt(peer.rtt)}{/if}
									</li>
								{/each}
							</ul>
						{:else}
							<p class="opacity-70">{m.explain.noPeers}</p>
						{/if}
						<p>STUN: <code class="font-mono">{info.stun}</code></p>
						<div>
							<span>{m.explain.relays}:</span>
							<ul class="ml-4">
								{#each info.relays as relay (relay.url)}
									<li><code class="font-mono">{relay.url}</code> – {relay.connected ? m.explain.relayConnected : m.explain.relayDisconnected}</li>
								{/each}
							</ul>
						</div>
						<button class="btn btn-xs self-start" onclick={copyDiagnostics}>
							<span class="icon-[material-symbols-light--content-copy-outline] size-4" aria-hidden="true"></span>
							{m.explain.copyDiagnostics}
						</button>
					{:else}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
				</section>
			{/if}
		{/if}

		<div class="modal-action">
			{#if onnext}
				<button class="btn" onclick={onclose}>{m.devices.cancel}</button>
				<button class="btn btn-primary" onclick={onnext}>{m.devices.next}</button>
			{:else}
				<button class="btn" onclick={onclose}>{m.devices.close}</button>
			{/if}
		</div>
	</div>
</dialog>
