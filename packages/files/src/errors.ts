import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { filesErrorText } from './i18n/index.svelte.js';
import { accessAction } from './sources/connections.svelte.js';

/**
 * An error the way every tool shows it (`ui.md`: never swallowed – a toast and the console): the text of a file
 * error unless `text` says more; with what the user can do about it – allowing access to a connected folder again
 * or changing a server's sign-in data (`accessAction`; `retry` runs once access is back).
 */
export function showError(e: unknown, { text, context, retry }: { text?: string; /** For the console, e.g. `[pdf-editor] stamp` */ context?: string; retry?: () => void } = {}): void {
	if (context) console.error(context, e);
	else console.error(e);
	const action = accessAction(e, retry);
	toast(text ?? filesErrorText(e), 'error', action ? 10_000 : 8000, action);
}
