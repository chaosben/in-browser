import type { Snippet } from 'svelte';

// The place in the BrandFooter a page of a tool fills: on the left the status of the current page (e.g. cursor
// position and encoding in the Text Editor). The suite-wide indicators on the right come from the tool's layout.

export const brandFooter = $state<{ status: Snippet | null }>({ status: null });

/** Fills the footer; call from an `$effect` of the page and return the result, which empties it again. */
export function setBrandFooter({ status = null }: { status?: Snippet | null }): () => void {
	brandFooter.status = status;
	return () => {
		brandFooter.status = null;
	};
}
