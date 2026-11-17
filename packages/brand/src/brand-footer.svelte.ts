import type { Snippet } from 'svelte';

// The places in the BrandFooter a page of a tool fills: on the left the save state of the current document (an icon
// in a fixed place) and the status of the current page (e.g. cursor position and encoding in the Text Editor). The
// suite-wide indicators on the right come from the tool's layout. Status belongs here, never in the BrandBar.

export interface SaveState {
	state: 'saved' | 'saving' | 'unsaved' | 'error';
	/** What it means, in the tool's language (tooltip, screen readers) */
	text: string;
}

export const brandFooter = $state<{ status: Snippet | null; save: SaveState | null }>({ status: null, save: null });

/** Fills the footer; call from an `$effect` of the page and return the result, which empties it again. */
export function setBrandFooter({ status = null, save = null }: { status?: Snippet | null; save?: SaveState | null }): () => void {
	brandFooter.status = status;
	brandFooter.save = save;
	return () => {
		brandFooter.status = null;
		brandFooter.save = null;
	};
}
