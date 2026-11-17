// Messages between the starter and the sync process it runs (Node IPC channel)

/** Starter → sync process */
export type ToPeer = { type: 'stop' };

/** Sync process → starter */
export type FromPeer =
	/** A device answered with another protocol version: look for an update now */
	{ type: 'outdated'; version: number };

/** Exit code of the sync process when its device was removed from the group (the starter doesn't restart it) */
export const EXIT_REMOVED = 3;
