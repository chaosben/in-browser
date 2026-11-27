// What belongs to the page shown and has to go with it. Pages change without reloading, so state kept in modules
// outlives the page that set it: a question asked by an editor would show up in the next tool and answer into a
// page that is gone. Modules holding such state register how to let go of it (`onLeavePage`, once, at module
// level); the app calls `leavePage()` before another page is shown (root layout, `beforeNavigate`).
// Not for what belongs to the tab (toasts, the syncs) or to a component (its own cleanup does that).

const leavers = new Set<() => void>();

export function onLeavePage(leave: () => void): void {
	leavers.add(leave);
}

export function leavePage(): void {
	for (const leave of leavers) leave();
}
