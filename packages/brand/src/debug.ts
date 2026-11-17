// Debug messages to the dev server (`.debug/browser.log`, see `vite-browser-log.ts` in the root) – only while
// running `vite dev`; in a build `import.meta.hot` is undefined and all of this does nothing. Workers have their
// own console, which is not forwarded.

export interface DebugHello {
	ua: string;
	path: string;
	dpr: number;
	screen: string;
	touch: number;
}

export interface DebugLog {
	level: 'debug' | 'warn' | 'error';
	message: string;
}

/** One argument as text; anything that isn't JSON (cycles, DOM objects …) as its string form */
function text(a: unknown): string {
	if (typeof a === 'string') return a;
	if (a instanceof Error) return `${a.name}: ${a.message}`;
	try {
		return JSON.stringify(a) ?? String(a);
	} catch {
		return String(a);
	}
}

const format = (args: unknown[]) => args.map(text).join(' ');

/** A message for the browser log of the dev server (and the console) */
export function debug(...args: unknown[]) {
	if (!import.meta.hot) return;
	console.debug(...args);
	import.meta.hot.send('in-browser:log', { level: 'debug', message: format(args) } satisfies DebugLog);
}

/** Announces this page to the dev server and forwards warnings, errors and uncaught errors (called once at start) */
export function startDebug() {
	const hot = import.meta.hot;
	if (!hot) return;
	hot.send('in-browser:hello', {
		ua: navigator.userAgent,
		path: location.pathname + location.search,
		dpr: devicePixelRatio,
		screen: `${screen.width}×${screen.height}`,
		touch: navigator.maxTouchPoints
	} satisfies DebugHello);
	const error = (message: string) => hot.send('in-browser:log', { level: 'error', message } satisfies DebugLog);
	// Console warnings and errors of the page (also from libraries, e.g. PDF.js) – the original output stays
	for (const level of ['warn', 'error'] as const) {
		const original = console[level].bind(console);
		console[level] = (...args: unknown[]) => {
			original(...args);
			hot.send('in-browser:log', { level, message: format(args) } satisfies DebugLog);
		};
	}
	addEventListener('error', (e) => error(e.error instanceof Error ? `${e.error.message}\n${e.error.stack ?? ''}` : e.message));
	addEventListener('unhandledrejection', (e) =>
		error(e.reason instanceof Error ? `unhandled rejection: ${e.reason.message}\n${e.reason.stack ?? ''}` : `unhandled rejection: ${String(e.reason)}`)
	);
}
