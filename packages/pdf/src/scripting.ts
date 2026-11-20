// A form's own scripts (calculations, number formats, checks – `/AA` of its fields, the document's JavaScript), run
// like Firefox runs them: PDF.js's QuickJS sandbox in a worker of its own (`scripting.worker.ts`), started only for
// PDFs that have scripts. A tool sends what the user did to a field (`commit`); the answer is what the scripts
// changed – values, the text they show (`formattedValue`), messages.

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { debug } from '@in-browser/brand/debug.js';

export type ScriptRequest = { type: 'create'; data: unknown } | { type: 'event'; id: number; event: SandboxEvent };
export type ScriptReply =
	| { type: 'created' }
	| { type: 'done'; id: number; updates: unknown[] }
	| { type: 'update'; detail: unknown }
	| { type: 'alert'; text: string }
	| { type: 'error'; id?: number; message: string };

/** An event for the sandbox, as PDF.js's annotation layer sends it (`id`: a widget's annotation id, `doc`, `page`) */
export interface SandboxEvent {
	id: string;
	name: string;
	[key: string]: unknown;
}

/** What the scripts changed of one field */
export interface ScriptChange {
	/** Its full name */
	field: string;
	/** The widget (annotation id) the change came for */
	widget: string;
	/** Its value now (text: also a number; boxes: true/false or a state name) */
	value?: unknown;
	/** The text shown for it (a number format); `null`: the value itself */
	formattedValue?: string | null;
	/** The scripts turned the input down (it became empty) */
	focus?: boolean;
}

export interface FormScripts {
	/** Runs an event (one at a time) and gives what the scripts changed; `null` when they didn't answer in time */
	dispatch(event: SandboxEvent): Promise<ScriptChange[] | null>;
	/** The page in view changed (pages from 1): its `PageOpen` scripts run once */
	pageOpen(pageNumber: number): void;
	destroy(): void;
}

export interface ScriptOptions {
	/** `navigator.language` of the scripts' `app` */
	language: string;
	/** Changes made outside an event (timers) */
	onChange?: (changes: ScriptChange[]) => void;
	/** `app.alert` of a script: shown as a message */
	onAlert?: (text: string) => void;
}

/** How long a script may take to answer an event */
const TIMEOUT = 2000;

/** Does the PDF have scripts at all? (field actions or document JavaScript) */
function hasScripts(objects: Map<string, object[]> | null, docActions: Record<string, unknown> | null): boolean {
	if (docActions && Object.keys(docActions).length) return true;
	for (const list of objects?.values() ?? []) for (const o of list) if ((o as { actions?: Record<string, unknown> }).actions) return true;
	return false;
}

/** Starts the sandbox for a PDF with scripts; `null` when it has none (no worker then) */
export async function startScripts(pdf: PDFDocumentProxy, options: ScriptOptions): Promise<FormScripts | null> {
	const [objects, calculationOrder, docActions] = await Promise.all([pdf.getFieldObjects(), pdf.getCalculationOrderIds(), pdf.getJSActions()]);
	if (!hasScripts(objects, docActions as Record<string, unknown> | null)) return null;
	// Updates name widgets (and fields) by annotation id
	const fieldOf = new Map<string, string>();
	for (const [name, list] of objects ?? []) for (const o of list) fieldOf.set((o as { id: string }).id, name);
	const { info, metadata } = await pdf.getMetadata();
	const worker = new Worker(new URL('./scripting.worker.ts', import.meta.url), { type: 'module' });
	const waiting = new Map<number, (updates: unknown[] | null) => void>();
	let created!: (ok: boolean) => void;
	const ready = new Promise<boolean>((resolve) => (created = resolve));
	let next = 0;
	let queue: Promise<unknown> = Promise.resolve();

	const changesOf = (updates: unknown[]): ScriptChange[] => {
		const out: ScriptChange[] = [];
		for (const u of updates as { id?: string; siblings?: string[]; command?: string; value?: unknown }[]) {
			if (!u || typeof u !== 'object') continue;
			if (!u.id) {
				// Commands of the viewer (print, zoom, page …) are left out; errors of a script are logged
				if (u.command === 'error' || u.command === 'println') debug(`[pdf] form script ${u.command}: ${String(u.value)}`);
				continue;
			}
			const { id, siblings, ...rest } = u as Record<string, unknown> & { id: string; siblings?: string[] };
			for (const widget of [id, ...(siblings ?? [])]) {
				const field = fieldOf.get(widget);
				if (field) out.push({ field, widget, ...(rest as Omit<ScriptChange, 'field' | 'widget'>) });
			}
		}
		return out;
	};

	worker.onmessage = (e: MessageEvent<ScriptReply>) => {
		const reply = e.data;
		if (reply.type === 'created') created(true);
		else if (reply.type === 'done') waiting.get(reply.id)?.(reply.updates);
		else if (reply.type === 'update') {
			const changes = changesOf([reply.detail]);
			if (changes.length) options.onChange?.(changes);
		} else if (reply.type === 'alert') options.onAlert?.(reply.text);
		else {
			debug(`[pdf] form scripts: ${reply.message}`);
			if (reply.id === undefined) created(false);
			else waiting.get(reply.id)?.(null);
		}
	};
	worker.onerror = (e) => {
		debug(`[pdf] form scripts failed: ${e.message}`);
		created(false);
	};

	const post = (request: ScriptRequest) => worker.postMessage(request);
	const run = (event: SandboxEvent): Promise<unknown[] | null> => {
		const id = next++;
		return new Promise((resolve) => {
			const timer = setTimeout(() => finish(null), TIMEOUT);
			const finish = (updates: unknown[] | null) => {
				clearTimeout(timer);
				waiting.delete(id);
				resolve(updates);
			};
			waiting.set(id, finish);
			post({ type: 'event', id, event });
		});
	};
	/** One event after the other (a script's answer may depend on the one before) */
	const dispatch = (event: SandboxEvent): Promise<ScriptChange[] | null> => {
		const result = queue.then(async () => ((await ready) ? run(event) : null)).then((updates) => (updates ? changesOf(updates) : null));
		queue = result.catch(() => {});
		return result;
	};

	post({
		type: 'create',
		data: {
			objects: objects ? Object.fromEntries(objects) : {},
			calculationOrder: calculationOrder ?? [],
			appInfo: { platform: navigator.platform, language: options.language },
			docInfo: {
				...(info as object),
				baseURL: '',
				filesize: (await pdf.getDownloadInfo()).length,
				filename: '',
				metadata: metadata?.getRaw(),
				authors: metadata?.get('dc:creator'),
				numPages: pdf.numPages,
				URL: '',
				actions: docActions
			}
		}
	});
	if (!(await ready)) {
		worker.terminate();
		return null;
	}
	await dispatch({ id: 'doc', name: 'Open' });
	const opened = new Set<number>();
	return {
		dispatch,
		pageOpen(pageNumber) {
			if (opened.has(pageNumber)) return;
			opened.add(pageNumber);
			void (async () => {
				const page = await pdf.getPage(pageNumber);
				await dispatch({ id: 'page', name: 'PageOpen', pageNumber, actions: await page.getJSActions() });
			})().catch((e: unknown) => debug(`[pdf] form scripts: page ${pageNumber}: ${String(e)}`));
		},
		destroy() {
			worker.terminate();
			for (const finish of waiting.values()) finish(null);
		}
	};
}
