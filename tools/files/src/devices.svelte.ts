import { deviceTraits } from '@in-browser/files/p2p/names.js';
import { m } from '#lib/i18n/index.js';

// Which of the sync dialogs of Files is open (placed once in Home.svelte)

export type DevicesDialog = 'sync' | 'explain' | 'setup' | 'pair' | 'join' | 'scope';

export const devicesUi = $state<{
	dialog: DevicesDialog | null;
	/** Key from a pairing link or typed */
	joinCode: string;
	/** Folder whose exclusion is being asked about */
	exclude: string | null;
	/** Dialog to return to when the current one closes (the sync dialog, for those opened from it) */
	back: DevicesDialog | null;
}>({ dialog: null, joinCode: '', exclude: null, back: null });

export function openDevicesDialog(dialog: DevicesDialog | null) {
	if (devicesUi.dialog === 'sync' && dialog && dialog !== 'sync') devicesUi.back = 'sync';
	if (!dialog || dialog === 'sync') devicesUi.back = null;
	devicesUi.dialog = dialog;
}

/** Closes the open dialog (back to the sync dialog if it was opened from there) */
export function closeDevicesDialog() {
	devicesUi.dialog = devicesUi.back;
	devicesUi.back = null;
}

/** Suggested name of this device, e.g. “Chrome on Windows” */
export function suggestedName(): string {
	const { browser, system } = deviceTraits(navigator.userAgent);
	const systemName = system === 'Android phone' ? m.devices.phone : system === 'Android tablet' ? m.devices.tablet : system;
	return m.devices.suggestion(browser, systemName);
}

/** Text with `**bold**` parts, split for rendering */
export function boldParts(text: string): { text: string; bold: boolean }[] {
	return text.split('**').map((part, i) => ({ text: part, bold: i % 2 === 1 }));
}
