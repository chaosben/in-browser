import type { Link } from './link.js';

// How devices find each other: rooms, identified by a hash of a secret. Every other device in the same room shows up
// as a Link. Trystero over public Nostr relays in the app (`trystero.ts`), an in-page hub in the browser specs.

export interface Network {
	join(roomId: string, password: string): NetworkRoom;
}

export interface NetworkRoom {
	/** Called for every device that connects (also for those already there) */
	onLink(handler: (link: Link, peerId: string) => void): void;
	/** A device is in the room but no direct connection came about (e.g. blocked by the network) */
	onUnreachable?(handler: (peerId: string) => void): void;
	leave(): void;
}
