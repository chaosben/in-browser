// Editor-wide state around the library: the pending "save to library" request (dialog), the remembered choice of
// library and the library section under a dragged element.
import type { Editor } from '#lib/project/editor.svelte.js';
import { itemLabel } from '#lib/project/labels.js';
import { toolState } from '#lib/tools/state.svelte.js';
import { entryName } from '#lib/project/library.js';
import type { Item } from '#lib/project/types.js';

export type LibraryScope = 'project' | 'global';

const SCOPE_KEY = 'screen-capture:library-scope';

function loadScope(): LibraryScope {
	try {
		return localStorage.getItem(SCOPE_KEY) === 'global' ? 'global' : 'project';
	} catch {
		// localStorage not available
		return 'project';
	}
}

class LibraryUi {
	/** Items waiting to be saved: the dialog asks for name and library */
	request = $state.raw<{ items: Item[]; name: string; scope: LibraryScope } | null>(null);
	/** Library section under the pointer while dragging elements from the preview or timeline */
	dropTarget = $state<LibraryScope | null>(null);
	/**
	 * What hangs at the pointer once dragged elements leave the preview or timeline (they themselves snap back
	 * then); `target`: the library section under it
	 */
	ghost = $state.raw<{ items: Item[]; label: string; target: LibraryScope | null } | null>(null);
	/** Pointer position of the ghost (separate, so its picture is not drawn again on every move) */
	ghostAt = $state.raw({ x: 0, y: 0 });

	/** Elements are on their way to the library: drop areas and the rail icon show it */
	get dragging() {
		return !!this.ghost;
	}
	#scope = loadScope();

	get scope() {
		return this.#scope;
	}

	set scope(scope: LibraryScope) {
		this.#scope = scope;
		try {
			localStorage.setItem(SCOPE_KEY, scope);
		} catch {
			// ignore
		}
	}

	/** Opens the save dialog; `scope` preselects a library (dropped onto it), else the last choice */
	save(items: Item[], name: string, scope = this.#scope) {
		if (items.length) this.request = { items, name, scope };
	}
}

export const libraryUi = new LibraryUi();

/** Library section of an element under the pointer (`data-library-drop`), if any */
function libraryTargetOf(el: Element | null): LibraryScope | null {
	const scope = el?.closest<HTMLElement>('[data-library-drop]')?.dataset.libraryDrop;
	return scope === 'project' || scope === 'global' ? scope : null;
}

/** Holding dragged elements over the library icon of the tool rail opens the library (spring-loaded) */
let springTimer: ReturnType<typeof setTimeout> | undefined;

function springOpen(el: Element | null) {
	const overIcon = !!el?.closest('[data-tool-group="library"]') && toolState.group !== 'library';
	if (!overIcon) {
		clearTimeout(springTimer);
		springTimer = undefined;
	} else springTimer ??= setTimeout(() => (toolState.group = 'library'), 500);
}

/** Asks to save the selected items, named after the clicked one */
export function saveSelection(editor: Editor, scope?: LibraryScope) {
	const items = editor.selectedItems;
	const primary = editor.selectedItem ?? items[0];
	if (primary) libraryUi.save(items, entryName(itemLabel(primary, editor), items.length), scope);
}

/**
 * While dragging the selection from the preview or timeline: outside its `origin` area the elements hang at the
 * pointer (the caller undoes the move) and can be dropped onto a library section (`target`).
 */
export function trackLibraryDrag(editor: Editor, x: number, y: number, origin: Element | null) {
	const el = document.elementFromPoint(x, y);
	const outside = !!origin && !(el && origin.contains(el));
	const target = outside ? libraryTargetOf(el) : null;
	const items = editor.selectedItems;
	const primary = editor.selectedItem ?? items[0];
	libraryUi.dropTarget = target;
	if (!outside || !primary) libraryUi.ghost = null;
	else {
		libraryUi.ghostAt = { x, y };
		if (libraryUi.ghost?.target !== target || !libraryUi.ghost) {
			libraryUi.ghost = { items, label: entryName(itemLabel(primary, editor), items.length), target };
		}
	}
	springOpen(outside ? el : null);
	return { outside, target };
}

export function endLibraryDrag() {
	libraryUi.dropTarget = null;
	libraryUi.ghost = null;
	springOpen(null);
}
