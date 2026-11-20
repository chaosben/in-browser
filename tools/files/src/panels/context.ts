import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
import type { ConnectionView } from '@in-browser/files/sources/connections.svelte.js';
import type { ShareView } from '@in-browser/files/p2p/view.js';
import type { Item } from '#lib/items.js';

// What the side panels of Files (folders – with the connected ones and the trash –, shares) get from the page

export interface FilesPanelContext {
	/** The open folder */
	current(): string;
	/** Goes to a folder */
	navigate(path: string): void;
	/** The trash is shown (the last entry of the panel “Folders”) */
	trashOpen(): boolean;
	openTrash(): void;
	/** Menu of the trash's entry */
	trashMenu(): MenuEntry[];
	/** Own entries dropped onto the trash: deleted (with “Undo”) */
	dropOnTrash(paths: string[]): void;
	/** Panels are full-screen sheets (phones): they close after a jump */
	sheet(): boolean;
	dropItems(paths: string[], folder: string, copy: boolean): void;
	dropFiles(data: DataTransfer, folder: string): void;
	/** Menu of “My files” */
	rootMenu(): MenuEntry[];
	/** Menu of a folder in a tree (the same actions as in the list) */
	folderMenu(item: Item): MenuEntry[];
	connectionMenu(connection: ConnectionView): MenuEntry[];
	shareMenu(share: ShareView): MenuEntry[];
	/** The dialog of a share (link, end) */
	openShare(share: ShareView): void;
	/** “Share a folder …” */
	shareNew(): void;
}
