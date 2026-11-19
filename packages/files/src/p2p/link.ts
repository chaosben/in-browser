// A connection to one other device, as the P2P sync needs it: ordered binary frames in both directions. Trystero
// provides it in the app (`trystero.ts`), the browser specs a plain RTCDataChannel (`testing.ts`) – the sync doesn't care.

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
