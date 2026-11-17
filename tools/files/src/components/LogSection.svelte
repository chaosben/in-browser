<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { clearLog, exportLog, logInfo, p2pStatus, setLogEnabled, type LogInfo } from '@in-browser/files/p2p/p2p.svelte.js';
	import { safeName } from '@in-browser/files/path.js';
	import { m } from '#lib/i18n/index.js';

	// Opt-in log of the device sync for finding errors: switch, number of entries, export as text file, clear

	let info = $state<LogInfo | null>(null);

	async function refresh() {
		info = await logInfo().catch(() => null);
	}

	$effect(() => {
		untrack(() => void refresh());
		const timer = setInterval(() => void refresh(), 2000);
		return () => clearInterval(timer);
	});

	async function run(action: () => Promise<unknown>) {
		try {
			await action();
			await refresh();
		} catch (e) {
			toast(m.devices.failed(e instanceof Error ? e.message : String(e)), 'error', 8000);
		}
	}

	async function download() {
		const text = await exportLog();
		const device = safeName(p2pStatus.view.self?.name ?? '', 'device');
		const date = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
		const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = m.log.fileName(device, date);
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
	}
</script>

<details class="text-sm">
	<summary class="cursor-pointer font-semibold">{m.log.title}</summary>
	<div class="mt-2 flex flex-col gap-2">
		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				class="toggle toggle-sm"
				checked={info?.enabled ?? false}
				disabled={!info}
				onchange={(e) => run(() => setLogEnabled(e.currentTarget.checked))}
			/>
			{m.log.record}
		</label>
		<p class="text-xs opacity-70">{m.log.hint}</p>
		{#if info}
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-xs opacity-60">{m.log.count(info.count)}</span>
				<button class="btn btn-xs" disabled={!info.count} onclick={() => run(download)}>
					<span class="icon-[material-symbols-light--download] size-4" aria-hidden="true"></span>
					{m.log.export}
				</button>
				<button class="btn btn-xs btn-ghost" disabled={!info.count} onclick={() => run(clearLog)}>{m.log.clear}</button>
			</div>
		{/if}
	</div>
</details>
