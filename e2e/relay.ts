import type { BrowserContext, WebSocketRoute } from '@playwright/test';

// A tiny Nostr relay inside the test process, so the P2P tests don't depend on public relays: every `wss://`
// connection of the given browser contexts lands here. It keeps subscriptions (`REQ` with `#x` filters) and passes
// every `EVENT` on to matching subscriptions of all connections (ephemeral events, nothing is stored).

interface Connection {
	ws: WebSocketRoute;
	subs: Map<string, string[]>;
}

export function fakeRelay() {
	const connections = new Set<Connection>();
	return {
		async attach(context: BrowserContext) {
			await context.routeWebSocket(/^wss:\/\//, (ws) => {
				const connection: Connection = { ws, subs: new Map() };
				connections.add(connection);
				ws.onClose(() => connections.delete(connection));
				ws.onMessage((raw) => {
					const message = JSON.parse(String(raw)) as unknown[];
					if (message[0] === 'REQ') {
						const [, subId, filter] = message as [string, string, { '#x'?: string[] }];
						connection.subs.set(subId, filter['#x'] ?? []);
						ws.send(JSON.stringify(['EOSE', subId]));
					} else if (message[0] === 'CLOSE') {
						connection.subs.delete(message[1] as string);
					} else if (message[0] === 'EVENT') {
						const event = message[1] as { id: string; tags: string[][] };
						ws.send(JSON.stringify(['OK', event.id, true, '']));
						const topics = event.tags.filter((t) => t[0] === 'x').map((t) => t[1]);
						for (const other of connections) {
							for (const [subId, wanted] of other.subs) {
								if (topics.some((topic) => wanted.includes(topic))) other.ws.send(JSON.stringify(['EVENT', subId, event]));
							}
						}
					}
				});
			});
		}
	};
}
