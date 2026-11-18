<script lang="ts">
	import { TOOL_HELP, toolHelpPath } from '#lib/help.js';
	import HelpPage from '#lib/HelpPage.svelte';
	import { locale, m } from '#lib/i18n/index.svelte.js';
	import { TOOLS, type Tool } from '#lib/tools.js';

	let { tool: id }: { tool: Tool['id'] } = $props();

	const tool = $derived(TOOLS.find((t) => t.id === id)!);
</script>

<!-- The help of one tool as a page: the same texts as its help window -->
<HelpPage title={m.help.toolTitle(m.tools[id].name)} summary={m.tools[id].summary} path={toolHelpPath(tool)} content={TOOL_HELP[id][locale]}>
	{#snippet actions()}
		<a href={tool.url} data-sveltekit-reload class="btn btn-primary mt-2 w-fit gap-2">
			<img src={tool.icon} alt="" class="size-5" width="20" height="20" />
			{m.help.openTool(m.tools[id].name)}
		</a>
	{/snippet}
</HelpPage>
