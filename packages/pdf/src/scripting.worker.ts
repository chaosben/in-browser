// The form's scripts (calculations, number formats, checks) in PDF.js's QuickJS sandbox, as Firefox runs them: a
// JavaScript engine compiled to WebAssembly, in a worker of its own. The scripts see only the form's data handed in;
// no page, no files, no network. What they change comes back as updates; `alert` becomes a message for the page,
// `confirm` says no and `prompt` gives nothing (no browser dialogs, `ui.md`).

import { QuickJSSandbox } from 'pdfjs-dist/build/pdf.sandbox.min.mjs';
import quickJsUrl from '/node_modules/pdfjs-dist/wasm/quickjs-eval.js?url';
import quickJsWasmUrl from '/node_modules/pdfjs-dist/wasm/quickjs-eval.wasm?url';
import type { ScriptReply, ScriptRequest } from './scripting.js';

const post = (reply: ScriptReply) => self.postMessage(reply);

// The engine fetches its WebAssembly next to its script by its plain name; built assets have hashed names
const realFetch = self.fetch.bind(self);
self.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
	const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
	return realFetch(url.endsWith('/quickjs-eval.wasm') ? quickJsWasmUrl : input, init);
};

/** Updates made while an event runs (answered together); others (timers) are sent one by one */
let collected: unknown[] | null = null;

// What the sandbox takes from `window`
(self as unknown as { window: unknown }).window = {
	setTimeout: self.setTimeout.bind(self),
	clearTimeout: self.clearTimeout.bind(self),
	setInterval: self.setInterval.bind(self),
	clearInterval: self.clearInterval.bind(self),
	console,
	URL,
	CustomEvent: class {
		readonly detail: unknown;
		constructor(
			readonly type: string,
			init?: { detail?: unknown }
		) {
			this.detail = init?.detail;
		}
	},
	dispatchEvent(event: { detail: unknown }) {
		if (collected) collected.push(event.detail);
		else post({ type: 'update', detail: event.detail });
		return true;
	},
	alert: (text: unknown) => post({ type: 'alert', text: String(text) }),
	confirm: () => false,
	prompt: () => null
};

type Sandbox = Awaited<ReturnType<typeof QuickJSSandbox>>;
let sandbox: Promise<Sandbox> | null = null;

self.onmessage = async (event: MessageEvent<ScriptRequest>) => {
	const request = event.data;
	try {
		if (request.type === 'create') {
			// `${url}#` + its own name: the engine's script under its built name
			sandbox = QuickJSSandbox(`${quickJsUrl}#`).then((s) => {
				s.create(request.data);
				return s;
			});
			await sandbox;
			post({ type: 'created' });
		} else {
			const s = await sandbox;
			if (!s) throw new Error('no sandbox');
			collected = [];
			try {
				s.dispatchEvent(request.event);
				post({ type: 'done', id: request.id, updates: collected });
			} finally {
				collected = null;
			}
		}
	} catch (e) {
		post({ type: 'error', id: request.type === 'event' ? request.id : undefined, message: e instanceof Error ? e.message : String(e) });
	}
};
