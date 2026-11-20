<script lang="ts">
	import { openSettings, suiteSettings } from '@in-browser/files/suite-settings.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import { trash, TRASH_LIMIT } from '#lib/trash.svelte.js';

	// Above the entries of the trash (shown by the list of a folder): what it is, how long it keeps (a suite setting),
	// where it lies outside the browser
</script>

<div class="border-base-300 flex flex-col gap-1 border-b px-4 py-2 text-sm">
	<p class="opacity-70">{m.trash.intro} {m.trash.elsewhere}</p>
	<p class="flex flex-wrap items-center gap-x-2">
		<span>{m.trash.kept(suiteSettings.values.trash.days)}</span>
		<button class="btn btn-link btn-sm h-auto min-h-0 px-0" onclick={() => openSettings('trash')}>{m.trash.changeKept}</button>
	</p>
	{#if (trash.items?.length ?? 0) > TRASH_LIMIT}
		<p class="text-xs opacity-60">{m.trash.more((trash.items?.length ?? 0) - TRASH_LIMIT)}</p>
	{/if}
</div>
