import type { BrowserContext } from '@playwright/test';
import type { AddressInfo } from 'node:net';
import { WebSocketServer } from 'ws';

// A tiny Nostr relay inside the test process, so the P2P tests don't depend on public relays: every `wss://`
// connection of the given browser contexts lands here, and `listen()` opens it for other processes too (the
// p2p-node). It keeps subscriptions (`REQ` with `#x` filters) and passes every `EVENT` on to matching subscriptions
// of all connections (ephemeral events, nothing is stored).

interface Connection {
	send(text: string): void;
	subs: Map<string, string[]>;
}

export function fakeRelay() {
	const connections = new Set<Connection>();
	let server: WebSocketServer | null = null;

	function connect(send: (text: string) => void) {
		const connection: Connection = { send, subs: new Map() };
		connections.add(connection);
		return {
			close: () => connections.delete(connection),
			message(raw: string) {
				const message = JSON.parse(raw) as unknown[];
				if (message[0] === 'REQ') {
					const [, subId, filter] = message as [string, string, { '#x'?: string[] }];
					connection.subs.set(subId, filter['#x'] ?? []);
					send(JSON.stringify(['EOSE', subId]));
				} else if (message[0] === 'CLOSE') {
					connection.subs.delete(message[1] as string);
				} else if (message[0] === 'EVENT') {
					const event = message[1] as { id: string; tags: string[][] };
					send(JSON.stringify(['OK', event.id, true, '']));
					const topics = event.tags.filter((t) => t[0] === 'x').map((t) => t[1]);
					for (const other of connections) {
						for (const [subId, wanted] of other.subs) {
							if (topics.some((topic) => wanted.includes(topic))) other.send(JSON.stringify(['EVENT', subId, event]));
						}
					}
				}
			}
		};
	}

	return {
		async attach(context: BrowserContext) {
			await context.routeWebSocket(/^wss:\/\//, (ws) => {
				const connection = connect((text) => ws.send(text));
				ws.onClose(() => connection.close());
				ws.onMessage((raw) => connection.message(String(raw)));
			});
		},
		/** Opens the relay on a local port; resolves to its address (`ws://127.0.0.1:…`) */
		async listen(): Promise<string> {
			server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
			server.on('connection', (socket) => {
				const connection = connect((text) => socket.send(text));
				socket.on('close', () => connection.close());
				socket.on('message', (raw) => connection.message(String(raw)));
			});
			await new Promise((resolve) => server!.once('listening', resolve));
			return `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
		},
		close: () => server?.close()
	};
}
