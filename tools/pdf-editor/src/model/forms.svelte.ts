// How form fields are shown: tinted (required ones framed) or as the page draws them – remembered as `pdf-editor:forms`.

const KEY = 'pdf-editor:forms';

function load(): { highlight: boolean } {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { highlight?: unknown };
		return { highlight: raw.highlight !== false };
	} catch {
		return { highlight: true };
	}
}

export const formView = $state(load());

/** Switches the tint of the fields (remembered) */
export function toggleHighlight() {
	formView.highlight = !formView.highlight;
	try {
		localStorage.setItem(KEY, JSON.stringify({ highlight: formView.highlight }));
	} catch {
		// Not kept (private window): it still applies now
	}
}
