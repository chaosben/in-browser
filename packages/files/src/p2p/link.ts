// A connection to one other device, as the P2P sync needs it: ordered binary frames in both directions. Trystero
// provides it in the app (`room.svelte.ts`), the browser specs a plain RTCDataChannel – the sync doesn't care.

export interface Link {
	/** Resolves once the frame is handed over (and the send buffer has room again: backpressure) */
	send(frame: Uint8Array<ArrayBuffer>): Promise<void>;
	onFrame(handler: (frame: Uint8Array<ArrayBuffer>) => void): () => void;
	onClose(handler: () => void): () => void;
	close(): void;
	/** DTLS fingerprints of both ends, the same string on both sides (binds the sign-in to this connection) */
	fingerprints(): string;
	/** How the connection runs (diagnostics) */
	stats?(): Promise<ConnectionStats>;
}

export interface ConnectionStats {
	/** `host`: directly in the local network, `srflx`/`prflx`: through NAT (via STUN), `relay`: TURN */
	type: string;
	/** Round-trip time in ms */
	rtt: number | null;
}

/** Type and round-trip time of the connection in use */
export async function connectionStats(connection: RTCPeerConnection): Promise<ConnectionStats> {
	const report = await connection.getStats();
	let pair: (RTCIceCandidatePairStats & { localCandidateId?: string }) | undefined;
	report.forEach((entry) => {
		if (entry.type === 'candidate-pair' && entry.nominated && entry.state === 'succeeded') pair = entry;
	});
	const local = pair?.localCandidateId ? (report.get(pair.localCandidateId) as { candidateType?: string } | undefined) : undefined;
	const rtt = pair?.currentRoundTripTime;
	return { type: local?.candidateType ?? 'unknown', rtt: rtt === undefined ? null : Math.round(rtt * 1000) };
}

/** `a=fingerprint:` lines of an SDP, normalized */
export function sdpFingerprints(sdp: string | undefined): string[] {
	return [...(sdp ?? '').matchAll(/^a=fingerprint:(\S+) (\S+)/gm)].map(([, algorithm, value]) => `${algorithm.toLowerCase()} ${value.toUpperCase()}`);
}

/** Both ends' fingerprints of a connection in an order that doesn't depend on the side */
export function connectionFingerprints(connection: RTCPeerConnection): string {
	const local = sdpFingerprints(connection.localDescription?.sdp);
	const remote = sdpFingerprints(connection.remoteDescription?.sdp);
	return [...new Set([...local, ...remote])].sort().join('|');
}

/** Link over one RTCDataChannel (browser specs; frames must stay below the channel's message size limit) */
export function channelLink(channel: RTCDataChannel, connection: RTCPeerConnection): Link {
	channel.binaryType = 'arraybuffer';
	channel.bufferedAmountLowThreshold = 1 << 20;
	const frameHandlers = new Set<(frame: Uint8Array<ArrayBuffer>) => void>();
	const closeHandlers = new Set<() => void>();
	channel.addEventListener('message', (e) => {
		const frame = new Uint8Array(e.data as ArrayBuffer);
		for (const handler of frameHandlers) handler(frame);
	});
	channel.addEventListener('close', () => closeHandlers.forEach((handler) => handler()));
	return {
		async send(frame) {
			if (channel.readyState !== 'open') throw new Error('Link closed');
			channel.send(frame);
			if (channel.bufferedAmount > 4 << 20) {
				await new Promise<void>((resolve) => channel.addEventListener('bufferedamountlow', () => resolve(), { once: true }));
			}
		},
		onFrame(handler) {
			frameHandlers.add(handler);
			return () => frameHandlers.delete(handler);
		},
		onClose(handler) {
			closeHandlers.add(handler);
			return () => closeHandlers.delete(handler);
		},
		close: () => channel.close(),
		fingerprints: () => connectionFingerprints(connection),
		stats: () => connectionStats(connection)
	};
}
