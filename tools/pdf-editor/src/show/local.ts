// The display and the presenter view as two windows of one browser (a projector as a second screen): their messages
// go over a `BroadcastChannel` named after the presentation, so either window may reload and find the other again.

import { fromDisplay, toDisplay, type FromDisplay, type ShowLink, type ToDisplay } from './protocol.js';

const channelName = (session: string) => `pdf-editor:present:${session}`;

/** A new name for a presentation */
export const newSession = () => crypto.randomUUID();

function link<In, Out>(session: string, check: (raw: unknown) => In | null): ShowLink<In, Out> {
	const channel = new BroadcastChannel(channelName(session));
	const handlers = new Set<(message: In) => void>();
	channel.onmessage = (e: MessageEvent) => {
		const message = check(e.data);
		if (message) for (const h of handlers) h(message);
	};
	return {
		send: (message) => channel.postMessage(message),
		onMessage(handler) {
			handlers.add(handler);
			return () => handlers.delete(handler);
		},
		close() {
			handlers.clear();
			channel.close();
		}
	};
}

/** The display's end: hears controls, answers with its state */
export const displayLink = (session: string) => link<ToDisplay, FromDisplay>(session, toDisplay);

/** A control's end (the presenter view) */
export const controlLink = (session: string) => link<FromDisplay, ToDisplay>(session, fromDisplay);
