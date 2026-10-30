<script lang="ts">
	import { untrack } from 'svelte';
	import { EditorView } from '@codemirror/view';
	import type { Workspace } from '#lib/workspace.svelte.js';

	// The one CodeMirror view of the page; the workspace swaps in the state of the active tab.

	let { workspace }: { workspace: Workspace } = $props();

	function mount(node: HTMLElement) {
		return untrack(() => {
			const view = new EditorView({
				parent: node,
				dispatchTransactions: (transactions, view) => {
					view.update(transactions);
					workspace.update(view, transactions);
				}
			});
			return workspace.attach(view);
		});
	}
</script>

<div class="size-full" {@attach mount}></div>
