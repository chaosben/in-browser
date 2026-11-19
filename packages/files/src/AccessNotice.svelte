<script lang="ts">
	import { filesMessages } from './i18n/index.svelte.js';
	import { connectionOf } from './path.js';
	import { allowAccess, connections } from './sources/connections.svelte.js';
	import { connectedDocuments } from './sources/recent.js';

	// On the start page of a tool: connected folders holding documents of the tool that the browser doesn't allow access
	// to right now (usually after a restart), each with “Allow access”.

	interface Props {
		/** Tool name as used for `rememberConnected` */
		tool: string;
		/** After access was allowed (reload the list) */
		onallowed?: () => void;
	}

	let { tool, onallowed }: Props = $props();

	const t = $derived(filesMessages());
	const blocked = $derived.by(() => {
		const ids = new Set(connectedDocuments(tool).map((path) => connectionOf(path)?.id));
		return connections.list.filter((c) => c.access !== 'granted' && ids.has(c.id));
	});

	async function allow(id: string) {
		if (await allowAccess(id)) onallowed?.();
	}
</script>

{#each blocked as connection (connection.id)}
	<div class="alert alert-warning alert-soft flex flex-wrap items-center gap-2 text-sm" role="status">
		<span class="icon-[material-symbols-light--link-off] size-5 shrink-0" aria-hidden="true"></span>
		<span class="min-w-0 flex-1">{t.connected.noAccess(connection.name)}</span>
		<button class="btn btn-sm" onclick={() => allow(connection.id)}>{t.connected.allow}</button>
	</div>
{/each}
