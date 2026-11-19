// Keyboard shortcuts of the tools stay out of the way while someone types.

/** Whether a key event's target is a form field or editable text (shortcuts leave it alone) */
export function inTextField(target: EventTarget | null): boolean {
	return target instanceof Element && !!target.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"])');
}
