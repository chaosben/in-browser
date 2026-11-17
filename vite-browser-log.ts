// Dev server only: messages from the browsers go to `.debug/browser.log`, readable while someone else runs the
// server. Uses Vite's client-server communication (custom events): each page announces itself
// (`in-browser:hello`) and sends console warnings and errors, uncaught errors and `debug()` messages (`in-browser:log`, see
// `packages/brand/src/debug.ts`). Several browsers at once (desktop, phone via `adb reverse`) are told apart by a
// label per connection, e.g. `[B2 Android Chrome 157]`.

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import type { DebugHello, DebugLog } from './packages/brand/src/debug.ts';

const DIR = '.debug';
const FILE = `${DIR}/browser.log`;

/** Short name of a browser from its user agent, e.g. `Android Chrome 157` */
export function browserName(ua: string): string {
	const os = /Android/.test(ua)
		? 'Android'
		: /iPad|iPhone/.test(ua)
			? 'iOS'
			: /Windows/.test(ua)
				? 'Windows'
				: /Mac OS X/.test(ua)
					? 'macOS'
					: /Linux/.test(ua)
						? 'Linux'
						: '?';
	const browsers: [string, RegExp][] = [
		['Samsung', /SamsungBrowser\/(\d+)/],
		['Edge', /Edg\/(\d+)/],
		['Firefox', /Firefox\/(\d+)/],
		['Chrome', /Chrome\/(\d+)/],
		['Safari', /Version\/([\d.]+).*Safari/]
	];
	for (const [name, pattern] of browsers) {
		const version = pattern.exec(ua)?.[1];
		if (version) return `${os} ${name} ${version}`;
	}
	return `${os} ?`;
}

export function browserLog(): Plugin {
	return {
		name: 'in-browser:browser-log',
		apply: 'serve',
		configureServer(server) {
			mkdirSync(DIR, { recursive: true });
			writeFileSync(FILE, `# Browser log of the dev server, started ${new Date().toISOString()}\n`);
			const write = (label: string, text: string) => {
				const time = new Date().toISOString().slice(11, 23);
				appendFileSync(FILE, `${time} [${label}] ${text.replace(/\n/g, '\n    ')}\n`);
			};
			const labels = new WeakMap<object, string>();
			let count = 0;
			server.ws.on('in-browser:hello', (hello: DebugHello, client) => {
				const label = `B${++count} ${browserName(hello.ua)}`;
				labels.set(client, label);
				write(label, `hello ${hello.path} · dpr ${hello.dpr} · screen ${hello.screen} · touch points ${hello.touch} · ${hello.ua}`);
			});
			server.ws.on('in-browser:log', (log: DebugLog, client) => {
				write(labels.get(client) ?? '?', `${log.level}: ${log.message}`);
			});
		}
	};
}
