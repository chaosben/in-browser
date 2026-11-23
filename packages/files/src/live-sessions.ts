// What can be offered live between two browsers (`p2p/live-ends.ts`), like formats are registered (`formats.ts`): a
// kind names the tool and the page that joins it, so every tool can show “… presents …” with a way in without
// knowing the tool that offers it.

import type { ToolSlug } from '@in-browser/brand/i18n/index.svelte.js';
import type { LiveView } from './p2p/view.js';

export interface LiveKind {
	tool: ToolSlug;
	/** The page that joins a session of this kind (gets `?end=…&path=…`) */
	join: string;
}

export const LIVE_KINDS: Record<string, LiveKind> = {
	// A PDF presented: its remote control
	present: { tool: 'pdf-editor', join: '/pdf-editor/remote' }
};

/** The page joining a live session; null for a kind this version doesn't know */
export function liveUrl(session: Pick<LiveView, 'kind' | 'end' | 'path'>): string | null {
	const kind = LIVE_KINDS[session.kind];
	return kind ? `${kind.join}?end=${encodeURIComponent(session.end)}&path=${encodeURIComponent(session.path)}` : null;
}
